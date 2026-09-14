import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";
import { parseSchedule, isEmployeeOffDay, thaiDateStr, dowOfDateStr } from "@/lib/work-schedule";

export const dynamic = "force-dynamic";

// สรุปสถานะรายงานประจำวัน "วันนี้" (เวลาไทย UTC+7) สำหรับ widget ผู้บริหารบนหน้าหลัก
// total = พนักงาน active ที่ต้องส่งรายงานวันนี้จริง (หักคนที่วันหยุด/มีใบลาอนุมัติแล้วออก) · submitted = ส่งแล้ว(รวมล่าช้า) · late = ส่งล่าช้า
export async function GET(req: NextRequest) {
  const { user, error } = await verifyAuth(req, ["manager"]);
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const todayThai = thaiDateStr();
    const todayDow = dowOfDateStr(todayThai);
    const db = getSupabaseAdmin();

    const [{ data: employees }, { data: reports }, { data: cfg }, { data: holidays }, { data: leaves }] = await Promise.all([
      db.from("employees")
        .select("id, weekly_off_day")
        .eq("status", "active")
        // ต้องส่งรายงานประจำวัน = ยกเว้นฝ่ายสวน (คนสวน) และฝ่ายบริหาร (ผู้บริหารเป็นผู้ตรวจ)
        .not("department", "in", '("ฝ่ายสวน","ฝ่ายบริหาร")'),
      db.from("work_reports")
        .select("id, status")
        .eq("report_type", "daily")
        .eq("report_date", todayThai)
        .in("status", ["submitted", "late"]),
      db.from("app_settings").select("value").eq("key", "work_schedule").maybeSingle(),
      db.from("company_holidays").select("holiday_date").eq("holiday_date", todayThai),
      db.from("leave_requests")
        .select("employee_id")
        .eq("status", "approved")
        .lte("date_from", todayThai)
        .gte("date_to", todayThai),
    ]);

    const schedule = parseSchedule((cfg as { value?: string } | null)?.value);
    const isHoliday = (holidays ?? []).length > 0;
    const onLeaveIds = new Set((leaves ?? []).map(l => l.employee_id as string));
    const expected = (employees ?? []).filter(e =>
      !(isHoliday || isEmployeeOffDay(todayDow, e.weekly_off_day, schedule.weekly_off_days)) && !onLeaveIds.has(e.id)
    ).length;

    const submitted = reports?.length ?? 0;
    const late = reports?.filter(r => r.status === "late").length ?? 0;

    return NextResponse.json({ total: expected, submitted, late, date: todayThai });
  } catch (err) {
    console.error("Error fetching report summary:", err);
    return NextResponse.json({ error: "Failed to fetch report summary" }, { status: 500 });
  }
}
