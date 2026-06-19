-- Add construction activity logging triggers

-- Trigger 1: Log when house progress updates
CREATE OR REPLACE FUNCTION public.log_construction_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_house_model VARCHAR;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
BEGIN
  -- Get house model
  SELECT house_model INTO v_house_model FROM public.houses WHERE id = NEW.id;

  -- Get performer info from updated_by (if available)
  IF NEW.updated_by IS NOT NULL THEN
    SELECT full_name, department INTO v_performer_name, v_performer_dept
    FROM auth.users WHERE id = NEW.updated_by;
  ELSE
    v_performer_name := 'System';
    v_performer_dept := 'Construction';
  END IF;

  -- Only log if progress changed
  IF NEW.progress != OLD.progress THEN
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE,
      'construction',
      'progress',
      NEW.updated_by,
      v_performer_name,
      v_performer_dept,
      'ความคืบหน้า ' || v_house_model || ': ' || NEW.progress || '% (ก่อนหน้า ' || OLD.progress || '%)',
      1,
      NULL,
      NEW.id,
      'houses',
      NEW.project_id,
      NEW.updated_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: บันทึก activity เมื่อ house progress update
DROP TRIGGER IF EXISTS construction_progress_log ON public.houses;
CREATE TRIGGER construction_progress_log AFTER UPDATE ON public.houses
  FOR EACH ROW
  WHEN (NEW.progress IS DISTINCT FROM OLD.progress)
  EXECUTE FUNCTION public.log_construction_progress();

-- Trigger 2: Log QC defects
CREATE OR REPLACE FUNCTION public.log_qc_defect()
RETURNS TRIGGER AS $$
DECLARE
  v_house_model VARCHAR;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
BEGIN
  -- Only log on insert
  IF TG_OP = 'INSERT' THEN
    -- Get house model
    SELECT house_model INTO v_house_model FROM public.houses
    WHERE id = NEW.house_id;

    -- Get performer info
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
      CURRENT_DATE,
      'construction',
      'qc_defect',
      NEW.created_by,
      v_performer_name,
      v_performer_dept,
      'พบข้อบกพร่อง ' || v_house_model || ': ' || NEW.defect_description,
      1,
      NULL,
      NEW.id,
      'qc_defects',
      (SELECT project_id FROM public.houses WHERE id = NEW.house_id),
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: บันทึก QC defect เมื่อเพิ่มใหม่
DROP TRIGGER IF EXISTS qc_defect_log ON public.qc_defects;
CREATE TRIGGER qc_defect_log AFTER INSERT ON public.qc_defects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_qc_defect();

COMMENT ON FUNCTION public.log_construction_progress() IS 'บันทึก activity เมื่อความคืบหน้าของหน่วยเปลี่ยน';
COMMENT ON FUNCTION public.log_qc_defect() IS 'บันทึก activity เมื่อพบข้อบกพร่อง QC';
