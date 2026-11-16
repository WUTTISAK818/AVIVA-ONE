// คำขอแก้ไขข้อมูลลูกค้า (CRM) — แหล่งความจริงเดียว ใช้ทั้งหน้า CRM · หน้าอนุมัติ · cron หมดเวลา
//
// v8.12 (Pom สั่ง 16 พ.ย. 69): "กรณีพนักงานมีปัญหาในการใช้งาน หรือต้องการแก้ไขข้อมูล ให้ทำเป็นคำขอ
//   ว่าจะแก้เรื่องอะไร ... ให้อนุมัติแก้ไขอะไรได้บ้าง ระยะเวลาเท่าไหร่ แล้วส่งกลับให้ผมตรวจแล้วถึงอนุมัติ"
//
// ขั้นตอน (ตาราง lead_edit_requests):
//   pending    พนักงานยื่นคำขอ: เลือกส่วนที่จะแก้ + เหตุผล
//   editing    ผู้บริหารอนุมัติ: เลือกส่วนที่แก้ได้จริง + ระยะเวลา 1/3/7 วัน · ระบบถ่ายค่าเดิมเก็บไว้ (snapshot)
//   submitted  พนักงานกด "ส่งให้ผู้บริหารตรวจ" หรือครบเวลาแล้วระบบส่งเอง (auto_submitted)
//   approved   ผู้บริหารตรวจแล้วอนุมัติ — ค่าใหม่มีผล
//   (ตีกลับ)    ผู้บริหารตีกลับพร้อมเหตุผล -> กลับเป็น editing อีกรอบ (return_count + 1) ค่าเดิมยังเก็บไว้เทียบ
//   reverted   ผู้บริหารเลือก "คืนค่าเดิม" — ระบบเขียนค่าใน snapshot กลับลงลูกค้า
//   rejected   ผู้บริหารไม่อนุมัติคำขอตั้งแต่แรก · cancelled ผู้ขอยกเลิกเอง / หมดเวลาโดยไม่ได้แก้อะไร
//
// หลัก Maker-Checker: ผู้ขอ (พนักงาน) ≠ ผู้อนุมัติ/ผู้ตรวจ (ผู้บริหาร) · ทุกขั้นลง audit_log (module crm)
// ฟังก์ชันในไฟล์นี้ทำงานกับฐานข้อมูลเท่านั้น (รับ db เข้ามา) — การแจ้งเตือนเป็นหน้าที่ของผู้เรียก
// เพราะฝั่งเบราว์เซอร์กับฝั่ง cron แจ้งเตือนคนละวิธี

import type { SupabaseClient } from "@supabase/supabase-js";

export type EditGroup = "contact" | "profile" | "sale_dates" | "money" | "owner";

