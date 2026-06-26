import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export async function GET(req: NextRequest) {
  try {
    // Use service role key to bypass RLS for dashboard data aggregation
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const rangeType = searchParams.get("range") || "day"; // day, week, month
    const department = searchParams.get("department"); // optional department filter

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

    const dStart = `${startDate}T00:00:00`;
    const dEnd = `${endDate}T23:59:59`;

    // Fetch activities from real data sources (same as /activity page)
    const [
      { data: salesActivities },
      { data: crmLogs },
      { data: jvEntries },
      { data: constructionReports },
      { data: installments },
      { data: purchaseOrders },
    ] = await Promise.all([
      supabase
        .from("sales_activities")
        .select("id, activity_date, created_by")
        .gte("activity_date", dStart)
        .lte("activity_date", dEnd),
      supabase
        .from("crm_logs")
        .select("id, created_at")
        .gte("created_at", dStart)
        .lte("created_at", dEnd),
      supabase
        .from("jv_entries")
        .select("id, jv_date")
        .gte("jv_date", startDate)
        .lte("jv_date", endDate),
      supabase
        .from("construction_reports")
        .select("id, created_at")
        .gte("created_at", dStart)
        .lte("created_at", dEnd),
      supabase
        .from("contractor_installments")
        .select("id, updated_at")
        .gte("updated_at", dStart)
        .lte("updated_at", dEnd),
      supabase
        .from("purchase_orders")
        .select("id, created_at")
        .gte("created_at", dStart)
        .lte("created_at", dEnd),
    ]);

    // Group by date and activity type
    const grouped: Record<string, any> = {};

    const addToGroup = (dateKey: string, type: string, count: number) => {
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          sales: { count: 0, items: [] },
          construction: { count: 0, items: [] },
          accounting: { count: 0, items: [] },
          finance: { count: 0, items: [] },
          marketing: { count: 0, items: [] },
          hr: { count: 0, items: [] },
          approvals: { count: 0, items: [] },
          office: { count: 0, items: [] },
        };
      }
      if (grouped[dateKey][type]) {
        grouped[dateKey][type].count += count;
      }
    };

    const getDateKey = (dateStr: string | null) => {
      if (!dateStr) return startDate;
      return dateStr.split("T")[0];
    };

    // Only apply department filter if provided and not a manager
    let filterDept = false;
    let deptFilterValue = "";
    if (department) {
      filterDept = true;
      deptFilterValue = department;
    }

    // Process sales activities
    (salesActivities || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === "sales") {
        const dateKey = getDateKey(item.activity_date);
        addToGroup(dateKey, "sales", 1);
      }
    });

    // Process CRM logs (calls/contacts)
    (crmLogs || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === "sales") {
        const dateKey = getDateKey(item.created_at);
        addToGroup(dateKey, "sales", 1);
      }
    });

    // Process journal entries (accounting)
    (jvEntries || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === "accounting") {
        const dateKey = getDateKey(item.jv_date);
        addToGroup(dateKey, "accounting", 1);
      }
    });

    // Process construction reports
    (constructionReports || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === "construction") {
        const dateKey = getDateKey(item.created_at);
        addToGroup(dateKey, "construction", 1);
      }
    });

    // Process installments (construction)
    (installments || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === "construction") {
        const dateKey = getDateKey(item.updated_at);
        addToGroup(dateKey, "construction", 1);
      }
    });

    // Process purchase orders (approvals)
    (purchaseOrders || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === "approvals") {
        const dateKey = getDateKey(item.created_at);
        addToGroup(dateKey, "approvals", 1);
      }
    });

    return NextResponse.json({
      success: true,
      data: grouped,
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
