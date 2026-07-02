import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push-notify";
import { sendLine } from "@/lib/line";
import { isManagerRole } from "@/lib/roles";

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

  const todayThai = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const dateLabel = new Date(Date.now() + 7 * 3_600_000)
    .toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  const [{ data: employees }, { data: sent }, { data: roleRows }] = await Promise.all([
    db.from("employees")
      .select("full_name, nickname, email, department")
      .eq("status", "active")
      .neq("department", "ฝ่ายสวน"),
    db.from("work_reports")
      .select("user_email")
      .eq("report_type", "daily")
      .eq("report_date", todayThai)
      .in("status", ["submitted", "late"]),
    db.from("users").select("email, role"),
  ]);

  const sentEmails = new Set((sent ?? []).map(r => (r.user_email ?? "").toLowerCase()));
  const roleByEmail = new Map(
    (roleRows ?? []).map(u => [(u.email ?? "").toLowerCase(), u.role as string | null])
  );

  const missing = (employees ?? []).filter(e => {
    const email = (e.email ?? "").toLowerCase();
    if (!email || sentEmails.has(email)) return false;
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

  return NextResponse.json({
    ok: true,
    date: todayThai,
    expected: employees?.length ?? 0,
    alreadySent: sentEmails.size,
    reminded: missing.map(m => m.full_name),
    pushSent,
    lineSent,
  });
}
