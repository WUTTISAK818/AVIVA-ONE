import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isClosedLost } from "./mock-data";

// รายงานการติดตามลูกค้าเก่า รายสัปดาห์/รายเดือน — ใช้ร่วมกันระหว่างหน้าจอ CRM และสรุป LINE
//
// Pom สั่ง 19 ต.ค. 69: "อยากเห็นว่าเซลล์แต่ละคนติดตามลูกค้าเก่าไปถึงไหน มีความคืบหน้าอย่างไร
// อยู่ในเมนูเดิม ไม่ต้องดูหลายที่ เอาให้ชัดและดูง่ายที่สุดสำหรับผู้บริหาร"
//
// ⚠️ ข้อจำกัดของข้อมูลที่ต้องรู้ก่อนอ่านตัวเลข (ตรวจจากฐานข้อมูลจริง 19 ต.ค. 69):
// 1. ตาราง `crm_logs` (บันทึกผลการโทร/แชตรายครั้ง) **ยังไม่มีข้อมูลสักแถวเดียว** — ฟีเจอร์มีอยู่ในแอป
//    แต่ไม่มีใครเคยใช้ จึงนับ "จำนวนครั้งที่ติดต่อ" ไม่ได้ นับได้แค่ "ติดต่อล่าสุดเมื่อไหร่"
// 2. `last_contact_date` ถูกอัปเดตเป็นก้อนใหญ่หลายครั้ง (เช่น 85 รายในวันเดียว) ซึ่งเป็นไปไม่ได้
//    ถ้าติดต่อจริงรายคน -> รายงานนี้จึง **แยก "อัปเดตเป็นชุด" ออกจาก "ติดต่อจริง"** ไม่รวมเป็นผลงาน
// 3. ตัวเลขที่เชื่อได้มากที่สุดคือ "ความคืบหน้าที่มีวันที่กำกับ" (เยี่ยมชม/จอง/เซ็นสัญญา/สินเชื่อ/โอน)
//    เพราะกรอกทีละรายตอนเกิดเหตุจริง -> ใช้เป็นตัวหลักในการวัดผล

export type FollowupPeriod = "week" | "month";

/** เพดานแถวที่ดึงมาคำนวณ — PostgREST ตัดที่ 1000 แถวโดยปริยาย ถ้าไม่ระบุจะนับไม่ครบเงียบ ๆ เมื่อลูกค้าโตขึ้น
 *  (มาตรฐานโค้ดส่วน D: ลิสต์ข้อมูลต้องมี .limit() เสมอ) */
const LEAD_QUERY_LIMIT = 5000;

/** ติดต่อในวันเดียวกันเกินจำนวนนี้ = อัปเดตเป็นชุด ไม่ใช่การติดต่อรายคน
 *  20 ราย/วัน/คน คือเพดานที่ยังพอเป็นไปได้ถ้าโทรจริงทั้งวัน — เกินกว่านี้คือแก้ข้อมูลทีเดียว */
const BULK_TOUCH_PER_DAY = 20;

const MILESTONES = [
  { field: "visit_date", label: "พาเยี่ยมชม", icon: "👀" },
  { field: "booking_date", label: "ปิดจอง", icon: "📝" },
  { field: "contract_signed_date", label: "เซ็นสัญญา", icon: "✍️" },
  { field: "loan_approved_date", label: "สินเชื่อผ่าน", icon: "🏦" },
  { field: "transfer_date", label: "โอนกรรมสิทธิ์", icon: "🔑" },
] as const;

export interface MilestoneCount { label: string; icon: string; n: number }

