import { NextResponse } from "next/server";
import generatePayload from "promptpay-qr";
import { supabaseAdmin, getAuthUserFromRequest } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const caller = await getAuthUserFromRequest(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.bill_id) return NextResponse.json({ error: "bill_id required" }, { status: 400 });

  const promptpayId = process.env.PROMPTPAY_ID;
  if (!promptpayId) {
    return NextResponse.json({ error: "PROMPTPAY_ID not configured" }, { status: 500 });
  }

  const { data: bill, error } = await supabaseAdmin
    .from("bills")
    .select("id, resident_id, amount, status, promptpay_payload")
    .eq("id", body.bill_id)
    .maybeSingle();
  if (error || !bill) return NextResponse.json({ error: "bill_not_found" }, { status: 404 });

  // verify resident owns this bill (admins also allowed)
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

  if (bill.promptpay_payload) {
    return NextResponse.json({ payload: bill.promptpay_payload });
  }

  const payload = generatePayload(promptpayId, { amount: Number(bill.amount) });
  await supabaseAdmin.from("bills").update({ promptpay_payload: payload }).eq("id", bill.id);
  return NextResponse.json({ payload });
}
