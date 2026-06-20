import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") || new Date().getFullYear().toString();
    const month = searchParams.get("month") || (new Date().getMonth() + 1).toString();
    const employeeId = searchParams.get("employee_id");
    const department = searchParams.get("department");
    const activityType = searchParams.get("activity_type");

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);

    let query = supabase
      .from("daily_activity_log")
      .select("*")
      .gte("activity_date", startDate.toISOString().split("T")[0])
      .lte("activity_date", endDate.toISOString().split("T")[0]);

    if (employeeId) {
      query = query.eq("performer_id", employeeId);
    }
    if (department) {
      query = query.eq("performer_department", department);
    }
    if (activityType) {
      query = query.eq("activity_type", activityType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const grouped: Record<string, any[]> = {};
    (data || []).forEach((activity) => {
      const date = activity.activity_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(activity);
    });

    return NextResponse.json({
      success: true,
      data: grouped,
      month,
      year,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
