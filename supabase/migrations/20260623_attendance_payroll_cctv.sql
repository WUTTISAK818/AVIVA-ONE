-- ============================================
-- ATTENDANCE & PAYROLL SYSTEM
-- ============================================

-- 1. Attendance Records
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  work_date DATE NOT NULL,
  duration_minutes INT,
  is_present BOOLEAN DEFAULT true,
  is_late BOOLEAN DEFAULT false,
  is_early_leave BOOLEAN DEFAULT false,
  status VARCHAR(20) CHECK (status IN ('present', 'absent', 'late', 'half_day', 'sick_leave', 'personal_leave')),
  device_id VARCHAR(100), -- Hikvision device ID
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attendance_employee_date ON attendance_records(employee_id, work_date);
CREATE INDEX idx_attendance_status ON attendance_records(status);

-- 2. Employee Payroll Config
CREATE TABLE employee_payroll_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_salary DECIMAL(12, 2) NOT NULL,
  allowance DECIMAL(12, 2) DEFAULT 0,
  deduction_per_late_hour DECIMAL(10, 2) DEFAULT 0,
  deduction_per_absent_day DECIMAL(10, 2) DEFAULT 0,
  bank_account VARCHAR(20),
  bank_name VARCHAR(100),
  account_holder_name VARCHAR(200),
  payment_method VARCHAR(50) CHECK (payment_method IN ('bank_transfer', 'cash', 'check')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id)
);

-- 3. Payroll Records (Monthly)
CREATE TABLE payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payroll_month INT NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
  payroll_year INT NOT NULL,
  base_salary DECIMAL(12, 2) NOT NULL,
  allowance DECIMAL(12, 2) DEFAULT 0,
  total_work_days INT,
  present_days INT,
  absent_days INT,
  late_hours FLOAT,
  early_leave_hours FLOAT,
  deduction_late DECIMAL(12, 2) DEFAULT 0,
  deduction_absent DECIMAL(12, 2) DEFAULT 0,
  total_deductions DECIMAL(12, 2) DEFAULT 0,
  bonus DECIMAL(12, 2) DEFAULT 0,
  gross_salary DECIMAL(12, 2) NOT NULL,
  net_salary DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('draft', 'pending_approval', 'approved', 'paid')),
  paid_date TIMESTAMP WITH TIME ZONE,
  payment_reference VARCHAR(100),
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payroll_employee_period ON payroll_records(employee_id, payroll_year, payroll_month);
CREATE INDEX idx_payroll_status ON payroll_records(status);

-- 4. Payroll History/Audit
CREATE TABLE payroll_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID REFERENCES payroll_records(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  changed_field VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CCTV MONITORING SYSTEM
-- ============================================

-- 5. CCTV Events
CREATE TABLE cctv_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL,
  event_time TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type VARCHAR(50) CHECK (event_type IN ('person_detected', 'face_recognized', 'face_not_recognized', 'visitor_detected', 'abnormal_activity')),
  detected_person_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  detected_person_name VARCHAR(200),
  confidence_score FLOAT,
  camera_id VARCHAR(100) NOT NULL,
  frame_url TEXT,
  video_start_time TIMESTAMP WITH TIME ZONE,
  video_end_time TIMESTAMP WITH TIME ZONE,
  presence_duration_minutes INT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cctv_events_date ON cctv_events(event_date);
CREATE INDEX idx_cctv_events_person ON cctv_events(detected_person_id, event_date);
CREATE INDEX idx_cctv_events_camera ON cctv_events(camera_id, event_date);

-- 6. CCTV Daily Summary
CREATE TABLE cctv_daily_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date DATE NOT NULL UNIQUE,
  total_events INT DEFAULT 0,
  total_persons_detected INT DEFAULT 0,
  unique_employees INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  avg_presence_duration_minutes INT,
  alerts_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CCTV Employee Presence (Daily)
CREATE TABLE cctv_employee_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  presence_date DATE NOT NULL,
  first_detected_time TIMESTAMP WITH TIME ZONE,
  last_detected_time TIMESTAMP WITH TIME ZONE,
  total_presence_minutes INT,
  detection_count INT,
  status VARCHAR(20) CHECK (status IN ('present', 'absent', 'partial_day')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cctv_presence_employee_date ON cctv_employee_presence(employee_id, presence_date);

-- 8. Visitor Tracking
CREATE TABLE visitor_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_date DATE NOT NULL,
  visit_time TIMESTAMP WITH TIME ZONE NOT NULL,
  visitor_name VARCHAR(200),
  visitor_phone VARCHAR(20),
  visitor_company VARCHAR(200),
  purpose VARCHAR(500),
  host_employee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INT,
  camera_frame_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_visitor_date ON visitor_tracking(visit_date);
CREATE INDEX idx_visitor_host ON visitor_tracking(host_employee_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_payroll_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cctv_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cctv_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE cctv_employee_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_tracking ENABLE ROW LEVEL SECURITY;

-- Attendance: employees see own, admins see all
CREATE POLICY "attendance_own" ON attendance_records
  FOR SELECT USING (auth.uid() = employee_id OR public.auth_role() IN ('admin', 'coo'));

CREATE POLICY "attendance_insert_admin" ON attendance_records
  FOR INSERT WITH CHECK (public.auth_role() IN ('admin', 'coo'));

-- Payroll: employees see own, HR/admin see all
CREATE POLICY "payroll_own" ON payroll_records
  FOR SELECT USING (auth.uid() = employee_id OR public.auth_role() IN ('admin', 'coo', 'hr'));

CREATE POLICY "payroll_admin" ON payroll_records
  FOR ALL USING (public.auth_role() IN ('admin', 'coo', 'hr'));

-- CCTV: admin/security only
CREATE POLICY "cctv_admin" ON cctv_events
  FOR ALL USING (public.auth_role() IN ('admin', 'coo', 'security'));

CREATE POLICY "cctv_summary_admin" ON cctv_daily_summary
  FOR ALL USING (public.auth_role() IN ('admin', 'coo', 'security'));

CREATE POLICY "cctv_presence_admin" ON cctv_employee_presence
  FOR ALL USING (public.auth_role() IN ('admin', 'coo', 'security'));

CREATE POLICY "visitor_admin" ON visitor_tracking
  FOR ALL USING (public.auth_role() IN ('admin', 'coo', 'security', 'receptionist'));
