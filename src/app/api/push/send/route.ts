import { NextRequest, NextResponse } from "next/server";
import { sendPush, type PushTarget, type PushPayload } from "@/lib/push-notify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
