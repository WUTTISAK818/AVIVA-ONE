// นิยามกลางของ "สิ่งที่ควรอยู่บนปฏิทินโครงการ" — ใช้ร่วมกันทั้ง API หน้าปฏิทิน และการ์ดบนหน้าหลัก
//
// Pom สั่ง 7 ต.ค. 69: "จัดการปฏิทินให้ด้วย ว่าควรนำเสนอข้อมูลอะไรบ้าง และเชื่อมโยงข้อมูลจากส่วนต่าง ๆ ให้ด้วย"
//
// หลักคิด: ปฏิทินต้องตอบคำถามเดียวคือ "วันนั้นมีอะไรที่ต้องทำหรือต้องรู้"
// จึงรวมเฉพาะสิ่งที่ "มีวันกำหนดไว้ล่วงหน้า" จากทุกส่วนของแอป ไม่ใช่บันทึกกิจกรรมย้อนหลัง
// (ปฏิทินกิจกรรมประจำวันบนหน้าหลักทำหน้าที่ย้อนหลังอยู่แล้ว — คนละเรื่องกัน)

export type CalendarKind =
  | "transfer"        // นัดโอนกรรมสิทธิ์
  | "contract"        // นัดทำสัญญา
  | "delivery"        // นัดส่งมอบบ้าน
  | "visit"           // นัดเยี่ยมชมโครงการ
  | "followup"        // นัดติดตามลูกค้า
  | "installment"     // งวดผ่อนลูกค้าครบกำหนด
  | "directive"       // คำสั่งงานครบกำหนด
  | "completion"      // กำหนดแล้วเสร็จของแปลง
  | "approval"        // เรื่องรออนุมัติครบกำหนด (SLA)
  | "holiday"         // วันหยุดบริษัท
  | "leave"           // ใบลาที่อนุมัติแล้ว
  | "event"           // นัดทั่วไปที่คนกรอกเอง (ประชุม/นัดผู้รับเหมา/นัดธนาคาร)
  // ── ย้อนหลัง: สิ่งที่เกิดขึ้นไปแล้ว (Pom ขอ 8 ต.ค. 69 ให้เห็นงาน/กิจกรรมทุกอย่างในปฏิทินเดียว) ──
  | "done_report"     // ส่งรายงานประจำวัน
  | "done_site"       // รายงานหน้างาน/อัปเดตความคืบหน้าแปลง
  | "done_lead"       // ลูกค้าใหม่เข้ามา
  | "done_booking"    // รับจอง
  | "done_contract"   // ทำสัญญา
  | "done_transfer"   // โอนกรรมสิทธิ์แล้ว
  | "done_payment";   // รับชำระเงินงวด

export interface CalendarItem {
  id: string;
  kind: CalendarKind;
  date: string;          // YYYY-MM-DD (เวลาไทย)
  title: string;         // ชื่อหลักที่แสดง เช่น ชื่อลูกค้า
  detail?: string | null;// บรรทัดรอง เช่น แปลง/จำนวนเงิน
  owner?: string | null; // ผู้รับผิดชอบ
  link?: string | null;  // กดแล้วไปไหนต่อ
}

export interface KindMeta {
  label: string;
  emoji: string;
  /** สำคัญ = ต้องเตรียมตัวล่วงหน้า พลาดไม่ได้ · ปกติ = งานประจำวัน · พื้นหลัง = ข้อมูลประกอบ · ย้อนหลัง = เกิดขึ้นแล้ว */
  weight: "critical" | "normal" | "background" | "past";
  /** คลาสสีแบบเต็ม (Tailwind compile คลาสประกอบสดไม่ได้) */
  text: string;
  chip: string;
}

