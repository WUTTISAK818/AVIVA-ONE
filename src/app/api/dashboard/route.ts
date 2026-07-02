import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

// ปฏิทินกิจกรรมหน้าหลัก — รวมกิจกรรมจริงของทุกฝ่ายต่อวัน (เวลาไทย UTC+7)
// แหล่งข้อมูล: sales_activities/crm_logs(ขาย) · construction_reports/contractor_installments(ก่อสร้าง)
//             jv_entries(บัญชี) · purchase_orders(อนุมัติ) · daily_activity_log(ออฟฟิศ)
//             work_reports(รายงานประจำวัน — แยกหมวดตามแผนกผู้ส่ง ทำให้ทุกฝ่ายรวมถึงการตลาด/บุคคล/การเงินขึ้นปฏิทิน)

const CATEGORIES = [
  "sales", "construction", "accounting", "finance",
  "marketing", "hr", "approvals", "office",
] as const;
type Category = (typeof CATEGORIES)[number];

// item ที่ปฏิทินฝั่ง UI อ่าน — normalize ทุกแหล่งข้อมูลให้เป็นรูปนี้เท่านั้น
interface ActivityItem {
  title: string;
  detail?: string | null;
  status?: string | null;
  createdBy?: string | null;
  amount?: number | null;
  link?: string;
}

type DayData = Record<Category, { count: number; items: ActivityItem[] }>;

// map แผนก (ไทย) → หมวดปฏิทิน — แผนกอื่น/ธุรการ ตกที่ office
const DEPT_TO_CATEGORY: Record<string, Category> = {
  "ฝ่ายขาย": "sales",
  "ฝ่ายก่อสร้าง": "construction",
  "ฝ่ายบัญชี": "accounting",
  "ฝ่ายการเงิน": "finance",
  "ฝ่ายการตลาด": "marketing",
  "ฝ่ายบุคคล": "hr",
};
const deptCategory = (dept?: string | null): Category =>
  DEPT_TO_CATEGORY[(dept ?? "").trim()] ?? "office";

