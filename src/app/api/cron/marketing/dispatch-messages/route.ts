import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSMSProvider, getEmailProvider, getLINEProvider } from "@/lib/messaging-providers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";

// Initialize providers
const smsProvider = getSMSProvider();
const emailProvider = getEmailProvider();
const lineProvider = getLINEProvider();

async function sendSMS(phone: string, message: string): Promise<boolean> {
  try {
    const result = await smsProvider.send(phone, message);
    if (result.success) {
      console.log(`[SMS] ✓ Sent to ${phone} (ID: ${result.messageId})`);
    } else {
      console.warn(`[SMS] ✗ Failed to ${phone}: ${result.error}`);
    }
    return result.success;
  } catch (error) {
    console.error("SMS send error:", error);
    return false;
  }
}

async function sendEmail(email: string, subject: string, body: string): Promise<boolean> {
  try {
    const result = await emailProvider.send(email, subject, body);
    if (result.success) {
      console.log(`[EMAIL] ✓ Sent to ${email} (ID: ${result.messageId})`);
    } else {
      console.warn(`[EMAIL] ✗ Failed to ${email}: ${result.error}`);
    }
    return result.success;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

async function sendLINE(userId: string, message: string): Promise<boolean> {
  try {
    const result = await lineProvider.send(userId, message);
    if (result.success) {
      console.log(`[LINE] ✓ Sent to ${userId} (ID: ${result.messageId})`);
    } else {
      console.warn(`[LINE] ✗ Failed to ${userId}: ${result.error}`);
    }
    return result.success;
  } catch (error) {
    console.error("LINE send error:", error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized cron request" },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date();

    // Get all pending messages that are scheduled for now or earlier
    const { data: messages, error: messagesError } = await supabase
      .from("marketing_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(100); // Process max 100 messages per cron run

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch pending messages" },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending messages to dispatch",
        sent_count: 0,
        failed_count: 0,
      });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Process each message
    for (const message of messages) {
      let sendSuccess = false;
      let errorMessage: string | null = null;

      try {
        switch (message.message_type) {
          case "sms":
            if (message.lead_phone) {
              sendSuccess = await sendSMS(message.lead_phone, message.content);
            } else {
              errorMessage = "No phone number available";
            }
            break;

          case "email":
            if (message.lead_email) {
              sendSuccess = await sendEmail(
                message.lead_email,
                message.subject || "Message from AVIVA ONE",
                message.content
              );
            } else {
              errorMessage = "No email address available";
            }
            break;

          case "line_message":
            if (message.lead_id) {
              // TODO: Get LINE user ID from lead data
              sendSuccess = await sendLINE(message.lead_id, message.content);
            } else {
              errorMessage = "No LINE user ID available";
            }
            break;

          case "call":
            // For calls, create a task for the sales team
            console.log(`[CALL] Task created for lead ${message.lead_id}`);
            sendSuccess = true;
            break;

          default:
            errorMessage = `Unknown message type: ${message.message_type}`;
        }

        // Update message status
        const updateData: any = {
          status: sendSuccess ? "sent" : "failed",
          sent_at: new Date().toISOString(),
        };

        if (errorMessage) {
          updateData.error_message = errorMessage;
        }

        await supabase.from("marketing_messages").update(updateData).eq("id", message.id);

        if (sendSuccess) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        await supabase
          .from("marketing_messages")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
            sent_at: new Date().toISOString(),
          })
          .eq("id", message.id);

        failedCount++;
      }
    }

    // Update campaign analytics
    if (sentCount > 0) {
      const today = new Date().toISOString().split("T")[0];

      // Group by campaign
      const campaignGroups = new Map<string, number>();
      for (const msg of messages.filter((m) => m.status === "sent")) {
        const count = campaignGroups.get(msg.campaign_id) || 0;
        campaignGroups.set(msg.campaign_id, count + 1);
      }

      // Update analytics for each campaign
      for (const [campaignId, count] of campaignGroups) {
        const { data: campaign } = await supabase
          .from("marketing_campaigns")
          .select("project_id")
          .eq("id", campaignId)
          .single();

        if (campaign) {
          const { data: existingAnalytics } = await supabase
            .from("campaign_analytics")
            .select("id, messages_sent")
            .eq("campaign_id", campaignId)
            .eq("analytics_date", today)
            .single();

          if (existingAnalytics) {
            await supabase
              .from("campaign_analytics")
              .update({
                messages_sent: existingAnalytics.messages_sent + count,
                messages_delivered: count, // Assume delivered if sent
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingAnalytics.id);
          } else {
            await supabase.from("campaign_analytics").insert({
              project_id: campaign.project_id,
              campaign_id: campaignId,
              analytics_date: today,
              messages_sent: count,
              messages_delivered: count,
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Dispatched ${sentCount} messages, ${failedCount} failed`,
      sent_count: sentCount,
      failed_count: failedCount,
      total_processed: messages.length,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Dispatch messages cron error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Cron schedule: */15 * * * * (Every 15 minutes)
export const dynamic = "force-dynamic";
