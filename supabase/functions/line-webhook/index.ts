// LINE webhook — OA เดียว ใช้ทั้ง "พนักงานผูกบัญชี" และ "ลูกค้าคุยกับโครงการ"
// รันบน Supabase Edge Function: มี SUPABASE_SERVICE_ROLE_KEY ในตัว (ไม่ต้องตั้งใน Vercel)
// verify_jwt = false เพราะ LINE ยิงเข้ามาโดยไม่มี JWT
//
// พฤติกรรม:
//  - /id หรือ "ไอดี"          -> ตอบ Group/User ID (ใช้ตั้งกลุ่มแจ้งเตือน)
//  - รหัส 6 หลัก ตรงกับที่ขอ -> ผูกบัญชีพนักงาน (line_links) + ตอบยืนยัน
//  - ข้อความจากพนักงานที่ผูกแล้ว -> เงียบ (กันสแปม)
//  - ข้อความจาก "ลูกค้า"      -> เก็บลง line_conversations + AI สรุป + เด้งงานให้เซล (ไม่ตอบกลับลูกค้า)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

type DB = ReturnType<typeof createClient>;

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type?: string; userId?: string; groupId?: string; roomId?: string };
  message?: { type: string; text?: string };
}

async function getSetting(db: DB, key: string, env?: string): Promise<string | undefined> {
  if (env) return env;
  const { data } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
  const v = data?.value as string | undefined;
  return v && v.length > 0 ? v : undefined;
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

async function push(token: string, to: string, text: string): Promise<void> {
  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    });
  } catch (_e) { /* best-effort */ }
}

async function getProfile(token: string, userId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return undefined;
    const j = await res.json();
    return j?.displayName as string | undefined;
  } catch { return undefined; }
}

// AI สรุปบทสนทนา + ความสนใจ + แนะนำคำตอบ (haiku, key จาก app_settings) — คืน null ถ้าไม่มี key/พลาด
async function aiSummary(apiKey: string | undefined, convo: string, name: string):
  Promise<{ summary: string; intent: string; suggestion: string } | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        system: "คุณคือผู้ช่วยฝ่ายขายอสังหาฯ โครงการ AVIVA วิเคราะห์บทสนทนาลูกค้าที่ทักเข้า LINE OA แล้วตอบเป็น JSON เท่านั้น: {\"summary\":\"สรุปสั้นๆ ลูกค้าต้องการอะไร 1-2 ประโยค\",\"intent\":\"ระดับความสนใจ/สิ่งที่สนใจ เช่น สอบถามราคา/นัดชมโครงการ/สนใจแปลงมุม\",\"suggestion\":\"ข้อความที่เซลควรตอบกลับ สุภาพ กระชับ พร้อมส่ง\"} ห้ามมีข้อความอื่นนอก JSON",
        messages: [{ role: "user", content: `ลูกค้าชื่อ ${name}\nบทสนทนาล่าสุด (in=ลูกค้า, out=เรา):\n${convo}` }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text: string = (j.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const s = text.indexOf("{"); const e = text.lastIndexOf("}");
    if (s < 0 || e <= s) return null;
    const parsed = JSON.parse(text.slice(s, e + 1));
    return { summary: parsed.summary ?? "", intent: parsed.intent ?? "", suggestion: parsed.suggestion ?? "" };
  } catch { return null; }
}

