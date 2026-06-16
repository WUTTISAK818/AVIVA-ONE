import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserFromRequest } from "@/lib/supabase-server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await getAuthUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.slip_url) return NextResponse.json({ error: "slip_url required" }, { status: 400 });

  const { data: bill } = await supabaseAdmin
    .from("bills")
    .select("id, resident_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!bill) return NextResponse.json({ error: "bill_not_found" }, { status: 404 });

  const role = (caller.user_metadata?.role as string) ?? "";
  const isStaff = ["admin", "manager", "ceo", "director"].includes(role);
  if (!isStaff) {
    const { data: resident } = await supabaseAdmin
      .from("residents")
      .select("id")
      .eq("auth_user_id", caller.id)
      .maybeSingle();
    if (!resident || resident.id !== bill.resident_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { error } = await supabaseAdmin
    .from("bills")
    .update({ slip_url: body.slip_url, payment_ref: body.payment_ref ?? null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("notifications").insert({
    type: "info",
    title: "มีสลิปโอนใหม่",
    message: `บิล ${id.slice(0, 8)} รอตรวจสอบ`,
    record_id: id,
  });

  return NextResponse.json({ ok: true });
}
