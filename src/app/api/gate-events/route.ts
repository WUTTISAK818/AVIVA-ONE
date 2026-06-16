import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { processGateEvent, type AlprPayload } from "@/lib/gate-events";

export async function POST(req: Request) {
  const secret = req.headers.get("x-gate-secret") ?? "";
  const body = (await req.json().catch(() => null)) as (AlprPayload & { gate_id?: string }) | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const gateCode = body.gate_id;
  if (!gateCode) return NextResponse.json({ error: "gate_id_required" }, { status: 400 });

  const { data: gate } = await supabaseAdmin
    .from("gates")
    .select("id, code, direction, webhook_secret, is_active")
    .eq("code", gateCode)
    .maybeSingle();
  if (!gate || !gate.is_active) {
    return NextResponse.json({ error: "unknown_gate" }, { status: 404 });
  }
  if (!secret || secret !== gate.webhook_secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const decision = await processGateEvent(body, { id: gate.id, code: gate.code, direction: gate.direction });
    return NextResponse.json({
      ok: true,
      action: decision.action,
      match_type: decision.match_type,
      event_id: decision.event_id,
      reason: decision.reason ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}
