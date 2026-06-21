import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { replyLine } from "@/lib/line";
import { verifyLineSignature } from "@/lib/api-auth";

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
  source?: { type?: string; userId?: string; groupId?: string; roomId?: string };
  message?: { type: string; text?: string };
}

export async function POST(req: NextRequest) {
  // Verify LINE webhook signature to prevent spoofed payloads
  const signature = req.headers.get("x-line-signature");
  const lineChannelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!signature || !lineChannelSecret) {
    console.error("Missing LINE signature or channel secret");
    return NextResponse.json({ ok: false, error: "Webhook validation failed" }, { status: 401 });
  }

  // Clone request to read body for signature verification
  const bodyText = await req.text();
  if (!verifyLineSignature(bodyText, signature, lineChannelSecret)) {
    console.error("Invalid LINE webhook signature");
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let body: { events?: LineEvent[] };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const db = admin();

  for (const ev of body.events ?? []) {
    if (ev.type !== "message" || ev.message?.type !== "text") continue;
    const text = (ev.message.text ?? "").trim();
    const src = ev.source ?? {};

    // /id — ตอบ ID ของแหล่งที่มา (groupId ในกลุ่ม / userId ในแชทเดี่ยว)
    // ใช้ดึงค่าไปตั้ง LINE_SALE_GROUP_ID ใน Vercel
    if (text.toLowerCase() === "/id" || text === "ไอดี") {
      const id = src.groupId ?? src.roomId ?? src.userId ?? "(ไม่พบ)";
      const label = src.groupId ? "Group ID" : src.roomId ? "Room ID" : "User ID";
      if (ev.replyToken) await replyLine(ev.replyToken, `${label}:\n${id}\n\nคัดลอก ID นี้ส่งให้ผู้ดูแลระบบ AVIVA ONE เพื่อเปิดแจ้งเตือนเข้ากลุ่มนี้`);
      continue;
    }

    const userId = src.userId;
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
