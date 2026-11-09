// ลูกค้ารายเดียวกันถูกลงข้อมูลหลายครั้ง — แหล่งความจริงเดียวของการจับคู่ซ้ำและการรวมใบ
//
// Pom ถาม 9 พ.ย. 69: "ข้อมูลลูกค้าที่ลงข้อมูลหลายครั้งแต่เป็นลูกค้ารายเดียวกันจะดำเนินการอย่างไร"
//
// หลักที่ใช้ (ห้ามลบข้อมูลการขายจริง):
//   1. ระบบ "เสนอ" คู่ที่น่าจะซ้ำ แต่ไม่รวมเอง — คนยืนยันเท่านั้น (ชื่อคนละแบบอาจเป็นคนละคนจริง)
//   2. รวมแล้ว "ไม่ลบ" ใบซ้ำ แค่ชี้ `duplicate_of` ไปที่ใบตัวจริง -> ใบซ้ำหลุดจากการนับยอดและคิวติดตาม
//   3. ย้อนกลับได้ตลอด (แยกกลับ) และเก็บไว้ว่าใครรวมเมื่อไร เพราะกระทบยอดขายที่รายงานผู้บริหาร
//   4. เงิน/วันที่ ไม่ย้ายให้เอง — ระบบบอกว่าช่องไหนต่างกัน แล้วให้คนตัดสินว่าจะใช้ค่าไหน

export interface DupLead {
  id: string;
  lead_code?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  contact_handle?: string | null;
  contact_channel?: string | null;
  plot_number?: number | null;
  status?: string | null;
  assigned_to?: string | null;
  contract_price?: number | null;
  booking_deposit?: number | null;
  contract_signed_date?: string | null;
  booking_date?: string | null;
  transfer_date?: string | null;
  visit_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
  created_at_default?: string | null;
  updated_at?: string | null;
  duplicate_of?: string | null;
}

function digitsOf(v: string | null | undefined): string {
  return (v ?? "").replace(/[^0-9]/g, "");
}

/** เบอร์ที่เป็นแค่ "ค่าเติมช่องว่าง" ไม่ใช่เบอร์ของใครจริง — ห้ามใช้เป็นหลักฐานว่าเป็นคนเดียวกัน
 *  เจอจริง 9 พ.ย. 69: 6 ใบ (CRM-0393…0398) ใส่ 089-999-9999 เหมือนกันหมด
 *  ถ้านับเบอร์นี้ ระบบจะเสนอว่าลูกค้า 6 คนเป็นคนเดียวกัน ซึ่งผิด */
function isFillerPhone(digits: string): boolean {
  if (!digits) return true;
  if (/(\d)\1{6,}/.test(digits)) return true;          // เลขเดียวซ้ำ 7 ตัวขึ้นไป (0999999999 · 0899999999)
  if (/^0?1?2?3?4?5?6?7?8?9?$/.test(digits)) return true; // 0123456789
  return false;
}

/** ชื่อที่ตัดคำนำหน้า/วงเล็บ/ช่องว่างออก เพื่อเทียบว่าเป็นคนเดียวกันไหม
 *  "คุณดารณี เวียงสกล (คุณต้อม คุณเก่ง)" -> "ดารณีเวียงสกล"
 *  "Daranee Wiangsakol" -> "daraneewiangsakol"  (คนละภาษา เทียบตรงไม่ได้ จึงใช้เกณฑ์อื่นช่วย) */
export function normalizeName(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")                         // ตัดวงเล็บ (ชื่อเล่น)
    .replace(/(คุณ|นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|ms\.?)/g, " ")
    .replace(/[\s .·,\-_]/g, "")
    .trim();
}

export type DupReason = "phone" | "name" | "handle" | "plot";

export const DUP_REASON_LABEL: Record<DupReason, string> = {
  phone: "เบอร์โทรเดียวกัน",
  name: "ชื่อเดียวกัน (ตัดคำนำหน้า/ชื่อเล่นแล้วตรงกัน)",
  handle: "ชื่อ/ไอดีในช่องทางแชตเดียวกัน",
  plot: "ผูกแปลงเดียวกัน",
};

export interface DupGroup {
  key: string;
  reason: DupReason;
  leads: DupLead[];
}

/** จับกลุ่มลูกค้าที่น่าจะเป็นรายเดียวกัน — เรียงจากหลักฐานแน่นสุดไปอ่อนสุด
 *  ใบที่ถูกทำเครื่องหมายว่าซ้ำไปแล้วไม่ถูกหยิบมาเสนออีก */
