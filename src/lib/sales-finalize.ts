import { supabase } from "./supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export interface FinalizeResult {
  ok: boolean;
  customerName: string;
  plot: number | null;
  amount: number | null;
}

/**
 * Group C — ปิดการขายจริง (เรียกเมื่อผู้จัดการ "อนุมัติ" Contract_Approval):
 * - บ้าน = sold, สร้าง revenue_recognition (TFRS15) + finance_transactions (รายรับ)
 * - lead → Closed Deal + วันโอน + ผู้บันทึก
 * กันทำซ้ำ: ถ้า lead เป็น Closed Deal อยู่แล้วจะคืนค่าโดยไม่บันทึกซ้ำ
 */
export async function finalizeSale(
  leadId: string,
  byName: string,
  byUserId?: string | null,
): Promise<FinalizeResult> {
  const { data } = await supabase
    .from("leads")
    .select("customer_name, plot_number, contract_price, budget, status")
    .eq("id", leadId)
    .maybeSingle();
  const l = data as {
    customer_name?: string; plot_number?: number | null;
    contract_price?: number | null; budget?: number | null; status?: string;
  } | null;
  if (!l) return { ok: false, customerName: "", plot: null, amount: null };

  const customerName = l.customer_name ?? "";
  const plot = l.plot_number ?? null;
  const amount = l.contract_price ?? l.budget ?? null;
  if (l.status === "Closed Deal") return { ok: true, customerName, plot, amount };

  const today = new Date().toISOString().split("T")[0];
  const cv = amount && amount > 0 ? Number(amount) : 0;
  if (plot) await supabase.from("houses").update({ status: "sold" }).eq("project_id", PROJECT_ID).eq("plot_number", plot);
  await supabase.from("revenue_recognition").insert({
    house_number: plot ? String(plot) : null,
    contract_date: today, transfer_date: today,
    contract_value: cv, recognized_amount: cv, deferred_amount: 0, received_total: cv,
    status: "recognized", project_id: PROJECT_ID,
    notes: `โอนกรรมสิทธิ์ — ${customerName}`,
  });
  if (cv > 0) await supabase.from("finance_transactions").insert({
    transaction_type: "income", amount: cv, category: "รายได้จากการขาย",
    description: `รายได้โอนกรรมสิทธิ์ — ${customerName}${plot ? ` แปลง ${plot}` : ""}`,
    approved_by: byUserId ?? null, project_id: PROJECT_ID,
  });
  await supabase.from("leads").update({ status: "Closed Deal", transfer_date: today, transfer_by: byName }).eq("id", leadId);
  return { ok: true, customerName, plot, amount };
}
