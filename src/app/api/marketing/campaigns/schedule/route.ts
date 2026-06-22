import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface SequenceMessage {
  delay_hours: number;
  type: "sms" | "email" | "line_message" | "call";
  template_id: string;
}

interface SequenceConfig {
  messages: SequenceMessage[];
}

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid authorization" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify token and get user
    const { data: user, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user.user) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    // Check role
    const { data: userData } = await supabase
      .from("app_users")
      .select("role")
      .eq("id", user.user.id)
      .single();

    const userRole = userData?.role?.toLowerCase() || "";
    const isMarketingRole = ["marketing", "sales", "ceo", "coo", "admin"].includes(userRole);

    if (!isMarketingRole) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions. Marketing role required." },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const { campaignId, batchSize = 100, projectId = "aaaaaaaa-0000-0000-0000-000000000001" } = body;

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "campaignId is required" },
        { status: 400 }
      );
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("marketing_campaigns")
      .select("id, name, lead_status_filter, sequence_config, is_active")
      .eq("id", campaignId)
      .eq("project_id", projectId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (!campaign.is_active) {
      return NextResponse.json(
        { success: false, error: "Campaign is not active" },
        { status: 400 }
      );
    }

    // Get template mappings (for replacing template_id with actual content)
    const { data: templates } = await supabase
      .from("message_templates")
      .select("id, name, subject, body, message_type")
      .eq("project_id", projectId)
      .eq("is_active", true);

    const templateMap = new Map(templates?.map((t) => [t.id, t]) || []);

    // Get leads matching the filter status (placeholder - actual lead table TBD)
    // For now, return success with message about scheduling
    const { data: enrollments } = await supabase
      .from("lead_campaign_enrollments")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("status", "active")
      .limit(batchSize);

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No leads to enroll in this campaign batch",
        scheduled_count: 0,
        messages_scheduled: 0,
      });
    }

    // Parse sequence config
    const sequenceConfig = campaign.sequence_config as SequenceConfig;
    if (!sequenceConfig.messages || sequenceConfig.messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Campaign has no messages configured" },
        { status: 400 }
      );
    }

    // Schedule messages for each enrollment
    const messagesToSchedule = [];
    const now = new Date();

    for (const enrollment of enrollments) {
      for (const message of sequenceConfig.messages) {
        const template = templateMap.get(message.template_id);
        if (!template) continue;

        const scheduledTime = new Date(now.getTime() + message.delay_hours * 60 * 60 * 1000);

        messagesToSchedule.push({
          project_id: projectId,
          campaign_id: campaignId,
          lead_id: enrollment.id, // This would be the actual lead_id from enrollment
          message_type: message.type,
          subject: template.subject || null,
          content: template.body,
          scheduled_at: scheduledTime.toISOString(),
          status: "pending",
          created_by: user.user.id,
        });
      }
    }

    // Insert scheduled messages
    const { data: inserted, error: insertError } = await supabase
      .from("marketing_messages")
      .insert(messagesToSchedule)
      .select("id");

    if (insertError) {
      console.error("Error scheduling messages:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to schedule messages" },
        { status: 500 }
      );
    }

    // Update enrollment status
    for (const enrollment of enrollments) {
      await supabase
        .from("lead_campaign_enrollments")
        .update({ status: "active", current_message_index: 0 })
        .eq("id", enrollment.id);
    }

    // Log activity
    await supabase
      .from("daily_activity_log")
      .insert({
        project_id: projectId,
        activity_date: new Date().toISOString().split("T")[0],
        activity_type: "marketing_automation",
        category: "campaign_scheduling",
        performer_id: user.user.id,
        performer_name: "System",
        performer_department: "Marketing",
        description: `Scheduled ${inserted?.length || 0} marketing messages for campaign: ${campaign.name}`,
        reference_id: campaignId,
        reference_type: "marketing_campaigns",
        created_by: user.user.id,
      });

    return NextResponse.json({
      success: true,
      message: `Successfully scheduled ${inserted?.length || 0} messages`,
      scheduled_count: enrollments.length,
      messages_scheduled: inserted?.length || 0,
      campaign_id: campaignId,
    });
  } catch (error) {
    console.error("Schedule campaign error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
