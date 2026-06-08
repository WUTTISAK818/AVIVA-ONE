import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SLA_DAYS } from "@/lib/approval-matrix";
import { sendPush } from "@/lib/push-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

interface Log {
  id: string;
  workflow_type: string;
  to_dept: string | null;
  source_doc_index: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const { data: logs } = await db
    .from("approval_logs")
    .select("id, workflow_type, to_dept, source_doc_index, created_at")
    .eq("action_taken", "Pending");

  let reminded = 0, escalated = 0;
  const results: string[] = [];

  for (const l of (logs ?? []) as Log[]) {
    const slaDays = SLA_DAYS[l.workflow_type] ?? 3;
    const ageMs = now - new Date(l.created_at).getTime();
    const dueMs = slaDays * DAY_MS;
    const nearDue = dueMs - ageMs < DAY_MS && dueMs - ageMs > 0;
    const overdue = ageMs > dueMs;
    if (!nearDue && !overdue) continue;

    // throttle: max 2 reminders/day/log
    const { count } = await db
      .from("workflow_events")
      .select("id", { count: "exact", head: true })
      .eq("log_id", l.id)
      .eq("event_type", "reminded")
      .gte("created_at", todayStart.toISOString());
    if ((count ?? 0) >= MAX_REMINDERS_PER_DAY) continue;

    const docName = (l.source_doc_index ?? "").split(" | ")[0] || l.workflow_type;
    const title = overdue ? "⏰ งานเกินกำหนด SLA" : "⏳ งานใกล้ครบกำหนด";
    const body = `${docName} รอการอนุมัติ (${overdue ? "เกินกำหนดแล้ว" : "ใกล้ครบกำหนด"})`;

    if (l.to_dept) {
      await sendPush({ department: l.to_dept }, { title, body, url: "/approvals", tag: `sla-${l.id}` });
    }
    await db.from("workflow_events").insert({ log_id: l.id, event_type: "reminded", detail: overdue ? "overdue" : "near-due" });
    reminded++;

    if (overdue) {
      await sendPush({ department: EXEC_DEPT }, { title: "🚨 Escalation: งานเกิน SLA", body, url: "/approvals", tag: `esc-${l.id}` });
      await db.from("workflow_events").insert({ log_id: l.id, event_type: "escalated", detail: docName });
      escalated++;
    }
    results.push(`${docName}:${overdue ? "overdue" : "near"}`);
  }

  return NextResponse.json({ ok: true, reminded, escalated, items: results });
}
