import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispatchNotification } from "@/lib/dispatch-notification";

export const runtime = "nodejs";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const STATUS_TEXT: Record<string, string> = {
  approved: "งานของคุณได้รับการอนุมัติแล้ว",
  paid: "มีการจ่ายเงินงวดงานให้คุณแล้ว",
  rejected: "งานของคุณถูกตีกลับ กรุณาตรวจสอบ",
};

export async function POST(req: NextRequest) {
  let payload: { ref_code?: string; status?: string; detail?: string };
  try { payload = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const { ref_code, status, detail } = payload;
  if (!ref_code || !status) return NextResponse.json({ error: "ref_code and status required" }, { status: 400 });

  const db = admin();
  const { data: c } = await db.from("contractors").select("name, phone, line_user_id, ref_code").eq("ref_code", ref_code).maybeSingle();
  if (!c) return NextResponse.json({ error: "contractor not found" }, { status: 404 });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const trackUrl = site ? `${site}/track/${ref_code}` : undefined;
  const title = "AVIVA ONE — แจ้งสถานะงาน";
  const body = `${STATUS_TEXT[status] ?? status}${detail ? `\n${detail}` : ""}`;

  const result = await dispatchNotification({
    title,
    body,
    url: trackUrl,
    tag: `contractor-${ref_code}`,
    lineUserId: c.line_user_id ?? undefined,
    smsPhone: c.phone ?? undefined,
  });
  return NextResponse.json({ ok: true, ...result });
}
