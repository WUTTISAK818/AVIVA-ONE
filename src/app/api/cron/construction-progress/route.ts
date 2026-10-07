import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push-notify";
import { sendLineToEmail } from "@/lib/line-log";
import { isManagerRole } from "@/lib/roles";
import { plotCodesIn } from "@/lib/plot-codes";
import { addDaysStr, thaiDateStr } from "@/lib/thai-date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const LOOKBACK_DAYS = 3;   // ทำงานที่แปลงนี้ใน 3 วันล่าสุด
const STALE_DAYS = 3;      // แต่ % ในผังไม่ขยับมา 3 วัน

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

/**
 * เตือนให้วิศวกรอัปเดต % ของแปลงที่กำลังทำอยู่ (Pom ถาม 7 ต.ค. 69 ว่า "จะแจ้งบอกยังไงให้เขาดำเนินการ")
 *
 * ไม่ใช้การไล่ถามเป็นครั้ง ๆ แต่ให้ระบบจับเองว่า "มีรายงานหน้างานที่แปลงนี้ แต่ตัวเลขในผังไม่ขยับ"
 * แล้วเตือนเฉพาะตอนที่ไม่ตรงกันจริง — วันไหนตรงกันก็เงียบ ไม่สแปม
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();

  const today = thaiDateStr();
  const since = addDaysStr(today, -LOOKBACK_DAYS);

  // 1) แปลงที่มีรายงานหน้างานใน 3 วันล่าสุด
  const { data: reports } = await db.from("work_reports")
    .select("id")
    .eq("report_type", "daily").eq("department", "ฝ่ายก่อสร้าง")
    .gte("report_date", since).in("status", ["submitted", "late"]);
  const reportIds = (reports ?? []).map(r => r.id as string);
  if (reportIds.length === 0) return NextResponse.json({ ok: true, skipped: "no-reports" });

  const { data: items } = await db.from("work_report_items")
    .select("description").in("report_id", reportIds);

  const worked = new Set<string>();
  for (const it of items ?? []) for (const c of plotCodesIn(it.description as string)) worked.add(c);
  if (worked.size === 0) return NextResponse.json({ ok: true, skipped: "no-plot-codes" });

  // 2) เทียบกับผัง — แปลงไหนที่ตัวเลขไม่ขยับมานานกว่าเกณฑ์
  const { data: houses } = await db.from("houses")
    .select("plot_code, progress, construction_status, updated_at")
    .eq("project_id", PROJECT_ID).in("plot_code", [...worked]);

  const staleCutMs = Date.now() - STALE_DAYS * 86_400_000;
  const stale = (houses ?? [])
    .filter(h => !h.updated_at || new Date(h.updated_at as string).getTime() < staleCutMs)
    .map(h => ({
      code: h.plot_code as string,
      progress: Number(h.progress ?? 0),
      days: h.updated_at
        ? Math.floor((Date.now() - new Date(h.updated_at as string).getTime()) / 86_400_000)
        : 999,
    }))
    .sort((a, b) => b.days - a.days);

  if (stale.length === 0) return NextResponse.json({ ok: true, stale: 0 });

  const lines = stale.map(s => `• ${s.code} — ผังขึ้น ${s.progress}% (ไม่ได้อัปเดต ${s.days} วัน)`).join("\n");

  // 3) เตือนวิศวกร/ฝ่ายก่อสร้างที่ต้องส่งรายงาน พร้อมบอกวิธีกดให้ชัด
  const { data: crew } = await db.from("employees")
    .select("email, full_name").eq("status", "active").eq("department", "ฝ่ายก่อสร้าง");

  const title = `🏗️ อัปเดตความคืบหน้าแปลงในผังด้วยครับ (${stale.length} แปลง)`;
  const body =
    `คุณรายงานหน้างานที่แปลงเหล่านี้ใน ${LOOKBACK_DAYS} วันล่าสุด แต่ตัวเลขในผังฝ่ายก่อสร้างยังไม่ขยับ:\n${lines}\n\n` +
    `วิธีอัปเดต (ใช้เวลาไม่ถึงนาที):\n` +
    `เมนู "งานรายวัน" → เขียนรายการงานขึ้นต้นด้วยรหัสแปลงตามปกติ → ใต้รายการงานจะมีการ์ด "อัปเดตความคืบหน้าแปลง" ขึ้นมาเอง → เลื่อนแถบให้ตรงหน้างาน → กด "บันทึกลงผังก่อสร้าง"\n\n` +
    `ผู้บริหารดูความคืบหน้าจากผังนี้ ถ้าไม่อัปเดตจะเห็นว่างานไม่เดินทั้งที่ทำอยู่จริง`;

  let notified = 0, lineSent = 0;
  for (const c of crew ?? []) {
    const email = (c.email ?? "").toLowerCase();
    if (!email) continue;
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "info", to_user_email: email, from_dept: "ระบบก่อสร้าง",
      title, message: body, is_read: false, link: "/reports",
    }).then(() => {}, () => {});
    await sendPush({ userEmail: email }, { title, body, url: "/reports", tag: "construction-progress" }).catch(() => {});
    const res = await sendLineToEmail(db, email, `${title}\n\n${body}`, { kind: "construction_progress", title });
    if (res.ok) lineSent++;
    notified++;
  }

  // 4) สรุปให้ผู้บริหารเฉพาะตอนที่ค้างนานจริง (เกิน 7 วัน) — ไม่งั้นเป็นเรื่องของหน้างานกันเอง
  const longStale = stale.filter(s => s.days >= 7);
  if (longStale.length > 0) {
    const eTitle = `🏗️ ผังก่อสร้างไม่ตรงหน้างาน ${longStale.length} แปลง`;
    const eBody = `${longStale.map(s => `• ${s.code} — ผังขึ้น ${s.progress}% (ค้าง ${s.days} วัน)`).join("\n")}\n\n` +
      `มีรายงานหน้างานที่แปลงเหล่านี้ แต่ตัวเลขในผังไม่ถูกอัปเดต — ระบบแจ้งฝ่ายก่อสร้างแล้ว`;
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "warning", to_dept: "ผู้บริหาร", from_dept: "ระบบก่อสร้าง",
      title: eTitle, message: eBody, is_read: false, link: "/construction",
    }).then(() => {}, () => {});

    try {
      const [{ data: links }, { data: roleRows }] = await Promise.all([
        db.from("line_links").select("user_email").not("linked_at", "is", null),
        db.from("users").select("email, role"),
      ]);
      const roleByEmail = new Map((roleRows ?? []).map(u => [(u.email ?? "").toLowerCase(), u.role as string | null]));
      for (const l of links ?? []) {
        const email = (l.user_email ?? "").toLowerCase();
        if (email && isManagerRole(roleByEmail.get(email))) {
          await sendLineToEmail(db, email, `${eTitle}\n\n${eBody}`, { kind: "construction_progress", title: eTitle });
        }
      }
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ ok: true, stale: stale.length, notified, lineSent, codes: stale.map(s => s.code) });
}
