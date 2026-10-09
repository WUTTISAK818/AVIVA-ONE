import { contactPlan } from "./contact-channel";
// จัดลำดับความสำคัญลูกค้าที่ต้องติดตาม แล้วแบ่งเป็น "ชุด" ทีละ 10 ราย
// เหตุผล (Pom 28 ก.ย. 69): ส่งรายชื่อค้างติดตามทีเดียว 150 ราย พนักงานทำไม่ทันและไม่รู้จะเริ่มที่ใคร
// → ระบบต้องบอกว่า "วันนี้โทร 10 คนนี้ เรียงตามความสำคัญ" แล้วค่อยทยอยชุดถัดไป

/** สถานะที่ถือว่าไม่ต้องติดตามในคิวขายแล้ว — ใช้ร่วมกันทั้งคิวในแอปและ cron สรุปเช้า เพื่อให้ตัวเลขตรงกันเสมอ
 *  หมายเหตุ: "Booking" ยังอยู่ในคิว เพราะจองแล้วยังต้องตามให้มาทำสัญญา — ที่ตัดออกคือขั้นที่มีระบบอื่นดูแลต่อแล้ว */
export const FOLLOWUP_DONE_STATUSES = ["Contract", "Loan Approved", "Transfer", "Closed Deal"] as const;

export const FOLLOWUP_BATCH_SIZE = 10;

export interface PriorityLead {
  id: string;
  customer_name: string;
  phone?: string | null;
  status: string;
  budget?: number | null;
  ai_score?: number | null;
  urgency?: string | null;
  probability?: string | null;
  plot_number?: number | null;
  next_follow_up_date?: string | null;
  last_contact_date?: string | null;
  visit_date?: string | null;
  assigned_to?: string | null;
  created_at_default?: string | null;
  /** ช่องทางที่ติดต่อได้จริง — ลูกค้าออนไลน์เกือบครึ่งไม่มีเบอร์ แต่ทักแชตได้ */
  contact_channel?: string | null;
  contact_handle?: string | null;
  source?: string | null;
}

export type PriorityTier = "hot" | "warm" | "cold";

export interface ScoredLead<T extends PriorityLead = PriorityLead> {
  lead: T;
  score: number;
  tier: PriorityTier;
  reasons: string[];
  overdueDays: number;
  /** ติดต่อไม่ได้เลย = ไม่มีทั้งเบอร์ที่ใช้ได้และช่องทางแชต จึงดันไปท้ายคิว
   *  (เดิมชื่อ noPhone และดูแค่ว่าช่อง phone ว่างไหม ทำให้ลูกค้า 103 ราย
   *   ที่ใส่ 099-999-9999 ถูกนับว่า "มีเบอร์" แล้วลอยขึ้นหัวคิวทั้งที่โทรไม่ติด) */
  unreachable: boolean;
}

/** จำนวนวันระหว่างวันที่รูปแบบ YYYY-MM-DD (b − a) — ใช้ UTC เที่ยงวันกันปัญหา timezone/DST */
export function daysBetweenStr(a: string, b: string): number {
  const pa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
  const pb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  if (!pa || !pb) return 0;
  const ta = Date.UTC(+pa[1], +pa[2] - 1, +pa[3], 12);
  const tb = Date.UTC(+pb[1], +pb[2] - 1, +pb[3], 12);
  return Math.round((tb - ta) / 86_400_000);
}

const STAGE_WEIGHT: Record<string, number> = {
  "New Lead": 4,
  Contacted: 10,
  Interested: 14,
  "Site Visit": 18,
  Booking: 30,
};

/** ลูกค้ารายนี้ต้องติดตามหรือยัง — เลยนัด / นัดวันนี้ / ยังไม่เคยตั้งวันนัด */
export function needsFollowup(lead: PriorityLead, today: string): boolean {
  if ((FOLLOWUP_DONE_STATUSES as readonly string[]).includes(lead.status)) return false;
  if (!lead.next_follow_up_date) return true;
  return lead.next_follow_up_date <= today;
}

