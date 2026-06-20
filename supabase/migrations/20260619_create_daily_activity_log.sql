-- Create daily_activity_log table for Activity Calendar
CREATE TABLE public.daily_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Activity details
  activity_date DATE NOT NULL,
  activity_type VARCHAR NOT NULL, -- 'sale', 'construction', 'finance', 'approval', 'hr'
  category VARCHAR NOT NULL, -- 'booking', 'contract', 'payment', 'defect', 'clock_in', etc.
  
  -- Performer info
  performer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performer_name VARCHAR,
  performer_department VARCHAR,
  
  -- Activity summary
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  amount DECIMAL(15,2),
  
  -- Reference to original record
  reference_id UUID,
  reference_type VARCHAR, -- 'leads', 'houses', 'payment_vouchers', 'qc_defects', 'crm_logs'
  
  -- Metadata
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_activity_type CHECK (activity_type IN ('sale', 'construction', 'finance', 'approval', 'hr')),
  CONSTRAINT activity_date_not_future CHECK (activity_date <= CURRENT_DATE)
);

-- Indexes for query performance
CREATE INDEX idx_daily_activity_log_date ON public.daily_activity_log(activity_date DESC);
CREATE INDEX idx_daily_activity_log_type ON public.daily_activity_log(activity_type);
CREATE INDEX idx_daily_activity_log_project ON public.daily_activity_log(project_id);
CREATE INDEX idx_daily_activity_log_performer ON public.daily_activity_log(performer_id);
CREATE INDEX idx_daily_activity_log_reference ON public.daily_activity_log(reference_type, reference_id);

-- Enable RLS
ALTER TABLE public.daily_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: ให้บรรทัดถูกตั้ง project ที่ user รับผิดชอบ (แสดงได้สำหรับผู้บริหาร/manager)
CREATE POLICY "Allow view for project members and managers"
  ON public.daily_activity_log
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM public.user_projects 
      WHERE user_id = auth.uid()
    ) OR 
    (SELECT auth_role() FROM auth.users WHERE id = auth.uid()) IN ('admin', 'ceo', 'coo')
  );

-- RLS Policy: ให้ insert activity log (system/app)
CREATE POLICY "Allow insert for system and app"
  ON public.daily_activity_log
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM public.user_projects 
      WHERE user_id = auth.uid()
    ) OR
    (SELECT auth_role() FROM auth.users WHERE id = auth.uid()) IN ('admin', 'ceo', 'coo')
  );

-- Function: log_lead_activity (เมื่อ lead change status)
CREATE OR REPLACE FUNCTION public.log_lead_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log on status change
  IF NEW.status != OLD.status THEN
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE,
      'sale',
      LOWER(NEW.status),
      NEW.updated_by,
      (SELECT full_name FROM auth.users WHERE id = NEW.updated_by),
      (SELECT department FROM auth.users WHERE id = NEW.updated_by),
      CASE 
        WHEN NEW.status = 'Booking' THEN 'นำเสนอ + จอง: ' || NEW.customer_name
        WHEN NEW.status = 'Contract' THEN 'ทำสัญญา: ' || NEW.customer_name
        WHEN NEW.status = 'Closed Deal' THEN 'โอนกรรมสิทธิ์: ' || NEW.customer_name
        ELSE NEW.status || ': ' || NEW.customer_name
      END,
      1,
      NEW.contract_price,
      NEW.id,
      'leads',
      NEW.project_id,
      NEW.updated_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: บันทึก activity เมื่อ lead change
CREATE TRIGGER lead_activity_log AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_lead_activity();

COMMENT ON TABLE public.daily_activity_log IS 'เก็บ activity log ประจำวัน สำหรับแสดงในปฏิทิน';
COMMENT ON COLUMN public.daily_activity_log.activity_type IS 'ประเภท: sale, construction, finance, approval, hr';
COMMENT ON COLUMN public.daily_activity_log.reference_type IS 'ชนิดข้อมูล: leads, houses, payment_vouchers, qc_defects, etc.';
