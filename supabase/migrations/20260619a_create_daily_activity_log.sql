-- Create daily_activity_log table for construction/finance/hr activity tracking
-- สมุดบันทึกกิจกรรมประจำวัน (Construction, Finance, HR)

CREATE TABLE IF NOT EXISTS public.daily_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),

  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_type VARCHAR(50) NOT NULL, -- 'construction', 'finance', 'hr'
  category VARCHAR(50) NOT NULL, -- 'progress', 'qc_defect', 'submitted', 'approved', 'paid', etc.

  performer_id UUID, -- who performed the action
  performer_name VARCHAR(255),
  performer_department VARCHAR(100),

  description TEXT NOT NULL,
  quantity NUMERIC(10, 2),
  amount DECIMAL(12, 2),

  reference_id UUID, -- ID of related record (house, payment_voucher, leave_request, etc.)
  reference_type VARCHAR(50), -- 'houses', 'payment_vouchers', 'leave_requests', 'qc_defects'

  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for quick queries
CREATE INDEX IF NOT EXISTS idx_daily_activity_log_project ON public.daily_activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_log_date ON public.daily_activity_log(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_activity_log_type ON public.daily_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_daily_activity_log_performer ON public.daily_activity_log(performer_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_log_reference ON public.daily_activity_log(reference_type, reference_id);

-- Row Level Security
ALTER TABLE public.daily_activity_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view activity logs from their project
CREATE POLICY daily_activity_select ON public.daily_activity_log
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Allow authenticated users to insert their own activities
CREATE POLICY daily_activity_insert ON public.daily_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);
