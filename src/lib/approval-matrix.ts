/** SLA working days for each workflow type */
export const SLA_DAYS: Record<string, number> = {
  Installment_Review: 2,
  Finance_Approval:   3,
  Material_Purchase:  2,
  Document_Approval:  3,
  Leave_Request:      1,
  Contract_Approval:  5,
  Booking_Deposit:    2,
  Marketing_Budget:   3,
  Purchase_Request:   2,
};

export function calcSlaDueAt(workflowType: string): string {
  const days = SLA_DAYS[workflowType] ?? 3;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Approval Authority Matrix
 * Defines who must approve based on workflow type and amount.
 */
export const APPROVAL_THRESHOLDS: Record<string, { managerMax: number; adminMin: number }> = {
  Finance_Approval:   { managerMax: 499_999,  adminMin: 500_000 },
  Material_Purchase:  { managerMax: 50_000,   adminMin: 50_001  },
  Purchase_Request:   { managerMax: 50_000,   adminMin: 50_001  },
  Installment_Review: { managerMax: Infinity, adminMin: Infinity },
  Leave_Request:      { managerMax: Infinity, adminMin: Infinity },
  Document_Approval:  { managerMax: Infinity, adminMin: Infinity },
  Booking_Deposit:    { managerMax: Infinity, adminMin: Infinity },
};

/** Returns required approver role for an approval request */
export function getApproverRole(workflowType: string, amount: number | null): "manager" | "admin" {
  const amt = amount ?? 0;
  const thresh = APPROVAL_THRESHOLDS[workflowType];
  if (thresh && amt >= thresh.adminMin) return "admin";
  return "manager";
}

/** Two-level threshold: non-admin approving above this must escalate */
export const TWO_LEVEL_THRESHOLD = 50_000;

// ─── ป้ายกำกับคำขออนุมัติ (ใช้ร่วมกันทุกหน้า) ───────────────────────────────
export const APPR_DEPT: Record<string, string> = {
  Material_Purchase: "ฝ่ายก่อสร้าง",
  Finance_Approval: "ฝ่ายการเงิน",
  Installment_Review: "ฝ่ายก่อสร้าง",
  Leave_Request: "ฝ่ายบุคคล",
  Document_Approval: "ฝ่ายออฟฟิศ",
  Booking_Deposit: "ฝ่ายขาย",
  Contract_Approval: "ฝ่ายขาย",
  Marketing_Budget: "ฝ่ายการตลาด",
};

export const APPR_LABEL: Record<string, string> = {
  Material_Purchase: "ขออนุมัติจัดซื้อวัสดุ",
  Finance_Approval: "ขออนุมัติรายจ่าย",
  Installment_Review: "ตรวจสอบงวดงาน",
  Leave_Request: "ขออนุมัติการลา",
  Document_Approval: "ขออนุมัติเอกสาร",
  Booking_Deposit: "อนุมัติเงินจอง",
  Contract_Approval: "อนุมัติสัญญาซื้อขาย",
  Marketing_Budget: "อนุมัติงบการตลาด",
};

/** บทบาทผู้อนุมัติเป็นภาษาไทย */
export const ROLE_TH: Record<string, string> = {
  manager: "ผู้จัดการ",
  admin: "ผู้บริหาร",
  finance: "ฝ่ายการเงิน",
  accounting: "ฝ่ายบัญชี",
  hr: "ฝ่ายบุคคล",
};

export interface ApprovalSummaryInput {
  source_doc_index?: string | null;
  workflow_type?: string | null;
  current_approver_role?: string | null;
  amount?: number | null;
  action_taken?: string | null;
  assigned_to_name?: string | null;
}

export interface ApprovalSummary {
  docNum: string;
  fromName: string; // ผู้ขออนุมัติ
  fromDept: string; // ฝ่ายต้นเรื่อง
  subject: string; // เรื่องที่ขออนุมัติ
  desc: string; // รายละเอียดย่อ
  currentApprover: string; // ผู้พิจารณาขั้นนี้
  nextStep: string; // ขั้นถัดไป/ปลายทาง ("" = ไม่มี)
  is2nd: boolean; // เป็นการอนุมัติชั้น 2 หรือไม่
  pending: boolean;
}

/**
 * สรุปคำขออนุมัติให้อ่านง่าย: มาจากใคร → เรื่องอะไร → ส่งต่อไปไหน
 * ใช้ร่วมกันทุกหน้าที่แสดงคำขออนุมัติ
 */
export function summarizeApproval(input: ApprovalSummaryInput): ApprovalSummary {
  const raw = (input.source_doc_index ?? "").trim();
  const is2nd = raw.startsWith("[2nd Approval]");
  const body = is2nd ? raw.replace(/^\[2nd Approval\]\s*/, "") : raw;

  const parts = body.split(" | ").map((s) => s.trim()).filter(Boolean);
  let docNum = "";
  let fromName = "";
  const descParts: string[] = [];
  parts.forEach((p, i) => {
    if (p.startsWith("โดย")) { fromName = p.replace(/^โดย\s*/, "").trim(); return; }
    if (i === 0) { docNum = p; return; }
    descParts.push(p);
  });

  const wf = input.workflow_type ?? "";
  const amount = input.amount ?? 0;
  const action = (input.action_taken ?? "Pending");
  const pending = action === "Pending";
  const roleTh = ROLE_TH[input.current_approver_role ?? ""] ?? input.assigned_to_name ?? "ผู้อนุมัติ";

  let currentApprover = roleTh;
  let nextStep = "";
  if (is2nd) {
    currentApprover = "ผู้บริหาร";
    nextStep = ""; // ชั้นสุดท้าย
  } else if (pending && amount > TWO_LEVEL_THRESHOLD) {
    nextStep = "ผู้บริหาร (อนุมัติชั้น 2)";
  }

  return {
    docNum,
    fromName: fromName || "—",
    fromDept: APPR_DEPT[wf] ?? "ระบบ",
    subject: APPR_LABEL[wf] ?? wf,
    desc: descParts.join(" · "),
    currentApprover,
    nextStep,
    is2nd,
    pending,
  };
}
