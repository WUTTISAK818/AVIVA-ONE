// src/lib/api-error-handler.ts
/**
 * API Error Handler
 * Handles rate limits, prompt size errors, and implements intelligent retry logic
 */

import { compressContextForAPI } from "./prompt-compression";

export interface APIError {
  status: number;
  message: string;
  code?: string;
  isRetryable: boolean;
  suggestedAction: string;
}

export interface RetryStrategy {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
};

/**
 * Parse API error response and determine if it's retryable
 */
export function parseAPIError(error: any): APIError {
  const status = error.status || error.statusCode || 500;
  const message = error.message || "Unknown error";
  const code = error.code || error.type || "unknown";

  // Determine if error is retryable
  let isRetryable = false;
  let suggestedAction = "";

  if (status === 429) {
    // Rate limit
    isRetryable = true;
    suggestedAction =
      "Rate limit hit. Switch to cheaper model or wait before retrying.";
  } else if (
    status === 400 &&
    message.toLowerCase().includes("prompt is too long")
  ) {
    // Prompt too long - can retry with compression
    isRetryable = true;
    suggestedAction = "Compress context and retry";
  } else if (status === 401 || status === 403) {
    // Auth error - not retryable
    isRetryable = false;
    suggestedAction = "Check API key and permissions";
  } else if (status === 500 || status === 502 || status === 503) {
    // Server error - retryable
    isRetryable = true;
    suggestedAction = "Server error. Retry after delay.";
  } else if (status === 408 || status === 504) {
    // Timeout - retryable
    isRetryable = true;
    suggestedAction = "Request timeout. Retry with compression.";
  }

  return {
    status,
    message,
    code,
    isRetryable,
    suggestedAction,
  };
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(
  attempt: number,
  strategy: RetryStrategy
): number {
  const delay =
    strategy.initialDelayMs * Math.pow(strategy.backoffMultiplier, attempt - 1);
  return Math.min(delay, strategy.maxDelayMs);
}

/**
 * Retry handler with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  strategy: RetryStrategy = DEFAULT_RETRY_STRATEGY,
  operationName: string = "API call"
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const parsedError = parseAPIError(error);

      if (!parsedError.isRetryable || attempt === strategy.maxAttempts) {
        throw error;
      }

      const delayMs = calculateBackoffDelay(attempt, strategy);
      console.log(
        `⏳ ${operationName} failed (attempt ${attempt}/${strategy.maxAttempts}). ` +
          `Retrying in ${delayMs}ms... (${parsedError.suggestedAction})`
      );

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Special handler for "Prompt is too long" errors
 * Attempts to compress context and retry
 */
export async function retryWithCompression(
  operation: (context: string) => Promise<any>,
  originalContext: string,
  isManager: boolean,
  strategy: RetryStrategy = DEFAULT_RETRY_STRATEGY
): Promise<any> {
  let lastError: any;
  let context = originalContext;

  for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
    try {
      return await operation(context);
    } catch (error) {
      lastError = error;
      const parsedError = parseAPIError(error);

      // If it's a "prompt too long" error, try compression
      if (
        parsedError.message.toLowerCase().includes("prompt is too long") &&
        attempt < strategy.maxAttempts
      ) {
        console.log(
          `📦 Prompt too long, compressing... (attempt ${attempt}/${strategy.maxAttempts})`
        );

        const compressed = compressContextForAPI(
          context,
          isManager,
          800 // target smaller size on retry
        );

        console.log(
          `✅ Compressed from ${compressed.originalSize} to ${compressed.compressedSize} tokens (${compressed.reductionPercent}% reduction)`
        );

        context = compressed.compressed;

        // Wait before retry
        const delayMs = calculateBackoffDelay(attempt, strategy);
        await sleep(delayMs);

        continue;
      }

      // If not retryable or max attempts reached
      if (!parsedError.isRetryable || attempt === strategy.maxAttempts) {
        throw error;
      }

      // Standard retry with backoff for other errors
      const delayMs = calculateBackoffDelay(attempt, strategy);
      console.log(
        `⏳ Retrying in ${delayMs}ms... (${parsedError.suggestedAction})`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Circuit breaker pattern for rate-limited endpoints
 * Temporarily disables API calls if hitting consistent rate limits
 */
export class RateLimitCircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private lastFailureTime: number = 0;

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeMs: number = 60000
  ) {}

  async execute<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    // Check if circuit should recover
    if (this.state === "open") {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure > this.recoveryTimeMs) {
        console.log("🟡 Circuit breaker: Attempting recovery...");
        this.state = "half-open";
      } else {
        throw new Error(
          `Circuit breaker OPEN. Rate limited. Retry in ${Math.ceil((this.recoveryTimeMs - timeSinceFailure) / 1000)}s`
        );
      }
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordSuccess(): void {
    this.successCount++;
    if (this.state === "half-open" && this.successCount >= 2) {
      console.log("🟢 Circuit breaker: Recovered");
      this.state = "closed";
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      console.log("🔴 Circuit breaker: OPENING (too many rate limits)");
      this.state = "open";
    }
  }

  getStatus(): "closed" | "open" | "half-open" {
    return this.state;
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
  }
}

/**
 * User-friendly error messages for frontend
 */
export function getUserFriendlyErrorMessage(error: APIError): string {
  const { status, message } = error;

  if (status === 429) {
    return "🔴 ระบบ AI ใช้ด้วยคนจำนวนมาก กรุณารอสักครู่แล้วลองใหม่ค่ะ";
  }

  if (status === 400 && message.toLowerCase().includes("prompt is too long")) {
    return "📦 ข้อความของคุณยาวเกินไป กรุณาย่อการค้นหาให้สั้นลงค่ะ";
  }

  if (status === 401 || status === 403) {
    return "🔐 เกิดข้อผิดพลาดการยืนยันตัวตน กรุณา login ใหม่ค่ะ";
  }

  if (status === 500 || status === 502 || status === 503) {
    return "⚙️ เซิร์ฟเวอร์มีปัญหาชั่วคราว กรุณาลองใหม่ในไม่ช่วงกว่านาทีค่ะ";
  }

  if (status === 408 || status === 504) {
    return "⏱️ การขอใช้เวลานานเกินไป กรุณาลองใหม่ค่ะ";
  }

  return "❌ เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบค่ะ";
}

/**
 * Log error for monitoring/debugging
 */
export function logAPIError(
  error: APIError,
  context: {
    timestamp: Date;
    userId?: string;
    operation: string;
    retryCount?: number;
  }
): void {
  const logEntry = {
    timestamp: context.timestamp.toISOString(),
    userId: context.userId,
    operation: context.operation,
    error: {
      status: error.status,
      message: error.message,
      code: error.code,
      isRetryable: error.isRetryable,
    },
    retryCount: context.retryCount || 0,
  };

  // In production, send to logging service (e.g., Sentry, LogRocket)
  console.error("[API Error Log]", JSON.stringify(logEntry, null, 2));
}
