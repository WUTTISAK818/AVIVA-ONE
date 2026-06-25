import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    const body = await req.json();
    const { activity_id, action, reason, user_id, user_name } = body;

    // Validate input
    if (!activity_id || !action || !user_id) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected", "sent_back"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    // Get current activity status
    const { data: activity, error: getError } = await supabase
      .from("activity_logs")
      .select("id, review_status")
      .eq("id", activity_id)
      .single();

    if (getError || !activity) {
      return NextResponse.json(
        { success: false, error: "Activity not found" },
        { status: 404 }
      );
    }

    const currentStatus = activity.review_status || "pending";
    const newStatus = action === "approved" ? "approved" : action === "rejected" ? "rejected" : "pending";

    // Update activity_logs with approval info
    const { error: updateError } = await supabase
      .from("activity_logs")
      .update({
        review_status: newStatus,
        approved_by: user_id,
        approved_by_name: user_name,
        approved_date: new Date().toISOString(),
        approval_reason: reason || null,
      })
      .eq("id", activity_id);

    if (updateError) {
      throw updateError;
    }

    // Record approval history (audit log)
    const { error: historyError } = await supabase
      .from("activity_approval_history")
      .insert({
        activity_id,
        action,
        approved_by: user_id,
        approved_by_name: user_name,
        approval_date: new Date().toISOString(),
        reason: reason || null,
        previous_status: currentStatus,
        new_status: newStatus,
      });

    if (historyError) {
      throw historyError;
    }

    return NextResponse.json({
      success: true,
      message: `Activity ${action} by ${user_name}`,
      data: {
        activity_id,
        new_status: newStatus,
        approved_by: user_name,
        approved_date: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Approval action error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// GET approval history for an activity
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    const { searchParams } = new URL(req.url);
    const activity_id = searchParams.get("activity_id");

    if (!activity_id) {
      return NextResponse.json(
        { success: false, error: "activity_id required" },
        { status: 400 }
      );
    }

    // Fetch approval history
    const { data: history, error } = await supabase
      .from("activity_approval_history")
      .select("*")
      .eq("activity_id", activity_id)
      .order("approval_date", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: history || [],
      count: history?.length || 0,
    });
  } catch (error) {
    console.error("Get approval history error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
