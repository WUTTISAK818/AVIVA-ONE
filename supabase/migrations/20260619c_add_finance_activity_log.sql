-- Add finance activity logging triggers

-- Trigger 1: Log when payment vouchers status changes
CREATE OR REPLACE FUNCTION public.log_payment_voucher()
RETURNS TRIGGER AS $$
DECLARE
  v_house_model VARCHAR;
  v_performer_name VARCHAR;
  v_performer_dept VARCHAR;
  v_performer_id UUID;
BEGIN
  -- Get house model
  SELECT house_model INTO v_house_model FROM public.houses WHERE id = NEW.house_id;

  -- Determine performer based on the status change
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

  -- Only log on status change
  IF NEW.status != OLD.status THEN
    INSERT INTO public.daily_activity_log (
      activity_date, activity_type, category, performer_id, performer_name,
      performer_department, description, quantity, amount, reference_id,
      reference_type, project_id, created_by
    ) VALUES (
      CURRENT_DATE,
      'finance',
      LOWER(NEW.status),
      v_performer_id,
      v_performer_name,
      v_performer_dept,
      'เอกสารชำระเงิน ' || COALESCE(NEW.stage_name, v_house_model) || ': ' ||
        CASE
          WHEN NEW.status = 'submitted' THEN 'ยื่นขออนุมัติ'
          WHEN NEW.status = 'approved' THEN 'อนุมัติแล้ว'
          WHEN NEW.status = 'paid' THEN 'ชำระเงินแล้ว'
          WHEN NEW.status = 'rejected' THEN 'ปฏิเสธ'
          ELSE NEW.status
        END,
      1,
      NEW.net_amount,
      NEW.id,
      'payment_vouchers',
      NEW.project_id,
      v_performer_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: บันทึก activity เมื่อ payment voucher status update
DROP TRIGGER IF EXISTS payment_voucher_log ON public.payment_vouchers;
CREATE TRIGGER payment_voucher_log AFTER UPDATE ON public.payment_vouchers
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.log_payment_voucher();

COMMENT ON FUNCTION public.log_payment_voucher() IS 'บันทึก activity เมื่อสถานะเอกสารชำระเงินเปลี่ยน';
