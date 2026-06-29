-- Employee Shifts Management
-- Allows managers to define work start/end times per employee
-- Used for automatic late detection and payroll calculations

CREATE TABLE employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_name VARCHAR(100) DEFAULT 'Standard', -- e.g., "Standard", "Early", "Late", "Flexible"
  start_time TIME NOT NULL DEFAULT '09:00:00', -- e.g., 09:00 (9 AM)
  end_time TIME NOT NULL DEFAULT '17:00:00',   -- e.g., 17:00 (5 PM)
  grace_period_minutes INT DEFAULT 15, -- Allow N minutes late before flagging as late
  break_duration_minutes INT DEFAULT 60, -- Lunch break duration (deducted from work hours)
  working_days VARCHAR(50) DEFAULT 'Mon,Tue,Wed,Thu,Fri', -- Comma-separated days
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE, -- When this shift starts
  notes TEXT,
  set_by_user_id UUID NOT NULL REFERENCES auth.users(id), -- Admin/Manager who set it
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for quick lookups
CREATE INDEX idx_employee_shifts_employee_id ON employee_shifts(employee_id);
CREATE INDEX idx_employee_shifts_effective_date ON employee_shifts(effective_date);

-- Add comments for documentation
COMMENT ON TABLE employee_shifts IS 'Employee work schedule configuration - defines start/end times and break periods';
COMMENT ON COLUMN employee_shifts.start_time IS 'Daily work start time (e.g., 09:00)';
COMMENT ON COLUMN employee_shifts.end_time IS 'Daily work end time (e.g., 17:00)';
COMMENT ON COLUMN employee_shifts.grace_period_minutes IS 'Allow late buffer (e.g., 15 min late = not flagged as late)';
COMMENT ON COLUMN employee_shifts.working_days IS 'CSV of working days (Mon,Tue,Wed,Thu,Fri)';
COMMENT ON COLUMN employee_shifts.set_by_user_id IS 'Admin/Manager who configured this shift';

-- RLS Policies
ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;

-- Employees can view their own shift
CREATE POLICY "Employees can view own shift" ON employee_shifts
  FOR SELECT USING (employee_id = auth.uid());

-- Managers/Admins can view all shifts
CREATE POLICY "Managers can view all shifts" ON employee_shifts
  FOR SELECT USING (auth_role() IN ('admin', 'ceo', 'coo', 'manager', 'director'));

-- Only managers/admins can create/update shifts
CREATE POLICY "Managers can manage shifts" ON employee_shifts
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'ceo', 'coo', 'manager', 'director'));

CREATE POLICY "Managers can update shifts" ON employee_shifts
  FOR UPDATE USING (auth_role() IN ('admin', 'ceo', 'coo', 'manager', 'director'));

-- Create a default shift for each existing employee (if not already set)
-- This ensures all employees have a shift configuration
INSERT INTO employee_shifts (employee_id, start_time, end_time, shift_name, set_by_user_id)
SELECT DISTINCT
  auth.users.id,
  '09:00:00'::TIME,
  '17:00:00'::TIME,
  'Standard',
  auth.users.id -- Temp: use employee_id (should be admin user in production)
FROM auth.users
WHERE auth.users.id NOT IN (SELECT employee_id FROM employee_shifts)
AND auth.users.id IN (SELECT id FROM public.employees)
ON CONFLICT (employee_id) DO NOTHING;
