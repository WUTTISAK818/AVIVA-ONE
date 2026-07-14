// ระบบลงเวลา + คำนวณเงินเดือน — ผูกกับตารางจริง (attendance / payroll_runs / employees)
// คำนวณ: ประกันสังคม 5% (เพดาน 750) · หักมาสาย/ขาดงานตามเวลาทำงาน+วันหยุดที่ผู้บริหารตั้ง · idempotent ต่อ พนักงาน+เดือน
import { getSupabaseAdmin } from "./supabase";
import { parseSchedule, workdaysInMonth, isLateCheckIn, ssoDeduction } from "./work-schedule";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const r2 = (n: number) => Math.round(n * 100) / 100;

async function getScheduleAndHolidays() {
  const db = getSupabaseAdmin();
  const [{ data: cfg }, { data: hol }] = await Promise.all([
    db.from("app_settings").select("value").eq("key", "work_schedule").maybeSingle(),
    db.from("company_holidays").select("holiday_date"),
  ]);
  const schedule = parseSchedule((cfg as { value?: string } | null)?.value);
  const holidays = ((hol as { holiday_date: string }[] | null) ?? []).map((h) => h.holiday_date);
  return { schedule, holidays };
}

// ── ลงเวลา (attendance real table: check_in / check_out / status / note) ──
export async function recordCheckIn(employeeId: string, note?: string) {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("attendance").insert({
      employee_id: employeeId,
      work_date: new Date().toISOString().split("T")[0],
      check_in: new Date().toISOString(),
      status: "present",
      note: note ?? null,
    }).select().single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Check-in failed" };
  }
}

export async function recordCheckOut(employeeId: string, workDate: string) {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("attendance")
      .update({ check_out: new Date().toISOString() })
      .eq("employee_id", employeeId).eq("work_date", workDate)
      .select().single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Check-out failed" };
  }
}

export async function getDailyAttendance(date: string) {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("attendance")
      .select("*, employees(id, full_name, nickname)")
      .eq("work_date", date).order("created_at", { ascending: false });
    if (error) throw error;
    const transformed = (data as Record<string, unknown>[] | null)?.map((rec) => ({
      ...rec,
      employee_name: (rec.employees as { full_name?: string } | null)?.full_name ?? "—",
    })) ?? [];
    return { ok: true, data: transformed };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to fetch attendance" };
  }
}

