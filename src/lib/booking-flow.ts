// งาน "รับจอง" 7 ขั้น — Pom เคาะขั้นตอน 28 ก.ย. 2569
// ปัญหาเดิม: พนักงานไม่รู้ว่าหลังกดจองแล้วต้องทำอะไรต่อ ระบบก็เงียบหลังผู้จัดการอนุมัติ
//            (ผล: ลูกค้า 14 รายที่จอง/ขายแล้ว มีตารางผ่อนแค่ 1 ราย)
// หลักออกแบบ: อ่านสถานะจาก "ของจริง" ที่มีอยู่แล้วเสมอ (สถานะลูกค้า · ใบอนุมัติ · ตารางผ่อน)
//            ไม่เก็บ flag ซ้ำ เพราะ flag จะเพี้ยนจากข้อมูลจริงเมื่อมีคนแก้ข้อมูลตรง ๆ
// Pom กำหนด: "อนุมัติก่อนหรือหลังโอนเงินก็ได้" → ขั้น 2 (รับเงิน) กับ 3 (อนุมัติ) สลับกันได้ แต่ต้องครบทั้งคู่
import { supabase } from "./supabase";

export type StepState = "done" | "current" | "waiting";
export type StepOwner = "sales" | "manager" | "finance" | "system";

export interface BookingStep {
  key: string;
  no: number;
  title: string;
  owner: StepOwner;
  state: StepState;
  detail?: string;       // ข้อความบอกสิ่งที่เกิดขึ้นแล้ว เช่น "รับเมื่อ 28 ก.ย."
  auto?: boolean;        // ระบบทำให้เอง ไม่ต้องมีใครกด
}

export interface BookingFlowFacts {
  lead: {
    id: string;
    status: string;
    booking_date?: string | null;
    booking_deposit?: number | null;
    deposit_slip_url?: string | null;
    deposit_received_at?: string | null;
    deposit_received_by?: string | null;
    booking_doc_at?: string | null;
    contract_appointment_date?: string | null;
    assigned_to?: string | null;
  };
  approval: "none" | "pending" | "approved" | "rejected";
  installmentCount: number;
  depositPosted: boolean;   // งวดจองถูกบันทึกว่าชำระแล้ว (ลงบัญชีรับเงินแล้ว)
}

export const OWNER_LABEL: Record<StepOwner, string> = {
  sales: "ฝ่ายขาย",
  manager: "ผู้จัดการ/ผู้บริหาร",
  finance: "ฝ่ายการเงิน",
  system: "ระบบทำให้เอง",
};

/** สถานะที่ถือว่า "จองแล้ว" ขึ้นไป — ใช้เช็คว่าขั้นที่ 1 (บันทึกจอง) ผ่านแล้วหรือยัง */
export const BOOKED_STATUSES = ["Booking", "Contract", "Loan Approved", "Transfer", "Closed Deal"];

/** ดีลที่ยัง "เดินอยู่" เท่านั้นที่ต้องไล่ขั้นตอนรับจอง
 *  โอนกรรมสิทธิ์/ปิดการขายไปแล้ว = จบแล้ว ไม่ต้องไปตามเก็บเงินจองย้อนหลัง
 *  (29 ก.ย. 69: cron ส่งงาน "เก็บเงินจอง" ของบ้านที่โอนไปแล้ว 112 วันให้ฟ้า — เป็นสัญญาณรบกวน) */
export const BOOKING_FLOW_STATUSES = ["Booking", "Contract", "Loan Approved"];

/** งานรับจองที่เก่าเกินเท่านี้ = ข้อมูลย้อนหลัง ไม่ต้องเตือนรายวัน (ยังค้างในกล่องงานตามเดิม) */
export const NUDGE_MAX_AGE_DAYS = 30;

const thDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "";

