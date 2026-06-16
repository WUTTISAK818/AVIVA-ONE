import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { supabaseAdmin, getAuthUserFromRequest } from "@/lib/supabase-server";

const STAFF_ROLES = ["admin", "manager", "ceo", "director", "guard"];

export async function POST(req: Request) {
  const caller = await getAuthUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.visitor_name || !body?.expected_at) {
    return NextResponse.json({ error: "visitor_name and expected_at required" }, { status: 400 });
  }

  const callerRole = (caller.user_metadata?.role as string) ?? "";
  const isStaff = STAFF_ROLES.includes(callerRole);

  let hostResidentId: string | null = body.host_resident_id ?? null;
  if (!isStaff) {
    const { data: resident } = await supabaseAdmin
      .from("residents")
      .select("id")
      .eq("auth_user_id", caller.id)
      .maybeSingle();
    if (!resident) {
      return NextResponse.json({ error: "no resident profile" }, { status: 403 });
    }
    hostResidentId = resident.id;
  }
  if (!hostResidentId) {
    return NextResponse.json({ error: "host_resident_id required for staff" }, { status: 400 });
  }

  const expectedAt = new Date(body.expected_at);
  if (Number.isNaN(expectedAt.getTime())) {
    return NextResponse.json({ error: "invalid expected_at" }, { status: 400 });
  }
  const expiresAt = body.expires_at
    ? new Date(body.expires_at)
    : new Date(expectedAt.getTime() + 6 * 60 * 60 * 1000); // default 6h window

  const { data: visitor, error: vErr } = await supabaseAdmin
    .from("visitors")
    .insert({
      host_resident_id: hostResidentId,
      visitor_name: body.visitor_name,
      visitor_phone: body.visitor_phone ?? null,
      visitor_id_last4: body.visitor_id_last4 ?? null,
      license_plate: body.license_plate ?? null,
      purpose: body.purpose ?? null,
      expected_at: expectedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (vErr || !visitor) {
    return NextResponse.json({ error: vErr?.message ?? "visitor insert failed" }, { status: 500 });
  }

  const qrToken = nanoid(32);
  const { data: pass, error: pErr } = await supabaseAdmin
    .from("visitor_passes")
    .insert({ visitor_id: visitor.id, qr_token: qrToken, status: "pending" })
    .select("id, qr_token, status")
    .single();
  if (pErr || !pass) {
    return NextResponse.json({ error: pErr?.message ?? "pass insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    visitor_id: visitor.id,
    pass_id: pass.id,
    qr_token: pass.qr_token,
    expires_at: expiresAt.toISOString(),
  });
}
