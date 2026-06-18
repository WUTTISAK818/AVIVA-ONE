-- Contractor Scorecard Period
CREATE TABLE public.contractor_scorecard_period (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contractor_scorecard_period_project ON public.contractor_scorecard_period(project_id);

-- Contractor Scorecard (Quality, Timeliness, Approval metrics)
CREATE TABLE public.contractor_scorecard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_line_id text,
  contractor_name text NOT NULL,
  period_id uuid REFERENCES public.contractor_scorecard_period(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Quality metrics
  quality_score numeric(4,2) NOT NULL DEFAULT 0,
  defect_count integer NOT NULL DEFAULT 0,
  defect_critical_count integer NOT NULL DEFAULT 0,
  defect_high_count integer NOT NULL DEFAULT 0,
  defect_resolved_pct numeric(5,2) NOT NULL DEFAULT 0,

  -- Schedule metrics
  timeliness_score numeric(4,2) NOT NULL DEFAULT 0,
  on_time_count integer NOT NULL DEFAULT 0,
  delayed_count integer NOT NULL DEFAULT 0,
  avg_days_late numeric(5,2),

  -- Approval metrics
  approval_rate numeric(5,2) NOT NULL DEFAULT 0,
  total_submissions integer NOT NULL DEFAULT 0,
  approved_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,

  -- Composite score
  composite_score numeric(4,2) NOT NULL DEFAULT 0,
  performance_tier text CHECK (performance_tier IN ('A', 'B', 'C', 'D')),

  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contractor_scorecard_period ON public.contractor_scorecard(period_id, project_id);
CREATE INDEX idx_contractor_scorecard_name ON public.contractor_scorecard(contractor_name, project_id);

-- Inspection Sign-off Workflow
CREATE TABLE public.inspection_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL REFERENCES public.contractor_installments(id) ON DELETE CASCADE,
  house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,

  -- Photo evidence
  photo_url_before text,
  photo_url_after text,

  -- Sign-off chain
  inspected_by text NOT NULL,
  inspected_at timestamptz NOT NULL,

  approved_by text,
  approved_at timestamptz,

  owner_signed_by text,
  owner_signed_at timestamptz,

  -- Gating logic
  all_items_passed boolean NOT NULL DEFAULT false,
  no_open_defects boolean NOT NULL DEFAULT false,
  next_stage text,

  -- Notes
  inspection_notes text,
  approval_notes text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspection_signoffs_installment ON public.inspection_signoffs(installment_id);
CREATE INDEX idx_inspection_signoffs_house ON public.inspection_signoffs(house_id);

-- Readiness view (gate conditions)
CREATE OR REPLACE VIEW public.vw_inspection_readiness AS
SELECT
  ci.id as installment_id,
  ci.house_id,
  h.house_number,
  ci.installment_no,
  ci.name,
  (SELECT COUNT(*) FROM public.installment_inspections iinsp
   WHERE iinsp.contractor_installment_id = ci.id) as total_items,
  (SELECT COUNT(*) FROM public.installment_inspections iinsp
   WHERE iinsp.contractor_installment_id = ci.id AND iinsp.result = 'pass') as passed_items,
  (SELECT COUNT(*) FROM public.qc_defects qd
   WHERE qd.house_id = ci.house_id AND qd.status IN ('open', 'in_progress')) as open_defects,
  CASE
    WHEN (SELECT COUNT(*) FROM public.installment_inspections iinsp
          WHERE iinsp.contractor_installment_id = ci.id AND iinsp.result != 'pass') > 0
    THEN 'blocked_by_inspection'
    WHEN (SELECT COUNT(*) FROM public.qc_defects qd
          WHERE qd.house_id = ci.house_id AND qd.status IN ('open', 'in_progress')) > 0
    THEN 'blocked_by_defect'
    ELSE 'ready_to_sign_off'
  END as readiness_status
FROM public.contractor_installments ci
JOIN public.houses h ON h.id = ci.house_id
WHERE ci.status = 'in_review';

-- Row Level Security
ALTER TABLE public.contractor_scorecard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers see contractor scorecard"
  ON public.contractor_scorecard
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'ceo', 'coo')
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('manager', 'director', 'project_manager')
    )
  );

CREATE POLICY "Engineers see inspection signoffs"
  ON public.inspection_signoffs
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Engineers create signoffs"
  ON public.inspection_signoffs
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Managers approve signoffs"
  ON public.inspection_signoffs
  FOR UPDATE
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'ceo', 'coo')
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('manager', 'director', 'project_manager')
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.contractor_scorecard;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inspection_signoffs;