/** แปลงข้อมูลจริง → ขั้นตอนทั้ง 7 พร้อมสถานะ (ไม่แตะฐานข้อมูล) */
export function deriveBookingSteps(f: BookingFlowFacts): BookingStep[] {
  const l = f.lead;
  const recorded = BOOKED_STATUSES.includes(l.status) && !!l.booking_date;
  const received = !!l.deposit_received_at;
  const approved = f.approval === "approved";
  const docIssued = !!l.booking_doc_at;
  const hasInstallments = f.installmentCount > 0;
  const posted = f.depositPosted;
  const contractSet = !!l.contract_appointment_date;

  // ขั้น 2 กับ 3 ทำพร้อมกันได้ · ขั้น 4-5 รอครบทั้งคู่ · ขั้น 6 รอตารางผ่อน · ขั้น 7 รอใบจอง
  const bothDone = received && approved;
  const st = (done: boolean, ready: boolean): StepState => (done ? "done" : ready ? "current" : "waiting");

  return [
    {
      key: "record", no: 1, title: "บันทึกลูกค้า + เปลี่ยนสถานะเป็น “จอง”", owner: "sales",
      state: st(recorded, true),
      detail: recorded ? `จองเมื่อ ${thDate(l.booking_date)}${l.booking_deposit ? ` · เงินจอง ฿${Number(l.booking_deposit).toLocaleString("th-TH")}` : ""}` : undefined,
    },
    {
      key: "slip", no: 2, title: "รับเงินจอง + แนบหลักฐาน (สลิป/ใบเสร็จ)", owner: "sales",
      state: st(received, recorded),
      detail: received ? `รับแล้ว ${thDate(l.deposit_received_at)}${l.deposit_received_by ? ` โดย ${l.deposit_received_by}` : ""}` : undefined,
    },
    {
      key: "approve", no: 3, title: "ผู้จัดการตรวจ + อนุมัติเงินจอง", owner: "manager",
      state: st(approved, recorded),
      detail: f.approval === "pending" ? "ส่งเรื่องแล้ว รอพิจารณา"
        : f.approval === "rejected" ? "ถูกปฏิเสธ — ต้องแก้ไขและส่งใหม่"
        : f.approval === "none" && recorded ? "ยังไม่มีใบขออนุมัติ" : undefined,
    },
    {
      key: "doc", no: 4, title: "ออกใบจองให้ลูกค้า", owner: "sales",
      state: st(docIssued, bothDone),
      detail: docIssued ? `ออกแล้ว ${thDate(l.booking_doc_at)}` : undefined,
    },
    {
      key: "installments", no: 5, title: "สร้างตารางผ่อน 4 งวด", owner: "system", auto: true,
      state: st(hasInstallments, bothDone),
      detail: hasInstallments ? `สร้างแล้ว ${f.installmentCount} งวด` : "ระบบสร้างให้เองเมื่ออนุมัติและรับเงินครบ",
    },
    {
      key: "posted", no: 6, title: "ตรวจยอดเข้าบัญชี + ลงบัญชีรับเงินจอง", owner: "finance",
      // ต้องรับเงินจริง + อนุมัติแล้วเท่านั้น — ห้ามส่งงานลงบัญชีให้การเงินก่อนเงินเข้า
      state: st(posted, hasInstallments && bothDone),
      detail: posted ? "ลงบัญชีแล้ว" : undefined,
    },
    {
      key: "contract_date", no: 7, title: "นัดวันทำสัญญา", owner: "sales",
      state: st(contractSet, docIssued),
      detail: contractSet ? `นัดวันที่ ${thDate(l.contract_appointment_date)}` : undefined,
    },
  ];
}

/** ขั้นที่ค้างอยู่จริงตอนนี้ (สำหรับพาดหัวการ์ด/ข้อความแจ้งเตือน) */
export function currentBookingStep(steps: BookingStep[]): BookingStep | null {
  return steps.find(s => s.state === "current") ?? null;
}

export function bookingProgress(steps: BookingStep[]): { done: number; total: number } {
  return { done: steps.filter(s => s.state === "done").length, total: steps.length };
}

