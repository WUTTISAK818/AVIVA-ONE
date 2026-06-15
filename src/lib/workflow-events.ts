// src/lib/workflow-events.ts
// Phase 1 — Workflow Hand-off & Status Tracking
// Audit trail (workflow_events) + per-department work queue (work_queue).
// Every helper is best-effort and never throws, so it can be layered onto
// existing approval/construction flows without changing their behaviour.
import { supabase } from "./supabase";
import { calcSlaDueAt } from "./approval-matrix";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export interface WorkflowEventInput {
  workflowType: string;
  sourceRecordId: string;
  docIndex?: string | null;
  eventType: string; // submitted | acknowledged | approved | rejected | paid | reminded | escalated
  stageFrom?: string | null;
  stageTo?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  routedToRole?: string | null;
  routedToName?: string | null;
  conditionNote?: string | null;
  amount?: number | null;
}

/** Append one immutable event to the audit trail. Best-effort. */
export async function logWorkflowEvent(e: WorkflowEventInput): Promise<void> {
  try {
    await supabase.from("workflow_events").insert({
      project_id: PROJECT_ID,
      workflow_type: e.workflowType,
      source_record_id: e.sourceRecordId,
      doc_index: e.docIndex ?? null,
      event_type: e.eventType,
      stage_from: e.stageFrom ?? null,
      stage_to: e.stageTo ?? null,
      actor_name: e.actorName ?? null,
      actor_role: e.actorRole ?? null,
      routed_to_role: e.routedToRole ?? null,
      routed_to_name: e.routedToName ?? null,
      condition_note: e.conditionNote ?? null,
      amount: e.amount ?? null,
    });
  } catch {
    /* best-effort audit — never block the main flow */
  }
}

export interface WorkQueueInput {
  workflowType: string;
  sourceRecordId: string;
  docIndex?: string | null;
  title: string;
  amount?: number | null;
  assignedRole: string; // "manager" | "finance" | ...
  slaDueAt?: string | null;
}

/** Push a task into a department's inbox. Best-effort. */
export async function createWorkQueue(q: WorkQueueInput): Promise<void> {
  try {
    await supabase.from("work_queue").insert({
      project_id: PROJECT_ID,
      workflow_type: q.workflowType,
      source_record_id: q.sourceRecordId,
      doc_index: q.docIndex ?? null,
      title: q.title,
      amount: q.amount ?? null,
      assigned_role: q.assignedRole,
      status: "open",
      sla_due_at: q.slaDueAt ?? null,
    });
  } catch {
    /* best-effort */
  }
}

/** Mark open queue item(s) for a record as done. Best-effort. */
export async function closeWorkQueue(
  sourceRecordId: string,
  assignedRole?: string,
  doneBy?: string | null
): Promise<void> {
  try {
    let q = supabase
      .from("work_queue")
      .update({ status: "done", done_at: new Date().toISOString(), done_by: doneBy ?? null })
      .eq("source_record_id", sourceRecordId)
      .eq("status", "open");
    if (assignedRole) q = q.eq("assigned_role", assignedRole);
    await q;
  } catch {
    /* best-effort */
  }
}

/**
 * เชื่อมคำขออนุมัติเข้ากล่องงานผู้จัดการ (/inbox) + audit trail (timeline).
 * เรียกคู่กับการ insert approval_logs ทุกจุด submit เพื่อให้ทุก workflow โผล่ใน /inbox
 * และมี timeline เหมือน Installment_Review (best-effort, ไม่ throw)
 */
export async function submitApprovalQueue(opts: {
  workflowType: string;
  sourceRecordId: string;
  docIndex?: string | null;
  title: string;
  amount?: number | null;
  actorName?: string | null;
  actorRole?: string | null;
}): Promise<void> {
  await createWorkQueue({
    workflowType: opts.workflowType,
    sourceRecordId: opts.sourceRecordId,
    docIndex: opts.docIndex ?? null,
    title: opts.title,
    amount: opts.amount ?? null,
    assignedRole: "manager",
    slaDueAt: calcSlaDueAt(opts.workflowType),
  });
  await logWorkflowEvent({
    workflowType: opts.workflowType,
    sourceRecordId: opts.sourceRecordId,
    docIndex: opts.docIndex ?? null,
    eventType: "submitted",
    stageTo: "in_review",
    actorName: opts.actorName ?? null,
    actorRole: opts.actorRole ?? null,
    routedToRole: "manager",
    routedToName: "ผู้จัดการ",
    amount: opts.amount ?? null,
  });
}