export const EDIT_GROUPS: { key: EditGroup; label: string; hint: string; fields: { key: string; label: string }[] }[] = [
  {
    key: "contact", label: "ข้อมูลติดต่อ / ที่อยู่", hint: "ชื่อ เบอร์ อีเมล ช่องทางแชต ที่อยู่",
    fields: [
      { key: "customer_name", label: "ชื่อลูกค้า" },
      { key: "phone", label: "เบอร์โทร" },
      { key: "email", label: "อีเมล" },
      { key: "contact_channel", label: "ช่องทางติดต่อ" },
      { key: "contact_handle", label: "ชื่อ/ไอดีในช่องทาง" },
      { key: "contact_address", label: "ที่อยู่ (รวม)" },
      { key: "addr_detail", label: "บ้านเลขที่/ถนน" },
      { key: "addr_tambon", label: "ตำบล" },
      { key: "addr_amphoe", label: "อำเภอ" },
      { key: "addr_province", label: "จังหวัด" },
      { key: "addr_zipcode", label: "รหัสไปรษณีย์" },
    ],
  },
  {
    key: "profile", label: "ข้อมูลประกอบการขาย / บันทึก", hint: "อาชีพ ความต้องการ งบผ่อน บันทึก วันนัดติดตาม",
    fields: [
      { key: "marital_status", label: "สถานภาพ" },
      { key: "age_range", label: "ช่วงอายุ" },
      { key: "occupation", label: "อาชีพ" },
      { key: "current_residence", label: "ที่อยู่อาศัยปัจจุบัน" },
      { key: "product_interest", label: "แบบบ้านที่สนใจ" },
      { key: "room_requirement", label: "จำนวนห้อง" },
      { key: "visit_reason", label: "เหตุผลที่มาดู" },
      { key: "competitor_projects", label: "โครงการคู่แข่ง" },
      { key: "budget_range", label: "ช่วงงบประมาณ" },
      { key: "monthly_payment_range", label: "ผ่อนต่อเดือน" },
      { key: "probability", label: "โอกาสซื้อ" },
      { key: "financing_type", label: "วิธีซื้อ (กู้/สด)" },
      { key: "urgency", label: "ความเร่งด่วน" },
      { key: "notes", label: "บันทึก" },
      { key: "next_follow_up_date", label: "วันนัดติดตาม" },
    ],
  },
  {
    key: "sale_dates", label: "วันที่การขาย", hint: "วันเข้าชม วันจอง วันทำสัญญา วันกู้ผ่าน วันนัดโอน วันโอน วันส่งมอบ",
    fields: [
      { key: "visit_date", label: "วันเข้าชม" },
      { key: "visit_time", label: "เวลาเข้าชม" },
      { key: "booking_date", label: "วันจอง" },
      { key: "contract_signed_date", label: "วันทำสัญญา" },
      { key: "loan_approved_date", label: "วันกู้ผ่าน" },
      { key: "transfer_appointment_date", label: "วันนัดโอน" },
      { key: "transfer_date", label: "วันโอน" },
      { key: "delivery_date", label: "วันส่งมอบ" },
    ],
  },
  {
    key: "money", label: "ตัวเลขเงิน", hint: "งบประมาณ ราคาขายที่ตกลง เงินจอง",
    fields: [
      { key: "budget", label: "งบประมาณ" },
      { key: "contract_price", label: "ราคาขายที่ตกลง" },
      { key: "booking_deposit", label: "เงินจอง" },
    ],
  },
  {
    key: "owner", label: "ผู้ดูแล / ที่มาของลูกค้า", hint: "พนักงานที่ดูแล ช่องทางที่ลูกค้าเข้ามา (มีผลกับผลงานขายและสถิติการตลาด)",
    fields: [
      { key: "assigned_to", label: "ผู้ดูแล" },
      { key: "source", label: "ช่องทางที่มา" },
    ],
  },
];

/** สถานะ/แปลง ไม่อยู่ในคำขอ — มีขั้นตอนอนุมัติของตัวเองอยู่แล้ว (จอง/ทำสัญญา/โอน มีผลกับบ้านและบัญชี) */
export const EDIT_GROUP_KEYS = EDIT_GROUPS.map((g) => g.key);
export const GROUP_LABEL: Record<string, string> = Object.fromEntries(EDIT_GROUPS.map((g) => [g.key, g.label]));
export const FIELD_LABEL: Record<string, string> = Object.fromEntries(EDIT_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.label])));
const MONEY_FIELDS = new Set(["budget", "contract_price", "booking_deposit"]);
const OTHER_LABEL: Record<string, string> = { status: "สถานะ", plot_number: "แปลง", reported_by: "ผู้รายงาน", reported_at: "เวลารายงาน" };
/** ชื่อช่องภาษาไทย — รวมช่องที่ไม่อยู่ในคำขอ (สถานะ/แปลง) ไว้ใช้บอกผู้ใช้ว่าช่องไหนแก้ไม่ได้ */
export function fieldLabel(key: string): string {
  return FIELD_LABEL[key] ?? OTHER_LABEL[key] ?? key;
}

export function fieldsOf(groups: readonly string[] | null | undefined): string[] {
  const set = new Set(groups ?? []);
  return EDIT_GROUPS.filter((g) => set.has(g.key)).flatMap((g) => g.fields.map((f) => f.key));
}

export function groupLabels(groups: readonly string[] | null | undefined): string {
  return (groups ?? []).map((g) => GROUP_LABEL[g] ?? g).join(" · ") || "—";
}

export const EDIT_DAYS_OPTIONS = [1, 3, 7] as const;

export type LeadEditStatus = "pending" | "editing" | "submitted" | "approved" | "rejected" | "reverted" | "cancelled";

export const EDIT_STATUS_LABEL: Record<LeadEditStatus, string> = {
  pending: "รอผู้บริหารอนุมัติคำขอ",
  editing: "อนุมัติให้แก้ไขแล้ว",
  submitted: "ส่งตรวจแล้ว รอผู้บริหารตรวจ",
  approved: "ผู้บริหารตรวจผ่านแล้ว",
  rejected: "ไม่อนุมัติคำขอ",
  reverted: "คืนค่าเดิมแล้ว",
  cancelled: "ปิดคำขอแล้ว",
};

