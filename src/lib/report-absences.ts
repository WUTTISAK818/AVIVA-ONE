import { supabase } from "./supabase";
import { createNotification, notifyPersonalLine } from "./notify";

// เคส "ไม่ได้ส่งรายงานประจำวัน" — ต้องจบที่สถานะปลายทางเสมอ ไม่ค้างเงียบ
//   open               = ระบบเปิดเคสแล้ว รอพนักงานส่งย้อนหลังหรือชี้แจง
//   explained          = พนักงานชี้แจงแล้ว รอผู้บริหารกดรับทราบ
//   closed_submitted   = ส่งรายงานย้อนหลังแล้ว (ระบบปิดให้เอง)
//   closed_unexplained = ครบ 7 วันไม่ทำอะไรเลย (ระบบปิดเอง ติดประวัติ)
export type AbsenceStatus = "open" | "explained" | "closed_submitted" | "closed_unexplained";

export const ABSENCE_GRACE_DAYS = 7; // ตามย้อนหลังเท่ากับจำนวนวันที่ส่งรายงานย้อนหลังได้

export interface ReportAbsence {
  id: string;
  employee_email: string;
  employee_name: string | null;
  department: string | null;
  report_date: string;
  status: AbsenceStatus;
  explanation: string | null;
  explained_at: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  reminder_count: number;
}

export const ABSENCE_STATUS_LABEL: Record<AbsenceStatus, string> = {
  open: "รอชี้แจง",
  explained: "ชี้แจงแล้ว รอรับทราบ",
  closed_submitted: "ส่งย้อนหลังแล้ว",
  closed_unexplained: "ขาดส่ง — ไม่ชี้แจง",
};

/** เคสที่ยังไม่จบของพนักงานคนนี้ (ใช้กับแถบเตือนในหน้า /reports) */
export async function loadMyOpenAbsences(email: string): Promise<ReportAbsence[]> {
  const { data } = await supabase
    .from("report_absences")
    .select("*")
    .ilike("employee_email", email)
    .in("status", ["open", "explained"])
    .order("report_date", { ascending: false });
  return (data as ReportAbsence[]) ?? [];
}

/** เคสที่ยังไม่จบในมุมผู้บริหาร — รอพนักงานชี้แจง หรือชี้แจงแล้วรอกดรับทราบ */
export async function loadPendingAbsences(): Promise<ReportAbsence[]> {
  const { data } = await supabase
    .from("report_absences")
    .select("*")
    .in("status", ["open", "explained"])
    .is("acknowledged_at", null)
    .order("report_date", { ascending: false });
  return (data as ReportAbsence[]) ?? [];
}

/** พนักงานชี้แจงเหตุผล → รอผู้บริหารรับทราบ + แจ้งเตือนผู้บริหารทันที */
export async function explainAbsence(
  absence: Pick<ReportAbsence, "id" | "report_date" | "employee_name">,
  explanation: string,
  executiveEmails: string[],
): Promise<{ ok: boolean; error?: string }> {
  const note = explanation.trim();
  if (!note) return { ok: false, error: "กรุณาเขียนเหตุผล" };

  const { error } = await supabase
    .from("report_absences")
    .update({ status: "explained", explanation: note, explained_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", absence.id);
  if (error) return { ok: false, error: error.message };

  const dateLabel = new Date(absence.report_date + "T12:00:00Z")
    .toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });
  const title = `${absence.employee_name || "พนักงาน"} ชี้แจงเหตุที่ไม่ได้ส่งรายงาน`;
  const body = `รายงานวันที่ ${dateLabel}\n\nเหตุผล: ${note}`;

  for (const email of executiveEmails) {
    await createNotification({ type: "info", title, message: body, to_user_email: email, link: "/reports/digest" }).catch(() => {});
  }
  await notifyPersonalLine(title, body, "/reports/digest", executiveEmails).catch(() => {});
  return { ok: true };
}

/** ผู้บริหารกดรับทราบ → ปิดเคส (เก็บสถานะ explained ไว้เป็นประวัติ แต่ acknowledged แล้ว) */
export async function acknowledgeAbsence(id: string, byName: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("report_absences")
    .update({ acknowledged_by: byName, acknowledged_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** ส่งรายงานย้อนหลังสำเร็จ → ปิดเคสของวันนั้นให้อัตโนมัติ (best-effort ไม่ให้กระทบการส่งรายงาน) */
export async function closeAbsenceOnSubmit(email: string, reportDate: string): Promise<void> {
  await supabase
    .from("report_absences")
    .update({ status: "closed_submitted", updated_at: new Date().toISOString() })
    .ilike("employee_email", email)
    .eq("report_date", reportDate)
    .in("status", ["open", "explained"]);
}
