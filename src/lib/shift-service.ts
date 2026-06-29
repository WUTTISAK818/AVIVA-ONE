import { supabase } from './supabase';
import type { EmployeeShift, LateAlert } from './types/attendance';

export async function getEmployeeShift(employeeId: string): Promise<{ ok: boolean; data?: EmployeeShift; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('employee_shifts')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch shift' };
  }
}

export async function getAllShifts(): Promise<{ ok: boolean; data?: EmployeeShift[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('employee_shifts')
      .select('*')
      .gte('effective_date', new Date().toISOString().split('T')[0])
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch shifts' };
  }
}

export async function setEmployeeShift(
  employeeId: string,
  shift: Omit<EmployeeShift, 'id' | 'created_at' | 'updated_at'>,
  adminUserId: string
): Promise<{ ok: boolean; data?: EmployeeShift; error?: string }> {
  try {
    // Check if shift exists
    const { data: existing } = await supabase
      .from('employee_shifts')
      .select('id')
      .eq('employee_id', employeeId)
      .single();

    // Remove employee_id from shift object to avoid duplication
    const shiftData = { ...shift };
    delete (shiftData as any).employee_id;

    if (existing) {
      // Update existing shift
      const { data, error } = await supabase
        .from('employee_shifts')
        .update({
          ...shiftData,
          set_by_user_id: adminUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('employee_id', employeeId)
        .select()
        .single();

      if (error) throw error;
      return { ok: true, data };
    } else {
      // Insert new shift
      const { data, error } = await supabase
        .from('employee_shifts')
        .insert([
          {
            employee_id: employeeId,
            shift_name: shiftData.shift_name,
            start_time: shiftData.start_time,
            end_time: shiftData.end_time,
            grace_period_minutes: shiftData.grace_period_minutes,
            break_duration_minutes: shiftData.break_duration_minutes,
            working_days: shiftData.working_days,
            effective_date: shiftData.effective_date,
            notes: shiftData.notes,
            set_by_user_id: adminUserId,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { ok: true, data };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to set shift' };
  }
}

export async function getLateAlertsToday(): Promise<{ ok: boolean; data?: LateAlert[]; error?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        id,
        employee_id,
        check_in_time,
        work_date,
        is_late,
        employees:employee_id(first_name, last_name),
        employee_shifts:employee_id(start_time, grace_period_minutes)
      `)
      .eq('work_date', today)
      .eq('is_late', true)
      .order('check_in_time', { ascending: false });

    if (error) throw error;

    // Transform to LateAlert format
    const alerts = data?.map((record: any) => ({
      id: record.id,
      employee_id: record.employee_id,
      employee_name: record.employees
        ? `${record.employees.first_name} ${record.employees.last_name}`
        : 'Unknown',
      check_in_time: record.check_in_time,
      expected_start_time: record.employee_shifts?.[0]?.start_time || '09:00:00',
      late_minutes: calculateLateMinutes(
        record.check_in_time,
        record.employee_shifts?.[0]?.start_time || '09:00:00',
        record.employee_shifts?.[0]?.grace_period_minutes || 15
      ),
      work_date: record.work_date,
      created_at: record.check_in_time,
    })) || [];

    return { ok: true, data: alerts };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch late alerts' };
  }
}

export function calculateLateMinutes(
  checkInTimeStr: string,
  startTimeStr: string,
  gracePeriodMinutes: number = 15
): number {
  try {
    const checkInTime = new Date(checkInTimeStr);
    const [hours, minutes, seconds] = startTimeStr.split(':').map(Number);

    // Create start time for today based on check-in date
    const startTime = new Date(checkInTime);
    startTime.setHours(hours, minutes, seconds || 0, 0);

    const diffMs = checkInTime.getTime() - startTime.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    // Only count late if exceeds grace period
    return Math.max(0, diffMinutes - gracePeriodMinutes);
  } catch {
    return 0;
  }
}

export async function checkIsLate(employeeId: string, checkInTimeStr: string): Promise<boolean> {
  try {
    const shift = await getEmployeeShift(employeeId);
    if (!shift.ok || !shift.data) return false;

    const checkInTime = new Date(checkInTimeStr);
    const [hours, minutes] = shift.data.start_time.split(':').map(Number);

    // Create start time for today
    const startTime = new Date(checkInTime);
    startTime.setHours(hours, minutes, 0, 0);

    // Add grace period
    const allowedTime = new Date(startTime.getTime() + shift.data.grace_period_minutes * 60000);

    return checkInTime > allowedTime;
  } catch {
    return false;
  }
}