export interface LeadEditRequest {
  id: string;
  lead_id: string;
  requested_by_email: string;
  requested_by_name: string | null;
  requested_groups: string[];
  reason: string;
  status: LeadEditStatus;
  allowed_groups: string[];
  edit_until: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  submitted_at: string | null;
  auto_submitted: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  return_count: number;
  created_at: string;
  updated_at: string;
}

export const OPEN_EDIT_STATUSES: LeadEditStatus[] = ["pending", "editing", "submitted"];

/** อยู่ในช่วงที่ได้รับอนุญาตให้แก้ (ยังไม่หมดเวลา) */
export function isActiveEdit(r: Pick<LeadEditRequest, "status" | "edit_until">, now = Date.now()): boolean {
  return r.status === "editing" && !!r.edit_until && new Date(r.edit_until).getTime() > now;
}

/** อนุมัติให้แก้แล้วแต่หมดเวลา — ต้องส่งตรวจ (หรือปิดถ้าไม่ได้แก้อะไร) */
export function isExpiredEdit(r: Pick<LeadEditRequest, "status" | "edit_until">, now = Date.now()): boolean {
  return r.status === "editing" && !!r.edit_until && new Date(r.edit_until).getTime() <= now;
}

/** เวลาไทยแบบอ่านง่าย เช่น "18 พ.ย. 69 14:05" */
export function thaiDateTimeLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function norm(field: string, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (MONEY_FIELDS.has(field)) {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : String(v).trim();
  }
  return String(v).trim();
}

export function sameValue(field: string, a: unknown, b: unknown): boolean {
  return norm(field, a) === norm(field, b);
}

export function formatEditValue(field: string, v: unknown): string {
  const s = norm(field, v);
  if (!s) return "(ว่าง)";
  if (MONEY_FIELDS.has(field) && /^-?\d+(\.\d+)?$/.test(s)) return `฿${Number(s).toLocaleString("th-TH")}`;
  return s;
}

export interface EditDiffRow { field: string; label: string; before: unknown; after: unknown }

/** เทียบค่าเดิม (snapshot) กับค่าปัจจุบัน — เฉพาะช่องที่อยู่ใน snapshot */
export function diffSnapshot(before: Record<string, unknown> | null, after: Record<string, unknown> | null): EditDiffRow[] {
  if (!before || !after) return [];
  return Object.keys(before)
    .filter((k) => !sameValue(k, before[k], after[k]))
    .map((k) => ({ field: k, label: FIELD_LABEL[k] ?? k, before: before[k], after: after[k] }));
}

/** อ่านค่าปัจจุบันของลูกค้าเฉพาะช่องในส่วนที่กำหนด */
export async function readLeadFields(db: SupabaseClient, leadId: string, groups: readonly string[]): Promise<Record<string, unknown> | null> {
  const fields = fieldsOf(groups);
  if (fields.length === 0) return {};
  const { data, error } = await db.from("leads").select(fields.join(", ")).eq("id", leadId).maybeSingle();
  if (error || !data) return null;
  return data as unknown as Record<string, unknown>;
}

export interface Actor { name: string; email?: string | null; role?: string | null; dept?: string | null }

/** Maker-Checker: ผู้ขอแก้ไขกับผู้อนุมัติ/ผู้ตรวจต้องไม่ใช่คนเดียวกัน */
function sameActor(req: Pick<LeadEditRequest, "requested_by_email">, by: Actor): boolean {
  return !!by.email && req.requested_by_email.toLowerCase() === by.email.toLowerCase();
}
const SELF_REVIEW = "ผู้ขอกับผู้อนุมัติ/ผู้ตรวจเป็นคนเดียวกันไม่ได้ (Maker-Checker)";
export type EditActionResult = { ok: true; diff?: EditDiffRow[]; note?: string } | { ok: false; reason: string };

async function audit(db: SupabaseClient, req: Pick<LeadEditRequest, "id" | "lead_id">, action: string, description: string, by: Actor) {
  await db.from("audit_log").insert({
    module: "crm",
    action,
    record_id: req.lead_id,
    description: `${description} · คำขอ ${req.id.slice(0, 8)}`,
    performed_by: by.name,
    performed_by_role: by.role ?? null,
    performed_by_dept: by.dept ?? null,
  });
}

