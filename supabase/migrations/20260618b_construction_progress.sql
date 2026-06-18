-- Construction Unit Progress Tracking
-- Tracks completion percentage and stage for each house

CREATE TABLE public.construction_unit_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  current_stage text NOT NULL CHECK (current_stage IN ('foundation', 'frame', 'roof', 'finishing', 'handover')),
  stage_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (stage_percentage >= 0 AND stage_percentage <= 100),
  overall_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (overall_percentage >= 0 AND overall_percentage <= 100),
  last_inspection_date timestamptz,
  next_milestone_date date,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_construction_progress_house ON public.construction_unit_progress(house_id);
CREATE INDEX idx_construction_progress_stage ON public.construction_unit_progress(current_stage);

-- Computed View for real-time progress
CREATE OR REPLACE VIEW public.vw_construction_progress AS
SELECT
  h.id,
  h.house_number,
  h.project_id,
  cup.current_stage,
  cup.stage_percentage,
  cup.overall_percentage,
  (SELECT COUNT(*) FROM public.contractor_installments ci
   WHERE ci.house_id = h.id AND ci.status = 'paid') as completed_stages,
  (SELECT COUNT(*) FROM public.contractor_installments ci
   WHERE ci.house_id = h.id) as total_stages,
  (SELECT COUNT(*) FROM public.qc_defects qd
   WHERE qd.house_id = h.id AND qd.status = 'open') as open_defects,
  cup.updated_at
FROM public.houses h
LEFT JOIN public.construction_unit_progress cup ON h.id = cup.house_id;

-- Row Level Security
ALTER TABLE public.construction_unit_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users see progress"
  ON public.construction_unit_progress
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin and managers update progress"
  ON public.construction_unit_progress
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
ALTER PUBLICATION supabase_realtime ADD TABLE public.construction_unit_progress;
