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
// คำนำหน้าชื่อ — "นางสาว" ต้องมาก่อน "นาง" เสมอ (แก้ v8.11: เดิม "นาง" ถูกตัดก่อน
// "นางสาวอรยา" จึงเหลือ "สาวอรยา" แล้วจับคู่กับ "อรยา" ไม่ได้ — CRM-0500/0514 หลุดจากระบบเพราะเหตุนี้)
const NAME_PREFIX = /(นางสาว|น\.ส\.|นาง|นาย|คุณ|ด\.ช\.|ด\.ญ\.|mrs\.?|mr\.?|ms\.?|miss)/g;

function stripName(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")                         // ตัดวงเล็บ (ชื่อเล่น)
    .replace(NAME_PREFIX, " ")
    .replace(/[\s ]+/g, " ")
    .trim();
}

export function normalizeName(v: string | null | undefined): string {
  return stripName(v).replace(/[\s .·,\-_]/g, "");
}

/** ชื่อต้น (คำแรกหลังตัดคำนำหน้า) — "นายนนทกร ขอมสระน้อย" กับ "คุณนนทกร" -> "นนทกร" ทั้งคู่ */
export function firstName(v: string | null | undefined): string {
  return (stripName(v).split(" ")[0] ?? "").replace(/[.·,\-_]/g, "");
}

/** วันที่ใช้เทียบว่าลงห่างกันกี่วัน — วันเยี่ยมชมก่อน ไม่มีจึงใช้วันที่ลงข้อมูล */
function leadDay(l: DupLead): number | null {
  const s = l.visit_date || l.created_at_default || l.created_at;
  if (!s) return null;
  const t = Date.parse(s.length <= 10 ? s + "T00:00:00Z" : s);
  return Number.isNaN(t) ? null : Math.floor(t / 86_400_000);
}

/** เสนอจาก "ชื่อต้นตรงกัน" เฉพาะใบที่ลงห่างกันไม่เกินกี่วัน (ชื่อต้นตรงแต่ห่างเป็นปี มักเป็นคนละคน) */
export const FIRST_NAME_WINDOW_DAYS = 30;

export type DupReason = "phone" | "name" | "handle" | "plot" | "note_ref" | "first_name";

export const DUP_REASON_LABEL: Record<DupReason, string> = {
  phone: "เบอร์โทรเดียวกัน",
  name: "ชื่อเดียวกัน (ตัดคำนำหน้า/ชื่อเล่นแล้วตรงกัน)",
  handle: "ชื่อ/ไอดีในช่องทางแชตเดียวกัน",
  plot: "ผูกแปลงเดียวกัน",
  note_ref: "หมายเหตุในใบอ้างถึงรหัสลูกค้าอีกใบ (พนักงานจดไว้ว่าซ้ำ)",
  first_name: "ชื่อต้นตรงกัน และลงห่างกันไม่เกิน 30 วัน — มักเป็นคนเดียวกันที่ทักออนไลน์ก่อนมาโครงการ (ใบหนึ่งไม่มีเบอร์/นามสกุล) ตรวจให้แน่ใจก่อนรวม",
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

  // 5) หมายเหตุอ้างรหัสลูกค้าอีกใบ — พนักงานมักจดไว้เองว่า "ข้อมูลซ้ำกับ CRM0474" (v8.11)
  const byCode = new Map<string, DupLead>();
  for (const l of pool) {
    const d = digitsOf(l.lead_code);
    if (d) byCode.set(String(Number(d)), l);
  }
  for (const l of pool) {
    for (const m of (l.notes ?? "").matchAll(/CRM\s*-?\s*(\d{2,5})/gi)) {
      const other = byCode.get(String(Number(m[1])));
      if (other && other.id !== l.id) push("note_ref", `note:${l.id}:${other.id}`, [l, other]);
    }
  }

  // 6) ชื่อต้นตรงกัน + ลงห่างกันไม่เกิน 30 วัน (v8.11 · Pom สั่ง 14 พ.ย. 69)
  //    จับเคสที่เกณฑ์อื่นหลุด เช่น "คุณนนทกร" (ไม่มีเบอร์ ไม่มีนามสกุล) กับ "นายนนทกร ขอมสระน้อย"
  //    เรียงตามวัน แล้วตัดกลุ่มเมื่อห่างจากใบก่อนหน้าเกิน 30 วัน
  const byFirst = new Map<string, DupLead[]>();
  for (const l of pool) {
    const f = firstName(l.customer_name);
    if (f.length < 3 || /^\d+$/.test(f)) continue;
    if (!byFirst.has(f)) byFirst.set(f, []);
    byFirst.get(f)!.push(l);
  }
  for (const [f, items] of byFirst) {
    if (items.length < 2) continue;
    const dated = items
      .map((l) => ({ l, d: leadDay(l) }))
      .filter((x): x is { l: DupLead; d: number } => x.d != null)
      .sort((a, b) => a.d - b.d);
    let cluster: DupLead[] = [];
    let last: number | null = null;
    const flush = () => {
      if (cluster.length >= 2) push("first_name", `first:${f}:${cluster[0].id}`, cluster);
      cluster = [];
    };
    for (const x of dated) {
      if (last != null && x.d - last > FIRST_NAME_WINDOW_DAYS) flush();
      cluster.push(x.l);
      last = x.d;
    }
    flush();
  }

  return groups;
}

/** ใบลูกค้าที่ชื่อคล้ายกับที่กำลังกรอก — ใช้เตือนตอนเพิ่มลูกค้าใหม่ (v8.11)
 *  ตรงทั้งชื่อ-นามสกุล หรือชื่อต้นตรงและลงไว้ไม่เกิน 30 วัน */
export function findSimilarByName(leads: DupLead[], name: string, excludeId?: string | null): DupLead[] {
  const full = normalizeName(name);
  const first = firstName(name);
  if (first.length < 3) return [];
  const today = Math.floor(Date.now() / 86_400_000);
  return leads.filter((l) => {
    if (l.duplicate_of || l.id === excludeId) return false;
    if (full.length >= 4 && normalizeName(l.customer_name) === full) return true;
    if (firstName(l.customer_name) !== first) return false;
    const d = leadDay(l);
    return d != null && Math.abs(today - d) <= FIRST_NAME_WINDOW_DAYS;
  }).slice(0, 5);
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