export interface SellerFollowup {
  seller: string;
  /** ลูกค้าที่ยังอยู่ในมือ (ไม่นับที่ปิดการขายไปแล้ว) */
  inHand: number;
  /** ติดต่อจริงในช่วงนี้ — หักวันที่อัปเดตเป็นชุดออกแล้ว */
  contacted: number;
  /** ถูกอัปเดตเป็นชุดในช่วงนี้ (ไม่นับเป็นผลงาน แต่ต้องให้ผู้บริหารเห็น) */
  bulkTouched: number;
  milestones: MilestoneCount[];
  milestoneTotal: number;
  /** ไม่ได้ติดต่อเกิน 30 วัน (รวมคนที่ไม่เคยบันทึกการติดต่อเลย) */
  stale30: number;
  stale90: number;
  /** เลยนัดติดตามอยู่ ณ ตอนนี้ */
  overdue: number;
  /** ติดต่อไม่ได้เลย — ไม่มีทั้งเบอร์ที่ใช้ได้และชื่อผู้ติดต่อในช่องทางแชต */
  unreachable: number;
  /** ช่วงก่อนหน้า (สัปดาห์ที่แล้ว / เดือนที่แล้ว) ไว้ตอบว่า "ดีขึ้นหรือแย่ลง" */
  prevMilestoneTotal: number;
  prevContacted: number;
}

export interface FollowupReport {
  period: FollowupPeriod;
  since: string;
  until: string;
  label: string;
  sellers: SellerFollowup[];
  totals: { inHand: number; contacted: number; bulkTouched: number; milestoneTotal: number; stale30: number; overdue: number };
  /** ป้ายของช่วงก่อนหน้า เช่น "กันยายน 2569" — ใช้บอกผู้บริหารว่ากำลังเทียบกับอะไร */
  prevLabel: string;
  prevTotals: { milestoneTotal: number; contacted: number };
  /** ข้อสังเกตเรื่องความน่าเชื่อถือของตัวเลข — ต้องแสดงคู่กับรายงานเสมอ */
  warnings: string[];
  generatedAt: string;
}

interface LeadRow {
  assigned_to: string | null;
  status: string | null;
  phone: string | null;
  contact_handle: string | null;
  contact_channel: string | null;
  last_contact_date: string | null;
  next_follow_up_date: string | null;
  visit_date: string | null;
  booking_date: string | null;
  contract_signed_date: string | null;
  loan_approved_date: string | null;
  transfer_date: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** "ตอนนี้" ตามเวลาไทย — อ่านค่าต่อด้วย getUTC* เหมือน cron ตัวอื่นในโปรเจกต์ */
export function thaiNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + 7 * 3_600_000);
}

/** สัปดาห์ จันทร์–อาทิตย์ ที่วันนั้นอยู่ */
export function thaiWeekRange(ref: Date): { since: string; until: string; label: string } {
  const dow = ref.getUTCDay();              // 0 = อาทิตย์
  const backToMonday = dow === 0 ? 6 : dow - 1;
  const start = new Date(ref.getTime() - backToMonday * 86_400_000);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });
  return { since: ymd(start), until: ymd(end), label: `${fmt(start)} – ${fmt(end)}` };
}

/** เดือนที่วันนั้นอยู่ */
export function thaiMonthRange(ref: Date): { since: string; until: string; label: string } {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0));
  return {
    since: ymd(start),
    until: ymd(end),
    label: start.toLocaleDateString("th-TH", { timeZone: "UTC", month: "long", year: "numeric" }),
  };
}

/** สัปดาห์ก่อนหน้าของสัปดาห์ที่วันนั้นอยู่ */
export function prevWeekRange(ref: Date): { since: string; until: string; label: string } {
  return thaiWeekRange(new Date(ref.getTime() - 7 * 86_400_000));
}

/** เดือนก่อนหน้าของเดือนที่วันนั้นอยู่ */
export function prevMonthRange(ref: Date): { since: string; until: string; label: string } {
  return thaiMonthRange(new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1) - 86_400_000));
}

const inRange = (v: string | null, since: string, until: string) => !!v && v >= since && v <= until;

/** เบอร์ใช้ได้จริงไหม — ตรงกับกฎใน contact-channel.ts (เลี่ยง import ข้าม server/client) */
const hasUsablePhone = (phone: string | null) => (phone ?? "").replace(/[^0-9]/g, "").length >= 9;

