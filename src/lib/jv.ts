import { supabase } from "@/lib/supabase";

/** "YYMM" — งวดบัญชี/ภาษี (พ.ศ. 2 หลักท้าย + เดือน 2 หลัก) จากปี ค.ศ. */
export function yymm(d: Date = new Date()) {
  return `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** เลขที่ใบสำคัญรายวัน เช่น JV-2606-1234 */
export function nextJvNumber(d: Date = new Date()) {
  return `JV-${yymm(d)}-${Date.now().toString().slice(-4)}`;
}

export interface JvLineInput {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  description?: string | null;
}

/**
 * บันทึก JV เดียว (header + lines) ลง jv_entries / jv_lines แบบ double-entry
 * รวม logic ที่เคยถูก copy กระจายในหน้า office และ accounting ไว้ที่เดียว
 * คืนค่า jv id (หรือ null ถ้า insert header ล้มเหลว)
 */
export async function postJv(params: {
  project_id: string;
  jv_date: string;
  description: string;
  ref_number?: string | null;
  status?: string; // default "posted"
  lines: JvLineInput[];
}): Promise<string | null> {
  const total_debit = params.lines.reduce((s, l) => s + Number(l.debit), 0);
  const total_credit = params.lines.reduce((s, l) => s + Number(l.credit), 0);

  // Guard: รายการบัญชีต้องสมดุล (เดบิต = เครดิต) — ป้องกัน JV ไม่ balance ตามหลักบัญชีคู่
  if (Math.round(total_debit * 100) !== Math.round(total_credit * 100)) {
    console.error("postJv: JV ไม่สมดุล — ไม่บันทึก", { total_debit, total_credit, description: params.description });
    return null;
  }

  const { data: jv } = await supabase
    .from("jv_entries")
    .insert({
      jv_number: nextJvNumber(new Date(params.jv_date)),
      jv_date: params.jv_date,
      description: params.description,
      ref_number: params.ref_number ?? null,
      status: params.status ?? "posted",
      total_debit,
      total_credit,
      project_id: params.project_id,
    })
    .select("id")
    .single();

  if (!jv) return null;

  await supabase.from("jv_lines").insert(
    params.lines.map((l, i) => ({
      jv_id: jv.id,
      account_code: l.account_code,
      account_name: l.account_name,
      description: l.description ?? null,
      debit: Number(l.debit),
      credit: Number(l.credit),
      line_order: i + 1,
    }))
  );

  return jv.id as string;
}
