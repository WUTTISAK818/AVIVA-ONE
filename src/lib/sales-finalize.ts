import { supabase } from "./supabase";
import { postJv } from "./jv";
import { BANK, SALES_REVENUE, COGS, WIP } from "./gl-accounts";

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

  // ลงบัญชีคู่ตอนโอนกรรมสิทธิ์: รับรู้รายได้ + ตัดต้นทุนขาย (ต้นทุนงานระหว่างก่อสร้างของแปลงนั้น)
  if (cv > 0) {
    await postJv({
      project_id: PROJECT_ID, jv_date: today,
      description: `รับรู้รายได้โอนกรรมสิทธิ์ — ${customerName}${plot ? ` แปลง ${plot}` : ""}`,
      lines: [
        { account_code: BANK.code, account_name: BANK.name, debit: cv, credit: 0 },
        { account_code: SALES_REVENUE.code, account_name: SALES_REVENUE.name, debit: 0, credit: cv },
      ],
    });
    // ต้นทุนขาย = ต้นทุนงานระหว่างก่อสร้างที่จ่ายจริงของแปลงนั้น (ตัดออกจากสินค้าคงเหลือ)
    let cost = 0;
    if (plot) {
      const { data: house } = await supabase.from("houses")
        .select("id").eq("project_id", PROJECT_ID).eq("plot_number", plot).maybeSingle();
      const houseId = (house as { id?: string } | null)?.id;
      if (houseId) {
        const { data: insts } = await supabase.from("contractor_installments")
          .select("amount").eq("house_id", houseId).eq("status", "paid");
        cost = ((insts as { amount: number | null }[] | null) ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
      }
    }
    if (cost > 0) {
      await postJv({
        project_id: PROJECT_ID, jv_date: today,
        description: `ตัดต้นทุนขายบ้าน — ${customerName}${plot ? ` แปลง ${plot}` : ""}`,
        lines: [
          { account_code: COGS.code, account_name: COGS.name, debit: cost, credit: 0 },
          { account_code: WIP.code, account_name: WIP.name, debit: 0, credit: cost },
        ],
      });
    }
  }
  await supabase.from("leads").update({ status: "Closed Deal", transfer_date: today, transfer_by: byName }).eq("id", leadId);
  return { ok: true, customerName, plot, amount };
}