/**
 * ปิดงานในกล่องผู้จัดการ + บันทึกผลอนุมัติ/ปฏิเสธลง timeline.
 * เรียกคู่กับการ update approval_logs ทุกจุดอนุมัติ/ปฏิเสธ เพื่อปิด loop (กัน orphan)
 */
export async function resolveApprovalQueue(opts: {
  workflowType: string;
  sourceRecordId: string;
  docIndex?: string | null;
  approved: boolean;
  actorName?: string | null;
  actorRole?: string | null;
  conditionNote?: string | null;
}): Promise<void> {
  await closeWorkQueue(opts.sourceRecordId, "manager", opts.actorName ?? null);
  await logWorkflowEvent({
    workflowType: opts.workflowType,
    sourceRecordId: opts.sourceRecordId,
    docIndex: opts.docIndex ?? null,
    eventType: opts.approved ? "approved" : "rejected",
    stageFrom: "in_review",
    stageTo: opts.approved ? "approved" : "rejected",
    actorName: opts.actorName ?? null,
    actorRole: opts.actorRole ?? null,
    conditionNote: opts.conditionNote ?? undefined,
  });
}

/** Map a logged-in user to the work_queue.assigned_role values they should see. */
/**
 * Map a user to every work_queue.assigned_role they should action in their inbox.
 * Covers human roles (manager/finance) AND the per-department task queues that the
 * automation seeds under "*_ai" roles (sales follow-ups, construction tasks) so the
 * work that lands there is actually visible to the responsible team, not stranded.
 */
export function rolesForUser(user: {
  role?: string;
  department?: string;
  isManager?: boolean;
  isAdmin?: boolean;
}): string[] {
  const roles = new Set<string>();
  const dept = user.department ?? "";
  const role = (user.role ?? "").toLowerCase();
  const inDept = (...k: string[]) => k.some((s) => dept.includes(s));
  const isRole = (...k: string[]) => k.some((s) => role.includes(s));

  if (user.isManager || user.isAdmin) roles.add("manager");

  // ฝ่ายการเงิน/บัญชี — งานรอจ่ายเงิน
  if (inDept("การเงิน", "finance", "บัญชี") || isRole("finance", "account")) roles.add("finance");

  // ฝ่ายขาย (ไม่รวมหลังการขาย) — งานติดตามลูกค้า (Lead_Followup → sales_ai)
  if ((inDept("ขาย") && !inDept("หลังการขาย")) || isRole("sales")) roles.add("sales_ai");

  // ฝ่ายก่อสร้าง/วิศวกรรม/QC — งานก่อสร้าง
  if (inDept("ก่อสร้าง", "วิศว", "construction") || isRole("engineer", "construction", "qc")) {
    roles.add("construction_ai");
    roles.add("engineer");
  }

  // ผู้บริหาร/แอดมิน เห็นทุกกล่องงานเพื่อกำกับดูแล
  if (user.isAdmin) {
    ["finance", "sales_ai", "construction_ai", "engineer"].forEach((r) => roles.add(r));
  }
  return Array.from(roles);
}

/**
 * Notify the contractor of a record's outcome over LINE/SMS (+ a public track
 * link). refCode is the contractor ref stored on houses.contractor_line_id.
 * No-op when the house has no linked contractor. Best-effort.
 */
export async function notifyContractor(
  refCode: string | null | undefined,
  status: "approved" | "paid" | "rejected",
  detail?: string
): Promise<void> {
  if (!refCode) return;
  try {
    await fetch("/api/notify/contractor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref_code: refCode, status, detail }),
    });
  } catch {
    /* best-effort */
  }
}

/** Fire a best-effort web-push to a department (no-op if no subscribers). */
export async function notifyPush(
  department: string,
  title: string,
  body: string,
  url?: string,
  tag?: string
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ department, title, body, url, tag }),
    });
  } catch {
    /* best-effort */
  }
}
