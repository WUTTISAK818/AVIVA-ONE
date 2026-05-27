import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserFromRequest } from "@/lib/supabase-server";

const ADMIN_ROLES = ["admin", "manager", "ceo", "director"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await getAuthUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = (caller.user_metadata?.role as string) ?? "";
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const { data: bill } = await supabaseAdmin
    .from("bills")
    .select("id, amount, period_label, resident_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!bill) return NextResponse.json({ error: "bill_not_found" }, { status: 404 });
  if (bill.status === "paid") return NextResponse.json({ error: "already_paid" }, { status: 409 });

  // Insert a finance_transactions row to maintain the existing finance module's books
  const { data: txn } = await supabaseAdmin
    .from("finance_transactions")
    .insert({
      project_id: "aaaaaaaa-0000-0000-0000-000000000001",
      transaction_type: "income",
      amount: bill.amount,
      description: `ค่าส่วนกลาง ${bill.period_label} (bill ${bill.id.slice(0, 8)})`,
    })
    .select("id")
    .single();

  await supabaseAdmin
    .from("bills")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      finance_txn_id: txn?.id ?? null,
    })
    .eq("id", id);

  await supabaseAdmin.from("audit_log").insert({
    module: "aviva_plus",
    action: "bill_confirmed_paid",
    description: `ยืนยันรับชำระบิล ${bill.id.slice(0, 8)} จำนวน ${bill.amount}`,
    performed_by: caller.user_metadata?.full_name ?? caller.email ?? "admin",
    record_id: bill.id,
  });

  return NextResponse.json({ ok: true, finance_txn_id: txn?.id ?? null });
}
