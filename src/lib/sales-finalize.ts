import { supabase } from "./supabase";
import { postJv } from "./jv";
import { CUSTOMER_ADVANCE, SALES_REVENUE, COGS, WIP } from "./gl-accounts";
import { thaiDateStr } from "@/lib/thai-date";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export interface FinalizeResult {
  ok: boolean;
  customerName: string;
  plot: number | null;
  amount: number | null;
  /** แปลงนี้รับรู้รายได้ไปแล้ว — ไม่รับรู้ซ้ำ (เปลี่ยนแค่สถานะลูกค้า) */
  alreadyRecognized?: boolean;
}

export type RecognizeOutcome = "recognized" | "already_recognized";

/**
 * รับรู้รายได้ตอนโอนกรรมสิทธิ์ (TFRS 15) — แหล่งความจริงเดียว ใช้ทั้งตอนอนุมัติปิดการขาย และหน้า CRM
 *
 * แก้ใน v8.10 (Pom อนุมัติ 13 พ.ย. 69) — ของเดิมมีบั๊ก 3 จุด:
 *   1. ลง "รายได้จากการขาย" เต็มราคาในสมุดรับ-จ่าย (finance_transactions) ซ้ำกับเงินที่ลงไว้แล้วตอนรับชำระแต่ละงวด
 *      → หน้า Dashboard/การเงินรวมทุกแถวรายรับ ยอดจึงเกินจริงเท่าราคาบ้านทุกหลังที่โอน (เจอจริง 19,710,003.50)
 *      ของใหม่: ไม่ลงในสมุดรับ-จ่ายแล้ว — สมุดรับ-จ่ายคือ "เงินเข้า-ออกจริง" ส่วนการรับรู้รายได้อยู่ที่ revenue_recognition + JV
 *   2. JV ตอนโอนลง Dr เงินฝากธนาคาร ทั้งที่เงินเข้าธนาคารไปแล้วตอนรับงวด (Dr ธนาคาร / Cr เงินรับล่วงหน้า)
 *      ของใหม่: Dr 2200 เงินรับล่วงหน้าจากลูกค้า / Cr 4100 รายได้ — คือ "ย้ายเงินรับล่วงหน้าไปเป็นรายได้" ตอนโอน
 *   3. รับรู้รายได้ซ้ำแปลงเดิมได้ (แปลง 16 เคยรับรู้ 50,000 จากบัญชีทดสอบ แล้วจะรับรู้อีก 4,080,000)
 *      ของใหม่: แปลงที่มีรายการ status=recognized แล้ว จะไม่รับรู้ซ้ำ · แถวที่ยังไม่รับรู้ (pending) จะถูกใช้ต่อแทนการสร้างใหม่
 */
