// เวลาทำงาน & วันหยุดบริษัท — ผู้บริหารกำหนดในแอป (app_settings key='work_schedule' + ตาราง company_holidays)
// ใช้คำนวณ "มาสาย" และ "วันทำงานจริงในเดือน" ของระบบเงินเดือน
import { supabase } from "@/lib/supabase";

export interface WorkSchedule {
  work_start: string;              // "08:00"
  work_end: string;                // "17:00"
  grace_minutes: number;           // ผ่อนผันก่อนนับสาย
  weekly_off_days: number[];       // 0=อา ... 6=ส (วันหยุดประจำสัปดาห์)
  late_deduction_per_day: number;  // หักเงินต่อครั้งที่มาสาย (บาท)
  absent_deduction_per_day: number;// หักต่อวันขาด (0 = ใช้ ฐาน/วันทำงาน อัตโนมัติ)
  sso_enabled: boolean;            // หักประกันสังคม 5% (เพดาน 750)
}

export const DEFAULT_SCHEDULE: WorkSchedule = {
  work_start: "08:00",
  work_end: "17:00",
  grace_minutes: 15,
  weekly_off_days: [0, 6],
  late_deduction_per_day: 0,
  absent_deduction_per_day: 0,
  sso_enabled: true,
};

export const SSO_RATE = 0.05;        // ประกันสังคม 5%
export const SSO_MONTHLY_CAP = 750;  // เพดานหักประกันสังคม 750 บาท/เดือน (ฐานสูงสุด 15,000)

export function parseSchedule(value: string | null | undefined): WorkSchedule {
  if (!value) return DEFAULT_SCHEDULE;
  try { return { ...DEFAULT_SCHEDULE, ...JSON.parse(value) }; } catch { return DEFAULT_SCHEDULE; }
}

/** ประกันสังคมลูกจ้าง 5% ของฐานเงินเดือน แต่ไม่เกิน 750 บาท/เดือน */
export function ssoDeduction(baseSalary: number): number {
  return Math.min(Math.round(Math.max(0, baseSalary) * SSO_RATE), SSO_MONTHLY_CAP);
}

/** นับวันทำงานจริงในเดือน = วันทั้งหมด − วันหยุดประจำสัปดาห์ − วันหยุดบริษัท */
export function workdaysInMonth(year: number, month: number, weeklyOff: number[], holidays: string[]): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  const holidaySet = new Set(holidays);
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (weeklyOff.includes(dow)) continue;
    if (holidaySet.has(iso)) continue;
    count++;
  }
  return count;
}

/** มาสายไหม — เทียบเวลาเช็คอินกับเวลาเริ่มงาน + ผ่อนผัน (grace) */
export function isLateCheckIn(checkIn: string | null | undefined, start: string, graceMinutes: number): boolean {
  if (!checkIn) return false;
  const t = new Date(checkIn);
  if (Number.isNaN(t.getTime())) return false;
  const [sh, sm] = start.split(":").map(Number);
  const limit = new Date(t);
  limit.setHours(sh, sm + graceMinutes, 0, 0);
  return t.getTime() > limit.getTime();
}

// ── client helpers (หน้า settings) ──────────────────────────────
export async function loadWorkSchedule(): Promise<WorkSchedule> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "work_schedule").maybeSingle();
  return parseSchedule((data as { value?: string } | null)?.value);
}

export async function saveWorkSchedule(s: WorkSchedule) {
  return supabase.from("app_settings").upsert(
    { key: "work_schedule", value: JSON.stringify(s), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

export async function loadHolidays(): Promise<{ holiday_date: string; name: string | null }[]> {
  const { data } = await supabase.from("company_holidays").select("holiday_date, name").order("holiday_date");
  return (data as { holiday_date: string; name: string | null }[]) ?? [];
}
