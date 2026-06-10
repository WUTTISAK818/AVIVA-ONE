import { NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/server-db";
import { sendLine } from "@/lib/line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ส่งแจ้งเตือนเข้า LINE "ส่วนตัว" ของผู้ใช้ที่ผูกบัญชีไว้ (ตาราง line_links)
 * เรียกจาก notifyPersonalLine() ฝั่ง client พร้อม access token ของผู้ใช้ที่ล็อกอิน
 * - อ่าน line_links ด้วยสิทธิ์ผู้ใช้ (RLS: linelinks_all_auth) — ไม่ต้องพึ่ง service role ใน Vercel
 * - ส่งได้เฉพาะบัญชีที่ linked_at ไม่ว่าง
 * best-effort ทั้งหมด: ไม่มีคนผูก/ไม่มี token ก็ตอบ ok แล้วข้ามเงียบ
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ ok: false, skipped: "no-auth" });

  let p: { title?: string; body?: string; url?: string; emails?: string[] };
  try { p = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!p?.title || !p?.body) return NextResponse.json({ error: "title and body required" }, { status: 400 });

  const db = serverDb(token);
  let q = db.from("line_links").select("line_user_id, user_email").not("linked_at", "is", null);
  // ถ้าระบุ emails มา ส่งเฉพาะคนเหล่านั้น ไม่งั้นส่งทุกคนที่ผูกบัญชี
  if (p.emails && p.emails.length > 0) q = q.in("user_email", p.emails);
  const { data: links } = await q;

  const targets = (links ?? []).map(l => l.line_user_id as string).filter(Boolean);
  if (targets.length === 0) return NextResponse.json({ ok: true, sent: 0, skipped: "no-linked-users" });

  const text = `${p.title}\n${p.body}` + (p.url ? `\nเปิดดู: ${p.url}` : "");
  const results = await Promise.allSettled(targets.map(id => sendLine(id, text)));
  const sent = results.reduce((n, r) => n + (r.status === "fulfilled" && r.value.ok ? 1 : 0), 0);
  return NextResponse.json({ ok: true, sent });
}
