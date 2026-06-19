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
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const rangeType = searchParams.get("range") || "day"; // day, week, month

    let startDate = dateStr;
    let endDate = dateStr;

    if (rangeType === "week") {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const sunday = new Date(date);
      sunday.setDate(date.getDate() - dayOfWeek);
      startDate = sunday.toISOString().split("T")[0];
      endDate = dateStr;
    } else if (rangeType === "month") {
      const date = new Date(dateStr);
      startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
      endDate = dateStr;
    }

    // Fetch all activities for the date range
    const { data: activities, error } = await supabase
      .from("daily_activity_log")
      .select("*")
      .eq("project_id", PROJECT_ID)
      .gte("activity_date", startDate)
      .lte("activity_date", endDate)
      .order("activity_date", { ascending: false });

    if (error) throw error;

    // Group by activity_type and activity_date
    const grouped = activities?.reduce(
      (acc, activity) => {
        const key = activity.activity_date;
        if (!acc[key]) {
          acc[key] = {
            date: key,
            sale: { count: 0, items: [], total_amount: 0 },
            construction: { count: 0, items: [], total_amount: 0 },
            finance: { count: 0, items: [], total_amount: 0 },
            approval: { count: 0, items: [], total_amount: 0 },
            hr: { count: 0, items: [], total_amount: 0 },
          };
        }

        const type = activity.activity_type;
        if (acc[key][type]) {
          acc[key][type].count += activity.quantity || 1;
          if (activity.amount) acc[key][type].total_amount += Number(activity.amount);
          acc[key][type].items.push({
            id: activity.id,
            category: activity.category,
            description: activity.description,
            performer_name: activity.performer_name,
            amount: activity.amount,
            created_at: activity.created_at,
          });
        }

        return acc;
      },
      {} as Record<string, any>
    );

    return NextResponse.json({
      success: true,
      data: grouped || {},
      range: { start: startDate, end: endDate, type: rangeType },
    });
  } catch (error) {
    console.error("Error fetching daily activities:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
    const body = await req.json();

    // Manual log entry
    const {
      activity_date,
      activity_type,
      category,
      performer_id,
      performer_name,
      performer_department,
      description,
      quantity = 1,
      amount,
      reference_id,
      reference_type,
    } = body;

    const { data, error } = await supabase
      .from("daily_activity_log")
      .insert([
        {
          activity_date,
          activity_type,
          category,
          performer_id,
          performer_name,
          performer_department,
          description,
          quantity,
          amount,
          reference_id,
          reference_type,
          project_id: PROJECT_ID,
          created_by: performer_id,
        },
      ])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error creating activity log:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
