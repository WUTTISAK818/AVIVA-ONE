// lib/messaging-providers.ts
// SMS, Email, LINE Bot integrations

interface SMSProvider {
  send(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

interface EmailProvider {
  send(email: string, subject: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

interface LINEProvider {
  send(userId: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// ============================================================
// BulkSMS Provider (for SMS)
// ============================================================
class BulkSMSProvider implements SMSProvider {
  private username: string;
  private password: string;
  private baseUrl = "https://api.bulksms.com/v1";

  constructor(username?: string, password?: string) {
    this.username = username || process.env.BULKSMS_USERNAME || "";
    this.password = password || process.env.BULKSMS_PASSWORD || "";
  }

  async send(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.username || !this.password) {
        console.warn("[BulkSMS] Credentials not configured, skipping");
        return { success: false, error: "BulkSMS credentials not configured" };
      }

      // Format phone number (remove non-digits, add country code if needed)
      const formattedPhone = this._formatPhone(phone);

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            `${this.username}:${this.password}`
          ).toString("base64")}`,
        },
        body: JSON.stringify({
          to: formattedPhone,
          body: message,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`BulkSMS error: ${error}`);
      }

      const data = (await response.json()) as any;
      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      console.error("[BulkSMS] Send error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private _formatPhone(phone: string): string {
    // Remove common formatting characters
    let cleaned = phone.replace(/[\s\-\(\)]/g, "");
    // If starts with 0 (Thailand), replace with +66
    if (cleaned.startsWith("0")) {
      cleaned = "+66" + cleaned.substring(1);
    }
    // If doesn't start with +, assume Thailand
    if (!cleaned.startsWith("+")) {
      cleaned = "+66" + cleaned;
    }
    return cleaned;
  }
}

// ============================================================
// SendGrid Provider (for Email)
// ============================================================
class SendGridProvider implements EmailProvider {
  private apiKey: string;
  private fromEmail: string;
  private baseUrl = "https://api.sendgrid.com/v3/mail/send";

  constructor(apiKey?: string, fromEmail?: string) {
    this.apiKey = apiKey || process.env.SENDGRID_API_KEY || "";
    this.fromEmail = fromEmail || process.env.EMAIL_FROM || "noreply@aviva.co.th";
  }

  async send(
    email: string,
    subject: string,
    body: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.apiKey) {
        console.warn("[SendGrid] API key not configured, skipping");
        return { success: false, error: "SendGrid API key not configured" };
      }

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email }],
            },
          ],
          from: {
            email: this.fromEmail,
            name: "AVIVA Private",
          },
          subject,
          content: [
            {
              type: "text/html",
              value: body,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid error: ${error}`);
      }

      // SendGrid returns 202 Accepted with no body on success
      const messageId = response.headers.get("x-message-id") || "unknown";
      return {
        success: true,
        messageId,
      };
    } catch (error) {
      console.error("[SendGrid] Send error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================================
// LINE Messaging API Provider
// ============================================================
class LINEProvider implements LINEProvider {
  private channelAccessToken: string;
  private baseUrl = "https://api.line.biz/v3/bot/message/push";

  constructor(channelAccessToken?: string) {
    this.channelAccessToken = channelAccessToken || process.env.LINE_ACCESS_TOKEN || "";
  }

  async send(userId: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.channelAccessToken) {
        console.warn("[LINE] Access token not configured, skipping");
        return { success: false, error: "LINE access token not configured" };
      }

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.channelAccessToken}`,
        },
        body: JSON.stringify({
          to: userId,
          messages: [
            {
              type: "text",
              text: message,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LINE error: ${error}`);
      }

      return {
        success: true,
        messageId: "line-msg-sent",
      };
    } catch (error) {
      console.error("[LINE] Send error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================================
// Factory to get providers based on configuration
// ============================================================
export function getSMSProvider(): SMSProvider {
  const provider = process.env.SMS_PROVIDER || "BULKSMS";
  if (provider === "BULKSMS") {
    return new BulkSMSProvider();
  }
  throw new Error(`Unknown SMS provider: ${provider}`);
}

export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER || "SENDGRID";
  if (provider === "SENDGRID") {
    return new SendGridProvider();
  }
  throw new Error(`Unknown email provider: ${provider}`);
}

export function getLINEProvider(): LINEProvider {
  return new LINEProvider();
}

// ============================================================
// Export provider classes for testing
// ============================================================
export { BulkSMSProvider, SendGridProvider, LINEProvider };
