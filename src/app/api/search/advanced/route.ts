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

    // Search filters
    const query = searchParams.get("query") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const department = searchParams.get("department");
    const creator = searchParams.get("creator");
    const status = searchParams.get("status");
    const reportType = searchParams.get("type") || "all"; // all, activity, construction
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const results: any[] = [];

    // Search activity logs
    if (reportType === "all" || reportType === "activity") {
      let activityQuery = supabase
        .from("activity_logs")
        .select(
          "id, title, description, activity_date, category, review_status, user_name, user_department, created_at, approved_by_name"
        );

      if (query) {
        activityQuery = activityQuery.or(
          `title.ilike.%${query}%,description.ilike.%${query}%`
        );
      }

      if (startDate) {
        activityQuery = activityQuery.gte("activity_date", startDate);
      }

      if (endDate) {
        activityQuery = activityQuery.lte("activity_date", endDate);
      }

      if (department) {
        activityQuery = activityQuery.eq("user_department", department);
      }

      if (creator) {
        activityQuery = activityQuery.eq("user_name", creator);
      }

      if (status) {
        activityQuery = activityQuery.eq("review_status", status);
      }

      const { data: activityLogs, error: activityError } =
        await activityQuery.order("activity_date", { ascending: false });

      if (activityError) throw activityError;

      (activityLogs || []).forEach((log) => {
        results.push({
          id: log.id,
          type: "activity",
          title: log.title,
          description: log.description,
          date: log.activity_date,
          category: log.category,
          status: log.review_status,
          creator: log.user_name,
          department: log.user_department,
          approvedBy: log.approved_by_name,
          createdAt: log.created_at,
        });
      });
    }

    // Search construction reports
    if (reportType === "all" || reportType === "construction") {
      let constructionQuery = supabase
        .from("construction_reports")
        .select(
          "id, title, detail, report_date, status, created_by, project_id, photo_urls, created_at"
        );

      if (query) {
        constructionQuery = constructionQuery.or(
          `title.ilike.%${query}%,detail.ilike.%${query}%`
        );
      }

      if (startDate) {
        constructionQuery = constructionQuery.gte("report_date", startDate);
      }

      if (endDate) {
        constructionQuery = constructionQuery.lte("report_date", endDate);
      }

      if (creator) {
        constructionQuery = constructionQuery.eq("created_by", creator);
      }

      if (status) {
        constructionQuery = constructionQuery.eq("status", status);
      }

      const { data: constructionReports, error: constructionError } =
        await constructionQuery.order("report_date", { ascending: false });

      if (constructionError) throw constructionError;

      (constructionReports || []).forEach((report) => {
        results.push({
          id: report.id,
          type: "construction",
          title: report.title,
          description: report.detail,
          date: report.report_date,
          status: report.status,
          creator: report.created_by,
          projectId: report.project_id,
          photoCount: (report.photo_urls || []).length,
          createdAt: report.created_at,
        });
      });
    }

    // Sort by date descending
    results.sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Paginate
    const paginatedResults = results.slice(offset, offset + limit);
    const totalCount = results.length;

    return NextResponse.json({
      success: true,
      data: paginatedResults,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      filters: {
        query,
        startDate,
        endDate,
        department,
        creator,
        status,
        type: reportType,
      },
    });
  } catch (error) {
    console.error("Error performing advanced search:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
