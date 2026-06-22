import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "7");
    const department = searchParams.get("department");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from("daily_activity_log")
      .select("performer_id, performer_name, activity_type, activity_date")
      .gte("activity_date", startDate.toISOString().split("T")[0]);

    if (department) {
      query = query.eq("performer_department", department);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const workload: Record<string, any> = {};
    (data || []).forEach((activity) => {
      if (!workload[activity.performer_id]) {
        workload[activity.performer_id] = {
          id: activity.performer_id,
          name: activity.performer_name,
          total: 0,
          byType: { construction: 0, finance: 0, hr: 0, sales: 0 },
        };
      }
      workload[activity.performer_id].total++;
      workload[activity.performer_id].byType[activity.activity_type] =
        (workload[activity.performer_id].byType[activity.activity_type] || 0) + 1;
    });

    const sorted = Object.values(workload).sort(
      (a: any, b: any) => b.total - a.total
    );

    return NextResponse.json({ success: true, data: sorted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