export function findDuplicateGroups(leads: DupLead[]): DupGroup[] {
  const pool = leads.filter((l) => !l.duplicate_of);
  const groups: DupGroup[] = [];
  const seenPairs = new Set<string>();

  const push = (reason: DupReason, key: string, items: DupLead[]) => {
    if (items.length < 2) return;
    // กันเสนอกลุ่มเดิมซ้ำด้วยเหตุผลอื่น (เบอร์ตรงอยู่แล้ว ไม่ต้องเสนอซ้ำเพราะชื่อตรงด้วย)
    const sig = items.map((i) => i.id).sort().join("|");
    if (seenPairs.has(sig)) return;
    seenPairs.add(sig);
    groups.push({ key, reason, leads: items });
  };

  const byKey = (fn: (l: DupLead) => string, reason: DupReason, prefix: string) => {
    const m = new Map<string, DupLead[]>();
    for (const l of pool) {
      const k = fn(l);
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    }
    for (const [k, items] of m) push(reason, `${prefix}:${k}`, items);
  };

  // 1) เบอร์โทรที่ใช้ได้จริงตรงกัน = หลักฐานแน่นสุด
  byKey((l) => { const d = digitsOf(l.phone); return d.length >= 9 && !isFillerPhone(d) ? d : ""; }, "phone", "phone");
  // 2) ชื่อตรงกันหลังตัดคำนำหน้า
  byKey((l) => { const n = normalizeName(l.customer_name); return n.length >= 4 ? n : ""; }, "name", "name");
  // 3) ชื่อ/ไอดีในช่องทางแชตตรงกัน
  byKey((l) => {
    const h = (l.contact_handle ?? "").trim().toLowerCase();
    return h.length >= 3 ? h : "";
  }, "handle", "handle");
  // 4) ผูกแปลงเดียวกันทั้งที่ 1 แปลงควรมีลูกค้าตัวจริงรายเดียว (นับเฉพาะสถานะที่ยังถือแปลงอยู่)
  const HOLDING = new Set(["Booking", "Contract", "Loan Approved", "Closed Deal", "Transfer"]);
  byKey((l) => (l.plot_number != null && HOLDING.has(l.status ?? "")) ? String(l.plot_number) : "", "plot", "plot");

  return groups;
}

/** สถานะที่ถือว่า "ถือแปลงอยู่" — ใบที่อยู่ในสถานะนี้มีน้ำหนักเป็นตัวจริงมากกว่า */
const HOLDING_STATUS = new Set(["Booking", "Contract", "Loan Approved", "Closed Deal", "Transfer"]);

/** ใบไหนควรเป็น "ตัวจริง" — ใบที่ข้อมูลครบที่สุด (ไม่ใช่ใบที่สร้างก่อน)
 *  เพราะใบที่ลงทีหลังมักเป็นใบที่ขายจริงและมีราคา/วันที่ครบ */
export function completenessScore(l: DupLead): number {
  let s = 0;
  if (l.plot_number != null) s += 3;
  if (l.contract_price != null && Number(l.contract_price) > 0) s += 3;
  if (l.contract_signed_date) s += 2;
  if (l.transfer_date) s += 2;
  if (l.booking_date) s += 1;
  if (l.booking_deposit != null) s += 1;
  { const d = digitsOf(l.phone); if (d.length >= 9 && !isFillerPhone(d)) s += 2; }
  if ((l.contact_handle ?? "").trim()) s += 1;
  if (l.visit_date) s += 1;
  if ((l.notes ?? "").trim().length > 20) s += 1;
  if (HOLDING_STATUS.has(l.status ?? "")) s += 2;
  return s;
}

/** เรียงใบในกลุ่ม: ตัวจริงที่ระบบแนะนำขึ้นก่อน */
export function sortByCompleteness(items: DupLead[]): DupLead[] {
  return [...items].sort((a, b) => completenessScore(b) - completenessScore(a));
}

export interface FieldDiff {
  field: string;
  label: string;
  values: { leadCode: string; value: string }[];
}

const COMPARE_FIELDS: { field: keyof DupLead; label: string; money?: boolean }[] = [
  { field: "plot_number", label: "แปลง" },
  { field: "status", label: "สถานะ" },
  { field: "contract_price", label: "ราคาขาย", money: true },
  { field: "booking_deposit", label: "เงินจอง", money: true },
  { field: "contract_signed_date", label: "วันเซ็นสัญญา" },
  { field: "booking_date", label: "วันจอง" },
  { field: "transfer_date", label: "วันโอน" },
  { field: "visit_date", label: "วันเยี่ยมชม" },
  { field: "phone", label: "เบอร์โทร" },
  { field: "contact_handle", label: "ชื่อ/ไอดีในช่องทาง" },
  { field: "assigned_to", label: "ผู้ดูแล" },
];

/** ช่องที่ค่าต่างกันระหว่างใบในกลุ่ม — ให้คนเห็นว่าต้องเก็บค่าไหนก่อนรวม
 *  ระบบไม่ย้ายค่าให้เอง เพราะเป็นข้อมูลการขายจริง */
export function diffFields(items: DupLead[]): FieldDiff[] {
  const out: FieldDiff[] = [];
  for (const cf of COMPARE_FIELDS) {
    const vals = items.map((l) => {
      const raw = l[cf.field];
      const v = raw == null || raw === "" ? "" : cf.money
        ? Number(raw).toLocaleString("th-TH")
        : String(raw);
      return { leadCode: l.lead_code ?? l.id.slice(0, 8), value: v };
    });
    const distinct = new Set(vals.map((v) => v.value));
    // ต่างกันจริง และไม่ใช่กรณี "ใบหนึ่งว่าง อีกใบว่าง"
    if (distinct.size > 1) out.push({ field: String(cf.field), label: cf.label, values: vals });
  }
  return out;
}
