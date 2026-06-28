-- v6.83 — ระบบหักยอดวันลาอัตโนมัติ + ขาดงาน + ใบรับรองแพทย์
-- แก้ Audit #5: อนุมัติใบลาไม่หักยอดวันลา

-- 1) เพิ่มคอลัมน์ลากิจ + ลาคลอด + ขาดงาน ใน employee_payroll_config
ALTER TABLE public.employee_payroll_config ADD COLUMN IF NOT EXISTS personal_leave_entitlement integer DEFAULT 3;
ALTER TABLE public.employee_payroll_config ADD COLUMN IF NOT EXISTS personal_leave_used integer DEFAULT 0;
ALTER TABLE public.employee_payroll_config ADD COLUMN IF NOT EXISTS maternity_leave_entitlement integer DEFAULT 98;
ALTER TABLE public.employee_payroll_config ADD COLUMN IF NOT EXISTS maternity_leave_used integer DEFAULT 0;
ALTER TABLE public.employee_payroll_config ADD COLUMN IF NOT EXISTS absent_days integer DEFAULT 0;

-- personal_leave_balance + maternity_leave_balance เป็น GENERATED columns (เหมือน annual/sick/study)
ALTER TABLE public.employee_payroll_config DROP COLUMN IF EXISTS personal_leave_balance;
ALTER TABLE public.employee_payroll_config ADD COLUMN personal_leave_balance integer
  GENERATED ALWAYS AS (personal_leave_entitlement - personal_leave_used) STORED;

ALTER TABLE public.employee_payroll_config DROP COLUMN IF EXISTS maternity_leave_balance;
ALTER TABLE public.employee_payroll_config ADD COLUMN maternity_leave_balance integer
  GENERATED ALWAYS AS (maternity_leave_entitlement - maternity_leave_used) STORED;

-- 2) เพิ่มคอลัมน์ใบรับรองแพทย์ + หมายเหตุ ใน leave_requests
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS doctor_cert_required boolean DEFAULT false;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS doctor_cert_provided boolean DEFAULT false;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS original_leave_type text;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS admin_note text;

-- 3) Trigger: หักยอดวันลาอัตโนมัติเมื่ออนุมัติ / คืนยอดเมื่อปฏิเสธ
-- หมายเหตุ: balance columns เป็น GENERATED ทั้งหมด → trigger อัปเดตเฉพาะ _used columns
CREATE OR REPLACE FUNCTION public.trg_leave_balance_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE
  _emp_id uuid;
  _used_col text;
  _days integer;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  _days := COALESCE(NEW.days_count, 1);
  _emp_id := NEW.employee_id;

  -- ถ้า employee_id null → หา employee_id จากชื่อ
  IF _emp_id IS NULL AND NEW.employee_name IS NOT NULL THEN
    SELECT id INTO _emp_id FROM public.employees WHERE full_name = NEW.employee_name LIMIT 1;
  END IF;

  -- ถ้ายังหาไม่เจอ → ข้ามไป (ข้อมูลเก่า/ทดสอบ)
  IF _emp_id IS NULL THEN RETURN NEW; END IF;

  -- map leave_type → used column
  CASE NEW.leave_type
    WHEN 'ลาพักร้อน' THEN _used_col := 'annual_leave_used';
    WHEN 'ลาป่วย'    THEN _used_col := 'sick_leave_used';
    WHEN 'ลากิจ'     THEN _used_col := 'personal_leave_used';
    WHEN 'ลาคลอด'   THEN _used_col := 'maternity_leave_used';
    WHEN 'ขาดงาน'   THEN
      IF NEW.status = 'approved' AND COALESCE(OLD.status, 'pending') IN ('pending', 'Pending') THEN
        UPDATE public.employee_payroll_config
        SET absent_days = COALESCE(absent_days, 0) + _days, updated_at = now()
        WHERE employee_id = _emp_id;
      ELSIF OLD.status = 'approved' AND NEW.status IN ('rejected', 'cancelled', 'pending') THEN
        UPDATE public.employee_payroll_config
        SET absent_days = GREATEST(0, COALESCE(absent_days, 0) - _days), updated_at = now()
        WHERE employee_id = _emp_id;
      END IF;
      RETURN NEW;
    ELSE RETURN NEW;
  END CASE;

  -- อนุมัติ: หักยอด (เพิ่ม _used → balance ลดอัตโนมัติผ่าน GENERATED column)
  IF NEW.status = 'approved' AND COALESCE(OLD.status, 'pending') IN ('pending', 'Pending') THEN
    EXECUTE format(
      'UPDATE public.employee_payroll_config SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE employee_id = $2',
      _used_col, _used_col
    ) USING _days, _emp_id;
  END IF;

  -- ปฏิเสธ/ยกเลิกหลังอนุมัติ: คืนยอด (ลด _used → balance เพิ่มอัตโนมัติ)
  IF OLD.status = 'approved' AND NEW.status IN ('rejected', 'cancelled', 'pending') THEN
    EXECUTE format(
      'UPDATE public.employee_payroll_config SET %I = GREATEST(0, COALESCE(%I, 0) - $1), updated_at = now() WHERE employee_id = $2',
      _used_col, _used_col
    ) USING _days, _emp_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_balance_auto ON public.leave_requests;
CREATE TRIGGER trg_leave_balance_auto
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_leave_balance_update();
