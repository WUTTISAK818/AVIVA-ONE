"use client";
// ทวงถามการอนุมัติ (ผู้ขอกดเตือนผู้อนุมัติ) — logic กลาง ใช้ร่วมทุก flow
// (คำขอซื้อ / งวดงาน / ฯลฯ) · จำกัด 1 ครั้ง/วัน/เรื่อง (ผ่าน workflow_events "reminded")
import { supabase } from "./supabase";
import { createNotification } from "./notify";
import { notifyPush } from "./workflow-events";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export const waitDaysFrom = (createdAt: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));

export interface NudgeInput {
  recordId: string;
  workflowType: string;
  docIndex?: string | null;
  itemLabel: string;          // ชื่อรายการสั้น ๆ สำหรับข้อความ
  toDept: string;             // แผนกผู้อนุมัติ (เช่น "ฝ่ายบริหาร")
  fromDept?: string | null;   // แผนกผู้ขอ
  link: string;
  actorName: string;
  actorRole?: string | null;
  waitDays: number;
}

export interface NudgeResult { ok: boolean; reason?: string }

export async function nudgeApproval(i: NudgeInput): Promise<NudgeResult> {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  // จำกัด 1 ครั้ง/วัน/เรื่อง
  const { count } = await supabase
    .from("workflow_events")
    .select("id", { count: "exact", head: true })
    .eq("source_record_id", i.recordId).eq("event_type", "reminded")
    .gte("created_at", todayStart.toISOString());
  if ((count ?? 0) > 0) return { ok: false, reason: "ทวงถามไปแล้ววันนี้ รอผู้อนุมัติดำเนินการค่ะ" };

  await supabase.from("workflow_events").insert({
    project_id: PROJECT_ID, workflow_type: i.workflowType, source_record_id: i.recordId,
    doc_index: i.docIndex ?? null, event_type: "reminded",
    condition_note: `ผู้ขอทวงถาม (รอ ${i.waitDays} วัน)`, actor_name: i.actorName, actor_role: i.actorRole ?? null,
  });
  await createNotification({
    type: "approval", title: "🔔 ทวงถามอนุมัติ",
    message: `${i.docIndex ? i.docIndex + " · " : ""}${i.itemLabel} — รอมาแล้ว ${i.waitDays} วัน (โดย ${i.actorName})`,
    from_dept: i.fromDept ?? undefined, to_dept: i.toDept, record_id: i.recordId, link: i.link,
  });
  await notifyPush(i.toDept, "🔔 ทวงถามอนุมัติ", `${i.docIndex ? i.docIndex + " · " : ""}${i.itemLabel} — รอ ${i.waitDays} วัน`, i.link, `nudge-${i.recordId}`);
  return { ok: true };
}