type Db = SupabaseClient;

export async function buildFollowupReport(
  db: Db,
  period: FollowupPeriod,
  ref: Date = thaiNow(),
): Promise<FollowupReport> {
  const range = period === "week" ? thaiWeekRange(ref) : thaiMonthRange(ref);
  const today = ymd(ref);
  const dayBefore = (n: number) => ymd(new Date(ref.getTime() - n * 86_400_000));

  const { data } = await db
    .from("leads")
    .select(
      "assigned_to, status, phone, contact_handle, contact_channel, last_contact_date, next_follow_up_date, visit_date, booking_date, contract_signed_date, loan_approved_date, transfer_date",
    )
    .limit(LEAD_QUERY_LIMIT);
  const leads = (data ?? []) as LeadRow[];
  // ถ้าชนเพดานพอดี แปลว่าอาจมีลูกค้าที่ไม่ได้ถูกนับ — ต้องบอกผู้บริหาร ห้ามให้ตัวเลขผิดแบบเงียบ ๆ
  const truncated = leads.length >= LEAD_QUERY_LIMIT;

  // หาวันที่ "อัปเดตเป็นชุด" ของแต่ละคน ก่อนนับผลงาน
  const touchesPerSellerDay = new Map<string, number>();
  for (const l of leads) {
    if (inRange(l.last_contact_date, range.since, range.until)) {
      const key = `${l.assigned_to ?? ""}|${l.last_contact_date}`;
      touchesPerSellerDay.set(key, (touchesPerSellerDay.get(key) ?? 0) + 1);
    }
  }
  const isBulk = (seller: string | null, date: string | null) =>
    (touchesPerSellerDay.get(`${seller ?? ""}|${date}`) ?? 0) >= BULK_TOUCH_PER_DAY;

  // ช่วงก่อนหน้า — นับจากข้อมูลชุดเดิมที่ดึงมาแล้ว ไม่ต้องยิง query เพิ่ม
  //
  // ⚠️ ต้องเทียบ "จำนวนวันเท่ากัน" เท่านั้น
  // ถ้าเอาเดือนนี้ที่เพิ่งผ่านไป 19 วัน ไปเทียบกับเดือนที่แล้วทั้งเดือน ตัวเลขจะขึ้นว่า "ลดลง"
  // ทั้งที่ยังไม่จบเดือน -> เป็นการบอกผู้บริหารผิด จึงตัดช่วงก่อนหน้าให้เหลือจำนวนวันเท่ากัน
  const prevFull = period === "week" ? prevWeekRange(ref) : prevMonthRange(ref);
  const elapsedDays =
    Math.round((Date.parse(today) - Date.parse(range.since)) / 86_400_000) + 1;
  const periodDays =
    Math.round((Date.parse(range.until) - Date.parse(range.since)) / 86_400_000) + 1;
  const inProgress = elapsedDays < periodDays;
  const prevCapped = ymd(new Date(Date.parse(prevFull.since) + (elapsedDays - 1) * 86_400_000));
  const prevUntil = inProgress && prevCapped < prevFull.until ? prevCapped : prevFull.until;
  const prevDayLabel = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });
  const prev = {
    since: prevFull.since,
    until: prevUntil,
    label: inProgress
      ? `${prevDayLabel(prevFull.since)}–${prevDayLabel(prevUntil)} (ช่วงเดียวกันของรอบก่อน)`
      : prevFull.label,
  };
  const prevTouchesPerSellerDay = new Map<string, number>();
  for (const l of leads) {
    if (inRange(l.last_contact_date, prev.since, prev.until)) {
      const key = `${l.assigned_to ?? ""}|${l.last_contact_date}`;
      prevTouchesPerSellerDay.set(key, (prevTouchesPerSellerDay.get(key) ?? 0) + 1);
    }
  }
  const wasBulk = (seller: string | null, date: string | null) =>
    (prevTouchesPerSellerDay.get(`${seller ?? ""}|${date}`) ?? 0) >= BULK_TOUCH_PER_DAY;

  const sellers = new Map<string, SellerFollowup>();
  const blank = (name: string): SellerFollowup => ({
    seller: name,
    inHand: 0, contacted: 0, bulkTouched: 0,
    milestones: MILESTONES.map((m) => ({ label: m.label, icon: m.icon, n: 0 })),
    milestoneTotal: 0, stale30: 0, stale90: 0, overdue: 0, unreachable: 0,
    prevMilestoneTotal: 0, prevContacted: 0,
  });

  for (const l of leads) {
    const name = (l.assigned_to ?? "").trim() || "ยังไม่มีเจ้าของ";
    if (!sellers.has(name)) sellers.set(name, blank(name));
    const s = sellers.get(name)!;
    // "ลูกค้าในมือ" = ยังต้องตามต่อจริง — ไม่นับที่ปิดการขายแล้ว และที่จบแบบไม่ไปต่อ (ไม่สนใจ/ติดต่อไม่ได้)
    const open = l.status !== "Closed Deal" && !isClosedLost(l.status);

    if (open) {
      s.inHand += 1;
      if (!l.last_contact_date || l.last_contact_date < dayBefore(30)) s.stale30 += 1;
      if (!l.last_contact_date || l.last_contact_date < dayBefore(90)) s.stale90 += 1;
      if (l.next_follow_up_date && l.next_follow_up_date < today) s.overdue += 1;
      if (!hasUsablePhone(l.phone) && !(l.contact_handle ?? "").trim()) s.unreachable += 1;
    }

    if (inRange(l.last_contact_date, range.since, range.until)) {
      if (isBulk(l.assigned_to, l.last_contact_date)) s.bulkTouched += 1;
      else s.contacted += 1;
    }

    MILESTONES.forEach((m, i) => {
      if (inRange(l[m.field], range.since, range.until)) {
        s.milestones[i].n += 1;
        s.milestoneTotal += 1;
      }
      if (inRange(l[m.field], prev.since, prev.until)) s.prevMilestoneTotal += 1;
    });

    if (inRange(l.last_contact_date, prev.since, prev.until) && !wasBulk(l.assigned_to, l.last_contact_date)) {
      s.prevContacted += 1;
    }
  }

  // เรียงคนที่มีความคืบหน้าจริงมากที่สุดขึ้นก่อน แล้วค่อยดูจำนวนที่ติดต่อ
  const list = [...sellers.values()]
    .filter((s) => s.inHand > 0 || s.milestoneTotal > 0 || s.contacted > 0)
    .sort((a, b) => b.milestoneTotal - a.milestoneTotal || b.contacted - a.contacted || b.inHand - a.inHand);

  const totals = list.reduce(
    (t, s) => ({
      inHand: t.inHand + s.inHand,
      contacted: t.contacted + s.contacted,
      bulkTouched: t.bulkTouched + s.bulkTouched,
      milestoneTotal: t.milestoneTotal + s.milestoneTotal,
      stale30: t.stale30 + s.stale30,
      overdue: t.overdue + s.overdue,
    }),
    { inHand: 0, contacted: 0, bulkTouched: 0, milestoneTotal: 0, stale30: 0, overdue: 0 },
  );

  const prevTotals = list.reduce(
    (t, s) => ({ milestoneTotal: t.milestoneTotal + s.prevMilestoneTotal, contacted: t.contacted + s.prevContacted }),
    { milestoneTotal: 0, contacted: 0 },
  );

  const warnings: string[] = [];
  if (inProgress) {
    warnings.push(`${period === "week" ? "สัปดาห์" : "เดือน"}นี้ยังไม่จบ (ผ่านไป ${elapsedDays} จาก ${periodDays} วัน) — ตัวเลขที่เอาไปเทียบจึงตัดช่วงก่อนหน้าให้เหลือ ${elapsedDays} วันเท่ากัน`);
  }
  if (truncated) {
    warnings.push(`ข้อมูลลูกค้าเกิน ${LEAD_QUERY_LIMIT.toLocaleString("th-TH")} ราย — รายงานนี้นับเฉพาะชุดแรกเท่านั้น ตัวเลขอาจไม่ครบ กรุณาแจ้งผู้ดูแลระบบ`);
  }
  if (totals.bulkTouched > 0) {
    warnings.push(`มีลูกค้า ${totals.bulkTouched} รายถูกอัปเดต "วันติดต่อล่าสุด" เป็นชุดในช่วงนี้ (เกิน ${BULK_TOUCH_PER_DAY} รายในวันเดียว) — ไม่นับเป็นการติดต่อรายคน`);
  }
  warnings.push('ระบบยังไม่มีบันทึกผลการโทร/แชตรายครั้งเลยสักรายการ — "ติดต่อจริง" จึงนับได้แค่จากวันติดต่อล่าสุด ไม่ใช่จำนวนครั้ง');

  return {
    period,
    since: range.since,
    until: range.until,
    label: range.label,
    sellers: list,
    totals,
    prevLabel: prev.label,
    prevTotals,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

/** ข้อความสรุปสำหรับส่ง LINE — สั้น อ่านจบในจอเดียว เรียงคนที่มีผลงานจริงขึ้นก่อน */
export function followupReportLineText(r: FollowupReport): string {
  const head = r.period === "week" ? "สรุปการติดตามลูกค้ารายสัปดาห์" : "สรุปการติดตามลูกค้ารายเดือน";
  const lines: string[] = [`📊 ${head} — ${r.label}`, ""];

  if (r.sellers.length === 0) {
    lines.push("ยังไม่มีข้อมูลลูกค้าในระบบสำหรับช่วงนี้");
    return lines.join("\n");
  }

  for (const s of r.sellers) {
    const done = s.milestones.filter((m) => m.n > 0).map((m) => `${m.icon} ${m.label} ${m.n}`).join(" · ");
    lines.push(`👤 ${s.seller} — ลูกค้าในมือ ${s.inHand} ราย`);
    const diff = s.milestoneTotal - s.prevMilestoneTotal;
    const trend = diff > 0 ? `▲ มากกว่าช่วงก่อน ${diff}` : diff < 0 ? `▼ น้อยกว่าช่วงก่อน ${Math.abs(diff)}` : "เท่าช่วงก่อน";
    lines.push(`   ความคืบหน้า: ${done || "ไม่มีความคืบหน้าในช่วงนี้"} (${trend})`);
    lines.push(`   ติดต่อจริง ${s.contacted} ราย${s.bulkTouched > 0 ? ` (+ อัปเดตเป็นชุดอีก ${s.bulkTouched} ราย ไม่นับ)` : ""}`);
    const risk: string[] = [];
    if (s.stale30 > 0) risk.push(`เงียบเกิน 30 วัน ${s.stale30}`);
    if (s.overdue > 0) risk.push(`เลยนัด ${s.overdue}`);
    if (s.unreachable > 0) risk.push(`ติดต่อไม่ได้ ${s.unreachable}`);
    if (risk.length > 0) lines.push(`   ⚠️ ${risk.join(" · ")}`);
    lines.push("");
  }

  lines.push(`รวมทีม: ความคืบหน้า ${r.totals.milestoneTotal} รายการ · ติดต่อจริง ${r.totals.contacted} ราย · เงียบเกิน 30 วัน ${r.totals.stale30} ราย`);
  lines.push(`เทียบ${r.prevLabel}: ความคืบหน้า ${r.prevTotals.milestoneTotal} รายการ · ติดต่อจริง ${r.prevTotals.contacted} ราย`);
  for (const w of r.warnings) lines.push(`หมายเหตุ: ${w}`);
  return lines.join("\n");
}
