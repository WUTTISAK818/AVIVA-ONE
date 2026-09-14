import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push-notify";
import { sendLine } from "@/lib/line";
import { isManagerRole } from "@/lib/roles";
import { parseSchedule, isEmployeeOffDay, thaiDateStr, dowOfDateStr } from "@/lib/work-schedule";
import { ABSENCE_GRACE_DAYS } from "@/lib/report-absences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

// สรุปสถานะรายงานประจำวัน "ของเมื่อวาน" พร้อมเหตุผลของคนที่ไม่ได้ส่ง ส่งถึงผู้บริหานทุกเช้า
// ตั้ง Vercel Cron 08:30 น. ไทย (= 01:30 UTC) วันถัดไป — รอให้ข้อมูลนิ่งก่อน (กันกรณีส่งย้อนหลัง/ลาอนุมัติช้า)
// เหตุผลที่ไม่ส่ง เรียงลำดับตรวจ: วันหยุดประจำตัว/บริษัท > ลาที่อนุมัติแล้ว > ไม่ทราบสาเหตุ (ต้องติดตาม)
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();

  const dateStr = thaiDateStr(-24 * 3_600_000); // เมื่อวานตามเวลาไทย
  const dateLabel = new Date(dateStr + "T12:00:00Z")
    .toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
  const dow = dowOfDateStr(dateStr);

  const [{ data: employees }, { data: reports }, { data: roleRows }, { data: cfg }, { data: holidays }, { data: leaves }] = await Promise.all([
    db.from("employees")
      .select("id, full_name, email, department, weekly_off_day")
      .eq("status", "active")
      .neq("department", "ฝ่ายสวน"),
    db.from("work_reports")
      .select("user_email, status")
      .eq("report_type", "daily")
      .eq("report_date", dateStr)
      .in("status", ["submitted", "late"]),
    db.from("users").select("email, role"),
    db.from("app_settings").select("value").eq("key", "work_schedule").maybeSingle(),
    db.from("company_holidays").select("holiday_date").eq("holiday_date", dateStr),
    db.from("leave_requests")
      .select("employee_id, leave_type")
      .eq("status", "approved")
      .lte("date_from", dateStr)
      .gte("date_to", dateStr),
  ]);

  const roleByEmail = new Map(
    (roleRows ?? []).map(u => [(u.email ?? "").toLowerCase(), u.role as string | null])
  );
  const sentEmails = new Set((reports ?? []).map(r => (r.user_email ?? "").toLowerCase()));
  const schedule = parseSchedule((cfg as { value?: string } | null)?.value);
  const isHoliday = (holidays ?? []).length > 0;
  const leaveByEmployeeId = new Map((leaves ?? []).map(l => [l.employee_id as string, l.leave_type as string]));

  const expected = (employees ?? []).filter(
    e => e.email && !isManagerRole(roleByEmail.get((e.email ?? "").toLowerCase()))
  );
  const missing = expected.filter(e => !sentEmails.has((e.email ?? "").toLowerCase()));
  const late = (reports ?? []).filter(r => r.status === "late").length;
  const submitted = expected.length - missing.length;

  // จัดกลุ่มเหตุผลของคนที่ไม่ได้ส่ง
  const offDay: string[] = [];
  const onLeave: string[] = [];
  const unexplained: string[] = [];
  for (const e of missing) {
    if (isHoliday || isEmployeeOffDay(dow, e.weekly_off_day, schedule.weekly_off_days)) {
      offDay.push(e.full_name);
    } else if (leaveByEmployeeId.has(e.id)) {
      onLeave.push(`${e.full_name} (${leaveByEmployeeId.get(e.id)})`);
    } else {
      unexplained.push(e.full_name);
    }
  }

  // ── เคสขาดส่ง: เปิดเคสใหม่ + ปิดเคสเก่าที่จบแล้ว + เตือนพนักงานครั้งที่ 2 ──
  const missingUnexplained = missing.filter(e =>
    !(isHoliday || isEmployeeOffDay(dow, e.weekly_off_day, schedule.weekly_off_days)) && !leaveByEmployeeId.has(e.id)
  );

  // เปิดเคสของเมื่อวาน (กันซ้ำด้วย unique constraint employee_email+report_date)
  if (missingUnexplained.length > 0) {
    await db.from("report_absences").upsert(
      missingUnexplained.map(e => ({
        employee_id: e.id,
        employee_email: (e.email ?? "").toLowerCase(),
        employee_name: e.full_name,
        department: e.department,
        report_date: dateStr,
        status: "open",
        reminder_count: 1,          // ครั้งที่ 1 = เตือน 18:00 ของเมื่อวาน
        last_reminded_at: new Date().toISOString(),
      })),
      { onConflict: "employee_email,report_date", ignoreDuplicates: true },
    );
  }

  // เคสที่ยังค้าง — เอามาปิด/เตือนต่อ
  const { data: openCases } = await db
    .from("report_absences")
    .select("id, employee_email, employee_name, report_date, status, reminder_count")
    .in("status", ["open", "explained"]);

  const cutoff = thaiDateStr(-ABSENCE_GRACE_DAYS * 24 * 3_600_000);
  let closedSubmitted = 0;
  let closedUnexplained = 0;
  let remindedStaff = 0;

  for (const c of openCases ?? []) {
    // 1) ส่งย้อนหลังแล้ว → ปิดเอง
    const { data: nowSubmitted } = await db
      .from("work_reports")
      .select("id")
      .eq("report_type", "daily")
      .eq("report_date", c.report_date)
      .ilike("user_email", c.employee_email)
      .in("status", ["submitted", "late"])
      .maybeSingle();
    if (nowSubmitted) {
      await db.from("report_absences").update({ status: "closed_submitted", updated_at: new Date().toISOString() }).eq("id", c.id);
      closedSubmitted++;
      continue;
    }
    // 2) เกินกำหนดตาม (7 วัน) และยังไม่ชี้แจง → ปิดเป็น "ขาดส่ง — ไม่ชี้แจง" ติดประวัติ
    if (c.report_date < cutoff && c.status === "open") {
      await db.from("report_absences").update({ status: "closed_unexplained", updated_at: new Date().toISOString() }).eq("id", c.id);
      closedUnexplained++;
      continue;
    }
    // 3) ยังรอชี้แจง + ยังไม่เกิน 3 ครั้ง → เตือนพนักงานคนนั้น (ครั้งที่ 2 ของบันได)
    if (c.status === "open" && c.reminder_count < 2) {
      const caseLabel = new Date(c.report_date + "T12:00:00Z")
        .toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });
      const staffTitle = "📝 ยังไม่ได้ส่งรายงาน";
      const staffBody = `รายงานวันที่ ${caseLabel} ยังไม่ได้ส่ง — ส่งย้อนหลังได้ที่เมนู "งานรายวัน" หรือชี้แจงเหตุผลในแอป`;
      await sendPush({ userEmail: c.employee_email }, { title: staffTitle, body: staffBody, url: "/reports", tag: "report-absence" }).catch(() => {});
      try {
        const { data: link } = await db.from("line_links").select("line_user_id")
          .ilike("user_email", c.employee_email).not("linked_at", "is", null).maybeSingle();
        if (link?.line_user_id) await sendLine(link.line_user_id, `${staffTitle}\n${staffBody}`);
      } catch { /* best-effort */ }
      await db.from("report_absences").update({
        reminder_count: 2, last_reminded_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", c.id);
      remindedStaff++;
    }
  }

  const { data: stillPending } = await db
    .from("report_absences")
    .select("employee_name, report_date, status")
    .in("status", ["open", "explained"])
    .is("acknowledged_at", null);
  const waitingExplain = (stillPending ?? []).filter(c => c.status === "open").length;
  const waitingAck = (stillPending ?? []).filter(c => c.status === "explained").length;

  const title = `📋 สรุปรายงานทีม — ${dateLabel}`;
  const lines = [
    `ส่งแล้ว ${submitted}/${expected.length} คน${late > 0 ? ` (ล่าช้า ${late})` : ""}`,
    offDay.length > 0 ? `🌴 วันหยุด: ${offDay.join(", ")}` : "",
    onLeave.length > 0 ? `🏥 ลา (อนุมัติแล้ว): ${onLeave.join(", ")}` : "",
    unexplained.length > 0 ? `❗ยังไม่ทราบสาเหตุ (ต้องติดตาม) ${unexplained.length} คน: ${unexplained.join(", ")}` : "✅ ที่เหลือส่งครบ ไม่มีคนขาดโดยไม่ทราบสาเหตุ",
    waitingExplain > 0 ? `⏳ เคสค้างรอพนักงานชี้แจง ${waitingExplain} เคส` : "",
    waitingAck > 0 ? `🖐️ ชี้แจงแล้ว รอคุณกดรับทราบ ${waitingAck} เคส` : "",
  ].filter(Boolean);
  const message = lines.join("\n");

  // 1) กระดิ่งในแอป (ผู้บริหาร)
  await db.from("notifications").insert({
    project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร", from_dept: "ระบบรายงาน",
    title, message, is_read: false,
  });

  // 2) Web push ผู้บริหาร
  await sendPush({ department: "ฝ่ายบริหาร" }, { title, body: message, url: "/reports/digest", tag: "report-digest" }).catch(() => {});

  // 3) LINE ส่วนตัว — เฉพาะผู้บริหารที่ผูกบัญชีไว้
  let lineSent = 0;
  try {
    const { data: links } = await db
      .from("line_links")
      .select("line_user_id, user_email")
      .not("linked_at", "is", null);
    const managerLinks = (links ?? []).filter(l =>
      isManagerRole(roleByEmail.get((l.user_email ?? "").toLowerCase()))
    );
    const text = `${title}\n${message}\nดูรายละเอียด: เมนูหน้าหลัก → รายงานทีมวันนี้`;
    const res = await Promise.allSettled(managerLinks.map(l => sendLine(l.line_user_id, text)));
    lineSent = res.reduce((n, r) => n + (r.status === "fulfilled" && r.value.ok ? 1 : 0), 0);
  } catch { /* best-effort */ }

  return NextResponse.json({
    ok: true,
    date: dateStr,
    submitted,
    expected: expected.length,
    late,
    offDay,
    onLeave,
    unexplained,
    absenceCases: { opened: missingUnexplained.length, closedSubmitted, closedUnexplained, remindedStaff, waitingExplain, waitingAck },
    lineSent,
  });
}
