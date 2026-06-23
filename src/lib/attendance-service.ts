import { supabase } from './supabase';
import type { AttendanceRecord, PayrollRecord, PayrollCalculationRequest } from './types/attendance';

// ============================================
// ATTENDANCE FUNCTIONS
// ============================================

export async function recordCheckIn(employeeId: string, deviceId?: string) {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .insert([
        {
          employee_id: employeeId,
          check_in_time: new Date().toISOString(),
          work_date: new Date().toISOString().split('T')[0],
          status: 'present',
          device_id: deviceId,
          is_present: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Check-in failed' };
  }
}

export async function recordCheckOut(employeeId: string, workDate: string) {
  try {
    const { data: record, error: fetchError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('work_date', workDate)
      .single();

    if (fetchError) throw fetchError;

    const checkOutTime = new Date();
    const checkInTime = new Date(record.check_in_time);
    const durationMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);

    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        check_out_time: checkOutTime.toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq('id', record.id)
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Check-out failed' };
  }
}

export async function getDailyAttendance(date: string) {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*, employees(id, first_name, last_name)')
      .eq('work_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to include employee_name
    const transformed = data?.map((record: any) => ({
      ...record,
      employee_name: record.employees
        ? `${record.employees.first_name} ${record.employees.last_name}`
        : 'Unknown',
    })) || [];

    return { ok: true, data: transformed };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch attendance' };
  }
}

export async function getEmployeeMonthlyAttendance(employeeId: string, year: number, month: number) {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true });

    if (error) throw error;

    const stats = {
      total_work_days: data?.length || 0,
      present_days: data?.filter(r => r.status === 'present').length || 0,
      absent_days: data?.filter(r => r.status === 'absent').length || 0,
      late_days: data?.filter(r => r.is_late).length || 0,
      sick_leave_days: data?.filter(r => r.status === 'sick_leave').length || 0,
      personal_leave_days: data?.filter(r => r.status === 'personal_leave').length || 0,
      total_late_hours: data?.reduce((sum, r) => sum + (r.duration_minutes ? 0 : 0), 0) || 0,
    };

    return { ok: true, data: stats };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch attendance' };
  }
}

export async function markAbsent(employeeId: string, workDate: string, reason?: string) {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .insert([
        {
          employee_id: employeeId,
          work_date: workDate,
          status: 'absent',
          is_present: false,
          notes: reason,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to mark absent' };
  }
}

// ============================================
// PAYROLL FUNCTIONS
// ============================================

export async function calculateMonthlyPayroll(req: PayrollCalculationRequest) {
  try {
    const { month, year, employee_id } = req;

    // Get employee payroll config
    const { data: payrollConfig, error: configError } = await supabase
      .from('employee_payroll_config')
      .select('*')
      .eq('employee_id', employee_id)
      .single();

    if (configError) throw configError;

    // Get attendance for the month
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employee_id)
      .gte('work_date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lte('work_date', `${year}-${String(month).padStart(2, '0')}-31`);

    if (attendanceError) throw attendanceError;

    // Calculate
    const presentDays = attendance?.filter(a => a.status === 'present').length || 0;
    const absentDays = attendance?.filter(a => a.status === 'absent').length || 0;
    const lateHours = attendance?.reduce((sum, a) => sum + (a.duration_minutes ? 0 : 0), 0) || 0;
    const totalWorkDays = 22; // standard workdays per month

    const deductionLate = lateHours * (payrollConfig.deduction_per_late_hour || 0);
    const deductionAbsent = absentDays * (payrollConfig.deduction_per_absent_day || 0);
    const totalDeductions = deductionLate + deductionAbsent;

    const grossSalary = payrollConfig.base_salary + payrollConfig.allowance;
    const netSalary = grossSalary - totalDeductions;

    // Insert payroll record
    const { data, error } = await supabase
      .from('payroll_records')
      .insert([
        {
          employee_id,
          payroll_month: month,
          payroll_year: year,
          base_salary: payrollConfig.base_salary,
          allowance: payrollConfig.allowance,
          total_work_days: totalWorkDays,
          present_days: presentDays,
          absent_days: absentDays,
          late_hours: lateHours,
          deduction_late: deductionLate,
          deduction_absent: deductionAbsent,
          total_deductions: totalDeductions,
          gross_salary: grossSalary,
          net_salary: netSalary,
          status: 'draft',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Payroll calculation failed' };
  }
}

export async function getPayrollRecord(employeeId: string, year: number, month: number) {
  try {
    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('payroll_year', year)
      .eq('payroll_month', month)
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch payroll' };
  }
}

export async function approvePayroll(payrollId: string) {
  try {
    const { data, error } = await supabase
      .from('payroll_records')
      .update({ status: 'approved' })
      .eq('id', payrollId)
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Approval failed' };
  }
}

export async function markPayrollAsPaid(payrollId: string, paymentReference: string) {
  try {
    const { data, error } = await supabase
      .from('payroll_records')
      .update({
        status: 'paid',
        paid_date: new Date().toISOString(),
        payment_reference: paymentReference,
      })
      .eq('id', payrollId)
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Payment marking failed' };
  }
}

export async function getMonthlyPayrollSummary(year: number, month: number) {
  try {
    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('payroll_year', year)
      .eq('payroll_month', month)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const summary = {
      total_employees: data?.length || 0,
      total_gross_salary: data?.reduce((sum, p) => sum + p.gross_salary, 0) || 0,
      total_deductions: data?.reduce((sum, p) => sum + p.total_deductions, 0) || 0,
      total_net_salary: data?.reduce((sum, p) => sum + p.net_salary, 0) || 0,
      paid_count: data?.filter(p => p.status === 'paid').length || 0,
      pending_count: data?.filter(p => p.status === 'pending_approval').length || 0,
    };

    return { ok: true, data: summary, details: data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch summary' };
  }
}
