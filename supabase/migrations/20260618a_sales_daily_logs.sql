-- Sales Daily Field Log Table
-- Tracks daily activities for sales staff (calls, visits, feedback)

CREATE TABLE public.sales_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL DEFAULT 'aaaaaaaa-0000-0000-0000-000000000001',
  staff_id uuid NOT NULL,
  staff_name text,
  log_date date NOT NULL,
  log_time time,
  activities_calls integer DEFAULT 0 CHECK (activities_calls >= 0),
  activities_visits integer DEFAULT 0 CHECK (activities_visits >= 0),
  activities_meetings integer DEFAULT 0 CHECK (activities_meetings >= 0),
  customer_feedback text,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_daily_logs_staff_date ON public.sales_daily_logs(staff_id, log_date DESC);
CREATE INDEX idx_sales_daily_logs_date ON public.sales_daily_logs(log_date DESC);
CREATE INDEX idx_sales_daily_logs_status ON public.sales_daily_logs(status);

-- Row Level Security
ALTER TABLE public.sales_daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff see own logs, managers see all"
  ON public.sales_daily_logs
  FOR SELECT
  USING (
    staff_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin', 'ceo', 'coo')
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('manager', 'director', 'project_manager')
    )
  );

CREATE POLICY "Staff insert own logs only"
  ON public.sales_daily_logs
  FOR INSERT
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Staff update own drafts only"
  ON public.sales_daily_logs
  FOR UPDATE
  USING (
    staff_id = auth.uid()
    AND status = 'draft'
  );

CREATE POLICY "Managers delete logs (audit trail)"
  ON public.sales_daily_logs
  FOR DELETE
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'ceo', 'coo')
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('manager', 'director', 'project_manager')
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_daily_logs;
