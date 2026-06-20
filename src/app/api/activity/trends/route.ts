import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");
    const department = searchParams.get("department");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from("daily_activity_log")
      .select("activity_date, activity_type, performer_department")
      .gte("activity_date", startDate.toISOString().split("T")[0]);

    if (department) {
      query = query.eq("performer_department", department);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Group by date
    const byDate: Record<string, Record<string, number>> = {};
    (data || []).forEach((activity) => {
      const date = activity.activity_date;
      if (!byDate[date]) {
        byDate[date] = { construction: 0, finance: 0, hr: 0, sales: 0 };
      }
      byDate[date][activity.activity_type]++;
    });

    // Calculate trends
    const dates = Object.keys(byDate).sort();
    const trends = dates.map((date) => ({
      date,
      ...byDate[date],
      total: Object.values(byDate[date]).reduce((a: number, b: number) => a + b, 0),
    }));

    return NextResponse.json({ success: true, data: trends });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
