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
    const rangeType = searchParams.get("range") || "month"; // week, month, year
    const departmentFilter = searchParams.get("department"); // optional department filter

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    if (rangeType === "week") {
      startDate.setDate(now.getDate() - 7);
    } else if (rangeType === "month") {
      startDate.setMonth(now.getMonth() - 1);
    } else if (rangeType === "year") {
      startDate.setFullYear(now.getFullYear() - 1);
    }

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = now.toISOString().split("T")[0];
    const dStart = `${startDateStr}T00:00:00`;
    const dEnd = `${endDateStr}T23:59:59`;

    // Fetch activity logs for analytics
    let query = supabase
      .from("activity_logs")
      .select(
        "id, activity_date, category, review_status, created_by, approved_by_name, approved_date, user_name, user_department"
      )
      .gte("activity_date", startDateStr)
      .lte("activity_date", endDateStr);

    if (departmentFilter) {
      query = query.eq("user_department", departmentFilter);
    }

    const { data: activityLogs, error: activityError } = await query;

    if (activityError) throw activityError;

    // Fetch construction reports
    let constructionQuery = supabase
      .from("construction_reports")
      .select("id, created_at, title, status, created_by, project_id")
      .gte("created_at", dStart)
      .lte("created_at", dEnd);

    const { data: constructionReports, error: constructionError } =
      await constructionQuery;

    if (constructionError) throw constructionError;

    // Process analytics data
    const analytics = {
      totalActivities: 0,
      totalApproved: 0,
      totalRejected: 0,
      totalPending: 0,
      approvalRate: 0,
      activitiesByDepartment: {} as Record<
        string,
        { count: number; approved: number; pending: number; rejected: number }
      >,
      activitiesByWeek: [] as Array<{
        week: string;
        count: number;
        approved: number;
      }>,
      approverStats: {} as Record<
        string,
        {
          name: string;
          approved: number;
          rejected: number;
          pending: number;
          approvalRate: number;
        }
      >,
      constructionReports: {
        total: constructionReports?.length || 0,
        byStatus: {} as Record<string, number>,
      },
    };

    // Process activity logs
    const activityMap = new Map<
      string,
      { count: number; approved: number; rejected: number }
    >();
    const approverMap = new Map<
      string,
      {
        name: string;
        approved: number;
        rejected: number;
        pending: number;
      }
    >();

    (activityLogs || []).forEach((log: any) => {
      analytics.totalActivities++;

      // Count by status
      if (log.review_status === "approved") {
        analytics.totalApproved++;
      } else if (log.review_status === "rejected") {
        analytics.totalRejected++;
      } else {
        analytics.totalPending++;
      }

      // Count by department
      const dept = log.user_department || "Unknown";
      if (!analytics.activitiesByDepartment[dept]) {
        analytics.activitiesByDepartment[dept] = {
          count: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
        };
      }
      analytics.activitiesByDepartment[dept].count++;

      if (log.review_status === "approved") {
        analytics.activitiesByDepartment[dept].approved++;
      } else if (log.review_status === "rejected") {
        analytics.activitiesByDepartment[dept].rejected++;
      } else {
        analytics.activitiesByDepartment[dept].pending++;
      }

      // Count by week
      const date = new Date(log.activity_date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];

      if (!activityMap.has(weekKey)) {
        activityMap.set(weekKey, { count: 0, approved: 0, rejected: 0 });
      }
      const week = activityMap.get(weekKey)!;
      week.count++;
      if (log.review_status === "approved") week.approved++;

      // Count by approver
      if (log.approved_by_name && log.review_status !== "pending") {
        const approverKey = log.approved_by_name;
        if (!approverMap.has(approverKey)) {
          approverMap.set(approverKey, {
            name: log.approved_by_name,
            approved: 0,
            rejected: 0,
            pending: 0,
          });
        }
        const approver = approverMap.get(approverKey)!;
        if (log.review_status === "approved") {
          approver.approved++;
        } else if (log.review_status === "rejected") {
          approver.rejected++;
        }
      }
    });

    // Convert maps to arrays
    analytics.activitiesByWeek = Array.from(activityMap.entries())
      .map(([week, data]) => ({
        week,
        count: data.count,
        approved: data.approved,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Calculate approver stats
    approverMap.forEach((stats, name) => {
      const total = stats.approved + stats.rejected;
      analytics.approverStats[name] = {
        ...stats,
        approvalRate:
          total > 0 ? Math.round((stats.approved / total) * 100) : 0,
      };
    });

    // Process construction reports by status
    (constructionReports || []).forEach((report: any) => {
      const status = report.status || "Unknown";
      analytics.constructionReports.byStatus[status] =
        (analytics.constructionReports.byStatus[status] || 0) + 1;
    });

    // Calculate overall approval rate
    const totalReviewed = analytics.totalApproved + analytics.totalRejected;
    analytics.approvalRate =
      totalReviewed > 0
        ? Math.round((analytics.totalApproved / totalReviewed) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      data: analytics,
      period: {
        start: startDateStr,
        end: endDateStr,
        type: rangeType,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
