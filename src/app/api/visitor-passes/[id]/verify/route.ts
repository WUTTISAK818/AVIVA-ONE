import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserFromRequest } from "@/lib/supabase-server";

const GUARD_ROLES = ["admin", "manager", "ceo", "director", "guard"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await getAuthUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const callerRole = (caller.user_metadata?.role as string) ?? "";
  if (!GUARD_ROLES.includes(callerRole)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const gateId: string | null = body.gate_id ?? null;

  // Allow lookup by id OR qr_token (passed as the [id] param if guard pasted the token)
  let pass;
  const byId = await supabaseAdmin
    .from("visitor_passes")
    .select("id, status, visitor_id, qr_token")
    .eq("id", id)
    .maybeSingle();
  if (byId.data) {
    pass = byId.data;
  } else {
    const byToken = await supabaseAdmin
      .from("visitor_passes")
      .select("id, status, visitor_id, qr_token")
      .eq("qr_token", id)
      .maybeSingle();
    pass = byToken.data;
  }
  if (!pass) return NextResponse.json({ error: "pass_not_found" }, { status: 404 });
  if (pass.status === "checked_in") {
    return NextResponse.json({ error: "already_checked_in" }, { status: 409 });
  }
  if (pass.status === "blocked" || pass.status === "expired") {
    return NextResponse.json({ error: pass.status }, { status: 403 });
  }

  const { error: uErr } = await supabaseAdmin
    .from("visitor_passes")
    .update({
      status: "checked_in",
      checked_in_at: new Date().toISOString(),
      checked_in_by: caller.id,
      checked_in_gate: gateId,
    })
    .eq("id", pass.id);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  // Log a manual gate event so admin sees it in the gate feed
  await supabaseAdmin.from("gate_events").insert({
    gate_id: gateId,
    event_type: "manual_open",
    match_type: "manual",
    matched_id: pass.id,
    matched_table: "visitor_passes",
    action: "manual_open",
    decided_by: caller.id,
    raw_payload: { source: "guard_verify", qr_token: pass.qr_token },
  });

  await supabaseAdmin.from("audit_log").insert({
    module: "aviva_plus",
    action: "visitor_checked_in",
    description: `รปภ. เช็คอินผู้มาเยือน pass ${pass.id}`,
    performed_by: caller.user_metadata?.full_name ?? caller.email ?? "guard",
    record_id: pass.id,
  });

  return NextResponse.json({ ok: true, pass_id: pass.id });
}
