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

  const byId = await supabaseAdmin
    .from("visitor_passes")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  let pass = byId.data;
  if (!pass) {
    const byToken = await supabaseAdmin
      .from("visitor_passes")
      .select("id, status")
      .eq("qr_token", id)
      .maybeSingle();
    pass = byToken.data;
  }
  if (!pass) return NextResponse.json({ error: "pass_not_found" }, { status: 404 });
  if (pass.status !== "checked_in") {
    return NextResponse.json({ error: "not_checked_in" }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from("visitor_passes")
    .update({ status: "checked_out", checked_out_at: new Date().toISOString() })
    .eq("id", pass.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_log").insert({
    module: "aviva_plus",
    action: "visitor_checked_out",
    description: `รปภ. เช็คเอาท์ผู้มาเยือน pass ${pass.id}`,
    performed_by: caller.user_metadata?.full_name ?? caller.email ?? "guard",
    record_id: pass.id,
  });

  return NextResponse.json({ ok: true });
}
