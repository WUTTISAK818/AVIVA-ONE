"use client";
// Work Actions — logic กลางสำหรับงานที่น้อง Viva สั่งทำแทนได้ (และฟอร์มปกติใช้ร่วม)
// ปัจจุบัน: แจ้งซ่อม/เคลม (warranty claim) + ขอลา (leave request)
// คู่กับ purchase-request.ts (PR) — แก้ flow ที่เดียว ทั้งฟอร์มและ Viva ตรงกัน
import { supabase } from "./supabase";
import { generateDocNumber } from "./doc-numbers";
import { createNotification } from "./notify";
import { calcSlaDueAt } from "./approval-matrix";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

// วันที่วันนี้ (เวลาไทย UTC+7) รูปแบบ YYYY-MM-DD
const todayTh = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];

/* ───────────────────────── แจ้งซ่อม / Warranty Claim ───────────────────────── */

export const CLAIM_ISSUE_TYPES = ["โครงสร้าง", "ระบบไฟฟ้า", "ระบบประปา", "หลังคา/รางน้ำ", "ประตู/หน้าต่าง", "พื้น/กระเบื้อง", "สี/ผนัง", "อื่นๆ"];

const issueTh: Record<string, string> = {
  "โครงสร้าง": "โครงสร้าง", "ระบบไฟฟ้า": "ไฟฟ้า", "ระบบประปา": "ประปา",
  "หลังคา/รางน้ำ": "หลังคา", "ประตู/หน้าต่าง": "ประตู/หน้าต่าง",
  "พื้น/กระเบื้อง": "พื้น", "สี/ผนัง": "สีผนัง", "อื่นๆ": "อื่นๆ",
};

export function normalizeIssueType(raw: string | null | undefined): string {
  const c = (raw ?? "").trim();
  if (CLAIM_ISSUE_TYPES.includes(c)) return c;
  const low = c.toLowerCase();
  if (low.includes("ไฟ") || low.includes("electric")) return "ระบบไฟฟ้า";
  if (low.includes("ประปา") || low.includes("น้ำ") || low.includes("ท่อ") || low.includes("plumb")) return "ระบบประปา";
  if (low.includes("หลังคา") || low.includes("รางน้ำ") || low.includes("roof")) return "หลังคา/รางน้ำ";
  if (low.includes("ประตู") || low.includes("หน้าต่าง") || low.includes("door") || low.includes("window")) return "ประตู/หน้าต่าง";
  if (low.includes("พื้น") || low.includes("กระเบื้อง") || low.includes("floor") || low.includes("tile")) return "พื้น/กระเบื้อง";
  if (low.includes("สี") || low.includes("ผนัง") || low.includes("wall") || low.includes("paint")) return "สี/ผนัง";
  if (low.includes("โครงสร้าง") || low.includes("structure") || low.includes("ร้าว")) return "โครงสร้าง";
  return "อื่นๆ";
}

export interface CreateClaimInput {
  customerName: string;
  houseNumber?: string | null;
  issueType: string;
  description: string;
  assignedTo?: string | null;
  reportDate?: string | null;
  scheduledDate?: string | null;
  estimatedCompletionDate?: string | null;
}

export interface CreateClaimResult { id: string; docNumber: string; }

