import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush, type PushTarget, type PushPayload } from "@/lib/push-notify";

export const runtime = "nodejs";

// อนุญาตเฉพาะผู้ใช้ที่ล็อกอิน (Bearer token) หรือผู้เรียกภายในที่มี secret — กัน open relay ยิง push ปลอม
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-internal-secret") === secret) return true;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await sb.auth.getUser(token);
    return !error && !!data.user;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let payload: PushPayload & PushTarget;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!payload?.title || !payload?.body) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }
  const result = await sendPush(
    { department: payload.department, userEmail: payload.userEmail },
    { title: payload.title, body: payload.body, url: payload.url, tag: payload.tag }
  );
  return NextResponse.json({ ok: true, ...result });
}
