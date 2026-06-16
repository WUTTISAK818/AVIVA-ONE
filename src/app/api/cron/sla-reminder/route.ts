import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SLA_DAYS } from "@/lib/approval-matrix";
import { sendPush } from "@/lib/push-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const EXEC_DEPT = "ฝ่ายบริหาร";
const MAX_REMINDERS_PER_DAY = 2;
const DAY_MS = 86_400_000;
// เพดานจำนวนงาน work_queue ที่ escalate ต่อรอบ (กัน push ทะลักรอบเดียว)
const MAX_QUEUE_ESCALATIONS = 40;

// แมพ assigned_role ของ work_queue → แผนกผู้รับผิดชอบ (ส่ง push เจาะแผนกนั้น ไม่เหมารวมผู้บริหาร)
const ROLE_DEPT: Record<string, string> = {
  manager: EXEC_DEPT,
  finance: "ฝ่ายการเงิน",
  sales_ai: "ฝ่ายขาย",
  construction_ai: "ฝ่ายก่อสร้าง",
  engineer: "ฝ่ายก่อสร้าง",
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

interface PendingLog {
  approval_id: string;
  workflow_type: string;
  source_record_id: string | null;
  source_doc_index: string | null;
  submitted_by_user_id: string | null;
  sla_due_at: string | null;
  created_at: string | null;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const { data: logs } = await db
    .from("approval_logs")
    .select("approval_id, workflow_type, source_record_id, source_doc_index, submitted_by_user_id, sla_due_at, created_at")
    .eq("action_taken", "Pending");

  let reminded = 0, escalated = 0;
  const results: string[] = [];

  for (const l of (logs ?? []) as PendingLog[]) {
    // Prefer the stored SLA deadline; fall back to created_at + SLA_DAYS.
    const dueMs = l.sla_due_at
      ? new Date(l.sla_due_at).getTime()
      : new Date(l.created_at ?? Date.now()).getTime() + (SLA_DAYS[l.workflow_type] ?? 3) * DAY_MS;
    const timeLeft = dueMs - now;
    const nearDue = timeLeft > 0 && timeLeft < DAY_MS;
    const overdue = timeLeft <= 0;
    if (!nearDue && !overdue) continue;

    // The audit/throttle key is the underlying record (falls back to the approval id).
    const recordId = l.source_record_id ?? l.approval_id;

    // throttle: max N reminders/day/record
    const { count } = await db
      .from("workflow_events")
      .select("id", { count: "exact", head: true })
      .eq("source_record_id", recordId)
      .eq("event_type", "reminded")
      .gte("created_at", todayStart.toISOString());
    if ((count ?? 0) >= MAX_REMINDERS_PER_DAY) continue;

    const docName = (l.source_doc_index ?? "").split(" | ")[0] || l.workflow_type;
    const title = overdue ? "⏰ งานเกินกำหนด SLA" : "⏳ งานใกล้ครบกำหนด";
    const body = `${docName} รอการอนุมัติ (${overdue ? "เกินกำหนดแล้ว" : "ใกล้ครบกำหนด"})`;

    await sendPush({ department: EXEC_DEPT }, { title, body, url: "/approvals", tag: `sla-${recordId}` });
    await db.from("workflow_events").insert({
      project_id: PROJECT_ID,
      workflow_type: l.workflow_type,
      source_record_id: recordId,
      doc_index: l.source_doc_index,
      event_type: "reminded",
      condition_note: overdue ? "overdue" : "near-due",
    });
    reminded++;

    if (overdue) {
      await sendPush({ department: EXEC_DEPT }, { title: "🚨 Escalation: งานเกิน SLA", body, url: "/approvals", tag: `esc-${recordId}` });
      await db.from("workflow_events").insert({
        project_id: PROJECT_ID,
        workflow_type: l.workflow_type,
        source_record_id: recordId,
        doc_index: l.source_doc_index,
        event_type: "escalated",
        condition_note: docName,
      });
      escalated++;

      // แจ้ง "ผู้ขอ" ด้วย (ไม่ใช่แค่ผู้อนุมัติ) — หาแผนกจากผู้ยื่นคำขอ
      if (l.submitted_by_user_id) {
        const { data: u } = await db.from("users").select("department").eq("id", l.submitted_by_user_id).maybeSingle();
        const reqDept = (u as { department?: string | null } | null)?.department;
        if (reqDept && reqDept !== EXEC_DEPT) {
          await sendPush({ department: reqDept }, { title: "⏰ คำขอของคุณยังรออนุมัติ", body: `${docName} เกินกำหนดแล้ว — กด 'ทวงถาม' เพื่อเร่งได้`, url: "/approvals", tag: `req-${recordId}` });
        }
      }
    }
    results.push(`${docName}:${overdue ? "overdue" : "near"}`);
  }

  // ── work_queue: escalate งานค้างที่เลย SLA (เดิม cron ครอบแค่ approval_logs) ──
  // ใช้ throttle ร่วม (workflow_events "reminded" ต่อ record) → ถ้าเตือนจาก approval_logs แล้ว
  // จะไม่เตือนซ้ำจาก loop นี้ และไม่เกิน MAX_REMINDERS_PER_DAY ต่อ record
  let queueEscalated = 0;
  const { data: queue } = await db
    .from("work_queue")
    .select("id, workflow_type, source_record_id, doc_index, title, assigned_role, sla_due_at, created_at")
    .eq("status", "open")
    .order("sla_due_at", { ascending: true, nullsFirst: false })
    .limit(300);

  for (const q of (queue ?? []) as QueueItem[]) {
    if (queueEscalated >= MAX_QUEUE_ESCALATIONS) break;
    const dueMs = q.sla_due_at
      ? new Date(q.sla_due_at).getTime()
      : new Date(q.created_at ?? Date.now()).getTime() + (SLA_DAYS[q.workflow_type] ?? 3) * DAY_MS;
    if (dueMs - now > 0) continue; // เอาเฉพาะที่เลยกำหนดแล้ว (ลด noise สำหรับงานติดตามจำนวนมาก)

    const recordId = q.source_record_id ?? q.id;
    const { count } = await db
      .from("workflow_events")
      .select("id", { count: "exact", head: true })
      .eq("source_record_id", recordId)
      .eq("event_type", "reminded")
      .gte("created_at", todayStart.toISOString());
    if ((count ?? 0) >= MAX_REMINDERS_PER_DAY) continue;

    const dept = ROLE_DEPT[q.assigned_role] ?? EXEC_DEPT;
    const docName = q.title || (q.doc_index ?? "").split(" | ")[0] || q.workflow_type;
    const body = `${docName} ค้างในกล่องงาน (${dept}) เกินกำหนดแล้ว`;

    await sendPush({ department: dept }, { title: "🚨 งานค้างเกิน SLA", body, url: "/inbox", tag: `wq-${recordId}` });
    await db.from("workflow_events").insert({
      project_id: PROJECT_ID,
      workflow_type: q.workflow_type,
      source_record_id: recordId,
      doc_index: q.doc_index,
      event_type: "reminded",
      condition_note: "work_queue overdue",
    });
    await db.from("workflow_events").insert({
      project_id: PROJECT_ID,
      workflow_type: q.workflow_type,
      source_record_id: recordId,
      doc_index: q.doc_index,
      event_type: "escalated",
      condition_note: dept,
    });

    // แจ้ง "ผู้ขอ" ด้วย (ไม่ใช่แค่ผู้อนุมัติ) — กรณีคำขอซื้อเกินกำหนด เด้งไปแผนกผู้ยื่น
    if (q.workflow_type === "Purchase_Request" && q.source_record_id) {
      const { data: pr } = await db
        .from("purchase_requests")
        .select("requester_dept, pr_number, item")
        .eq("id", q.source_record_id)
        .maybeSingle();
      if (pr?.requester_dept && pr.requester_dept !== dept) {
        await sendPush(
          { department: pr.requester_dept as string },
          { title: "⏰ คำขอของคุณยังรออนุมัติ", body: `${pr.pr_number ?? ""} ${pr.item ?? ""} เกินกำหนดแล้ว — กด 'ทวงถาม' เพื่อเร่งได้`, url: "/office?tab=finance", tag: `req-${recordId}` }
        );
      }
    }
    queueEscalated++;
    results.push(`queue:${docName}`);
  }

  return NextResponse.json({ ok: true, reminded, escalated, queueEscalated, items: results });
}

interface QueueItem {
  id: string;
  workflow_type: string;
  source_record_id: string | null;
  doc_index: string | null;
  title: string | null;
  assigned_role: string;
  sla_due_at: string | null;
  created_at: string | null;
}
