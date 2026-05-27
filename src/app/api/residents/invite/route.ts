import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserFromRequest } from "@/lib/supabase-server";

const ADMIN_ROLES = ["admin", "manager", "ceo", "director"];

export async function POST(req: Request) {
  const caller = await getAuthUserFromRequest(req);
  if (!caller) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const callerRole = (caller.user_metadata?.role as string) ?? "";
  if (!ADMIN_ROLES.includes(callerRole)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.full_name) {
    return NextResponse.json({ error: "email and full_name required" }, { status: 400 });
  }

  const memberId: string | null = body.member_id ?? null;
  const phone: string | null = body.phone ?? null;
  const residentType: string = body.resident_type ?? "owner";

  const { data: inviteData, error: inviteErr } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(body.email, {
      data: { full_name: body.full_name, role: "resident", department: "ลูกบ้าน" },
    });

  if (inviteErr || !inviteData?.user) {
    return NextResponse.json(
      { error: inviteErr?.message ?? "invite failed" },
      { status: 400 }
    );
  }

  const { error: residentErr } = await supabaseAdmin.from("residents").insert({
    auth_user_id: inviteData.user.id,
    member_id: memberId,
    full_name: body.full_name,
    phone,
    resident_type: residentType,
  });

  if (residentErr) {
    return NextResponse.json(
      { error: residentErr.message, user_created: true },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("audit_log").insert({
    module: "aviva_plus",
    action: "resident_invited",
    description: `เชิญลูกบ้าน ${body.full_name} (${body.email})`,
    performed_by: caller.user_metadata?.full_name ?? caller.email ?? "admin",
  });

  return NextResponse.json({ ok: true, user_id: inviteData.user.id });
}