export const KIND_META: Record<CalendarKind, KindMeta> = {
  transfer:    { label: "นัดโอนกรรมสิทธิ์", emoji: "🔑", weight: "critical",   text: "text-aviva-gold",     chip: "bg-aviva-gold/15 border-aviva-gold/40 text-aviva-gold" },
  contract:    { label: "นัดทำสัญญา",      emoji: "📝", weight: "critical",   text: "text-green-400",      chip: "bg-green-500/15 border-green-500/40 text-green-300" },
  delivery:    { label: "นัดส่งมอบบ้าน",    emoji: "🏠", weight: "critical",   text: "text-blue-400",       chip: "bg-blue-500/15 border-blue-500/40 text-blue-300" },
  installment: { label: "งวดผ่อนครบกำหนด",  emoji: "💰", weight: "critical",   text: "text-yellow-400",     chip: "bg-yellow-500/15 border-yellow-500/40 text-yellow-300" },
  visit:       { label: "นัดเยี่ยมชมโครงการ", emoji: "👀", weight: "normal",   text: "text-purple-400",     chip: "bg-purple-500/15 border-purple-500/40 text-purple-300" },
  directive:   { label: "คำสั่งงานครบกำหนด", emoji: "📋", weight: "normal",    text: "text-orange-400",     chip: "bg-orange-500/15 border-orange-500/40 text-orange-300" },
  approval:    { label: "รออนุมัติครบกำหนด", emoji: "🧾", weight: "normal",    text: "text-emerald-400",    chip: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" },
  completion:  { label: "กำหนดแล้วเสร็จ",   emoji: "🏗️", weight: "normal",    text: "text-amber-400",      chip: "bg-amber-500/15 border-amber-500/40 text-amber-300" },
  followup:    { label: "นัดติดตามลูกค้า",  emoji: "📞", weight: "background", text: "text-aviva-secondary", chip: "bg-aviva-bg border-aviva-gold/20 text-aviva-secondary" },
  leave:       { label: "ลา (อนุมัติแล้ว)", emoji: "🏖️", weight: "background", text: "text-cyan-400",       chip: "bg-cyan-500/15 border-cyan-500/40 text-cyan-300" },
  holiday:     { label: "วันหยุดบริษัท",    emoji: "🌴", weight: "background", text: "text-pink-400",       chip: "bg-pink-500/15 border-pink-500/40 text-pink-300" },
  event:       { label: "นัดหมายทั่วไป",    emoji: "📅", weight: "normal",     text: "text-aviva-text",     chip: "bg-aviva-bg border-aviva-gold/25 text-aviva-text" },

  done_report:   { label: "ส่งรายงานประจำวัน", emoji: "📄", weight: "past", text: "text-aviva-secondary", chip: "bg-aviva-bg border-aviva-gold/15 text-aviva-secondary" },
  done_site:     { label: "รายงานหน้างาน",   emoji: "🧱", weight: "past", text: "text-orange-300",      chip: "bg-orange-500/10 border-orange-500/25 text-orange-300" },
  done_lead:     { label: "ลูกค้าใหม่",      emoji: "✨", weight: "past", text: "text-green-300",       chip: "bg-green-500/10 border-green-500/25 text-green-300" },
  done_booking:  { label: "รับจอง",          emoji: "🏷️", weight: "past", text: "text-aviva-gold",      chip: "bg-aviva-gold/10 border-aviva-gold/25 text-aviva-gold" },
  done_contract: { label: "ทำสัญญาแล้ว",     emoji: "🤝", weight: "past", text: "text-green-400",       chip: "bg-green-500/10 border-green-500/30 text-green-300" },
  done_transfer: { label: "โอนกรรมสิทธิ์แล้ว", emoji: "✅", weight: "past", text: "text-aviva-gold",     chip: "bg-aviva-gold/10 border-aviva-gold/30 text-aviva-gold" },
  done_payment:  { label: "รับชำระเงินงวด",  emoji: "💵", weight: "past", text: "text-yellow-300",      chip: "bg-yellow-500/10 border-yellow-500/25 text-yellow-300" },
};

/** มุมมองของปฏิทิน — ข้างหน้า (ต้องทำ) · ย้อนหลัง (ทำไปแล้ว) · ทั้งหมด */
export type CalendarView = "upcoming" | "past" | "all";

export const PAST_KINDS: CalendarKind[] = [
  "done_transfer", "done_contract", "done_booking", "done_payment",
  "done_site", "done_report", "done_lead",
];

export function kindsForView(view: CalendarView): CalendarKind[] {
  const past = new Set(PAST_KINDS);
  if (view === "past") return KIND_ORDER.filter(k => past.has(k));
  if (view === "upcoming") return KIND_ORDER.filter(k => !past.has(k));
  return KIND_ORDER;
}

/** ลำดับการแสดงในวันเดียวกัน — เรื่องที่พลาดไม่ได้ขึ้นก่อนเสมอ */
export const KIND_ORDER: CalendarKind[] = [
  "transfer", "contract", "delivery", "installment",
  "visit", "directive", "approval", "completion", "event",
  "leave", "holiday", "followup",
  // ย้อนหลัง — ต่อท้ายเสมอ เพราะเป็นข้อมูลอ้างอิง ไม่ใช่สิ่งที่ต้องลงมือ
  "done_transfer", "done_contract", "done_booking", "done_payment",
  "done_site", "done_report", "done_lead",
];

export function sortItems(items: CalendarItem[]): CalendarItem[] {
  const rank = new Map(KIND_ORDER.map((k, i) => [k, i]));
  return [...items].sort((a, b) =>
    a.date === b.date
      ? (rank.get(a.kind) ?? 99) - (rank.get(b.kind) ?? 99) || a.title.localeCompare(b.title, "th")
      : a.date < b.date ? -1 : 1);
}

/** นับเฉพาะเรื่องที่ "ต้องเตรียมตัว" — ใช้ทำจุดสีบนช่องวันที่ */
export function criticalCount(items: CalendarItem[]): number {
  return items.filter(i => KIND_META[i.kind].weight === "critical").length;
}

/** แตกช่วงวันลา (date_from..date_to) ออกเป็นรายวัน เพื่อให้ขึ้นครบทุกวันบนปฏิทิน */
export function expandRange(from: string, to: string, maxDays = 60): string[] {
  const out: string[] = [];
  const start = new Date(from + "T12:00:00Z");
  const end = new Date(to + "T12:00:00Z");
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    if (d > end) break;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
