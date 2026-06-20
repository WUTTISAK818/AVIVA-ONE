-- AVIVA ONE v6.46
-- Activity Logging System Installation (CORRECTED SEQUENCE)
-- ติดตั้ง automatic activity logging สำหรับ:
-- 1. Construction (ก่อสร้าง)
-- 2. Finance (การเงิน)
-- 3. HR (ทรัพยากรบุคคล)

-- ========================================
-- PREREQUISITE STEP 1: PAYMENT_VOUCHERS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.payment_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  house_id UUID NOT NULL REFERENCES public.houses(id),
  contractor_id UUID NOT NULL,

  milestone_id UUID,
  stage_name VARCHAR(100),

  base_amount DECIMAL(12, 2) NOT NULL,
  days_late INTEGER DEFAULT 0,
  daily_penalty_rate DECIMAL(10, 2) DEFAULT 0,
  penalty_amount DECIMAL(12, 2) DEFAULT 0,

  gross_amount DECIMAL(12, 2) NOT NULL,
  tax_3percent DECIMAL(12, 2) DEFAULT 0,
  retention_rate DECIMAL(5, 2) DEFAULT 5.0,
  retention_amount DECIMAL(12, 2) DEFAULT 0,
  net_amount DECIMAL(12, 2) NOT NULL,

  status VARCHAR(50) DEFAULT 'draft',
  submitted_by UUID,
  submitted_at TIMESTAMP,
  approved_by UUID,
  approved_at TIMESTAMP,
  rejected_reason TEXT,
  paid_at TIMESTAMP,
  paid_reference VARCHAR(100),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_status CHECK (status IN ('draft', 'submitted', 'approved', 'paid', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_payment_vouchers_project ON public.payment_vouchers(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_contractor ON public.payment_vouchers(contractor_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_status ON public.payment_vouchers(status);

-- ========================================
-- PREREQUISITE STEP 2: DAILY ACTIVITY LOG TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.daily_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),

  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_type VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,

  performer_id UUID,
  performer_name VARCHAR(255),
  performer_department VARCHAR(100),

  description TEXT NOT NULL,
  quantity NUMERIC(10, 2),
  amount DECIMAL(12, 2),

  reference_id UUID,
  reference_type VARCHAR(50),

  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_activity_log_project ON public.daily_activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_log_date ON public.daily_activity_log(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_activity_log_type ON public.daily_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_daily_activity_log_performer ON public.daily_activity_log(performer_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_log_reference ON public.daily_activity_log(reference_type, reference_id);

ALTER TABLE public.daily_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS daily_activity_select ON public.daily_activity_log
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY IF NOT EXISTS daily_activity_insert ON public.daily_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

-- ========================================
-- MIGRATION 1: CONSTRUCTION ACTIVITY LOGGING
-- ========================================

CREATE OR REPLACE FUNCTION public.log_construction_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_house_model VARCHAR;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
BEGIN
  SELECT house_model INTO v_house_model FROM public.houses WHERE id = NEW.id;
  IF NEW.updated_by IS NOT NULL THEN
    SELECT full_name, department INTO v_performer_name, v_performer_dept
    FROM auth.users WHERE id = NEW.updated_by;
  ELSE
    v_performer_name := 'System';
    v_performer_dept := 'Construction';
  END IF;
  IF NEW.progress != OLD.progress THEN
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE, 'construction', 'progress', NEW.updated_by, v_performer_name,
      v_performer_dept, 'ความคืบหน้า ' || v_house_model || ': ' || NEW.progress || '% (ก่อนหน้า ' || OLD.progress || '%)',
      1, NULL, NEW.id, 'houses', NEW.project_id, NEW.updated_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS construction_progress_log ON public.houses;
CREATE TRIGGER construction_progress_log AFTER UPDATE ON public.houses
  FOR EACH ROW
  WHEN (NEW.progress IS DISTINCT FROM OLD.progress)
  EXECUTE FUNCTION public.log_construction_progress();

CREATE OR REPLACE FUNCTION public.log_qc_defect()
RETURNS TRIGGER AS $$
DECLARE
  v_house_model VARCHAR;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT house_model INTO v_house_model FROM public.houses WHERE id = NEW.house_id;
    IF NEW.created_by IS NOT NULL THEN
      SELECT full_name, department INTO v_performer_name, v_performer_dept
      FROM auth.users WHERE id = NEW.created_by;
    ELSE
      v_performer_name := 'System';
      v_performer_dept := 'QC';
    END IF;
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE, 'construction', 'qc_defect', NEW.created_by, v_performer_name,
      v_performer_dept, 'พบข้อบกพร่อง ' || v_house_model || ': ' || NEW.defect_description,
      1, NULL, NEW.id, 'qc_defects', (SELECT project_id FROM public.houses WHERE id = NEW.house_id),
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS qc_defect_log ON public.qc_defects;
CREATE TRIGGER qc_defect_log AFTER INSERT ON public.qc_defects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_qc_defect();

-- ========================================
-- MIGRATION 2: FINANCE ACTIVITY LOGGING
-- ========================================

CREATE OR REPLACE FUNCTION public.log_payment_voucher()
RETURNS TRIGGER AS $$
DECLARE
  v_house_model VARCHAR;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
  v_performer_id UUID;
BEGIN
  SELECT house_model INTO v_house_model FROM public.houses WHERE id = NEW.house_id;
  IF NEW.status = 'submitted' AND NEW.submitted_by IS NOT NULL THEN
    v_performer_id := NEW.submitted_by;
    SELECT full_name, department INTO v_performer_name, v_performer_dept
    FROM auth.users WHERE id = NEW.submitted_by;
  ELSIF NEW.status = 'approved' AND NEW.approved_by IS NOT NULL THEN
    v_performer_id := NEW.approved_by;
    SELECT full_name, department INTO v_performer_name, v_performer_dept
    FROM auth.users WHERE id = NEW.approved_by;
  ELSIF NEW.status = 'paid' THEN
    v_performer_id := NULL;
    v_performer_name := 'System';
    v_performer_dept := 'Finance';
  ELSE
    v_performer_id := NULL;
    v_performer_name := 'System';
    v_performer_dept := 'Finance';
  END IF;
  IF NEW.status != OLD.status THEN
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE, 'finance', LOWER(NEW.status), v_performer_id, v_performer_name,
      v_performer_dept, 'เอกสารชำระเงิน ' || COALESCE(NEW.stage_name, v_house_model) || ': ' ||
        CASE
          WHEN NEW.status = 'submitted' THEN 'ยื่นขออนุมัติ'
          WHEN NEW.status = 'approved' THEN 'อนุมัติแล้ว'
          WHEN NEW.status = 'paid' THEN 'ชำระเงินแล้ว'
          WHEN NEW.status = 'rejected' THEN 'ปฏิเสธ'
          ELSE NEW.status
        END,
      1, NEW.net_amount, NEW.id, 'payment_vouchers', NEW.project_id, v_performer_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_voucher_log ON public.payment_vouchers;
CREATE TRIGGER payment_voucher_log AFTER UPDATE ON public.payment_vouchers
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.log_payment_voucher();

-- ========================================
-- MIGRATION 3: HR ACTIVITY LOGGING
-- ========================================

CREATE OR REPLACE FUNCTION public.log_leave_request()
RETURNS TRIGGER AS $$
DECLARE
  v_performer_id UUID;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
BEGIN
  IF NEW.status = 'approved' AND NEW.approved_by IS NOT NULL THEN
    v_performer_name := NEW.approved_by;
    v_performer_dept := 'HR';
    v_performer_id := NULL;
  ELSE
    v_performer_name := 'System';
    v_performer_dept := 'HR';
    v_performer_id := NULL;
  END IF;
  IF NEW.status != OLD.status THEN
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE, 'hr', LOWER(NEW.status), v_performer_id, v_performer_name,
      v_performer_dept, 'การลา ' || NEW.leave_type || ': ' || NEW.employee_name || ' (' || NEW.days_count || ' วัน) - ' ||
        CASE
          WHEN NEW.status = 'approved' THEN 'อนุมัติแล้ว'
          WHEN NEW.status = 'rejected' THEN 'ปฏิเสธ'
          ELSE NEW.status
        END,
      NEW.days_count, NULL, NEW.id, 'leave_requests',
      COALESCE((SELECT project_id FROM public.projects LIMIT 1), gen_random_uuid()),
      v_performer_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leave_request_log ON public.leave_requests;
CREATE TRIGGER leave_request_log AFTER UPDATE ON public.leave_requests
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.log_leave_request();

-- ========================================
-- END: ALL MIGRATIONS COMPLETED
-- ========================================
