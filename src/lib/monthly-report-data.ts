import { getSupabaseAdmin } from "@/lib/supabase";
import { channelBucket, CHANNEL_ORDER } from "@/lib/lead-channel";

export type ReportDepartment = "sales" | "construction" | "finance" | "hr";

const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

// แปลงวันที่ปฏิทินไทย (YYYY-MM-DD) เป็น ISO instant ของเวลาไทยเที่ยงคืนวันนั้น (UTC+7)
// ใช้รูปแบบเดียวกับ src/app/api/cron/sales-lead-digest/route.ts เพื่อให้ขอบเขตวันตรงกันทั้งระบบ
export function thaiDateToUtcIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 7 * 3_600_000).toISOString();
}

interface RangeReport {
  title: string;
  content: string;
}

async function buildSalesReport(fromIso: string, toIso: string, label: string): Promise<RangeReport> {
  const db = getSupabaseAdmin();
  const { data: leads } = await db
    .from("leads")
    .select("customer_name, source, assigned_to, status, booking_date, transfer_date, contract_price")
    .gte("created_at", fromIso)
    .lt("created_at", toIso);
  const rows = leads ?? [];

  const byChannel = new Map<string, number>();
  const bySales = new Map<string, number>();
  for (const l of rows) {
    const ch = channelBucket(l.source);
    byChannel.set(ch, (byChannel.get(ch) ?? 0) + 1);
    const who = l.assigned_to || "ไม่ระบุผู้ดูแล";
    bySales.set(who, (bySales.get(who) ?? 0) + 1);
  }
  const booked = rows.filter((l) => !!l.booking_date).length;
  const transferred = rows.filter((l) => !!l.transfer_date).length;

  const lines: string[] = [];
  lines.push(`ลูกค้าใหม่ทั้งหมด: ${rows.length} ราย (${label})`);
  lines.push("");
  lines.push("แยกตามช่องทาง:");
  for (const c of CHANNEL_ORDER) {
    if (byChannel.has(c)) lines.push(`- ${c}: ${byChannel.get(c)} ราย`);
  }
  lines.push("");
  if (bySales.size > 0) {
    lines.push("แยกตามพนักงานขาย:");
    for (const [who, count] of [...bySales.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${who}: ${count} ราย`);
    }
    lines.push("");
  }
  lines.push(`จองแล้ว: ${booked} ราย · โอนแล้ว: ${transferred} ราย`);
  if (rows.length === 0) lines.push("(ไม่มีลูกค้าใหม่ในช่วงนี้)");

  return { title: `รายงานฝ่ายขาย — ${label}`, content: lines.join("\n") };
}

async function buildConstructionReport(fromIso: string, toIso: string, label: string): Promise<RangeReport> {
  const db = getSupabaseAdmin();
  const [{ data: defectsNew }, { data: defectsResolved }, { data: installments }, { data: housesDelayed }] = await Promise.all([
    db.from("defects").select("house_id, severity").gte("reported_at", fromIso).lt("reported_at", toIso),
    db.from("defects").select("house_id").gte("resolved_at", fromIso).lt("resolved_at", toIso),
    db.from("contractor_installments").select("house_id, amount, net_payout, status").gte("paid_at", fromIso).lt("paid_at", toIso).eq("status", "paid"),
    db.from("houses").select("house_number, delayed_days").gt("delayed_days", 0),
  ]);

  const inst = installments ?? [];
  const totalPaid = inst.reduce((s, r) => s + Number(r.net_payout ?? r.amount ?? 0), 0);
  const delayed = housesDelayed ?? [];

  const lines: string[] = [];
  lines.push(`งวดงานที่จ่ายแล้วในช่วงนี้: ${inst.length} งวด รวม ${baht(totalPaid)} (${label})`);
  lines.push(`ข้อบกพร่อง (QC) ที่พบใหม่: ${(defectsNew ?? []).length} รายการ · แก้ไขเสร็จ: ${(defectsResolved ?? []).length} รายการ`);
  lines.push("");
  lines.push(`สถานะปัจจุบัน (ณ วันที่ทำรายงาน) — บ้านที่ล่าช้ากว่าแผน: ${delayed.length} หลัง`);
  if (delayed.length > 0) {
    for (const h of delayed.slice(0, 10)) {
      lines.push(`- ${h.house_number}: ล่าช้า ${h.delayed_days} วัน`);
    }
    if (delayed.length > 10) lines.push(`- ...และอีก ${delayed.length - 10} หลัง`);
  }

  return { title: `รายงานฝ่ายก่อสร้าง — ${label}`, content: lines.join("\n") };
}

async function buildFinanceReport(fromIso: string, toIso: string, label: string): Promise<RangeReport> {
  const db = getSupabaseAdmin();
  const { data: jv } = await db
    .from("jv_entries")
    .select("total_debit, total_credit, status")
    .gte("jv_date", fromIso.slice(0, 10))
    .lt("jv_date", toIso.slice(0, 10));
  const rows = jv ?? [];

  if (rows.length === 0) {
    return {
      title: `รายงานการเงิน-บัญชี — ${label}`,
      content: "ยังไม่เริ่มใช้งานจริง ระบบพร้อมใช้แล้ว (ไม่พบรายการบัญชีในช่วงนี้)",
    };
  }

  const totalDebit = rows.reduce((s, r) => s + Number(r.total_debit ?? 0), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.total_credit ?? 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const lines = [
    `รายการบัญชี (JV) ในช่วงนี้: ${rows.length} รายการ (${label})`,
    `ยอดเดบิตรวม: ${baht(totalDebit)} · ยอดเครดิตรวม: ${baht(totalCredit)}`,
    `บัญชีคู่สมดุล: ${balanced ? "ใช่ ✓" : "ไม่สมดุล ⚠️ ต้องตรวจสอบ"}`,
  ];

  return { title: `รายงานการเงิน-บัญชี — ${label}`, content: lines.join("\n") };
}

async function buildHrReport(fromIso: string, toIso: string, label: string): Promise<RangeReport> {
  const db = getSupabaseAdmin();
  const [{ data: payroll }, { data: attendance }] = await Promise.all([
    db.from("payroll_runs").select("status, net_income").gte("created_at", fromIso).lt("created_at", toIso),
    db.from("attendance").select("status").gte("work_date", fromIso.slice(0, 10)).lt("work_date", toIso.slice(0, 10)),
  ]);
  const payrollRows = payroll ?? [];
  const attRows = attendance ?? [];

  if (payrollRows.length === 0 && attRows.length === 0) {
    return {
      title: `รายงานบุคคล-เงินเดือน — ${label}`,
      content: "ยังไม่เริ่มใช้งานจริง ระบบพร้อมใช้แล้ว (ไม่พบข้อมูล payroll/ลงเวลาในช่วงนี้)",
    };
  }

  const paid = payrollRows.filter((p) => p.status === "paid").length;
  const totalNet = payrollRows.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.net_income ?? 0), 0);
  const absent = attRows.filter((a) => a.status === "absent").length;
  const late = attRows.filter((a) => a.status === "late").length;

  const lines = [
    `รอบเงินเดือนที่คำนวณในช่วงนี้: ${payrollRows.length} รอบ · จ่ายแล้ว: ${paid} รอบ รวม ${baht(totalNet)} (${label})`,
    `การลงเวลา: ขาดงาน ${absent} ครั้ง · มาสาย ${late} ครั้ง (จาก ${attRows.length} วันลงเวลารวม)`,
  ];

  return { title: `รายงานบุคคล-เงินเดือน — ${label}`, content: lines.join("\n") };
}

export async function buildDepartmentReports(
  fromIso: string,
  toIso: string,
  label: string,
): Promise<Record<ReportDepartment, RangeReport>> {
  const [sales, construction, finance, hr] = await Promise.all([
    buildSalesReport(fromIso, toIso, label),
    buildConstructionReport(fromIso, toIso, label),
    buildFinanceReport(fromIso, toIso, label),
    buildHrReport(fromIso, toIso, label),
  ]);
  return { sales, construction, finance, hr };
}
