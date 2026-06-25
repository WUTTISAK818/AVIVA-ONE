import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    const { searchParams } = new URL(req.url);

    // Extract parameters
    const q = searchParams.get("q") || "";
    const category = searchParams.get("category")?.split(",") || [];
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const department = searchParams.get("department");
    const status = searchParams.get("status");
    const sortBy = searchParams.get("sortBy") || "date";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    // Validate pagination
    if (page < 1 || limit < 1) {
      return NextResponse.json(
        { success: false, error: "Invalid pagination parameters" },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .order(sortBy === "date" ? "activity_date" : sortBy, {
        ascending: sortOrder === "asc",
      });

    // Apply filters
    if (q.trim()) {
      query = query.or(`title.ilike.%${q}%,detail.ilike.%${q}%`);
    }

    if (category.length > 0) {
      query = query.in("category", category);
    }

    if (dateFrom) {
      query = query.gte("activity_date", dateFrom);
    }

    if (dateTo) {
      query = query.lte("activity_date", dateTo);
    }

    if (department) {
      query = query.eq("department", department);
    }

    if (status) {
      query = query.eq("review_status", status);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error("Filter query error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch activities" },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      filters: {
        q,
        category,
        dateFrom,
        dateTo,
        department,
        status,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    console.error("Filter API error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
