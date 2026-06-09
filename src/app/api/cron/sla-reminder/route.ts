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
    .select("approval_id, workflow_type, source_record_id, source_doc_index, sla_due_at, created_at")
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
    }
    results.push(`${docName}:${overdue ? "overdue" : "near"}`);
  }

  return NextResponse.json({ ok: true, reminded, escalated, items: results });
}
