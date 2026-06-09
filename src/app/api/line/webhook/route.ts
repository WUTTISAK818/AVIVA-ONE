import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { replyLine } from "@/lib/line";

export const runtime = "nodejs";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
}

export async function POST(req: NextRequest) {
  let body: { events?: LineEvent[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }
  const db = admin();

  for (const ev of body.events ?? []) {
    if (ev.type !== "message" || ev.message?.type !== "text") continue;
    const userId = ev.source?.userId;
    const text = (ev.message.text ?? "").trim();
    if (!userId) continue;

    const m = text.match(/\b(\d{6})\b/);
    if (m) {
      const code = m[1];
      const { data: link } = await db.from("line_links").select("link_code").eq("link_code", code).is("linked_at", null).maybeSingle();
      if (link) {
        await db.from("line_links").update({ line_user_id: userId, linked_at: new Date().toISOString() }).eq("link_code", code);
        if (ev.replyToken) await replyLine(ev.replyToken, "ผูกบัญชี AVIVA ONE สำเร็จ ✅ คุณจะได้รับแจ้งเตือนทาง LINE");
      } else if (ev.replyToken) {
        await replyLine(ev.replyToken, "รหัสไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่ในแอป");
      }
    } else if (ev.replyToken) {
      await replyLine(ev.replyToken, "พิมพ์รหัส 6 หลักจากหน้าตั้งค่าในแอป AVIVA ONE เพื่อผูกบัญชี");
    }
  }
  return NextResponse.json({ ok: true });
}