// จัดการข้อความลูกค้า: เก็บ + AI + เด้งเซล (รันเบื้องหลังหลังตอบ LINE แล้ว)
async function handleCustomerMessage(db: DB, token: string, userId: string, text: string): Promise<void> {
  const displayName = (await getProfile(token, userId)) ?? "ลูกค้า LINE";

  // จับคู่กับ lead ใน CRM (ถ้าเคยเติม line_user_id ไว้)
  const { data: lead } = await db.from("leads")
    .select("id, customer_name, assigned_to").eq("line_user_id", userId).limit(1).maybeSingle();

  await db.from("line_conversations").insert({
    project_id: PROJECT_ID,
    line_user_id: userId,
    display_name: displayName,
    direction: "in",
    message: text,
    lead_id: (lead?.id as string | undefined) ?? null,
  });

  // ประวัติล่าสุดของลูกค้าคนนี้ (ไว้ให้ AI มีบริบท)
  const { data: hist } = await db.from("line_conversations")
    .select("direction, message").eq("line_user_id", userId)
    .order("created_at", { ascending: false }).limit(15);
  const convo = (hist ?? []).reverse().map(h => `${h.direction}: ${h.message}`).join("\n");

  const apiKey = await getSetting(db, "ANTHROPIC_API_KEY", Deno.env.get("ANTHROPIC_API_KEY"));
  const ai = await aiSummary(apiKey, convo, displayName);

  // ประกอบข้อความเด้งเซล
  const leadName = lead?.customer_name as string | undefined;
  let msg = `💬 ลูกค้าทัก LINE OA\n👤 ${displayName}${leadName ? ` (CRM: ${leadName})` : " (ยังไม่อยู่ใน CRM)"}\n📩 "${text}"`;
  if (ai) {
    msg += `\n\n🤖 สรุป: ${ai.summary}`;
    if (ai.intent) msg += `\n🎯 สนใจ: ${ai.intent}`;
    if (ai.suggestion) msg += `\n💡 แนะนำตอบ:\n${ai.suggestion}`;
  }
  const siteUrl = await getSetting(db, "site_url", Deno.env.get("NEXT_PUBLIC_SITE_URL"));
  if (siteUrl) msg += `\n\n🔗 เปิด CRM: ${siteUrl}/crm`;

  // ปลายทาง: กลุ่มทีมขาย (ถ้าตั้งไว้ ประหยัดโควต้า) ไม่งั้นส่งเข้าพนักงานทุกคนที่ผูกบัญชี
  const saleGroup = await getSetting(db, "line_sale_group_id", Deno.env.get("LINE_SALE_GROUP_ID"));
  if (saleGroup) {
    await push(token, saleGroup, msg);
  } else {
    const { data: staff } = await db.from("line_links")
      .select("line_user_id").not("linked_at", "is", null);
    const ids = (staff ?? []).map(s => s.line_user_id as string).filter(Boolean);
    await Promise.allSettled(ids.map(id => push(token, id, msg)));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }
  let body: { events?: LineEvent[] };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }); }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const token = await getSetting(db, "line_channel_access_token", Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN"));
  const background: Promise<void>[] = [];

  for (const ev of body.events ?? []) {
    if (ev.type !== "message" || ev.message?.type !== "text") continue;
    const text = (ev.message.text ?? "").trim();
    const src = ev.source ?? {};

    // /id — ตอบ ID ของแหล่งที่มา (ใช้ตั้ง group id แจ้งเตือน)
    if (text.toLowerCase() === "/id" || text === "ไอดี") {
      const id = src.groupId ?? src.roomId ?? src.userId ?? "(ไม่พบ)";
      const label = src.groupId ? "Group ID" : src.roomId ? "Room ID" : "User ID";
      if (token && ev.replyToken) await reply(token, ev.replyToken, `${label}:\n${id}\n\nคัดลอก ID นี้ส่งให้ผู้ดูแลระบบ AVIVA ONE`);
      continue;
    }

    const userId = src.userId;
    if (!userId) continue;

    // รหัส 6 หลัก "ทั้งข้อความ" ที่ตรงกับรหัสที่ยังไม่ผูก -> ผูกบัญชีพนักงาน
    const m = text.match(/^(\d{6})$/);
    if (m) {
      const { data: link } = await db.from("line_links").select("link_code").eq("link_code", m[1]).is("linked_at", null).maybeSingle();
      if (link) {
        await db.from("line_links").update({ line_user_id: userId, linked_at: new Date().toISOString(), status: "linked" }).eq("link_code", m[1]);
        if (token && ev.replyToken) await reply(token, ev.replyToken, "ผูกบัญชี AVIVA ONE สำเร็จ ✅ คุณจะได้รับแจ้งเตือนทาง LINE");
        continue;
      }
      // ไม่ตรงรหัส -> ตกไปเป็นข้อความลูกค้าด้านล่าง (ไม่ตอบ error กันลูกค้างง)
    }

    // ข้ามถ้าเป็น "พนักงานที่ผูกบัญชีแล้ว" (ไม่ใช่ลูกค้า) กันสแปมทีมขายกันเอง
    const { data: staffMatch } = await db.from("line_links").select("user_email").eq("line_user_id", userId).not("linked_at", "is", null).maybeSingle();
    if (staffMatch) continue;

    // ลูกค้าจริง -> ทำงานเบื้องหลัง (เก็บ + AI + เด้งเซล) เพื่อตอบ LINE 200 ทันที
    if (token) background.push(handleCustomerMessage(db, token, userId, text));
  }

  // ตอบ LINE ทันที แล้วให้งานหนัก (AI) รันต่อเบื้องหลัง
  if (background.length > 0) {
    // @ts-ignore EdgeRuntime มีใน Supabase Edge Functions
    EdgeRuntime.waitUntil(Promise.allSettled(background));
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
