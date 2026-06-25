import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const type = searchParams.get("type"); // 'pending_approvals', 'new_reports', 'all'

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "user_id required" },
        { status: 400 }
      );
    }

    let pendingCount = 0;
    let newReportsCount = 0;
    let notifications: any[] = [];

    // Get pending approvals (for managers)
    if (!type || type === "pending_approvals" || type === "all") {
      const { data, count, error } = await supabase
        .from("activity_logs")
        .select("id, title, user_name, user_id, activity_date, created_at", { count: "exact" })
        .eq("review_status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        pendingCount = count || 0;
        notifications.push(
          ...data.map((item) => ({
            id: `pending-${item.id}`,
            type: "pending_approval",
            title: `รายงานใหม่รอการอนุมัติ: ${item.title}`,
            message: `จาก ${item.user_name} เมื่อ ${new Date(item.created_at).toLocaleString("th-TH")}`,
            activityId: item.id,
            severity: "high",
            timestamp: item.created_at,
            read: false,
          }))
        );
      }
    }

    // Get new reports from today
    if (!type || type === "new_reports" || type === "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];

      const { data, count, error } = await supabase
        .from("activity_logs")
        .select("id, title, user_name, department, activity_date, created_at", { count: "exact" })
        .gte("activity_date", todayStr)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        newReportsCount = count || 0;
        notifications.push(
          ...data.map((item) => ({
            id: `new-${item.id}`,
            type: "new_report",
            title: `กิจกรรมใหม่: ${item.title}`,
            message: `จากแผนก${item.department} - ${item.user_name}`,
            activityId: item.id,
            severity: "info",
            timestamp: item.created_at,
            read: false,
          }))
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: notifications,
      summary: {
        pendingApprovals: pendingCount,
        newReports: newReportsCount,
        total: pendingCount + newReportsCount,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// POST: Mark notification as read
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { notification_id, user_id } = body;

    if (!notification_id || !user_id) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // In a real system, this would update a notifications_read table
    // For now, we just return success
    return NextResponse.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
