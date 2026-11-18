import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/server-db";
import { sendLineToEmail, type LineKind } from "@/lib/line-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** kind ที่ฝั่งแอปส่งมาได้ — นอกเหนือจากนี้บันทึกเป็น app_notify */
const CLIENT_KINDS = new Set<LineKind>(["app_notify", "directive_sent", "edit_request"]);

/**
 * ส่งแจ้งเตือนเข้า LINE "ส่วนตัว" ของผู้ใช้ที่ผูกบัญชีไว้ (ตาราง line_links)
 * เรียกจาก notifyPersonalLine() ฝั่ง client พร้อม access token ของผู้ใช้ที่ล็อกอิน
 *
 * v8.14 (Pom อนุมัติ 17 พ.ย. 69 — LINE เกินโควตาตั้งแต่ 13 พ.ย.):
 *  1. ส่ง "เฉพาะอีเมลที่ระบุ" เท่านั้น — ไม่มีผู้รับ = ไม่ส่ง
 *     เดิมถ้าไม่ระบุอีเมล (เช่น แจ้งฝ่ายการเงินที่ไม่มีใครผูก LINE) ระบบส่งถึง "ทุกคนที่ผูกบัญชี"
 *     แจ้งรับชำระงวด 15 ครั้งจึงกลายเป็น 45 ข้อความถึง Pom ฟ้า เดียร์ ทั้งที่ไม่เกี่ยวกับงานของคนรับ
 *  2. ผู้เรียกต้องเป็นผู้ใช้ที่ล็อกอินจริง — เดิมเช็กแค่ว่ามีข้อความ "Bearer ..." ส่งมา
 *     ใครยิงเข้ามาก็สั่งส่ง LINE ได้ (เปลืองโควตา + ส่งข้อความในนามบริษัทได้)
 *  3. ทุกข้อความลงบันทึก line_message_log (เดิมทางนี้ไม่บันทึก นับยอดใช้จริงไม่ได้)
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ ok: false, skipped: "no-auth" }, { status: 401 });

  const db = serverDb(token);
  const { data: auth, error: authErr } = await db.auth.getUser(token);
  if (authErr || !auth?.user) return NextResponse.json({ ok: false, skipped: "invalid-auth" }, { status: 401 });

  let p: { title?: string; body?: string; url?: string; emails?: string[]; kind?: string };
  try { p = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!p?.title || !p?.body) return NextResponse.json({ error: "title and body required" }, { status: 400 });

  const emails = Array.from(new Set((p.emails ?? []).map((e) => (e ?? "").trim().toLowerCase()).filter(Boolean)));
  if (emails.length === 0) return NextResponse.json({ ok: true, sent: 0, skipped: "no-recipients" });

  const kind: LineKind = CLIENT_KINDS.has(p.kind as LineKind) ? (p.kind as LineKind) : "app_notify";
  const text = `${p.title}\n${p.body}` + (p.url ? `\nเปิดดู: ${p.url}` : "");
  let sent = 0;
  for (const email of emails) {
    const r = await sendLineToEmail(db, email, text, { kind, title: p.title });
    if (r.ok) sent++;
  }
  return NextResponse.json({ ok: true, sent });
}
