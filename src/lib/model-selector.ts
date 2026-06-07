// src/lib/model-selector.ts
/**
 * Model Selection Engine
 * Automatically selects the best model based on current API quota usage
 */

export interface ModelConfig {
  name: string;
  provider: "openai" | "claude";
  maxTokens: number;
  costPer1kTokens: number; // approximate cost in USD
  speedScore: number; // 1-10 (higher = faster)
  qualityScore: number; // 1-10 (higher = better)
}

export interface QuotaInfo {
  totalTokensWeek: number;
  usedTokensWeek: number;
  usagePercent: number;
  tokensRemaining: number;
}

export interface ModelSelectionResult {
  model: string;
  provider: "openai" | "claude";
  maxTokens: number;
  reason: string;
  expectedCostPerRequest: number;
  fallbackModel?: string;
}

// Define available models
const MODELS: Record<string, ModelConfig> = {
  "gpt-4": {
    name: "GPT-4",
    provider: "openai",
    maxTokens: 2048,
    costPer1kTokens: 0.03, // input cost
    speedScore: 4,
    qualityScore: 10,
  },
  "gpt-4-turbo": {
    name: "GPT-4 Turbo",
    provider: "openai",
    maxTokens: 2048,
    costPer1kTokens: 0.01,
    speedScore: 7,
    qualityScore: 9,
  },
  "gpt-4o-mini": {
    name: "GPT-4o Mini",
    provider: "openai",
    maxTokens: 2048,
    costPer1kTokens: 0.00015,
    speedScore: 9,
    qualityScore: 7,
  },
  "gpt-3.5-turbo": {
    name: "GPT-3.5 Turbo",
    provider: "openai",
    maxTokens: 2048,
    costPer1kTokens: 0.0005,
    speedScore: 10,
    qualityScore: 5,
  },
  "claude-opus-4-20250514": {
    name: "Claude Opus 4",
    provider: "claude",
    maxTokens: 2048,
    costPer1kTokens: 0.015,
    speedScore: 4,
    qualityScore: 10,
  },
  "claude-3-5-sonnet-20241022": {
    name: "Claude 3.5 Sonnet",
    provider: "claude",
    maxTokens: 2048,
    costPer1kTokens: 0.003,
    speedScore: 8,
    qualityScore: 8,
  },
  "claude-3-5-haiku-20241022": {
    name: "Claude 3.5 Haiku",
    provider: "claude",
    maxTokens: 1024,
    costPer1kTokens: 0.00008,
    speedScore: 10,
    qualityScore: 6,
  },
};

/**
 * Default model hierarchy - tries in order until one succeeds
 * Currently uses OpenAI (primary) with Claude fallback option
 */
const DEFAULT_MODEL_HIERARCHY = [
  "gpt-4o-mini", // Current: Fast, cheap, good quality
  "gpt-3.5-turbo", // Fallback: Very cheap, decent quality
  "gpt-4-turbo", // Premium: Better quality if quota allows
];

const CLAUDE_MODEL_HIERARCHY = [
  "claude-3-5-sonnet-20241022", // Balanced
  "claude-3-5-haiku-20241022", // Cheap fallback
  "claude-opus-4-20250514", // Premium
];

/**
 * Select best model based on quota usage
 * Strategy:
 * - Low usage (< 50%): Use premium models for best quality
 * - Medium usage (50-80%): Use balanced models
 * - High usage (> 80%): Use cheapest models to extend quota
 */
export function selectModelByQuota(
  quotaInfo: QuotaInfo,
  preferredProvider: "openai" | "claude" = "openai"
): ModelSelectionResult {
  const { usagePercent } = quotaInfo;

  let selectedModel: string;
  let reason: string;
  let hierarchy: string[];

  if (preferredProvider === "claude") {
    hierarchy = CLAUDE_MODEL_HIERARCHY;
  } else {
    hierarchy = DEFAULT_MODEL_HIERARCHY;
  }

  // Strategy: Select model based on remaining quota
  if (usagePercent <= 40) {
    // Plenty of quota: use premium model for best quality
    selectedModel = hierarchy[2] || hierarchy[0]; // Opus/GPT-4
    reason = `Quota low (${usagePercent}%) - using premium model for quality`;
  } else if (usagePercent <= 70) {
    // Medium quota: use balanced model
    selectedModel = hierarchy[0]; // Sonnet/GPT-4o-mini
    reason = `Quota moderate (${usagePercent}%) - using balanced model`;
  } else if (usagePercent <= 90) {
    // High quota: use cheap model to extend
    selectedModel = hierarchy[1]; // Haiku/GPT-3.5
    reason = `Quota high (${usagePercent}%) - using efficient model`;
  } else {
    // Critical: use absolute cheapest
    selectedModel = hierarchy[1]; // Haiku/GPT-3.5
    reason = `Quota critical (${usagePercent}%) - using cheapest model`;
  }

  const modelConfig = MODELS[selectedModel];
  const expectedCostPerRequest =
    (modelConfig.maxTokens * modelConfig.costPer1kTokens) / 1000;

  return {
    model: selectedModel,
    provider: modelConfig.provider,
    maxTokens: modelConfig.maxTokens,
    reason,
    expectedCostPerRequest,
    fallbackModel: hierarchy[(hierarchy.indexOf(selectedModel) + 1) % hierarchy.length],
  };
}

