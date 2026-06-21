import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  messages_sent: number;
  messages_delivered: number;
  messages_failed: number;
  delivery_rate: number;
  responses_count: number;
  clicks_count: number;
  engagement_rate: number;
  conversions: number;
  conversion_rate: number;
  revenue_generated: number;
}

export async function GET(request: NextRequest) {
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
    const isMarketingRole = ["marketing", "ceo", "coo", "admin"].includes(userRole);

    if (!isMarketingRole) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions. Marketing role required." },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const campaignId = searchParams.get("campaignId");
    const projectId = searchParams.get("projectId") || "aaaaaaaa-0000-0000-0000-000000000001";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = supabase
      .from("campaign_analytics")
      .select("*")
      .eq("project_id", projectId);

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    if (startDate) {
      query = query.gte("analytics_date", startDate);
    }

    if (endDate) {
      query = query.lte("analytics_date", endDate);
    }

    const { data: analytics, error: analyticsError } = await query.order("analytics_date", {
      ascending: false,
    });

    if (analyticsError) {
      console.error("Error fetching analytics:", analyticsError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch analytics" },
        { status: 500 }
      );
    }

    // Get campaign details
    let campaignName = "All Campaigns";
    if (campaignId) {
      const { data: campaign } = await supabase
        .from("marketing_campaigns")
        .select("name")
        .eq("id", campaignId)
        .single();

      if (campaign) {
        campaignName = campaign.name;
      }
    }

    // Aggregate metrics
    const metrics: CampaignMetrics = {
      campaign_id: campaignId || "all",
      campaign_name: campaignName,
      messages_sent: 0,
      messages_delivered: 0,
      messages_failed: 0,
      delivery_rate: 0,
      responses_count: 0,
      clicks_count: 0,
      engagement_rate: 0,
      conversions: 0,
      conversion_rate: 0,
      revenue_generated: 0,
    };

    if (analytics && analytics.length > 0) {
      analytics.forEach((record: any) => {
        metrics.messages_sent += record.messages_sent || 0;
        metrics.messages_delivered += record.messages_delivered || 0;
        metrics.messages_failed += record.messages_failed || 0;
        metrics.responses_count += record.response_count || 0;
        metrics.clicks_count += record.click_count || 0;
        metrics.conversions += record.conversion_count || 0;
        metrics.revenue_generated += parseFloat(record.revenue_generated) || 0;
      });

      // Calculate rates
      if (metrics.messages_sent > 0) {
        metrics.delivery_rate = (metrics.messages_delivered / metrics.messages_sent) * 100;
        metrics.engagement_rate =
          ((metrics.responses_count + metrics.clicks_count) / metrics.messages_delivered) * 100 || 0;
        metrics.conversion_rate = (metrics.conversions / metrics.messages_sent) * 100;
      }
    }

    // Get trend data (daily breakdown)
    const trendData = (analytics || []).map((record: any) => ({
      date: record.analytics_date,
      sent: record.messages_sent || 0,
      delivered: record.messages_delivered || 0,
      responses: record.response_count || 0,
      conversions: record.conversion_count || 0,
      revenue: parseFloat(record.revenue_generated) || 0,
    }));

    // Get message type breakdown
    const { data: messageBreakdown } = await supabase
      .from("marketing_messages")
      .select("message_type, status")
      .eq("project_id", projectId)
      .eq("campaign_id", campaignId || "");

    const typeStats: Record<string, Record<string, number>> = {};
    (messageBreakdown || []).forEach((msg: any) => {
      if (!typeStats[msg.message_type]) {
        typeStats[msg.message_type] = { sent: 0, delivered: 0, failed: 0 };
      }
      typeStats[msg.message_type][msg.status] =
        (typeStats[msg.message_type][msg.status] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      metrics,
      trend: trendData,
      message_type_stats: typeStats,
      summary: {
        total_records: analytics?.length || 0,
        period_start: startDate || null,
        period_end: endDate || null,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Campaign analytics error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
