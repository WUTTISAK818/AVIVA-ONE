// รวมใบลูกค้าซ้ำ — แหล่งความจริงเดียว ใช้ทั้ง "ผู้บริหารกดรวมเอง" และ "อนุมัติคำขอรวมจากพนักงาน"
//
// v8.11 (Pom สั่ง 14 พ.ย. 69): "ให้พนักงานเปิดแก้ไขข้อมูลลูกค้ารายที่ซ้ำกันเพื่อรวมเป็นรายเดียว
//   โดยมีปุ่มขอแก้ไขให้ผู้บริหารอนุมัติก่อน แล้วให้รวมลูกค้า และลูกค้าที่ไม่ใช้ออกในส่วนเหตุว่าเป็นลูกค้าซ้ำ"
//
// หลัก Maker-Checker: พนักงานขาย (คนที่รู้จักลูกค้าจริง) = ผู้ขอ · ผู้บริหาร = ผู้อนุมัติ
//   - พนักงานกด "ขอรวมใบซ้ำ" -> approval_logs (workflow_type = Lead_Merge, Pending)
//   - ผู้บริหารกดอนุมัติในหน้าอนุมัติ -> mergeLeads() ทำงาน -> ใบที่ไม่ใช้ถูกตัดออกจากการนับยอด
//   - ไม่ลบข้อมูล: ใบซ้ำยังเปิดดูได้ มีเหตุผลกำกับ และแยกกลับได้
//
// approval_logs ไม่มีช่องเก็บ "ใบตัวจริง" แยก จึงเขียนรหัสทั้งสองใบลงใน source_doc_index
// รูปแบบตายตัว "CRM-0603 → CRM-0474" แล้วตอนอนุมัติอ่านกลับด้วย parseMergeCodes()
// และตรวจซ้ำกับฐานข้อมูลจริงทุกครั้งก่อนรวม (ใบยังอยู่ไหม · ถูกรวมไปแล้วหรือยัง)

import type { SupabaseClient } from "@supabase/supabase-js";

export const LEAD_MERGE_WORKFLOW = "Lead_Merge";

export interface MergeLeadRef {
  id: string;
  lead_code?: string | null;
  customer_name?: string | null;
}

/** ข้อความใน source_doc_index — รหัสสองใบต้องอยู่ในรูป "CRM-xxxx → CRM-yyyy" เสมอ */
export function buildMergeDocIndex(dup: MergeLeadRef, primary: MergeLeadRef, reason: string, byName: string): string {
  const r = reason.trim().replace(/\s*\|\s*/g, " / ");
  return `ขอรวมใบซ้ำ ${dup.lead_code} → ${primary.lead_code}` +
    ` | ${(dup.customer_name ?? "").trim()} → ${(primary.customer_name ?? "").trim()}` +
    (r ? ` | เหตุผล: ${r}` : "") +
    ` | โดย ${byName}`;
}

export function parseMergeCodes(docIndex: string | null | undefined): { dupCode: string; primaryCode: string } | null {
  const m = /(CRM-\d{3,5})\s*→\s*(CRM-\d{3,5})/.exec(docIndex ?? "");
  return m ? { dupCode: m[1], primaryCode: m[2] } : null;
}

export type MergeResult = { ok: true } | { ok: false; reason: string };

/**
 * รวมใบซ้ำเข้าใบตัวจริง — ตรวจกับฐานข้อมูลจริงก่อนทุกครั้ง
 * กันกรณี: รวมเข้าตัวเอง · ใบซ้ำถูกรวมไปแล้ว · ใบตัวจริงเองเป็นใบซ้ำของใบอื่น (กันโซ่ซ้อน)
 */