/** ให้คะแนนความสำคัญ + เหตุผลที่อ่านออก (พนักงานต้องรู้ว่าทำไมคนนี้มาก่อน) */
export function scoreLead<T extends PriorityLead>(lead: T, today: string): ScoredLead<T> {
  const reasons: string[] = [];
  let score = 0;

  score += STAGE_WEIGHT[lead.status] ?? 4;
  if (lead.status === "Booking") reasons.push("จองแล้ว รอทำสัญญา");
  else if (lead.status === "Site Visit") reasons.push("มาดูโครงการแล้ว");

  const urgency = (lead.urgency ?? "").trim();
  if (urgency === "สูงมาก") { score += 18; reasons.push("ด่วนสูงมาก"); }
  else if (urgency === "เร่งด่วน") { score += 10; reasons.push("เร่งด่วน"); }

  const prob = (lead.probability ?? "").trim().toLowerCase();
  if (prob === "high") { score += 14; reasons.push("โอกาสปิดสูง"); }
  else if (prob === "medium") { score += 6; }

  let overdueDays = 0;
  if (lead.next_follow_up_date) {
    overdueDays = Math.max(0, daysBetweenStr(lead.next_follow_up_date, today));
    if (overdueDays > 0) {
      score += Math.min(overdueDays, 14) * 1.5;
      reasons.push(`เลยนัด ${overdueDays} วัน`);
    } else {
      score += 12;
      reasons.push("นัดวันนี้");
    }
  }

  // เพิ่งมาดูโครงการแต่ยังไม่มีนัดต่อ = ลูกค้าร้อนที่กำลังจะหลุดมือ
  if (!lead.next_follow_up_date && lead.visit_date) {
    const since = daysBetweenStr(lead.visit_date, today);
    if (since >= 0 && since <= 14) { score += 12; reasons.push(`เพิ่งมาดู ${since} วันก่อน ยังไม่มีนัดต่อ`); }
  }

  if (lead.plot_number) { score += 8; reasons.push(`สนใจแปลง ${lead.plot_number}`); }

  const budget = Number(lead.budget ?? 0);
  if (budget >= 5_000_000) { score += 8; reasons.push(`งบ ${(budget / 1_000_000).toFixed(1)}M`); }
  else if (budget >= 3_000_000) score += 4;

  if (Number(lead.ai_score ?? 0) >= 80) score += 6;

  // เงียบนาน: นับจากวันที่คุยล่าสุด (ถ้าไม่มี ใช้วันที่มาดู แล้วค่อยวันที่สร้าง)
  const lastTouch = lead.last_contact_date || lead.visit_date
    || (lead.created_at_default ? lead.created_at_default.slice(0, 10) : "");
  if (lastTouch) {
    const quiet = daysBetweenStr(lastTouch, today);
    if (quiet >= 30) { score += 6; reasons.push(`ไม่ได้คุยมา ${quiet} วัน`); }
  }

  const plan = contactPlan(lead);
  const unreachable = plan.unreachable;
  if (unreachable) { score -= 10; reasons.push("ยังไม่มีช่องทางติดต่อ — ต้องหาช่องทางก่อน"); }
  else if (plan.channel !== "phone" && !plan.handle) {
    // ทักได้แต่ยังไม่รู้ว่าทักหาใคร — ติดตามได้ช้ากว่าคนที่ข้อมูลครบ
    score -= 3; reasons.push(`ติดต่อทาง ${plan.label} — ยังไม่ได้บันทึกชื่อผู้ติดต่อ`);
  }

  const tier: PriorityTier = score >= 45 ? "hot" : score >= 25 ? "warm" : "cold";
  return { lead, score, tier, reasons, overdueDays, unreachable };
}

/** เรียงลูกค้าที่ต้องติดตามตามความสำคัญ (คนที่ติดต่อไม่ได้เลยไปท้ายคิวเสมอ) */
export function rankFollowupLeads<T extends PriorityLead>(leads: T[], today: string): ScoredLead<T>[] {
  return leads
    .filter(l => needsFollowup(l, today))
    .map(l => scoreLead(l, today))
    .sort((a, b) => {
      if (a.unreachable !== b.unreachable) return a.unreachable ? 1 : -1;
      if (b.score !== a.score) return b.score - a.score;
      if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
      return a.lead.customer_name.localeCompare(b.lead.customer_name, "th");
    });
}

/** แบ่งคิวเป็นชุดละ size ราย — ชุดที่ 1 คือกลุ่มที่สำคัญที่สุด */
export function splitIntoBatches<T>(rows: T[], size = FOLLOWUP_BATCH_SIZE): T[][] {
  if (size < 1) return rows.length ? [rows] : [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export const TIER_LABEL: Record<PriorityTier, string> = {
  hot: "สำคัญมาก",
  warm: "สำคัญ",
  cold: "ตามปกติ",
};
