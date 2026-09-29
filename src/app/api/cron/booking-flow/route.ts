import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendLine } from "@/lib/line";
import { thaiDateStr } from "@/lib/thai-date";
import { daysBetweenStr } from "@/lib/lead-priority";
import { defaultInstallments } from "@/lib/payment-plan";
import {
  BOOKING_FLOW_STATUSES, NUDGE_MAX_AGE_DAYS, OWNER_LABEL, deriveBookingSteps, currentBookingStep,
  type BookingFlowFacts,
} from "@/lib/booking-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const NUDGE_AFTER_DAYS = 2;

// งานรับจองที่ต้องมีในกล่องงานของแต่ละขั้น (ขั้นอนุมัติใช้ใบที่ submitApprovalQueue สร้างไว้แล้ว)
const QUEUE_FOR_STEP: Record<string, { type: string; role: string; label: string }> = {
  slip:          { type: "Booking_Collect_Deposit", role: "sales_ai", label: "เก็บเงินจอง + แนบสลิป" },
  doc:           { type: "Booking_Issue_Doc",       role: "sales_ai", label: "ออกใบจองให้ลูกค้า" },
  posted:        { type: "Booking_Post_Payment",    role: "finance",  label: "ตรวจยอดเข้าบัญชี + ลงบัญชีเงินจอง" },
  contract_date: { type: "Booking_Set_Contract",    role: "sales_ai", label: "นัดวันทำสัญญา" },
};

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

interface LeadRow {
  id: string; customer_name: string; status: string; assigned_to: string | null;
  booking_date: string | null; booking_deposit: number | null; contract_price: number | null; budget: number | null;
  deposit_slip_url: string | null; deposit_received_at: string | null; deposit_received_by: string | null;
  booking_doc_at: string | null; contract_appointment_date: string | null;
}

