-- Employee Report Submission Schedule & Tracking
-- เก็บความต้องการส่งรายงาน, ขั้นตอนกำหนดการ, และสถานะการส่ง

CREATE TABLE IF NOT EXISTS public.employee_report_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Report definition
  report_name TEXT NOT NULL, -- "Daily Activity Report", "Sales Report", "Construction Log", etc.
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'ad-hoc')) DEFAULT 'daily',

  -- Requirement
  due_day_of_week INTEGER, -- 0=Sunday, 1=Monday (for weekly/monthly)
  due_date DATE, -- สำหรับ specific dates
  due_time TIME DEFAULT '17:00:00', -- default submission time

  -- Department/Role requirement
  required_for_department VARCHAR(100), -- HR, Sales, Construction, Finance, etc.
  required_for_role VARCHAR(100), -- manager, staff, all

  -- Submission tracking
  project_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_report_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to schedule
  schedule_id UUID NOT NULL REFERENCES public.employee_report_schedule(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,

  -- Submitter info
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_by_name VARCHAR(255),
  submitted_by_department VARCHAR(100),

  -- Submission status
  status TEXT NOT NULL CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')) DEFAULT 'pending',
  submitted_at TIMESTAMP,

  -- Report content (JSON)
  report_content JSONB,

  -- Metadata
  project_id UUID NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  -- Constraint: one submission per employee per report per date
  UNIQUE(schedule_id, report_date, submitted_by)
);

-- Indexes
CREATE INDEX idx_employee_report_schedule_dept ON public.employee_report_schedule(required_for_department);
CREATE INDEX idx_employee_report_schedule_type ON public.employee_report_schedule(report_type);
CREATE INDEX idx_employee_report_submissions_date ON public.employee_report_submissions(report_date DESC);
CREATE INDEX idx_employee_report_submissions_status ON public.employee_report_submissions(status);
CREATE INDEX idx_employee_report_submissions_submitter ON public.employee_report_submissions(submitted_by, report_date DESC);

-- Enable RLS
ALTER TABLE public.employee_report_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_report_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule
CREATE POLICY "Schedule visible to all users"
  ON public.employee_report_schedule
  FOR SELECT
  USING (project_id = 'aaaaaaaa-0000-0000-0000-000000000001');

-- RLS Policies for submissions
CREATE POLICY "Users see own submissions"
  ON public.employee_report_submissions
  FOR SELECT
  USING (
    submitted_by = auth.uid() OR
    (SELECT auth_role() FROM auth.users WHERE id = auth.uid()) IN ('admin', 'ceo', 'coo', 'manager', 'director')
  );

CREATE POLICY "Users submit own reports"
  ON public.employee_report_submissions
  FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
  );

CREATE POLICY "Users update own pending submissions"
  ON public.employee_report_submissions
  FOR UPDATE
  USING (
    submitted_by = auth.uid() AND status = 'pending'
  );

-- Insert default report schedules (daily activity report required for all)
INSERT INTO public.employee_report_schedule (
  report_name,
  report_type,
  due_time,
  required_for_department,
  required_for_role
) VALUES
  ('Daily Activity Report', 'daily', '17:00:00', 'all', 'all'),
  ('Sales Daily Summary', 'daily', '19:00:00', 'sales', 'all'),
  ('Construction Daily Log', 'daily', '16:00:00', 'construction', 'all')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.employee_report_schedule IS 'กำหนดข้อกำหนดการส่งรายงานของพนักงาน';
COMMENT ON TABLE public.employee_report_submissions IS 'บันทึกการส่งรายงานของพนักงาน และสถานะการอนุมัติ';
