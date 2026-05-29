import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

interface LineEvent {
  type: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!LINE_CHANNEL_SECRET || !signature) return false;
  const hash = crypto.createHmac("sha256", LINE_CHANNEL_SECRET).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // ยังไม่ได้ตั้งค่า credentials -> ตอบ 200 แบบ no-op (LINE ต้องการ 200)
  if (!LINE_CHANNEL_SECRET || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: true, skipped: "LINE credentials not configured" });
  }

  const signature = req.headers.get("x-line-signature");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    events = JSON.parse(rawBody).events ?? [];
  } catch {
    return NextResponse.json({ ok: true });
  }

  // webhook เขียนข้ามผู้ใช้ -> ใช้ service role (bypass RLS)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  for (const ev of events) {
    // ชาวบ้านสแกน QR -> เปิดแชต OA พร้อม token -> แตะส่ง -> message event ที่ text = token
    if (ev.type === "message" && ev.message?.type === "text" && ev.message.text) {
      const token = ev.message.text.trim();
      const lineUserId = ev.source?.userId ?? null;

      const { data: vrec } = await admin
        .from("winvote_phone_verifications")
        .select("id, resident_id, status, expires_at")
        .eq("token", token)
        .single();

      if (!vrec) continue;
      if (vrec.status === "verified") continue;
      if (new Date(vrec.expires_at) < new Date()) {
        await admin.from("winvote_phone_verifications").update({ status: "expired" }).eq("id", vrec.id);
        continue;
      }

      await admin
        .from("winvote_phone_verifications")
        .update({ status: "verified", verified_at: new Date().toISOString(), line_user_id: lineUserId })
        .eq("id", vrec.id);

      if (vrec.resident_id) {
        await admin
          .from("winvote_residents")
          .update({
            phone_verified: true,
            phone_verified_at: new Date().toISOString(),
            phone_verify_channel: "line",
            line_user_id: lineUserId,
          })
          .eq("id", vrec.resident_id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