export async function recognizeTransferRevenue(p: {
  plot: number | null;
  customerName: string;
  amount: number | null;
  transferDate: string;
  contractDate: string;
}): Promise<RecognizeOutcome> {
  const cv = p.amount && p.amount > 0 ? Number(p.amount) : 0;
  const label = `${p.customerName}${p.plot ? ` แปลง ${p.plot}` : ""}`;

  // กันรับรู้รายได้ซ้ำ — 1 แปลงขายได้ครั้งเดียว
  let reuseId: string | null = null;
  if (p.plot) {
    const { data: existing } = await supabase.from("revenue_recognition")
      .select("id, status")
      .eq("project_id", PROJECT_ID).eq("house_number", String(p.plot));
    const rows = (existing as { id: string; status: string | null }[] | null) ?? [];
    if (rows.some((r) => r.status === "recognized")) return "already_recognized";
    reuseId = rows[0]?.id ?? null;
  }

  // JV: ย้ายเงินรับล่วงหน้าจากลูกค้าไปเป็นรายได้ ลงวันที่ตามวันโอนจริง (ไม่ใช่วันที่กดอนุมัติ)
  let jvId: string | null = null;
  if (cv > 0) {
    jvId = await postJv({
      project_id: PROJECT_ID, jv_date: p.transferDate,
      description: `รับรู้รายได้โอนกรรมสิทธิ์ — ${label}`,
      lines: [
        { account_code: CUSTOMER_ADVANCE.code, account_name: CUSTOMER_ADVANCE.name, debit: cv, credit: 0 },
        { account_code: SALES_REVENUE.code, account_name: SALES_REVENUE.name, debit: 0, credit: cv },
      ],
    });
  }

  const row = {
    house_number: p.plot ? String(p.plot) : null,
    contract_date: p.contractDate, transfer_date: p.transferDate,
    contract_value: cv, recognized_amount: cv, deferred_amount: 0, received_total: cv,
    status: "recognized", project_id: PROJECT_ID, jv_id: jvId,
    notes: `โอนกรรมสิทธิ์ — ${p.customerName}`,
  };
  if (reuseId) {
    await supabase.from("revenue_recognition").update({ ...row, updated_at: new Date().toISOString() }).eq("id", reuseId);
  } else {
    await supabase.from("revenue_recognition").insert(row);
  }

  // ต้นทุนขาย = ต้นทุนงานระหว่างก่อสร้างที่จ่ายจริงของแปลงนั้น (ตัดออกจากสินค้าคงเหลือ)
  if (cv > 0 && p.plot) {
    const { data: house } = await supabase.from("houses")
      .select("id").eq("project_id", PROJECT_ID).eq("plot_number", p.plot).maybeSingle();
    const houseId = (house as { id?: string } | null)?.id;
    let cost = 0;
    if (houseId) {
      const { data: insts } = await supabase.from("contractor_installments")
        .select("amount").eq("house_id", houseId).eq("status", "paid");
      cost = ((insts as { amount: number | null }[] | null) ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
    }
    if (cost > 0) {
      await postJv({
        project_id: PROJECT_ID, jv_date: p.transferDate,
        description: `ตัดต้นทุนขายบ้าน — ${label}`,
        lines: [
          { account_code: COGS.code, account_name: COGS.name, debit: cost, credit: 0 },
          { account_code: WIP.code, account_name: WIP.name, debit: 0, credit: cost },
        ],
      });
    }
  }
  return "recognized";
}

/**
 * Group C — ปิดการขายจริง (เรียกเมื่อผู้จัดการ "อนุมัติ" Contract_Approval):
 * - บ้าน = sold · รับรู้รายได้ (recognizeTransferRevenue) · lead → Closed Deal
 * - ใช้ "วันโอนจริง" ที่ฝ่ายขายกรอกไว้ — เดิมเขียนทับเป็นวันที่กดอนุมัติเสมอ
 *   (แปลง 30 โอนจริง 29 พ.ย. 67 จะกลายเป็นยอดขาย พ.ย. 69) · ถ้ายังไม่กรอกจึงใช้วันนี้
 * กันทำซ้ำ: ถ้า lead เป็น Closed Deal อยู่แล้วจะคืนค่าโดยไม่บันทึกซ้ำ
 */
export async function finalizeSale(leadId: string, byName: string): Promise<FinalizeResult> {
  const { data } = await supabase
    .from("leads")
    .select("customer_name, plot_number, contract_price, budget, status, transfer_date, contract_signed_date")
    .eq("id", leadId)
    .maybeSingle();
  const l = data as {
    customer_name?: string; plot_number?: number | null;
    contract_price?: number | null; budget?: number | null; status?: string;
    transfer_date?: string | null; contract_signed_date?: string | null;
  } | null;
  if (!l) return { ok: false, customerName: "", plot: null, amount: null };

  const customerName = l.customer_name ?? "";
  const plot = l.plot_number ?? null;
  const amount = l.contract_price ?? l.budget ?? null;
  if (l.status === "Closed Deal") return { ok: true, customerName, plot, amount };

  const today = thaiDateStr();
  const transferDate = l.transfer_date || today;
  const contractDate = l.contract_signed_date || transferDate;

  if (plot) await supabase.from("houses").update({
    status: "sold", sale_status_at: today, sale_status_by: byName ?? null,
    sale_status_note: `โอนกรรมสิทธิ์แล้ว — ${customerName}`,
  }).eq("project_id", PROJECT_ID).eq("plot_number", plot);

  const outcome = await recognizeTransferRevenue({ plot, customerName, amount, transferDate, contractDate });

  await supabase.from("leads").update({ status: "Closed Deal", transfer_date: transferDate, transfer_by: byName }).eq("id", leadId);
  return { ok: true, customerName, plot, amount, alreadyRecognized: outcome === "already_recognized" };
}