// ── กล่องงาน: เด้งงานถึง "คนถัดไป" ทุกขั้น ────────────────────────────────
// ขั้นที่ 3 ไม่สร้างงานซ้ำ เพราะ submitApprovalQueue สร้างให้ผู้จัดการอยู่แล้วตอนกดจอง
const QUEUE_FOR_STEP: Record<string, { type: string; role: string; title: (name: string) => string }> = {
  slip:          { type: "Booking_Collect_Deposit", role: "sales_ai", title: n => `เก็บเงินจอง + แนบสลิป — ${n}` },
  doc:           { type: "Booking_Issue_Doc",       role: "sales_ai", title: n => `ออกใบจองให้ลูกค้า — ${n}` },
  posted:        { type: "Booking_Post_Payment",    role: "finance",  title: n => `ตรวจยอดเข้าบัญชี + ลงบัญชีเงินจอง — ${n}` },
  contract_date: { type: "Booking_Set_Contract",    role: "sales_ai", title: n => `นัดวันทำสัญญา — ${n}` },
};

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

/**
 * ให้กล่องงานตรงกับสถานะจริง: ขั้นที่ถึงคิวแล้ว → มีงานค้างอยู่ 1 ใบ · ขั้นที่ทำเสร็จแล้ว → ปิดงาน
 * เรียกซ้ำได้ไม่สร้างซ้ำ (best-effort — ไม่ทำให้การบันทึกหลักล้มเหลว)
 */
export async function syncBookingQueue(
  leadId: string,
  customerName: string,
  steps: BookingStep[],
  byName?: string | null,
): Promise<void> {
  try {
    const { data: open } = await supabase.from("work_queue")
      .select("id, workflow_type").eq("source_record_id", leadId).eq("status", "open");
    const openTypes = new Set(((open ?? []) as { workflow_type: string }[]).map(r => r.workflow_type));

    for (const step of steps) {
      const cfg = QUEUE_FOR_STEP[step.key];
      if (!cfg) continue;
      if (step.state === "current" && !openTypes.has(cfg.type)) {
        await supabase.from("work_queue").insert({
          project_id: PROJECT_ID, workflow_type: cfg.type, source_record_id: leadId,
          title: cfg.title(customerName), assigned_role: cfg.role, status: "open",
        });
      } else if (step.state !== "current" && openTypes.has(cfg.type)) {
        // ทำเสร็จแล้ว (หรือถอยกลับไปรอขั้นก่อน) → ไม่ต้องค้างในกล่องงานอีก
        await supabase.from("work_queue")
          .update({ status: "done", done_at: new Date().toISOString(), done_by: byName ?? null })
          .eq("source_record_id", leadId).eq("workflow_type", cfg.type).eq("status", "open");
      }
    }
  } catch {
    /* best-effort — กล่องงานไม่ควรทำให้การบันทึกหลักพัง */
  }
}

/** ดึงข้อมูลจริงทั้งหมดที่ใช้คำนวณขั้นตอน แล้วคืนขั้นตอนพร้อมใช้ */
export async function loadBookingFlow(leadId: string): Promise<{ steps: BookingStep[]; facts: BookingFlowFacts } | null> {
  const { data: lead } = await supabase.from("leads")
    .select("id, customer_name, status, booking_date, booking_deposit, deposit_slip_url, deposit_received_at, deposit_received_by, booking_doc_at, contract_appointment_date, assigned_to")
    .eq("id", leadId).maybeSingle();
  if (!lead) return null;

  const [{ data: approvals }, { data: insts }] = await Promise.all([
    supabase.from("approval_logs").select("action_taken, created_at")
      .eq("source_record_id", leadId).eq("workflow_type", "Booking_Deposit")
      .order("created_at", { ascending: false }).limit(1),
    supabase.from("customer_installments").select("installment_no, status").eq("lead_id", leadId),
  ]);

  const act = ((approvals ?? [])[0] as { action_taken?: string } | undefined)?.action_taken ?? "";
  const approval: BookingFlowFacts["approval"] =
    act === "Approved" ? "approved" : act === "Rejected" ? "rejected" : act ? "pending" : "none";

  const rows = (insts ?? []) as { installment_no: number; status: string }[];
  const facts: BookingFlowFacts = {
    lead: lead as BookingFlowFacts["lead"],
    approval,
    installmentCount: rows.length,
    depositPosted: rows.some(r => r.installment_no === 1 && r.status === "paid"),
  };
  return { steps: deriveBookingSteps(facts), facts };
}
