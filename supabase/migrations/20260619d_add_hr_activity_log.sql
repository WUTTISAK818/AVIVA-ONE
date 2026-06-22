-- Add HR activity logging triggers

-- Trigger 1: Log when leave requests status changes
CREATE OR REPLACE FUNCTION public.log_leave_request()
RETURNS TRIGGER AS $$
DECLARE
  v_performer_id UUID;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
BEGIN
  -- Get approver info from approved_by field
  IF NEW.status = 'approved' AND NEW.approved_by IS NOT NULL THEN
    v_performer_name := NEW.approved_by;
    v_performer_dept := 'HR';
    v_performer_id := NULL;
  ELSE
    v_performer_name := 'System';
    v_performer_dept := 'HR';
    v_performer_id := NULL;
  END IF;

  -- Only log on status change to approved or rejected
  IF NEW.status != OLD.status THEN
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE,
      'hr',
      LOWER(NEW.status),
      v_performer_id,
      v_performer_name,
      v_performer_dept,
      'การลา ' || NEW.leave_type || ': ' || NEW.employee_name || ' (' || NEW.days_count || ' วัน) - ' ||
        CASE
          WHEN NEW.status = 'approved' THEN 'อนุมัติแล้ว'
          WHEN NEW.status = 'rejected' THEN 'ปฏิเสธ'
          ELSE NEW.status
        END,
      NEW.days_count,
      NULL,
      NEW.id,
      'leave_requests',
      COALESCE((SELECT project_id FROM public.projects LIMIT 1), gen_random_uuid()),
      v_performer_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: บันทึก activity เมื่อ leave request status update
DROP TRIGGER IF EXISTS leave_request_log ON public.leave_requests;
CREATE TRIGGER leave_request_log AFTER UPDATE ON public.leave_requests
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.log_leave_request();

COMMENT ON FUNCTION public.log_leave_request() IS 'บันทึก activity เมื่อสถานะคำขอลาเปลี่ยน';
