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
