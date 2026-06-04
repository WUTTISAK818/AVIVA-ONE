-- ================================================================
-- AVIVA ONE v2.9.16 — Audit Hardening & Delete Prevention
-- ================================================================
-- วิธีใช้: รัน SQL นี้ใน Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. ป้องกัน DELETE บน approval_logs สำหรับ Approved/Rejected records
CREATE OR REPLACE FUNCTION prevent_approval_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.action_taken IN ('Approved', 'Rejected') THEN
    RAISE EXCEPTION 'Cannot delete completed approval log (immutable audit trail)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_delete_approval_log ON approval_logs;
CREATE TRIGGER trg_no_delete_approval_log
  BEFORE DELETE ON approval_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_approval_log_delete();

-- 2. เพิ่ม column ใน audit_log สำหรับ role/dept tracking
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS performed_by_role TEXT,
  ADD COLUMN IF NOT EXISTS performed_by_dept TEXT,
  ADD COLUMN IF NOT EXISTS timestamp          TIMESTAMPTZ DEFAULT NOW();

-- 3. index ใหม่บน audit_log สำหรับ performance
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at
  ON audit_log (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_module_action
  ON audit_log (module, action);

-- 4. เพิ่ม approved_by_role ใน leave_requests
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS approved_by_role TEXT;

-- ================================================================
-- v2.9.16 deployment checklist:
-- [x] DELETE prevention trigger on approval_logs
-- [x] audit_log schema upgrade (role/dept/timestamp)
-- [x] leave_requests approved_by_role column
-- ================================================================