/**
 * Get model config by name
 */
export function getModelConfig(modelName: string): ModelConfig | null {
  return MODELS[modelName] || null;
}

/**
 * Suggest best model for specific use case
 */
export function suggestModelForContext(
  contextLength: number,
  isManager: boolean,
  qualityRequired: "low" | "medium" | "high" = "medium"
): ModelSelectionResult {
  let model: string;

  // Quality-based selection
  if (qualityRequired === "high") {
    model = "gpt-4o-mini"; // Better understanding of complex context
  } else if (qualityRequired === "medium") {
    model = "gpt-4o-mini"; // Balanced
  } else {
    model = "gpt-3.5-turbo"; // Speed over quality
  }

  // For very large contexts (manager with full financial data)
  if (isManager && contextLength > 1500) {
    model = "gpt-4o-mini"; // Better at handling large contexts
  }

  const config = MODELS[model]!;

  return {
    model,
    provider: config.provider,
    maxTokens: config.maxTokens,
    reason: `Selected for ${qualityRequired} quality + ${isManager ? "manager" : "staff"} context`,
    expectedCostPerRequest:
      (config.maxTokens * config.costPer1kTokens) / 1000,
  };
}

/**
 * Calculate estimated quota hours remaining
 */
export function estimateQuotaHoursRemaining(
  quotaInfo: QuotaInfo,
  avgRequestsPerHour: number = 20,
  avgTokensPerRequest: number = 1000
): {
  hoursRemaining: number;
  requestsRemaining: number;
  recommendation: string;
} {
  const { tokensRemaining } = quotaInfo;
  const tokensPerHour = avgRequestsPerHour * avgTokensPerRequest;
  const hoursRemaining = Math.floor(tokensRemaining / tokensPerHour);
  const requestsRemaining = Math.floor(tokensRemaining / avgTokensPerRequest);

  let recommendation = "";

  if (hoursRemaining < 1) {
    recommendation = "🔴 CRITICAL: Switch to cheapest model NOW";
  } else if (hoursRemaining < 4) {
    recommendation = "🟠 HIGH: Use efficient models (GPT-3.5 / Haiku)";
  } else if (hoursRemaining < 12) {
    recommendation = "🟡 MEDIUM: Be mindful of prompt size";
  } else {
    recommendation = "🟢 GOOD: Can use higher-quality models";
  }

  return {
    hoursRemaining,
    requestsRemaining,
    recommendation,
  };
}

/**
 * Parse OpenAI usage response and return quota info
 * Requires: https://api.openai.com/dashboard/account/api-keys with account info
 */
export function parseOpenAIQuotaResponse(
  quotaResponse: any
): QuotaInfo | null {
  try {
    // This is the expected API response format from OpenAI
    const usage = quotaResponse.total_usage || 0;
    const limit = quotaResponse.total_limit || 1000000; // fallback

    return {
      totalTokensWeek: limit,
      usedTokensWeek: usage,
      usagePercent: Math.round((usage / limit) * 100),
      tokensRemaining: limit - usage,
    };
  } catch {
    return null;
  }
}

/**
 * Create a rate-limit-aware wrapper function
 * Automatically downgrades model if hit rate limits
 */
export function createModelWithFallback(
  primaryModel: string,
  fallbackModel: string = "gpt-3.5-turbo"
) {
  return async (apiCall: (model: string) => Promise<any>) => {
    try {
      return await apiCall(primaryModel);
    } catch (error: any) {
      if (
        error.status === 429 ||
        error.message?.includes("rate limit") ||
        error.message?.includes("quota")
      ) {
        console.log(
          `⚠️ Rate limit hit on ${primaryModel}, falling back to ${fallbackModel}`
        );
        return await apiCall(fallbackModel);
      }
      throw error;
    }
  };
}

/**
 * Recommended configuration for AVIVA-ONE
 */
export const AVIVA_RECOMMENDED_CONFIG = {
  // Current optimal settings based on 72% quota usage
  primaryModel: "gpt-4o-mini",
  fallbackModel: "gpt-3.5-turbo",
  maxRequestsPerMinute: 10,
  maxTokensPerRequest: 2000,
  recommendedSystemContextSize: 900, // tokens (after compression)
  recommendedHistoryMessages: 2, // instead of 5
  responseTimeout: 20000, // ms
  retryAttempts: 2,
  retryBackoffMs: 1000,
};