export async function createWarrantyClaim(input: CreateClaimInput): Promise<CreateClaimResult> {
  const customer = input.customerName.trim();
  const desc = input.description.trim();
  if (!customer) throw new Error("กรุณาระบุชื่อลูกค้า (ผู้แจ้ง)");
  if (!desc) throw new Error("กรุณาระบุรายละเอียดปัญหา");
  const issue = normalizeIssueType(input.issueType);
  const docNum = await generateDocNumber("WR");

  const { data, error } = await supabase
    .from("warranty_claims")
    .insert({
      project_id: PROJECT_ID,
      doc_number: docNum,
      customer_name: customer,
      house_number: (input.houseNumber ?? "").trim() || null,
      issue_type: issue,
      description: desc,
      assigned_to: (input.assignedTo ?? "").trim() || null,
      report_date: input.reportDate || todayTh(),
      scheduled_date: input.scheduledDate || null,
      estimated_completion_date: input.estimatedCompletionDate || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("บันทึกแจ้งซ่อมไม่สำเร็จ — ลองใหม่อีกครั้ง");

  await createNotification({
    type: "claim",
    title: `แจ้งซ่อมใหม่ — ${docNum}`,
    message: `${customer} — ${issueTh[issue] ?? issue}: ${desc}`,
    from_dept: "ฝ่ายหลังการขาย",
  });
  return { id: data.id, docNumber: docNum };
}

/* ───────────────────────── ขอลา / Leave Request ───────────────────────── */

export const LEAVE_TYPES = ["ลาพักร้อน", "ลาป่วย", "ลากิจ", "ลาครอบครัว", "ลาอื่นๆ"];

export function normalizeLeaveType(raw: string | null | undefined): string {
  const c = (raw ?? "").trim();
  if (LEAVE_TYPES.includes(c)) return c;
  const low = c.toLowerCase();
  if (low.includes("ป่วย") || low.includes("sick")) return "ลาป่วย";
  if (low.includes("พักร้อน") || low.includes("vacation") || low.includes("annual") || low.includes("พักผ่อน")) return "ลาพักร้อน";
  if (low.includes("ครอบครัว") || low.includes("family")) return "ลาครอบครัว";
  if (low.includes("กิจ") || low.includes("personal") || low.includes("ธุระ")) return "ลากิจ";
  return "ลาอื่นๆ";
}

export interface CreateLeaveInput {
  employeeName: string;
  leaveType: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  reason?: string | null;
  userId?: string | null;
}

export interface CreateLeaveResult { id: string; docNumber: string; days: number; }

export async function createLeaveRequest(input: CreateLeaveInput): Promise<CreateLeaveResult> {
  const name = input.employeeName.trim();
  if (!name) throw new Error("กรุณาระบุชื่อผู้ขอลา");
  if (!input.dateFrom || !input.dateTo) throw new Error("กรุณาระบุวันที่เริ่ม–สิ้นสุดการลา");
  const leaveType = normalizeLeaveType(input.leaveType);

  // กันยื่นลาซ้ำช่วงเดียวกัน (เหมือนฟอร์มฝ่ายบุคคล)
  const { data: overlap } = await supabase
    .from("leave_requests")
    .select("id,date_from,date_to")
    .eq("employee_name", name)
    .lte("date_from", input.dateTo)
    .gte("date_to", input.dateFrom)
    .eq("status", "pending");
  if (overlap && overlap.length > 0) {
    throw new Error(`${name} มีคำขอลาช่วง ${overlap[0].date_from} – ${overlap[0].date_to} ที่รออนุมัติอยู่แล้ว`);
  }

  const days = Math.max(1, Math.ceil((new Date(input.dateTo).getTime() - new Date(input.dateFrom).getTime()) / 86400000) + 1);
  const docNum = await generateDocNumber("LEAVE");

  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_name: name,
      leave_type: leaveType,
      date_from: input.dateFrom,
      date_to: input.dateTo,
      days_count: days,
      reason: (input.reason ?? "").trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("ยื่นใบลาไม่สำเร็จ — ลองใหม่อีกครั้ง");

  // ส่งเข้าสายอนุมัติผู้จัดการ (เหมือนฟอร์มฝ่ายบุคคล)
  await supabase.from("approval_logs").insert({
    workflow_type: "Leave_Request",
    source_doc_index: `${docNum} | ขอ${leaveType} ${days} วัน (${input.dateFrom} – ${input.dateTo}) | โดย ${name}`,
    submitted_by_user_id: input.userId ?? null,
    source_record_id: data.id,
    current_approver_role: "manager",
    action_taken: "Pending",
    amount: 0,
    sla_due_at: calcSlaDueAt("Leave_Request"),
    assigned_to_name: "ผู้จัดการ",
  });
  await createNotification({
    type: "info",
    title: `คำขอลาใหม่ — ${docNum}`,
    message: `${name} ขอ${leaveType} ${days} วัน`,
    from_dept: "ฝ่ายบุคคล",
  });
  return { id: data.id, docNumber: docNum, days };
}