// ── คำนวณเงินเดือน 1 คน → upsert payroll_runs (กันซ้ำ ไม่ทับงวดที่อนุมัติ/จ่ายแล้ว) ──
export async function calculateMonthlyPayroll(req: { month: number; year: number; employee_id: string }) {
  try {
    const { month, year, employee_id } = req;
    const db = getSupabaseAdmin();
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;

    // ไม่คำนวณทับงวดที่อนุมัติ/จ่ายแล้ว
    const { data: existing } = await db.from("payroll_runs")
      .select("id, status").eq("employee_id", employee_id).eq("month", monthStr).maybeSingle();
    if (existing && (existing.status === "approved" || existing.status === "paid")) {
      return { ok: true, data: existing, skipped: true };
    }

    const { data: emp, error: empErr } = await db.from("employees")
      .select("id, full_name, base_salary").eq("id", employee_id).single();
    if (empErr) throw empErr;

    const { schedule, holidays } = await getScheduleAndHolidays();
    const daysInMonth = new Date(year, month, 0).getDate();
    const start = `${monthStr}-01`;
    const end = `${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

    const { data: att } = await db.from("attendance")
      .select("work_date, check_in, status")
      .eq("employee_id", employee_id).gte("work_date", start).lte("work_date", end);
    const rows = (att as { check_in: string | null; status: string }[] | null) ?? [];

    const workDays = workdaysInMonth(year, month, schedule.weekly_off_days, holidays);
    const presentDays = rows.filter((a) => a.status === "present").length;
    const absentDays = rows.filter((a) => a.status === "absent").length;
    const lateCount = rows.filter((a) => a.status === "present" && isLateCheckIn(a.check_in, schedule.work_start, schedule.grace_minutes)).length;

    const base = Number(emp.base_salary ?? 0);
    const perDayRate = schedule.absent_deduction_per_day > 0
      ? schedule.absent_deduction_per_day
      : (workDays > 0 ? base / workDays : 0);
    const lateDeduction = r2(lateCount * schedule.late_deduction_per_day);
    const absentDeduction = r2(absentDays * perDayRate);
    const sso = schedule.sso_enabled ? ssoDeduction(base) : 0;
    const tax = 0; // ภาษีหัก ณ ที่จ่ายรายเดือน — ตั้งค่าเพิ่มภายหลัง (ค่าเริ่มต้นให้บัญชีทำปลายปี)
    const commission = 0; // commission/special_income กรอกเพิ่มได้ในภายหลัง

    const grossIncome = r2(base + commission);
    const netIncome = r2(grossIncome - sso - tax - lateDeduction - absentDeduction);

    const row = {
      employee_id, month: monthStr,
      base_salary: base, commission_amount: commission, special_income: 0,
      gross_income: grossIncome, sso_deduction: sso, tax_deduction: tax, net_income: netIncome,
      work_days: workDays, present_days: presentDays, absent_days: absentDays,
      late_count: lateCount, late_deduction: lateDeduction, absent_deduction: absentDeduction,
      status: "draft",
    };

    const { data, error } = await db.from("payroll_runs")
      .upsert(row, { onConflict: "employee_id,month" }).select().single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Payroll calculation failed" };
  }
}

// ── คำนวณทั้งบริษัท (พนักงาน active ทุกคน) สำหรับเดือนนั้น ──
export async function calculateAllForMonth(year: number, month: number) {
  try {
    const db = getSupabaseAdmin();
    const { data: emps, error } = await db.from("employees").select("id").eq("status", "active");
    if (error) throw error;
    let done = 0;
    for (const e of (emps as { id: string }[] | null) ?? []) {
      const res = await calculateMonthlyPayroll({ month, year, employee_id: e.id });
      if (res.ok) done++;
    }
    return await getMonthlyPayrollSummary(year, month, done);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Bulk payroll failed" };
  }
}

export async function approvePayroll(payrollId: string) {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("payroll_runs")
      .update({ status: "approved" }).eq("id", payrollId).eq("status", "draft").select().maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "ไม่พบงวดสถานะ draft (อาจถูกอนุมัติ/จ่ายไปแล้ว)" };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Approval failed" };
  }
}

// จ่ายเงินเดือน → ลง JV บัญชีคู่ (Dr เงินเดือน / Cr ประกันสังคม+ภาษีค้างจ่าย+ธนาคาร)
export async function markPayrollAsPaid(payrollId: string, paymentReference: string, byUserId?: string | null) {
  try {
    const db = getSupabaseAdmin();
    // กันจ่ายซ้ำ: flip approved→paid แบบ atomic ก่อน
    const { data: pr, error } = await db.from("payroll_runs")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", payrollId).eq("status", "approved")
      .select("id, employee_id, month, gross_income, sso_deduction, tax_deduction, late_deduction, absent_deduction, net_income")
      .maybeSingle();
    if (error) throw error;
    if (!pr) return { ok: false, error: "งวดนี้ยังไม่อนุมัติ หรือจ่ายไปแล้ว — ไม่บันทึกซ้ำ" };

    // ลง JV: ค่าใช้จ่ายเงินเดือน (สุทธิของงวด) = ประกันสังคม + ภาษี + จ่ายสุทธิ
    const { postJv } = await import("./jv");
    const { SALARY_EXPENSE, SSO_PAYABLE, WHT_PAYABLE, BANK } = await import("./gl-accounts");
    const salaryExpense = r2(Number(pr.gross_income) - Number(pr.late_deduction ?? 0) - Number(pr.absent_deduction ?? 0));
    const sso = Number(pr.sso_deduction ?? 0);
    const tax = Number(pr.tax_deduction ?? 0);
    const net = Number(pr.net_income);
    const lines = [{ account_code: SALARY_EXPENSE.code, account_name: SALARY_EXPENSE.name, debit: salaryExpense, credit: 0 }];
    if (sso > 0) lines.push({ account_code: SSO_PAYABLE.code, account_name: SSO_PAYABLE.name, debit: 0, credit: sso });
    if (tax > 0) lines.push({ account_code: WHT_PAYABLE.code, account_name: WHT_PAYABLE.name, debit: 0, credit: tax });
    lines.push({ account_code: BANK.code, account_name: BANK.name, debit: 0, credit: net });

    const jvId = await postJv({
      project_id: PROJECT_ID,
      jv_date: new Date().toISOString().split("T")[0],
      description: `จ่ายเงินเดือน: งวด ${pr.month} (${paymentReference})`,
      ref_number: paymentReference || null,
      lines,
    });
    if (jvId) await db.from("payroll_runs").update({ jv_id: jvId }).eq("id", pr.id);
    void byUserId;
    return { ok: true, data: pr };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Payment marking failed" };
  }
}

export async function getMonthlyPayrollSummary(year: number, month: number, calculated?: number) {
  try {
    const db = getSupabaseAdmin();
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    const { data, error } = await db.from("payroll_runs")
      .select("*, employees(full_name, nickname)")
      .eq("month", monthStr).order("created_at", { ascending: false });
    if (error) throw error;

    const rows = (data as Record<string, unknown>[] | null) ?? [];
    const details = rows.map((p) => ({
      ...p,
      employee_name: (p.employees as { full_name?: string; nickname?: string } | null)?.full_name
        ?? (p.employees as { nickname?: string } | null)?.nickname ?? "—",
      gross_salary: p.gross_income,
      total_deductions: r2(Number(p.sso_deduction ?? 0) + Number(p.tax_deduction ?? 0) + Number(p.late_deduction ?? 0) + Number(p.absent_deduction ?? 0)),
      net_salary: p.net_income,
    }));
    const num = (v: unknown) => Number(v ?? 0);
    const summary = {
      total_employees: rows.length,
      total_gross_salary: rows.reduce((s, p) => s + num(p.gross_income), 0),
      total_deductions: rows.reduce((s, p) => s + num(p.sso_deduction) + num(p.tax_deduction) + num(p.late_deduction) + num(p.absent_deduction), 0),
      total_net_salary: rows.reduce((s, p) => s + num(p.net_income), 0),
      paid_count: rows.filter((p) => p.status === "paid").length,
      calculated: calculated ?? undefined,
    };
    return { ok: true, data: summary, details };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to fetch summary" };
  }
}