export async function mergeLeads(db: SupabaseClient, opts: {
  dupId: string;
  primaryId: string;
  byName: string;
  byRole?: string | null;
  byDept?: string | null;
  /** เหตุผล/ที่มา เช่น "อนุมัติคำขอของเดียร์" — ไปอยู่ใน merge_note ของใบที่ไม่ใช้ */
  note: string;
}): Promise<MergeResult> {
  if (opts.dupId === opts.primaryId) return { ok: false, reason: "เลือกใบเดียวกันทั้งสองฝั่ง" };

  const { data: rows } = await db.from("leads")
    .select("id, lead_code, customer_name, duplicate_of")
    .in("id", [opts.dupId, opts.primaryId]);
  const list = (rows ?? []) as { id: string; lead_code: string | null; customer_name: string | null; duplicate_of: string | null }[];
  const dup = list.find((r) => r.id === opts.dupId);
  const primary = list.find((r) => r.id === opts.primaryId);
  if (!dup || !primary) return { ok: false, reason: "ไม่พบใบลูกค้า (อาจถูกลบไปแล้ว)" };
  if (dup.duplicate_of) return { ok: false, reason: `${dup.lead_code} ถูกรวมเป็นใบซ้ำไปแล้ว` };
  if (primary.duplicate_of) return { ok: false, reason: `${primary.lead_code} เองเป็นใบซ้ำของใบอื่น — เลือกใบตัวจริงใหม่` };

  const now = new Date().toISOString();
  const { data: updated, error } = await db.from("leads").update({
    duplicate_of: primary.id,
    merged_at: now,
    merged_by: opts.byName,
    merge_note: `ลูกค้าซ้ำ — รวมเป็นใบซ้ำของ ${primary.lead_code} · ${opts.note}`,
    updated_at: now,
  }).eq("id", dup.id).is("duplicate_of", null).select("id");
  if (error) return { ok: false, reason: error.message };
  if (!updated || updated.length === 0) return { ok: false, reason: `${dup.lead_code} ถูกรวมไปแล้วระหว่างนี้` };

  await db.from("audit_log").insert({
    module: "crm",
    action: "merge_duplicate",
    record_id: dup.id,
    description: `ยืนยันใบซ้ำ: ${dup.lead_code} ${(dup.customer_name ?? "").trim()} -> รวมเข้า ${primary.lead_code} · ${opts.note} (ไม่ลบข้อมูล ตัดออกจากการนับยอด แยกกลับได้)`,
    performed_by: opts.byName,
    performed_by_role: opts.byRole ?? null,
    performed_by_dept: opts.byDept ?? null,
  });
  return { ok: true };
}

/**
 * ผู้บริหารกด "อนุมัติ" คำขอรวมใบซ้ำ -> รวมจริง (ใช้ร่วมกันทั้ง /approvals และ /office แท็บอนุมัติ)
 * อ่านรหัสใบตัวจริงจาก source_doc_index แล้วตรวจกับฐานข้อมูลจริงก่อนรวม
 */
export async function executeMergeRequest(db: SupabaseClient, log: {
  source_record_id: string | null;
  source_doc_index: string | null;
}, approver: { name: string; role?: string | null; dept?: string | null; dateLabel: string }): Promise<MergeResult> {
  const codes = parseMergeCodes(log.source_doc_index);
  if (!codes || !log.source_record_id) return { ok: false, reason: "อ่านรหัสลูกค้าในคำขอไม่ได้" };
  const { data: prim } = await db.from("leads").select("id").eq("lead_code", codes.primaryCode).maybeSingle();
  const primaryId = (prim as { id?: string } | null)?.id;
  if (!primaryId) return { ok: false, reason: `ไม่พบใบตัวจริง ${codes.primaryCode}` };
  return mergeLeads(db, {
    dupId: log.source_record_id,
    primaryId,
    byName: approver.name,
    byRole: approver.role ?? null,
    byDept: approver.dept ?? null,
    note: `อนุมัติคำขอโดย ${approver.name} (${approver.dateLabel}) · คำขอ: ${log.source_doc_index}`,
  });
}
