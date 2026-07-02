import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push-notify";
import { sendLine } from "@/lib/line";
import { isManagerRole } from "@/lib/roles";

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

// สรุปสถานะรายงานประจำวัน "หลังเส้นตาย 19:00" ส่งถึงผู้บริหารอัตโนมัติ
// ตั้ง Vercel Cron 19:30 น. ไทย (= 12:30 UTC) — ผู้บริหารรู้ทันทีว่าใครส่ง/ใครขาด โดยไม่ต้องเปิดแอป
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();

  const todayThai = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const dateLabel = new Date(Date.now() + 7 * 3_600_000)
    .toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  const [{ data: employees }, { data: reports }, { data: roleRows }] = await Promise.all([
    db.from("employees")
      .select("full_name, email, department")
      .eq("status", "active")
      .neq("department", "ฝ่ายสวน"),
    db.from("work_reports")
      .select("user_email, status")
      .eq("report_type", "daily")
      .eq("report_date", todayThai)
      .in("status", ["submitted", "late"]),
    db.from("users").select("email, role"),
  ]);

  const roleByEmail = new Map(
    (roleRows ?? []).map(u => [(u.email ?? "").toLowerCase(), u.role as string | null])
  );
  const sentEmails = new Set((reports ?? []).map(r => (r.user_email ?? "").toLowerCase()));

  const expected = (employees ?? []).filter(
    e => e.email && !isManagerRole(roleByEmail.get((e.email ?? "").toLowerCase()))
  );
  const missing = expected.filter(e => !sentEmails.has((e.email ?? "").toLowerCase()));
  const late = (reports ?? []).filter(r => r.status === "late").length;
  const submitted = expected.length - missing.length;

  const title = `📋 สรุปรายงานทีม — ${dateLabel}`;
  const lines = [
    `ส่งแล้ว ${submitted}/${expected.length} คน${late > 0 ? ` (ล่าช้า ${late})` : ""}`,
    missing.length > 0
      ? `❌ ยังไม่ส่ง ${missing.length} คน: ${missing.map(m => m.full_name).join(", ")}`
      : "✅ ส่งครบทุกคน",
  ];
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
    date: todayThai,
    submitted,
    expected: expected.length,
    late,
    missing: missing.map(m => m.full_name),
    lineSent,
  });
}
