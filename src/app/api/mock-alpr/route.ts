import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserFromRequest } from "@/lib/supabase-server";
import { processGateEvent } from "@/lib/gate-events";

const ADMIN_ROLES = ["admin", "manager", "ceo", "director"];

export async function POST(req: Request) {
  const caller = await getAuthUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = (caller.user_metadata?.role as string) ?? "";
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.gate_code || !body?.plate) {
    return NextResponse.json({ error: "gate_code and plate required" }, { status: 400 });
  }

  const { data: gate } = await supabaseAdmin
    .from("gates")
    .select("id, code, direction, is_active")
    .eq("code", body.gate_code)
    .maybeSingle();
  if (!gate || !gate.is_active) {
    return NextResponse.json({ error: "unknown_gate" }, { status: 404 });
  }

  const confidence = typeof body.confidence === "number" ? body.confidence : 0.94;

  try {
    const decision = await processGateEvent(
      {
        license_plate: body.plate,
        confidence,
        timestamp: new Date().toISOString(),
        event_type: "plate_detected",
        photo_url: body.photo_url ?? null,
      },
      { id: gate.id, code: gate.code, direction: gate.direction },
      { manualDecidedBy: caller.id }
    );
    return NextResponse.json({ ok: true, ...decision });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}
