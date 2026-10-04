// ช่วยผู้บริหารอ่านรายงานประจำวันเร็วขึ้น — คัดว่า "ฉบับไหนควรกดเข้าไปอ่าน"
//
// Pom สั่ง 4 ต.ค. 69: ให้เห็นภาพรวมรายคนก่อน แล้วเลือกรับทราบทั้งหมด / กดเข้าไปดูบางฉบับ / ตีกลับบางฉบับ
// หลักคิดสำคัญ: ป้ายเตือนต้องเทียบกับ "ปกติของคนนั้น" ไม่ใช่เกณฑ์กลาง
//   เช่น พีทเขียนสรุปสั้น ~22 ตัวอักษรทุกวันเป็นเรื่องปกติของเขา แต่แนบรูป 15-36 รูปทุกวัน
//   → วันที่พีทไม่แนบรูปคือวันที่ผิดปกติจริง ส่วนความสั้นของข้อความไม่ใช่สัญญาณอะไรเลย
// ถ้าตั้งเกณฑ์กลาง ป้ายจะขึ้นทุกวันจนไม่มีใครสนใจ แล้วปุ่ม "รับทราบทั้งหมด" จะกลายเป็นตรายาง

export type FlagTone = "warn" | "info";

export interface ReportFlag {
  key: string;
  icon: string;
  label: string;
  tone: FlagTone;
}

/** ค่า "ปกติ" ของพนักงานคนหนึ่ง คิดจากรายงานย้อนหลังของตัวเอง */
export interface PersonNorm {
  /** จำนวนรายงานย้อนหลังที่ใช้คิดค่าปกติ — น้อยกว่า 3 ฉบับถือว่ายังสรุปไม่ได้ ไม่ขึ้นป้ายเทียบค่าปกติ */
  samples: number;
  /** สัดส่วนวันที่แนบรูป (0-1) */
  photoRate: number;
  /** ค่ากลางของจำนวนรายการงานต่อวัน */
  medianItems: number;
}

export interface ReportFacts {
  status: string;                 // submitted | late
  summary: string | null;
  items: number;                  // จำนวนรายการงานในรายงานฉบับนี้
  photos: number;                 // จำนวนรูปแนบ
  hasIssueItem: boolean;          // มีรายการที่จัดหมวด "ปัญหา/อุปสรรค"
  lastEditedAt: string | null;
  returnedAt: string | null;
}

/** คำที่บอกว่าพนักงานกำลังแจ้งปัญหา/ขอการตัดสินใจ — ฉบับนี้ผู้บริหารควรอ่านเอง */
const ATTENTION_WORDS = [
  "ปัญหา", "ติดขัด", "อุปสรรค", "ด่วน", "ขออนุมัติ", "รอการตัดสิน", "รออนุมัติ",
  "เสียหาย", "ล่าช้า", "ไม่ได้", "ขาด", "ร้องเรียน", "แก้ไขด่วน",
];

export function hasAttentionWord(text: string | null | undefined): boolean {
  const t = (text ?? "").toLowerCase();
  return !!t && ATTENTION_WORDS.some(w => t.includes(w.toLowerCase()));
}

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function buildNorm(history: { items: number; photos: number }[]): PersonNorm {
  return {
    samples: history.length,
    photoRate: history.length === 0 ? 0 : history.filter(h => h.photos > 0).length / history.length,
    medianItems: median(history.map(h => h.items)),
  };
}

/** ป้ายเตือนของรายงานฉบับหนึ่ง — เรียงจากเรื่องที่ควรสนใจที่สุด */
export function reportFlags(f: ReportFacts, norm: PersonNorm): ReportFlag[] {
  const flags: ReportFlag[] = [];

  if (f.returnedAt) {
    flags.push({ key: "returned", icon: "↩️", label: "ตีกลับแล้วยังไม่แก้", tone: "warn" });
  }
  if (f.hasIssueItem || hasAttentionWord(f.summary)) {
    flags.push({ key: "attention", icon: "⚠️", label: "แจ้งปัญหา/ขอการตัดสินใจ", tone: "warn" });
  }
  // ไม่แนบรูปทั้งที่ปกติแนบเกือบทุกวัน (ต้องมีประวัติพอ 3 ฉบับ และปกติแนบ ≥ 60% ของวัน)
  if (f.photos === 0 && norm.samples >= 3 && norm.photoRate >= 0.6) {
    flags.push({ key: "no-photo", icon: "📷", label: "ไม่มีรูปแนบ (ปกติแนบทุกวัน)", tone: "warn" });
  }
  // งานน้อยกว่าครึ่งของค่าปกติของตัวเอง
  if (norm.samples >= 3 && norm.medianItems >= 2 && f.items * 2 < norm.medianItems) {
    flags.push({ key: "thin", icon: "📝", label: `งานน้อยกว่าปกติ (${f.items} จากปกติ ~${norm.medianItems})`, tone: "warn" });
  }
  if (f.status === "late") {
    flags.push({ key: "late", icon: "⏰", label: "ส่งล่าช้า", tone: "info" });
  }
  if (f.lastEditedAt) {
    flags.push({ key: "edited", icon: "✏️", label: "แก้ไขหลังส่ง", tone: "info" });
  }
  return flags;
}

/** ฉบับที่ควรกดเข้าไปอ่านก่อนรับทราบ (มีป้ายระดับ warn อย่างน้อย 1 อัน) */
export function isNoteworthy(flags: ReportFlag[]): boolean {
  return flags.some(fl => fl.tone === "warn");
}

/**
 * ย่อข้อความสรุปให้อ่านได้บนการ์ดเดียว
 * ตัด markdown (**หัวข้อ**) และบรรทัดว่างออก แล้วต่อเป็นบรรทัดเดียวคั่นด้วย ·
 */
export function summaryLine(summary: string | null | undefined, maxLen = 150): string {
  const clean = (summary ?? "")
    .replace(/\*\*/g, "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .join(" · ");
  if (!clean) return "(ไม่ได้เขียนสรุป)";
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}…` : clean;
}