// วันที่แบบไทยจาก timestamp (กันข้อมูลช่วง 00:00-07:00 น. ตกวันผิด)
const thaiDate = (ts: string) =>
  new Date(new Date(ts).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  // ข้อมูลรวมทุกฝ่าย อ่านผ่าน service client (ข้าม RLS) — จึงต้องบังคับล็อกอินเสมอ
  const { user, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return NextResponse.json({ success: false, error: authError ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date") || thaiDate(new Date().toISOString());
    const rangeType = searchParams.get("range") || "day"; // day, week, month
    const department = searchParams.get("department"); // ชื่อแผนกภาษาไทย เช่น "ฝ่ายขาย"

    let startDate = dateStr;
    let endDate = dateStr;

    if (rangeType === "week") {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const sunday = new Date(date);
      sunday.setDate(date.getDate() - dayOfWeek);
      startDate = sunday.toISOString().split("T")[0];
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      endDate = saturday.toISOString().split("T")[0];
    } else if (rangeType === "month") {
      const date = new Date(dateStr);
      startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0];
    }

    // ขอบเขต timestamp ของช่วงวัน "ตามเวลาไทย" สำหรับคอลัมน์ TIMESTAMP
    const dStart = `${startDate}T00:00:00+07:00`;
    const dEnd = `${endDate}T23:59:59.999+07:00`;

    const [
      { data: salesActivities },
      { data: crmLogs },
      { data: jvEntries },
      { data: constructionReports },
      { data: installments },
      { data: purchaseOrders },
      { data: dailyActivity },
      { data: workReports },
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
        .select("id, activity_date, activity_type, performer_name, description")
        .gte("activity_date", startDate)
        .lte("activity_date", endDate),
      supabase
        .from("work_reports")
        .select("id, report_date, employee_name, department, status, summary")
        .gte("report_date", startDate)
        .lte("report_date", endDate)
        .eq("report_type", "daily")
        .in("status", ["submitted", "late"]),
    ]);

    // Group by date and activity type
    const grouped: Record<string, DayData> = {};

    const addToGroup = (dateKey: string, type: Category, item: ActivityItem) => {
      if (!grouped[dateKey]) {
        grouped[dateKey] = Object.fromEntries(
          CATEGORIES.map(c => [c, { count: 0, items: [] as ActivityItem[] }])
        ) as DayData;
      }
      grouped[dateKey][type].count += 1;
      if (grouped[dateKey][type].items.length < 30) grouped[dateKey][type].items.push(item); // กัน payload บวม
    };

    const getDateKey = (raw: string | null, isTimestamp: boolean) => {
      if (!raw) return startDate;
      return isTimestamp ? thaiDate(raw) : raw.split("T")[0];
    };

    (salesActivities || []).forEach((item: any) => {
      addToGroup(getDateKey(item.activity_date, false), "sales", {
        title: item.activity_type || "กิจกรรมขาย",
        detail: item.note || null,
        createdBy: item.created_by_name || null,
        link: "/crm",
      });
    });

    (crmLogs || []).forEach((item: any) => {
      addToGroup(getDateKey(item.created_at, true), "sales", {
        title: "สอบถามลูกค้า",
        link: "/crm",
      });
    });

    (jvEntries || []).forEach((item: any) => {
      addToGroup(getDateKey(item.jv_date, false), "accounting", {
        title: "บันทึกบัญชี (JV)",
        link: "/office?tab=accounting",
      });
    });

    (constructionReports || []).forEach((item: any) => {
      addToGroup(getDateKey(item.created_at, true), "construction", {
        title: item.work_type || "รายงานก่อสร้าง",
        createdBy: item.reported_by || null,
        link: "/construction",
      });
    });

    (installments || []).forEach((item: any) => {
      addToGroup(getDateKey(item.updated_at, true), "construction", {
        title: "อัปเดตการจ่ายเงินก่อสร้าง",
        link: "/construction",
      });
    });

    (purchaseOrders || []).forEach((item: any) => {
      addToGroup(getDateKey(item.created_at, true), "approvals", {
        title: "ใบสั่งซื้อ (PO)",
        link: "/office?tab=purchase-orders",
      });
    });

    // รายงานประจำวัน — หัวใจของปฏิทิน: กิจกรรมแต่ละฝ่ายที่ส่งเข้ามาจริง แยกหมวดตามแผนกผู้ส่ง
    (workReports || []).forEach((item: any) => {
      addToGroup(getDateKey(item.report_date, false), deptCategory(item.department), {
        title: `รายงานประจำวัน: ${item.employee_name || "ไม่ระบุ"}`,
        detail: item.summary || null,
        status: item.status === "late" ? "ส่งล่าช้า" : "ส่งแล้ว",
        createdBy: item.employee_name || null,
        link: "/reports/review",
      });
    });

    (dailyActivity || []).forEach((item: any) => {
      addToGroup(getDateKey(item.activity_date, false), "office", {
        title: item.activity_type || "บันทึกกิจกรรม",
        detail: item.description || null,
        createdBy: item.performer_name || null,
      });
    });

    // พนักงานทั่วไปเห็นเฉพาะหมวดของแผนกตัวเอง (รับชื่อแผนกภาษาไทยจาก user-context)
    // ผู้บริหารไม่ส่ง param นี้ → เห็นทุกหมวด
    if (department) {
      const keep = deptCategory(department);
      for (const day of Object.values(grouped)) {
        for (const cat of CATEGORIES) {
          if (cat !== keep) day[cat] = { count: 0, items: [] };
        }
      }
    }

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
  // บันทึกกิจกรรม manual — ต้องล็อกอิน (เขียนผ่าน service client เพื่อให้ผ่าน RLS ได้จริง)
  const { user, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return NextResponse.json({ success: false, error: authError ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();

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
