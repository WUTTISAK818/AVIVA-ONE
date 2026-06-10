// LINE webhook — รับ event จาก LINE OA แล้วผูกบัญชี/ตอบกลับ
// รันบน Supabase Edge Function: มี SUPABASE_SERVICE_ROLE_KEY ในตัว (ไม่ต้องตั้งใน Vercel)
// verify_jwt = false เพราะ LINE ยิงเข้ามาโดยไม่มี JWT (เป็น public webhook)
// Deploy: ผ่าน Supabase MCP deploy_edge_function (slug: line-webhook)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type?: string; userId?: string; groupId?: string; roomId?: string };
  message?: { type: string; text?: string };
}

// โทเคน LINE: env ก่อน ไม่งั้นอ่านจาก app_settings.line_channel_access_token (ตั้งในแอปได้)
async function getLineToken(db: ReturnType<typeof createClient>): Promise<string | undefined> {
  const envTok = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (envTok) return envTok;
  const { data } = await db.from("app_settings").select("value").eq("key", "line_channel_access_token").maybeSingle();
  return (data?.value as string | undefined) ?? undefined;
}

async function reply(token: string, replyToken: string, text: string): Promise<void> {
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    });
  } catch (_e) { /* best-effort */ }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }
  let body: { events?: LineEvent[] };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }); }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const token = await getLineToken(db);

  for (const ev of body.events ?? []) {
    if (ev.type !== "message" || ev.message?.type !== "text") continue;
    const text = (ev.message.text ?? "").trim();
    const src = ev.source ?? {};

    // /id หรือ "ไอดี" — ตอบ ID ของแหล่งที่มา (ใช้ตั้ง group id สำหรับแจ้งเตือนเข้ากลุ่ม)
    if (text.toLowerCase() === "/id" || text === "ไอดี") {
      const id = src.groupId ?? src.roomId ?? src.userId ?? "(ไม่พบ)";
      const label = src.groupId ? "Group ID" : src.roomId ? "Room ID" : "User ID";
      if (token && ev.replyToken) await reply(token, ev.replyToken, `${label}:\n${id}\n\nคัดลอก ID นี้ส่งให้ผู้ดูแลระบบ AVIVA ONE เพื่อเปิดแจ้งเตือนเข้ากลุ่มนี้`);
      continue;
    }

    const userId = src.userId;
    if (!userId) continue;

    // รหัส 6 หลัก — จับคู่กับ line_links ที่ยังไม่ผูก
    const m = text.match(/\b(\d{6})\b/);
    if (m) {
      const code = m[1];
      const { data: link } = await db.from("line_links").select("link_code").eq("link_code", code).is("linked_at", null).maybeSingle();
      if (link) {
        await db.from("line_links").update({ line_user_id: userId, linked_at: new Date().toISOString(), status: "linked" }).eq("link_code", code);
        if (token && ev.replyToken) await reply(token, ev.replyToken, "ผูกบัญชี AVIVA ONE สำเร็จ ✅ คุณจะได้รับแจ้งเตือนทาง LINE");
      } else if (token && ev.replyToken) {
        await reply(token, ev.replyToken, "รหัสไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่ในแอป AVIVA ONE");
      }
    } else if (token && ev.replyToken) {
      await reply(token, ev.replyToken, "พิมพ์รหัส 6 หลักจากหน้าตั้งค่าในแอป AVIVA ONE เพื่อผูกบัญชีรับแจ้งเตือน");
    }
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
