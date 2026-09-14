import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push-notify";
import { sendLine } from "@/lib/line";
import { isManagerRole } from "@/lib/roles";
import { parseSchedule, thaiDateStr, dowOfDateStr } from "@/lib/work-schedule";
import { resolveOffDay, groupSwapsByEmail } from "@/lib/off-day-swaps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// เตือนพนักงานที่ "ยังไม่ส่งรายงานประจำวัน" ผ่าน Push + LINE ส่วนตัว
// ตั้ง Vercel Cron 18:00 น. ไทย (= 11:00 UTC) — 1 ชั่วโมงก่อนเส้นตาย 19:00 น.
// ไม่เตือน: ฝ่ายสวน (ไม่ต้องส่ง) และผู้บริหาร (ไม่ได้ส่งรายงาน — เป็นฝ่ายรับทราบ)
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();

  const todayThai = thaiDateStr();
  const dateLabel = new Date(todayThai + "T12:00:00Z")
    .toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

  const [{ data: employees }, { data: sent }, { data: roleRows }, { data: cfg }, { data: holidays }, { data: leaves }, { data: swapRows }] = await Promise.all([
    db.from("employees")
      .select("id, full_name, nickname, email, department, weekly_off_day")
      .eq("status", "active")
      .neq("department", "ฝ่ายสวน"),
    db.from("work_reports")
      .select("user_email")
      .eq("report_type", "daily")
      .eq("report_date", todayThai)
      .in("status", ["submitted", "late"]),
    db.from("users").select("email, role"),
    db.from("app_settings").select("value").eq("key", "work_schedule").maybeSingle(),
    db.from("company_holidays").select("holiday_date").eq("holiday_date", todayThai),
    db.from("leave_requests")
      .select("employee_id")
      .eq("status", "approved")
      .lte("date_from", todayThai)
      .gte("date_to", todayThai),
    db.from("off_day_swaps")
      .select("employee_email, original_off_date, swapped_off_date")
      .eq("status", "approved")
      .or(`original_off_date.eq.${todayThai},swapped_off_date.eq.${todayThai}`),
  ]);

  const sentEmails = new Set((sent ?? []).map(r => (r.user_email ?? "").toLowerCase()));
  const roleByEmail = new Map(
    (roleRows ?? []).map(u => [(u.email ?? "").toLowerCase(), u.role as string | null])
  );
  const schedule = parseSchedule((cfg as { value?: string } | null)?.value);
  const todayDow = dowOfDateStr(todayThai);
  const isHoliday = (holidays ?? []).length > 0;
  const onLeaveIds = new Set((leaves ?? []).map(l => l.employee_id as string));
  const swapsByEmail = groupSwapsByEmail(swapRows ?? []);

  const missing = (employees ?? []).filter(e => {
    const email = (e.email ?? "").toLowerCase();
    if (!email || sentEmails.has(email)) return false;
    const { isOff } = resolveOffDay({
      dateStr: todayThai, dow: todayDow, weeklyOffDay: e.weekly_off_day,
      companyWeeklyOff: schedule.weekly_off_days, swaps: swapsByEmail.get(email) ?? [],
    });
    if (isHoliday || isOff) return false;        // วันหยุดบริษัท/วันหยุดของคนนี้ (รวมที่สลับแล้ว) — ไม่ต้องเตือน
    if (onLeaveIds.has(e.id)) return false;      // ลาที่อนุมัติแล้ว — ไม่ต้องเตือน
    return !isManagerRole(roleByEmail.get(email)); // ผู้บริหารไม่ต้องส่งรายงาน
  });

  const title = "⏰ อย่าลืมส่งรายงานประจำวัน";
  const body = `วันนี้ (${dateLabel}) ยังไม่ได้ส่งรายงาน — ส่งก่อน 19:00 น. เพื่อไม่ให้ขึ้นสถานะล่าช้า`;

  let pushSent = 0;
  let lineSent = 0;

  for (const emp of missing) {
    const email = (emp.email ?? "").toLowerCase();

    // Push ส่วนตัว
    const push = await sendPush({ userEmail: email }, { title, body, url: "/reports", tag: "report-reminder" }).catch(() => ({ sent: 0 }));
    pushSent += push.sent;

    // LINE ส่วนตัว (เฉพาะคนที่ผูกบัญชีแล้ว)
    try {
      const { data: link } = await db
        .from("line_links")
        .select("line_user_id")
        .eq("user_email", email)
        .not("linked_at", "is", null)
        .maybeSingle();
      if (link?.line_user_id) {
        const name = emp.nickname || emp.full_name || "";
        const res = await sendLine(link.line_user_id, `${title}\nคุณ${name} ${body}\nส่งได้ที่เมนู "งานรายวัน" ในแอป`);
        if (res.ok) lineSent++;
      }
    } catch { /* best-effort */ }
  }

  // ── เตือนครั้งที่ 3 (ครั้งสุดท้าย) สำหรับเคสขาดส่งที่ยังไม่ชี้แจง + แจ้งผู้บริหารให้ทราบด้วย ──
  const { data: finalCases } = await db
    .from("report_absences")
    .select("id, employee_email, employee_name, report_date")
    .eq("status", "open")
    .eq("reminder_count", 2);

  let finalReminded = 0;
  for (const c of finalCases ?? []) {
    const caseLabel = new Date(c.report_date + "T12:00:00Z")
      .toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });
    const fTitle = "⚠️ เตือนครั้งสุดท้าย — รายงานค้างส่ง";
    const fBody = `รายงานวันที่ ${caseLabel} ยังไม่ได้ส่งและยังไม่ได้ชี้แจง — กรุณาส่งย้อนหลังหรือชี้แจงเหตุผลในแอป (แจ้งผู้บริหารรับทราบแล้ว)`;
    await sendPush({ userEmail: c.employee_email }, { title: fTitle, body: fBody, url: "/reports", tag: "report-absence-final" }).catch(() => {});
    try {
      const { data: link } = await db.from("line_links").select("line_user_id")
        .ilike("user_email", c.employee_email).not("linked_at", "is", null).maybeSingle();
      if (link?.line_user_id) await sendLine(link.line_user_id, `${fTitle}\n${fBody}`);
    } catch { /* best-effort */ }
    await db.from("report_absences").update({
      reminder_count: 3, last_reminded_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", c.id);
    finalReminded++;
  }

  if (finalReminded > 0) {
    const names = (finalCases ?? []).map(c => `${c.employee_name} (${c.report_date})`).join(", ");
    const eTitle = "⚠️ มีพนักงานค้างส่งรายงานหลังเตือนครบ 3 ครั้ง";
    const eBody = `${names}\n\nเตือนอัตโนมัติครบแล้ว — ระบบจะหยุดเตือน รอพนักงานส่งย้อนหลัง/ชี้แจง หรือครบ 7 วันจะปิดเป็น "ขาดส่ง — ไม่ชี้แจง" อัตโนมัติ`;
    await db.from("notifications").insert({
      type: "warning", to_dept: "ผู้บริหาร", from_dept: "ระบบรายงาน",
      title: eTitle, message: eBody, is_read: false,
    });
    await sendPush({ department: "ฝ่ายบริหาร" }, { title: eTitle, body: eBody, url: "/reports/digest", tag: "report-absence-escalate" }).catch(() => {});
    try {
      const { data: links } = await db.from("line_links").select("line_user_id, user_email").not("linked_at", "is", null);
      const managerLinks = (links ?? []).filter(l => isManagerRole(roleByEmail.get((l.user_email ?? "").toLowerCase())));
      await Promise.allSettled(managerLinks.map(l => sendLine(l.line_user_id, `${eTitle}\n${eBody}`)));
    } catch { /* best-effort */ }
  }

  return NextResponse.json({
    ok: true,
    date: todayThai,
    expected: employees?.length ?? 0,
    alreadySent: sentEmails.size,
    reminded: missing.map(m => m.full_name),
    finalReminded,
    pushSent,
    lineSent,
  });
}
