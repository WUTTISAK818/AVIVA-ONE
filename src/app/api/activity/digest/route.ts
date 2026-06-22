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
    const days = parseInt(searchParams.get("days") || "1");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    // Get all activities
    const { data: activities, error: activitiesError } = await supabase
      .from("daily_activity_log")
      .select("*")
      .gte("activity_date", startDateStr)
      .lte("activity_date", today);

    if (activitiesError) {
      return NextResponse.json(
        { success: false, error: activitiesError.message },
        { status: 400 }
      );
    }

    // Group by type and department
    const summary: Record<string, any> = {
      construction: 0,
      finance: 0,
      hr: 0,
      sales: 0,
      byDepartment: {},
    };

    (activities || []).forEach((activity) => {
      summary[activity.activity_type]++;
      if (!summary.byDepartment[activity.performer_department]) {
        summary.byDepartment[activity.performer_department] = 0;
      }
      summary.byDepartment[activity.performer_department]++;
    });

    summary.total = (activities || []).length;
    summary.average = summary.total / (days || 1);

    // Get top performer
    const performers: Record<string, number> = {};
    (activities || []).forEach((activity) => {
      performers[activity.performer_id] = (performers[activity.performer_id] || 0) + 1;
    });

    const topPerformer = Object.entries(performers).sort((a, b) => b[1] - a[1])[0];

    return NextResponse.json({
      success: true,
      data: {
        summary,
        topPerformer: topPerformer
          ? { id: topPerformer[0], count: topPerformer[1] }
          : null,
        period: `${days} day(s)`,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
