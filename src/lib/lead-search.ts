// ค้นหาลูกค้า — แหล่งความจริงเดียว ใช้ร่วมกันทุกหน้าที่มีช่องค้นหาลูกค้า
//
// ปัญหาที่แก้ (Pom แจ้ง 9 พ.ย. 69): "การค้นหาสามารถค้นหาให้แตกทั้งรหัสจากชื่อและข้อมูลอื่นๆ"
// ของเดิมค้นได้ช่องเดียวคือ `customer_name.includes(search)` ซึ่ง:
//   - พิมพ์รหัส "CRM-0325" หรือ "325" หาไม่เจอ
//   - พิมพ์เบอร์ "0868713626" หาไม่เจอ เพราะในฐานข้อมูลเก็บเป็น "086-871-3626"
//   - พิมพ์ "แปลง 13" หาไม่เจอ
//   - พิมพ์ชื่อ LINE / Facebook ที่ใช้ทักกลับ หาไม่เจอ
//   - ตัวพิมพ์ใหญ่-เล็กไม่ตรงก็หาไม่เจอ (includes ไม่ได้ lowercase)
//
// ของใหม่: พิมพ์อะไรก็หาเจอ และพิมพ์หลายคำได้ (ทุกคำต้องเจอ = AND)
// เช่น "ฟ้า 13" = ลูกค้าของฟ้า ที่แปลง 13 · "0868 line" = เบอร์ขึ้นต้น 0868 และช่องทาง LINE

export interface SearchableLead {
  lead_code?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_channel?: string | null;
  contact_handle?: string | null;
  plot_number?: number | null;
  assigned_to?: string | null;
  source?: string | null;
  status?: string | null;
  notes?: string | null;
  occupation?: string | null;
  product_interest?: string | null;
  contact_address?: string | null;
  addr_province?: string | null;
  addr_amphoe?: string | null;
  addr_tambon?: string | null;
  contract_price?: number | null;
  booking_deposit?: number | null;
  budget?: number | null;
}

/** ป้ายสถานะภาษาไทย — ให้พิมพ์ "โอนแล้ว" หรือ "ไม่สนใจ" แล้วหาเจอ */
const STATUS_WORDS: Record<string, string> = {
  New: "ลูกค้าใหม่ new",
  Contacted: "ติดต่อแล้ว contacted",
  Qualified: "มีศักยภาพ qualified",
  Visit: "เยี่ยมชม visit",
  Booking: "จอง booking",
  Contract: "ทำสัญญา contract",
  "Loan Approved": "อนุมัติสินเชื่อ กู้ผ่าน loan",
  "Closed Deal": "โอนแล้ว ปิดการขาย closed transfer",
  Transfer: "โอนแล้ว transfer",
  "Not Interested": "ไม่สนใจแล้ว ไม่เอา not interested",
  Unreachable: "ติดต่อไม่ได้ unreachable",
};

/** ชื่อช่องทางติดต่อภาษาไทย — ให้พิมพ์ "ไลน์" หรือ "เฟส" แล้วหาเจอ */
const CHANNEL_WORDS: Record<string, string> = {
  phone: "โทรศัพท์ เบอร์ phone",
  facebook: "facebook เฟสบุ๊ค เฟส messenger",
  line: "line ไลน์",
  instagram: "instagram ไอจี ig",
  tiktok: "tiktok ติ๊กต๊อก",
  email: "email อีเมล",
  walk_in: "วอล์กอิน มาที่โครงการ walkin walk in",
};

function digitsOf(v: string | null | undefined): string {
  return (v ?? "").replace(/[^0-9]/g, "");
}

/** ก้อนข้อความที่เอาไว้ค้นของลูกค้า 1 ราย — รวมทุกช่องที่คนน่าจะพิมพ์หา */
function haystack(l: SearchableLead): string {
  const code = (l.lead_code ?? "").toLowerCase();
  return [
    code,
    // "CRM-0325" ต้องหาเจอด้วยการพิมพ์ "325" หรือ "0325" -> ใส่เลขล้วนเข้าไปด้วย
    digitsOf(code),
    (l.customer_name ?? "").toLowerCase(),
    (l.phone ?? "").toLowerCase(),
    digitsOf(l.phone),
    (l.email ?? "").toLowerCase(),
    (l.contact_handle ?? "").toLowerCase(),
    (l.contact_channel ?? "").toLowerCase(),
    CHANNEL_WORDS[(l.contact_channel ?? "").toLowerCase()] ?? "",
    l.plot_number != null ? `แปลง${l.plot_number} แปลง ${l.plot_number} plot${l.plot_number}` : "",
    (l.assigned_to ?? "").toLowerCase(),
    (l.source ?? "").toLowerCase(),
    (l.status ?? "").toLowerCase(),
    STATUS_WORDS[l.status ?? ""] ?? "",
    (l.notes ?? "").toLowerCase(),
    (l.occupation ?? "").toLowerCase(),
    (l.product_interest ?? "").toLowerCase(),
    (l.contact_address ?? "").toLowerCase(),
    (l.addr_province ?? "").toLowerCase(),
    (l.addr_amphoe ?? "").toLowerCase(),
    (l.addr_tambon ?? "").toLowerCase(),
    l.contract_price != null ? String(l.contract_price) : "",
    l.booking_deposit != null ? String(l.booking_deposit) : "",
    l.budget ? String(l.budget) : "",
  ].filter(Boolean).join(" \u0001 ");
}

/** คำค้น 1 คำตรงกับลูกค้ารายนี้ไหม */
function matchTerm(l: SearchableLead, hay: string, term: string): boolean {
  if (hay.includes(term)) return true;

  // พิมพ์เป็นตัวเลข — เทียบกับเบอร์แบบไม่สนขีด และเทียบกับเลขแปลง/รหัสลูกค้า
  const d = digitsOf(term);
  if (d.length >= 2) {
    if (digitsOf(l.phone).includes(d)) return true;
    if (digitsOf(l.lead_code).includes(d)) return true;
    // "13" ต้องได้แปลง 13 ไม่ใช่แปลง 1 และ 3 ด้วย -> เทียบเลขแปลงแบบเต็มค่า
    if (l.plot_number != null && String(l.plot_number) === d) return true;
  }
  return false;
}

/**
 * ลูกค้ารายนี้ตรงกับคำค้นไหม — พิมพ์หลายคำได้ คั่นด้วยเว้นวรรค (ทุกคำต้องเจอ)
 * คำค้นว่าง = ตรงทุกราย
 */
export function matchLead(l: SearchableLead, query: string): boolean {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return true;
  const hay = haystack(l);
  return q.split(/\s+/).filter(Boolean).every((t) => matchTerm(l, hay, t));
}

/** ข้อความบอกผู้ใช้ว่าพิมพ์อะไรหาได้ — แสดงใต้ช่องค้นหา */
export const SEARCH_HINT =
  "พิมพ์หาได้ทุกอย่าง: ชื่อ · รหัส (CRM-0325 หรือ 325) · เบอร์ (ใส่ขีดหรือไม่ก็ได้) · ชื่อใน LINE/Facebook · เลขแปลง (13) · ชื่อพนักงานขาย · สถานะ (โอนแล้ว) · ช่องทาง (ไลน์) · จังหวัด/อำเภอ · อาชีพ · ยอดเงิน · หมายเหตุ — พิมพ์หลายคำได้ เช่น “ฟ้า 13”";
