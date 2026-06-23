// Attendance Records
export interface AttendanceRecord {
  id: string;
  employee_id: string;
  check_in_time: string; // ISO timestamp
  check_out_time?: string;
  work_date: string; // YYYY-MM-DD
  duration_minutes?: number;
  is_present: boolean;
  is_late: boolean;
  is_early_leave: boolean;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'sick_leave' | 'personal_leave';
  device_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceDailyReport {
  employee_id: string;
  employee_name: string;
  work_date: string;
  check_in_time?: string;
  check_out_time?: string;
  work_duration_hours: number;
  status: AttendanceRecord['status'];
  is_late: boolean;
  late_minutes?: number;
  notes?: string;
}

export interface AttendanceMonthlyStats {
  employee_id: string;
  employee_name: string;
  month: number;
  year: number;
  total_work_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  sick_leave_days: number;
  personal_leave_days: number;
  total_late_hours: number;
  attendance_rate: number; // percentage
}

// Employee Payroll Config
export interface EmployeePayrollConfig {
  id: string;
  employee_id: string;
  base_salary: number;
  allowance: number;
  deduction_per_late_hour: number;
  deduction_per_absent_day: number;
  bank_account: string;
  bank_name: string;
  account_holder_name: string;
  payment_method: 'bank_transfer' | 'cash' | 'check';
  created_at: string;
  updated_at: string;
}

// Payroll Records
export interface PayrollRecord {
  id: string;
  employee_id: string;
  payroll_month: number;
  payroll_year: number;
  base_salary: number;
  allowance: number;
  total_work_days: number;
  present_days: number;
  absent_days: number;
  late_hours: number;
  early_leave_hours: number;
  deduction_late: number;
  deduction_absent: number;
  total_deductions: number;
  bonus: number;
  gross_salary: number;
  net_salary: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'paid';
  paid_date?: string;
  payment_reference?: string;
  calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollCalculationRequest {
  month: number;
  year: number;
  employee_id?: string; // if undefined, calculate for all
}

export interface PayrollSummary {
  employee_id: string;
  employee_name: string;
  month: number;
  year: number;
  base_salary: number;
  allowance: number;
  deductions: number;
  bonus: number;
  net_salary: number;
  status: PayrollRecord['status'];
}
