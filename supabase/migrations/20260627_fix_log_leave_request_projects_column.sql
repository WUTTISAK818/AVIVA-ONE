-- บั๊ก: trigger log_leave_request() อ้าง (SELECT project_id FROM public.projects) แต่ตาราง projects
-- ใช้คอลัมน์ชื่อ id (ไม่มี project_id) → ทุกครั้งที่ UPDATE leave_requests.status จะ error
-- ทำให้ "อนุมัติ/ปฏิเสธใบลา" จากกล่องงานล้มเหลว (งานค้าง ทำต่อไม่ได้)
-- แก้: project_id → id ในซับคิวรี
CREATE OR REPLACE FUNCTION public.log_leave_request()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
      COALESCE((SELECT id FROM public.projects LIMIT 1), gen_random_uuid()),
      v_performer_id
    );
  END IF;
  RETURN NEW;
END;
$function$;
