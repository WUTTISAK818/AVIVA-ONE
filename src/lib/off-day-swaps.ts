import { supabase } from "./supabase";
import { createNotification, notifyPersonalLine } from "./notify";
import { isEmployeeOffDay } from "./work-schedule";

// คำขอสลับวันหยุด — พนักงานขอเอง ผู้บริหารอนุมัติ แล้วจึงมีผลกับการนับวันหยุด/การส่งรายงาน
//   original_off_date = วันหยุดเดิมของเขา แต่จะมาทำงานแทน (วันนั้นต้องส่งรายงานตามปกติ)
//   swapped_off_date  = วันที่จะหยุดแทน (วันนั้นไม่ต้องส่งรายงาน)
export type SwapStatus = "pending" | "approved" | "rejected";

export interface OffDaySwap {
  id: string;
  employee_id: string | null;
  employee_email: string;
  employee_name: string | null;
  department: string | null;
  original_off_date: string;
  swapped_off_date: string;
  reason: string | null;
  status: SwapStatus;
  approved_by: string | null;
  approved_at: string | null;
  decision_note: string | null;
  created_at: string;
}

/** คู่วันที่ของการสลับที่อนุมัติแล้ว — ใช้คำนวณว่าวันไหนเป็นวันหยุดจริง */
export interface SwapPair { original_off_date: string; swapped_off_date: string }

/**
 * วันนี้เป็นวันหยุดของพนักงานคนนี้ไหม — คิดการสลับวันหยุดที่อนุมัติแล้วก่อนเสมอ
 * ลำดับ: สลับมาหยุดวันนี้ > สลับไปทำงานวันนี้ > วันหยุดประจำตัว/ค่ากลางบริษัท
 */
export function resolveOffDay(opts: {
  dateStr: string;
  dow: number;
  weeklyOffDay: number | null | undefined;
  companyWeeklyOff: number[];
  swaps: SwapPair[];
}): { isOff: boolean; swapped: boolean } {
  const { dateStr, dow, weeklyOffDay, companyWeeklyOff, swaps } = opts;
  if (swaps.some(s => s.swapped_off_date === dateStr)) return { isOff: true, swapped: true };
  if (swaps.some(s => s.original_off_date === dateStr)) return { isOff: false, swapped: true };
  return { isOff: isEmployeeOffDay(dow, weeklyOffDay, companyWeeklyOff), swapped: false };
}

/** จัดกลุ่มการสลับที่อนุมัติแล้วตามอีเมลพนักงาน (ใช้ฝั่ง cron/API ที่ดึงทีละหลายคน) */
export function groupSwapsByEmail(rows: { employee_email: string; original_off_date: string; swapped_off_date: string }[]): Map<string, SwapPair[]> {
  const map = new Map<string, SwapPair[]>();
  for (const r of rows) {
    const key = (r.employee_email ?? "").toLowerCase();
    const list = map.get(key) ?? [];
    list.push({ original_off_date: r.original_off_date, swapped_off_date: r.swapped_off_date });
    map.set(key, list);
  }
  return map;
}

// ── client helpers ─────────────────────────────────────────────

export async function loadMySwaps(email: string): Promise<OffDaySwap[]> {
  const { data } = await supabase
    .from("off_day_swaps")
    .select("*")
    .ilike("employee_email", email)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as OffDaySwap[]) ?? [];
}

export async function loadPendingSwaps(): Promise<OffDaySwap[]> {
  const { data } = await supabase
    .from("off_day_swaps")
    .select("*")
    .eq("status", "pending")
    .order("swapped_off_date");
  return (data as OffDaySwap[]) ?? [];
}

/** การสลับที่อนุมัติแล้วของคนนี้ ที่ครอบคลุมช่วงวันที่ที่สนใจ */
export async function loadApprovedSwaps(email: string, fromDate: string, toDate: string): Promise<SwapPair[]> {
  const { data } = await supabase
    .from("off_day_swaps")
    .select("original_off_date, swapped_off_date")
    .ilike("employee_email", email)
    .eq("status", "approved")
    .or(`and(original_off_date.gte.${fromDate},original_off_date.lte.${toDate}),and(swapped_off_date.gte.${fromDate},swapped_off_date.lte.${toDate})`);
  return (data as SwapPair[]) ?? [];
}

export async function requestSwap(opts: {
  employeeId: string | null;
  employeeEmail: string;
  employeeName: string;
  department: string | null;
  originalOffDate: string;
  swappedOffDate: string;
  reason: string;
  executiveEmails: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("off_day_swaps").insert({
    employee_id: opts.employeeId,
    employee_email: opts.employeeEmail.toLowerCase(),
    employee_name: opts.employeeName,
    department: opts.department,
    original_off_date: opts.originalOffDate,
    swapped_off_date: opts.swappedOffDate,
    reason: opts.reason.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  const title = `ขอสลับวันหยุด — ${opts.employeeName}`;
  const body = `มาทำงานวันที่ ${thDate(opts.originalOffDate)} แทน และขอหยุดวันที่ ${thDate(opts.swappedOffDate)}${opts.reason.trim() ? `\nเหตุผล: ${opts.reason.trim()}` : ""}`;
  for (const email of opts.executiveEmails) {
    await createNotification({ type: "approval", title, message: body, to_user_email: email, link: "/office?tab=hr" }).catch(() => {});
  }
  await notifyPersonalLine(title, body, "/office?tab=hr", opts.executiveEmails).catch(() => {});
  return { ok: true };
}

export async function decideSwap(
  swap: OffDaySwap,
  approve: boolean,
  byName: string,
  byRole: string | null,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("off_day_swaps").update({
    status: approve ? "approved" : "rejected",
    approved_by: byName,
    approved_by_role: byRole,
    approved_at: new Date().toISOString(),
    decision_note: note?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", swap.id);
  if (error) return { ok: false, error: error.message };

  const title = approve ? "อนุมัติสลับวันหยุดแล้ว" : "ไม่อนุมัติคำขอสลับวันหยุด";
  const body = `มาทำงาน ${thDate(swap.original_off_date)} · หยุดแทน ${thDate(swap.swapped_off_date)}\nโดย ${byName}${note?.trim() ? `\nหมายเหตุ: ${note.trim()}` : ""}`;
  await createNotification({ type: "info", title, message: body, to_user_email: swap.employee_email, link: "/office?tab=hr" }).catch(() => {});
  await notifyPersonalLine(title, body, "/office?tab=hr", [swap.employee_email]).catch(() => {});
  return { ok: true };
}

export function thDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z")
    .toLocaleDateString("th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}