function diffText(diff: EditDiffRow[]): string {
  return diff.map((d) => `${d.label}: ${formatEditValue(d.field, d.before)} → ${formatEditValue(d.field, d.after)}`).join(" · ");
}

/** อัปเดตแบบมีเงื่อนไขสถานะเดิม — กันสองคนกดพร้อมกัน (เช่น cron ส่งตรวจพร้อมกับพนักงานกดส่ง) */
async function transition(db: SupabaseClient, id: string, from: LeadEditStatus[], patch: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await db.from("lead_edit_requests")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id).in("status", from).select("id");
  return !error && !!data && data.length > 0;
}

/** พนักงานยื่นคำขอ */
export async function createEditRequest(db: SupabaseClient, p: {
  leadId: string; email: string; name: string; groups: string[]; reason: string; role?: string | null; dept?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const groups = p.groups.filter((g) => EDIT_GROUP_KEYS.includes(g as EditGroup));
  if (groups.length === 0) return { ok: false, reason: "เลือกอย่างน้อย 1 ส่วนที่ต้องการแก้" };
  if (p.reason.trim().length < 5) return { ok: false, reason: "กรุณาเขียนเหตุผลว่าจะแก้อะไร เพราะอะไร" };
  const { data: open } = await db.from("lead_edit_requests").select("id")
    .eq("lead_id", p.leadId).eq("requested_by_email", p.email).in("status", OPEN_EDIT_STATUSES);
  if (open && open.length > 0) return { ok: false, reason: "มีคำขอของลูกค้ารายนี้ที่ยังไม่จบอยู่แล้ว" };
  const { data, error } = await db.from("lead_edit_requests").insert({
    lead_id: p.leadId, requested_by_email: p.email, requested_by_name: p.name,
    requested_groups: groups, reason: p.reason.trim(), status: "pending",
  }).select("id").single();
  if (error || !data) return { ok: false, reason: error?.message ?? "บันทึกคำขอไม่สำเร็จ" };
  const id = (data as { id: string }).id;
  await audit(db, { id, lead_id: p.leadId }, "edit_request_create",
    `ขอแก้ไขข้อมูลลูกค้า ส่วน: ${groupLabels(groups)} · เหตุผล: ${p.reason.trim()}`, { name: p.name, role: p.role, dept: p.dept });
  return { ok: true, id };
}

/** ผู้ขอยกเลิกเองตอนยังรออนุมัติ */
export async function cancelEditRequest(db: SupabaseClient, req: LeadEditRequest, by: Actor): Promise<EditActionResult> {
  const ok = await transition(db, req.id, ["pending"], { status: "cancelled", review_note: `ผู้ขอยกเลิกเอง (${by.name})` });
  if (!ok) return { ok: false, reason: "คำขอนี้ถูกดำเนินการไปแล้ว" };
  await audit(db, req, "edit_request_cancel", "ผู้ขอยกเลิกคำขอแก้ไขข้อมูล", by);
  return { ok: true };
}

/** ผู้บริหารอนุมัติคำขอ: กำหนดส่วนที่แก้ได้ + ระยะเวลา · ถ่ายค่าเดิมเก็บไว้ */
export async function approveEditRequest(db: SupabaseClient, req: LeadEditRequest, p: {
  groups: string[]; days: number; note?: string; by: Actor;
}): Promise<EditActionResult> {
  if (sameActor(req, p.by)) return { ok: false, reason: SELF_REVIEW };
  const groups = p.groups.filter((g) => EDIT_GROUP_KEYS.includes(g as EditGroup));
  if (groups.length === 0) return { ok: false, reason: "เลือกอย่างน้อย 1 ส่วนที่อนุญาตให้แก้" };
  const snapshot = await readLeadFields(db, req.lead_id, groups);
  if (!snapshot) return { ok: false, reason: "อ่านข้อมูลลูกค้าไม่ได้ (อาจถูกลบไปแล้ว)" };
  const until = new Date(Date.now() + p.days * 86_400_000).toISOString();
  const ok = await transition(db, req.id, ["pending"], {
    status: "editing", allowed_groups: groups, edit_until: until, snapshot,
    decided_by: p.by.name, decided_at: new Date().toISOString(), decision_note: p.note?.trim() || null,
  });
  if (!ok) return { ok: false, reason: "คำขอนี้ถูกดำเนินการไปแล้ว" };
  await audit(db, req, "edit_request_approve",
    `อนุมัติให้แก้ไขข้อมูลลูกค้า ส่วน: ${groupLabels(groups)} ถึง ${thaiDateTimeLabel(until)} (${p.days} วัน)${p.note?.trim() ? ` · ${p.note.trim()}` : ""}`, p.by);
  return { ok: true };
}

/** ผู้บริหารไม่อนุมัติคำขอ (ขั้นแรก) */
export async function rejectEditRequest(db: SupabaseClient, req: LeadEditRequest, p: { note: string; by: Actor }): Promise<EditActionResult> {
  if (sameActor(req, p.by)) return { ok: false, reason: SELF_REVIEW };
  if (!p.note.trim()) return { ok: false, reason: "กรุณาระบุเหตุผลที่ไม่อนุมัติ" };
  const ok = await transition(db, req.id, ["pending"], {
    status: "rejected", decided_by: p.by.name, decided_at: new Date().toISOString(), decision_note: p.note.trim(),
  });
  if (!ok) return { ok: false, reason: "คำขอนี้ถูกดำเนินการไปแล้ว" };
  await audit(db, req, "edit_request_reject", `ไม่อนุมัติคำขอแก้ไขข้อมูล · ${p.note.trim()}`, p.by);
  return { ok: true };
}

/**
 * ส่งให้ผู้บริหารตรวจ — พนักงานกดเอง หรือระบบส่งเมื่อหมดเวลา (auto)
 * ถ้าไม่ได้แก้อะไรเลยและหมดเวลา -> ปิดคำขอ (cancelled) ไม่ต้องรบกวนผู้บริหาร
 */
export async function submitEditRequest(db: SupabaseClient, req: LeadEditRequest, p: { auto: boolean; by: Actor }): Promise<EditActionResult & { closedNoChange?: boolean }> {
  const after = await readLeadFields(db, req.lead_id, req.allowed_groups);
  if (!after) return { ok: false, reason: "อ่านข้อมูลลูกค้าไม่ได้" };
  const diff = diffSnapshot(req.snapshot, after);
  const nowIso = new Date().toISOString();
  if (diff.length === 0 && p.auto) {
    const ok = await transition(db, req.id, ["editing"], {
      status: "cancelled", after_snapshot: after, submitted_at: nowIso, auto_submitted: true,
      review_note: "หมดเวลาแก้ไขโดยไม่มีการเปลี่ยนแปลง — ระบบปิดคำขอเอง",
    });
    if (!ok) return { ok: false, reason: "คำขอนี้ถูกดำเนินการไปแล้ว" };
    await audit(db, req, "edit_request_expire", "หมดเวลาแก้ไข ไม่มีการเปลี่ยนแปลง — ระบบปิดคำขอ", p.by);
    return { ok: true, diff, closedNoChange: true };
  }
  if (diff.length === 0) return { ok: false, reason: "ยังไม่มีข้อมูลที่ถูกแก้ — แก้ข้อมูลก่อนแล้วค่อยส่งตรวจ" };
  const ok = await transition(db, req.id, ["editing"], {
    status: "submitted", after_snapshot: after, submitted_at: nowIso, auto_submitted: p.auto,
  });
  if (!ok) return { ok: false, reason: "คำขอนี้ถูกส่งตรวจไปแล้ว" };
  await audit(db, req, p.auto ? "edit_request_auto_submit" : "edit_request_submit",
    `${p.auto ? "หมดเวลาแก้ไข ระบบส่งตรวจให้" : "ส่งให้ผู้บริหารตรวจ"} · ${diffText(diff)}`, p.by);
  return { ok: true, diff };
}

/** ผู้บริหารตรวจแล้วอนุมัติการแก้ไข */
export async function approveEditResult(db: SupabaseClient, req: LeadEditRequest, p: { note?: string; by: Actor }): Promise<EditActionResult> {
  if (sameActor(req, p.by)) return { ok: false, reason: SELF_REVIEW };
  const diff = diffSnapshot(req.snapshot, req.after_snapshot);
  const ok = await transition(db, req.id, ["submitted"], {
    status: "approved", reviewed_by: p.by.name, reviewed_at: new Date().toISOString(), review_note: p.note?.trim() || null,
  });
  if (!ok) return { ok: false, reason: "คำขอนี้ถูกตรวจไปแล้ว" };
  await audit(db, req, "edit_request_review_approve",
    `ตรวจผ่าน — อนุมัติการแก้ไข · ${diffText(diff)}${p.note?.trim() ? ` · ${p.note.trim()}` : ""}`, p.by);
  return { ok: true, diff };
}

/** ผู้บริหารตีกลับให้แก้ใหม่ — เปิดสิทธิ์รอบใหม่ (ค่าเดิมยังเก็บไว้เทียบ) */
export async function returnEditRequest(db: SupabaseClient, req: LeadEditRequest, p: { note: string; days: number; by: Actor }): Promise<EditActionResult> {
  if (sameActor(req, p.by)) return { ok: false, reason: SELF_REVIEW };
  if (!p.note.trim()) return { ok: false, reason: "กรุณาระบุว่าต้องแก้อะไรเพิ่ม" };
  const until = new Date(Date.now() + p.days * 86_400_000).toISOString();
  const ok = await transition(db, req.id, ["submitted"], {
    status: "editing", edit_until: until, return_count: (req.return_count ?? 0) + 1,
    reviewed_by: p.by.name, reviewed_at: new Date().toISOString(), review_note: p.note.trim(),
  });
  if (!ok) return { ok: false, reason: "คำขอนี้ถูกตรวจไปแล้ว" };
  await audit(db, req, "edit_request_return",
    `ตีกลับให้แก้ใหม่ (รอบที่ ${(req.return_count ?? 0) + 1}) ถึง ${thaiDateTimeLabel(until)} · ${p.note.trim()}`, p.by);
  return { ok: true };
}

/**
 * ผู้บริหาร "คืนค่าเดิม" — เขียนค่าจาก snapshot กลับลงลูกค้า เฉพาะช่องที่ต่างจากค่าเดิม
 * คืน note ถ้ามีช่องที่ถูกแก้ต่อหลังส่งตรวจ (ค่าปัจจุบัน ≠ ค่าตอนส่งตรวจ) — ให้ผู้บริหารรู้ว่าทับอะไรไป
 */
export async function revertEditRequest(db: SupabaseClient, req: LeadEditRequest, p: { note?: string; by: Actor }): Promise<EditActionResult> {
  if (sameActor(req, p.by)) return { ok: false, reason: SELF_REVIEW };
  if (!req.snapshot) return { ok: false, reason: "คำขอนี้ไม่มีค่าเดิมเก็บไว้" };
  const current = await readLeadFields(db, req.lead_id, req.allowed_groups);
  if (!current) return { ok: false, reason: "อ่านข้อมูลลูกค้าไม่ได้" };
  const diff = diffSnapshot(req.snapshot, current);
  const changedAfter = req.after_snapshot
    ? Object.keys(current).filter((k) => !sameValue(k, current[k], req.after_snapshot?.[k])).map((k) => FIELD_LABEL[k] ?? k)
    : [];
  if (diff.length > 0) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const d of diff) patch[d.field] = req.snapshot[d.field] ?? null;
    const { error } = await db.from("leads").update(patch).eq("id", req.lead_id);
    if (error) return { ok: false, reason: `คืนค่าไม่สำเร็จ: ${error.message}` };
  }
  const ok = await transition(db, req.id, ["submitted"], {
    status: "reverted", reviewed_by: p.by.name, reviewed_at: new Date().toISOString(), review_note: p.note?.trim() || null,
  });
  if (!ok) return { ok: false, reason: "ค่าเดิมถูกคืนแล้ว แต่ปิดคำขอไม่สำเร็จ (อาจถูกตรวจไปแล้ว)" };
  const note = changedAfter.length ? `มีช่องที่ถูกแก้ต่อหลังส่งตรวจและถูกคืนค่าทับด้วย: ${changedAfter.join(", ")}` : undefined;
  await audit(db, req, "edit_request_revert",
    `คืนค่าเดิม · ${diff.length ? diff.map((d) => `${d.label}: ${formatEditValue(d.field, d.after)} → ${formatEditValue(d.field, d.before)}`).join(" · ") : "ไม่มีช่องที่ต่างจากค่าเดิม"}${note ? ` · ${note}` : ""}${p.note?.trim() ? ` · ${p.note.trim()}` : ""}`, p.by);
  return { ok: true, diff, note };
}

/** ลูกค้าที่โอนแล้ว + เปลี่ยนเงิน/วันที่ -> บัญชีรับรู้รายได้ (revenue_recognition / JV) อาจต้องปรับตาม */
export function needsAccountingCheck(leadStatus: string | null | undefined, diff: EditDiffRow[]): boolean {
  if (leadStatus !== "Closed Deal") return false;
  return diff.some((d) => ["contract_price", "booking_deposit", "transfer_date", "contract_signed_date", "booking_date"].includes(d.field));
}