// ตาข่ายกันงานรับจองตกหล่น — รันทุกเช้า 09:05 น. ไทย (02:05 UTC)
//  1) สร้างตารางผ่อนให้อัตโนมัติเมื่อครบเงื่อนไข (อนุมัติแล้ว + รับเงินแล้ว)
//  2) ทำให้กล่องงานตรงกับสถานะจริง — ขั้นที่ถึงคิวต้องมีงานค้าง ขั้นที่เสร็จต้องถูกปิด
//  3) เตือนผู้รับผิดชอบเมื่อขั้นเดิมค้างเกิน 2 วัน (ไม่ใช่เตือนทุกอย่างทุกวัน)
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  const today = thaiDateStr();

  const { data: leadRows, error } = await db.from("leads")
    .select("id, customer_name, status, assigned_to, booking_date, booking_deposit, contract_price, budget, deposit_slip_url, deposit_received_at, deposit_received_by, booking_doc_at, contract_appointment_date")
    .in("status", BOOKING_FLOW_STATUSES);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leads = (leadRows ?? []) as LeadRow[];
  const ids = leads.map(l => l.id);
  if (ids.length === 0) return NextResponse.json({ ok: true, date: today, leads: 0 });

  const [{ data: approvals }, { data: insts }, { data: queue }, { data: dir }] = await Promise.all([
    db.from("approval_logs").select("source_record_id, action_taken, created_at")
      .eq("workflow_type", "Booking_Deposit").in("source_record_id", ids).order("created_at", { ascending: false }),
    db.from("customer_installments").select("lead_id, installment_no, status").in("lead_id", ids),
    db.from("work_queue").select("id, source_record_id, workflow_type").eq("status", "open").in("source_record_id", ids),
    db.from("employees_directory").select("full_name, nickname, email"),
  ]);

  const latestApproval = new Map<string, string>();
  for (const a of (approvals ?? []) as { source_record_id: string; action_taken: string }[]) {
    if (!latestApproval.has(a.source_record_id)) latestApproval.set(a.source_record_id, a.action_taken ?? "");
  }
  const instByLead = new Map<string, { installment_no: number; status: string }[]>();
  for (const r of (insts ?? []) as { lead_id: string; installment_no: number; status: string }[]) {
    instByLead.set(r.lead_id, [...(instByLead.get(r.lead_id) ?? []), r]);
  }
  const openByLead = new Map<string, Set<string>>();
  for (const q of (queue ?? []) as { source_record_id: string; workflow_type: string }[]) {
    const set = openByLead.get(q.source_record_id) ?? new Set<string>();
    set.add(q.workflow_type);
    openByLead.set(q.source_record_id, set);
  }
  const emailByName = new Map<string, string>();
  for (const e of (dir ?? []) as { full_name: string | null; nickname: string | null; email: string | null }[]) {
    if (!e.email) continue;
    if (e.nickname) emailByName.set(e.nickname.trim().toLowerCase(), e.email);
    if (e.full_name) emailByName.set(e.full_name.trim().toLowerCase(), e.email);
  }

  let installmentsCreated = 0, queueOpened = 0, queueClosed = 0, nudged = 0;
  const stuck: { lead: string; step: string; owner: string; days: number }[] = [];

  for (const lead of leads) {
    const act = latestApproval.get(lead.id) ?? "";
    const rows = instByLead.get(lead.id) ?? [];
    let facts: BookingFlowFacts = {
      lead,
      approval: act === "Approved" ? "approved" : act === "Rejected" ? "rejected" : act ? "pending" : "none",
      installmentCount: rows.length,
      depositPosted: rows.some(r => r.installment_no === 1 && r.status === "paid"),
    };
    let steps = deriveBookingSteps(facts);

    // 1) ตารางผ่อน — งานของระบบ ไม่ต้องรอใครกด
    const salePrice = Number(lead.contract_price ?? lead.budget ?? 0);
    if (facts.installmentCount === 0 && salePrice > 0 && steps.find(s => s.key === "installments")?.state === "current") {
      const plan = defaultInstallments(salePrice, lead.booking_deposit)
        .map(r => ({ ...r, lead_id: lead.id, house_id: null, status: "pending" as const }));
      const { error: insErr } = await db.from("customer_installments").insert(plan);
      if (!insErr) {
        installmentsCreated++;
        facts = { ...facts, installmentCount: plan.length };
        steps = deriveBookingSteps(facts);
      }
    }

    // 2) กล่องงานให้ตรงกับสถานะจริง
    const openTypes = openByLead.get(lead.id) ?? new Set<string>();
    for (const step of steps) {
      const cfg = QUEUE_FOR_STEP[step.key];
      if (!cfg) continue;
      if (step.state === "current" && !openTypes.has(cfg.type)) {
        await db.from("work_queue").insert({
          project_id: PROJECT_ID, workflow_type: cfg.type, source_record_id: lead.id,
          title: `${cfg.label} — ${lead.customer_name}`, assigned_role: cfg.role, status: "open",
        });
        queueOpened++;
      } else if (step.state !== "current" && openTypes.has(cfg.type)) {
        await db.from("work_queue").update({ status: "done", done_at: new Date().toISOString(), done_by: "ระบบ (ตรวจอัตโนมัติ)" })
          .eq("source_record_id", lead.id).eq("workflow_type", cfg.type).eq("status", "open");
        queueClosed++;
      }
    }

    // 3) เตือนเมื่อค้างนาน — นับจากวันจอง (งานรับจองไม่ควรลากเกิน 2-3 วัน)
    const cur = currentBookingStep(steps);
    if (!cur || !lead.booking_date) continue;
    const days = daysBetweenStr(lead.booking_date, today);
    if (days < NUDGE_AFTER_DAYS) continue;
    // ของเก่าเกิน 30 วัน = ข้อมูลย้อนหลัง ปล่อยไว้ในกล่องงาน แต่ไม่ต้องเตือนทุกเช้า
    if (days > NUDGE_MAX_AGE_DAYS) continue;
    stuck.push({ lead: lead.customer_name, step: cur.title, owner: OWNER_LABEL[cur.owner], days });

    const title = `📌 งานรับจองค้าง ${days} วัน — ${lead.customer_name}`;
    const body = [
      `ขั้นที่ค้าง: ${cur.no}. ${cur.title}`,
      `ผู้รับผิดชอบ: ${OWNER_LABEL[cur.owner]}`,
      `ทำต่อได้ที่: เปิดหน้า CRM → ลูกค้ารายนี้ → การ์ด "ขั้นตอนงานรับจอง"`,
    ].join("\n");

    if (cur.owner === "sales") {
      const email = emailByName.get((lead.assigned_to ?? "").trim().toLowerCase());
      if (email) {
        await db.from("notifications").insert({
          project_id: PROJECT_ID, type: "info", to_user_email: email, from_dept: "ระบบขาย",
          title, message: body, is_read: false, link: `/crm?lead=${lead.id}`,
        });
        try {
          const { data: link } = await db.from("line_links").select("line_user_id")
            .ilike("user_email", email).not("linked_at", "is", null).maybeSingle();
          if (link?.line_user_id) await sendLine(link.line_user_id, `${title}\n\n${body}`);
        } catch { /* best-effort */ }
        nudged++;
      }
    } else {
      // ขั้นของผู้จัดการ/การเงิน → แจ้งผู้บริหาร (Pom + พี่อ้อน เห็นทั้งคู่)
      await db.from("notifications").insert({
        project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร", from_dept: "ระบบขาย",
        title, message: body, is_read: false, link: `/crm?lead=${lead.id}`,
      });
      nudged++;
    }
  }

  return NextResponse.json({
    ok: true, date: today, leads: leads.length,
    installmentsCreated, queueOpened, queueClosed, nudged, stuck,
  });
}
