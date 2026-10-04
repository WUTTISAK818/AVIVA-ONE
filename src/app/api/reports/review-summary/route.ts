import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";
import { isManagerRole } from "@/lib/roles";
import { buildNorm, reportFlags, isNoteworthy, summaryLine, type ReportFlag } from "@/lib/report-review";

export const dynamic = "force-dynamic";

const NORM_DAYS = 14;

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface ReviewCard {
  id: string;
  userEmail: string;
  employeeName: string;
  department: string;
  reportDate: string;
  status: string;
  submittedAt: string | null;
  acknowledgedBy: string | null;
  ackMethod: string | null;
  returnedAt: string | null;
  returnReason: string | null;
  items: number;
  photos: number;
  summary: string;
  flags: ReportFlag[];
  noteworthy: boolean;
}

/**
 * ภาพรวมรายงานประจำวันรายคน สำหรับหน้าตรวจของผู้บริหาร (Pom สั่ง 4 ต.ค. 69)
 * คืนการ์ดต่อคน พร้อมเนื้อหาย่อ จำนวนงาน จำนวนรูป และป้ายเตือนที่เทียบกับค่าปกติของคนนั้นเอง
 * เดิมหน้าตรวจโชว์แค่ ชื่อ/ฝ่าย/เวลา/สถานะ ต้องกดเปิดทีละคนจึงรู้ว่าเขียนอะไร — เป็นเหตุให้กดไม่ทัน
 */
export async function GET(req: NextRequest) {
  const { user, error } = await verifyAuth(req);
  if (error || !user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data: dbUser } = await db.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!isManagerRole(dbUser?.role)) {
    return NextResponse.json({ error: "เฉพาะผู้บริหาร/ผู้จัดการเท่านั้น" }, { status: 403 });
  }

  const date = (new URL(req.url).searchParams.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "ต้องระบุ date เป็น YYYY-MM-DD" }, { status: 400 });
  }

  try {
    // 1) รายงานของวันที่ดู + ย้อนหลังอีก 14 วันเพื่อคิดค่าปกติของแต่ละคน
    const { data: reportRows } = await db
      .from("work_reports")
      .select("id, user_email, employee_name, department, report_date, status, summary, submitted_at, acknowledged_by, ack_method, returned_at, return_reason, last_edited_at")
      .eq("report_type", "daily")
      .in("status", ["submitted", "late"])
      .gte("report_date", addDays(date, -NORM_DAYS))
      .lte("report_date", date)
      .order("department")
      .order("employee_name");

    const rows = reportRows ?? [];
    if (rows.length === 0) return NextResponse.json({ date, cards: [] });

    const ids = rows.map(r => r.id as string);

    // 2) นับรายการงาน + รูปแนบของทุกฉบับในหน้าต่างเวลานี้ (ดึงแค่คอลัมน์ที่ใช้นับ)
    const [{ data: itemRows }, { data: attRows }] = await Promise.all([
      db.from("work_report_items").select("report_id, category").in("report_id", ids),
      db.from("work_report_attachments").select("report_id").in("report_id", ids),
    ]);

    const itemCount = new Map<string, number>();
    const issueFlag = new Map<string, boolean>();
    for (const it of itemRows ?? []) {
      const key = it.report_id as string;
      itemCount.set(key, (itemCount.get(key) ?? 0) + 1);
      if (it.category === "issue") issueFlag.set(key, true);
    }
    const photoCount = new Map<string, number>();
    for (const a of attRows ?? []) {
      const key = a.report_id as string;
      photoCount.set(key, (photoCount.get(key) ?? 0) + 1);
    }

    // 3) ค่าปกติของแต่ละคน คิดจากรายงานย้อนหลัง "ไม่รวมวันที่กำลังดู"
    const historyByEmail = new Map<string, { items: number; photos: number }[]>();
    for (const r of rows) {
      if (r.report_date === date) continue;
      const email = (r.user_email as string).toLowerCase();
      const list = historyByEmail.get(email) ?? [];
      list.push({ items: itemCount.get(r.id as string) ?? 0, photos: photoCount.get(r.id as string) ?? 0 });
      historyByEmail.set(email, list);
    }

    // 4) การ์ดของวันที่ดู
    const cards: ReviewCard[] = rows
      .filter(r => r.report_date === date)
      .map(r => {
        const id = r.id as string;
        const items = itemCount.get(id) ?? 0;
        const photos = photoCount.get(id) ?? 0;
        const norm = buildNorm(historyByEmail.get((r.user_email as string).toLowerCase()) ?? []);
        const flags = reportFlags({
          status: r.status as string,
          summary: r.summary as string | null,
          items, photos,
          hasIssueItem: issueFlag.get(id) ?? false,
          lastEditedAt: r.last_edited_at as string | null,
          returnedAt: r.returned_at as string | null,
        }, norm);
        return {
          id,
          userEmail: r.user_email as string,
          employeeName: r.employee_name as string,
          department: r.department as string,
          reportDate: r.report_date as string,
          status: r.status as string,
          submittedAt: (r.submitted_at as string | null) ?? null,
          acknowledgedBy: (r.acknowledged_by as string | null) ?? null,
          ackMethod: (r.ack_method as string | null) ?? null,
          returnedAt: (r.returned_at as string | null) ?? null,
          returnReason: (r.return_reason as string | null) ?? null,
          items, photos,
          summary: summaryLine(r.summary as string | null),
          flags,
          noteworthy: isNoteworthy(flags),
        };
      });

    return NextResponse.json({ date, cards });
  } catch (err) {
    console.error("[review-summary]", err);
    return NextResponse.json({ error: "โหลดภาพรวมไม่สำเร็จ" }, { status: 500 });
  }
}
