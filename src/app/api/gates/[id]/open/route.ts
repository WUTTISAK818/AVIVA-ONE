import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserFromRequest } from "@/lib/supabase-server";

const ALLOWED_ROLES = ["admin", "manager", "ceo", "director", "guard"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await getAuthUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = (caller.user_metadata?.role as string) ?? "";
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const { data: gate } = await supabaseAdmin
    .from("gates")
    .select("id, code, name_th, direction")
    .eq("id", id)
    .maybeSingle();
  if (!gate) return NextResponse.json({ error: "unknown_gate" }, { status: 404 });

  const { data: event, error } = await supabaseAdmin
    .from("gate_events")
    .insert({
      gate_id: gate.id,
      event_type: "manual_open",
      match_type: "manual",
      action: "manual_open",
      decided_by: caller.id,
      raw_payload: { source: "manual_console", reason: body.reason ?? null },
    })
    .select("id")
    .single();
  if (error || !event) return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });

  await supabaseAdmin.from("audit_log").insert({
    module: "aviva_plus",
    action: "gate_manual_open",
    description: `เปิดประตู ${gate.name_th} (${gate.code}) ด้วยมือ${body.reason ? ` — ${body.reason}` : ""}`,
    performed_by: caller.user_metadata?.full_name ?? caller.email ?? "guard",
    record_id: gate.id,
  });

  return NextResponse.json({ ok: true, event_id: event.id });
}
