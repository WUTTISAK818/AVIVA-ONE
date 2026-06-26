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

    console.log("[Dashboard] Query range:", { dateStr, rangeType, startDate, endDate, dStart, dEnd, department });

    // Fetch activities from real data sources with detailed fields
    // Note: Use date strings for DATE columns, timestamps for TIMESTAMP columns
    const [
      { data: salesActivities, error: salesErr },
      { data: crmLogs, error: crmErr },
      { data: jvEntries, error: jvErr },
      { data: constructionReports, error: constErr },
      { data: installments, error: instErr },
      { data: purchaseOrders, error: poErr },
      { data: dailyActivity, error: dailyErr },
      { data: workReports, error: workErr },
    ] = await Promise.all([
      supabase
        .from("sales_activities")
        .select("id, activity_date, activity_type, note, created_by_name")
        .gte("activity_date", startDate)
        .lte("activity_date", endDate),
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
        .select("id, created_at, work_type, reported_by")
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
      supabase
        .from("daily_activity_log")
        .select("id, activity_date")
        .gte("activity_date", startDate)
        .lte("activity_date", endDate),
      supabase
        .from("work_reports")
        .select("id, report_date, employee_name, department, status")
        .gte("report_date", startDate)
        .lte("report_date", endDate)
        .eq("report_type", "daily"),
    ]);

    console.log("[Dashboard] Data counts:", {
      sales: salesActivities?.length ?? 0,
      crm: crmLogs?.length ?? 0,
      jv: jvEntries?.length ?? 0,
      construction: constructionReports?.length ?? 0,
      installments: installments?.length ?? 0,
      po: purchaseOrders?.length ?? 0,
      daily: dailyActivity?.length ?? 0,
      workReports: workReports?.length ?? 0,
    });
    console.log("[Dashboard] Errors:", { salesErr, crmErr, jvErr, constErr, instErr, poErr, dailyErr, workErr });

    // Group by date and activity type
    const grouped: Record<string, any> = {};

    const addToGroup = (dateKey: string, type: string, count: number, item?: any) => {
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
        if (item) {
          grouped[dateKey][type].items.push(item);
        }
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
        addToGroup(dateKey, "sales", 1, {
          id: item.id,
          title: item.activity_type || "กิจกรรมขาย",
          description: `${item.created_by_name || "ไม่ระบุ"} · ${item.note || ""}`,
          link: "/crm",
        });
      }
    });

    // Process CRM logs (calls/contacts)
    (crmLogs || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === "sales") {
        const dateKey = getDateKey(item.created_at);
        addToGroup(dateKey, "sales", 1, {
          id: item.id,
          title: "สอบถามลูกค้า",
          description: getDateKey(item.created_at),
          link: "/crm",
        });
      }
    });

    // Process journal entries (accounting)
    (jvEntries || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === "accounting") {
        const dateKey = getDateKey(item.jv_date);
        addToGroup(dateKey, "accounting", 1, {
          id: item.id,
          title: "บันทึกบัญชี",
          description: `JV Entry`,
          link: "/office?tab=accounting",
        });
      }
    });

    // Process construction reports
    (constructionReports || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === "construction") {
        const dateKey = getDateKey(item.created_at);
        addToGroup(dateKey, "construction", 1, {
          id: item.id,
          title: item.work_type || "รายงานก่อสร้าง",
          description: `รายงานโดย: ${item.reported_by || "ไม่ระบุ"}`,
          link: "/construction",
        });
      }
    });

    // Process installments (construction)
    (installments || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === "construction") {
        const dateKey = getDateKey(item.updated_at);
        addToGroup(dateKey, "construction", 1, {
          id: item.id,
          title: "อัปเดตการจ่ายเงินก่อสร้าง",
          description: `Installment Update`,
          link: "/construction",
        });
      }
    });

    // Process purchase orders (approvals)
    (purchaseOrders || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === "approvals") {
        const dateKey = getDateKey(item.created_at);
        addToGroup(dateKey, "approvals", 1, {
          id: item.id,
          title: "ใบสั่งซื้อ",
          description: `PO Created`,
          link: "/office?tab=purchase-orders",
        });
      }
    });

    // Process work reports
    (workReports || []).forEach((item: any) => {
      if (!filterDept || deptFilterValue === item.department) {
        const dateKey = getDateKey(item.report_date);
        const statusLabel = item.status === "late" ? "ส่งสาย" : "ส่งตรงเวลา";
        addToGroup(dateKey, item.department === "sales" ? "sales" : "office", 1, {
          id: item.id,
          title: `รายงานประจำวัน (${statusLabel})`,
          description: `${item.employee_name || "ไม่ระบุ"} · ${item.department}`,
          link: "/reports/review",
        });
      }
    });

    // Process daily activity logs
    (dailyActivity || []).forEach((item: any) => {
      if (!filterDept) {
        const dateKey = getDateKey(item.activity_date);
        addToGroup(dateKey, "office", 1, {
          id: item.id,
          title: "บันทึกกิจกรรม",
          description: `Daily Log Entry`,
          link: "/dashboard",
        });
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
