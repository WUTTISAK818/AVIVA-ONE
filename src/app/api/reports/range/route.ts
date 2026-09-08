import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { buildDepartmentReports, thaiDateToUtcIso } from "@/lib/monthly-report-data";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// สรุปผลงานรายฝ่าย (ขาย/ก่อสร้าง/การเงิน-บัญชี/บุคคล) แบบเรียลไทม์ ตามช่วงวันที่ที่เลือก (ปฏิทินไทย)
// ใช้สำหรับหน้า /reports/monthly โหมด "รายสัปดาห์"/"กำหนดเอง" — ต่างจากโหมด "รายเดือน" ที่อ่านจาก
// ตาราง monthly_department_reports (สแนปช็อตที่ Routine สร้างไว้ตอนสิ้นเดือน + เก็บสำเนาไว้ใน Google Drive)
export async function GET(req: NextRequest) {
  const { user, error } = await verifyAuth(req, ["admin", "ceo", "coo"]);
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get("from") ?? "";
  const toExclusive = req.nextUrl.searchParams.get("to") ?? "";
  const label = req.nextUrl.searchParams.get("label") ?? `${from} ถึง ${toExclusive}`;

  if (!DATE_RE.test(from) || !DATE_RE.test(toExclusive)) {
    return NextResponse.json({ error: "ต้องระบุ from/to เป็นรูปแบบ YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const fromIso = thaiDateToUtcIso(from);
    const toIso = thaiDateToUtcIso(toExclusive);
    const reports = await buildDepartmentReports(fromIso, toIso, label);
    return NextResponse.json({ from, to: toExclusive, label, reports });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
