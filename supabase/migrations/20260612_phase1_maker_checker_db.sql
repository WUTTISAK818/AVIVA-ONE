-- ================================================================
-- AVIVA ONE — Phase 1: Maker-Checker enforcement (DB) + audit append-only
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP apply_migration
-- ================================================================
-- บริบท: เดิม maker-checker/2-ชั้น บังคับฝั่ง client เท่านั้น (bypass ได้)
-- แก้: บังคับระดับ DB ด้วย trigger + ผูกผู้ยื่นด้วย auth user id
-- ปลอดภัย: column nullable, trigger เช็คเฉพาะ record ที่มี submitted_by_user_id (ของใหม่)
--   และข้าม service-role (auth.uid() = NULL)
-- ================================================================

ALTER TABLE public.approval_logs ADD COLUMN IF NOT EXISTS submitted_by_user_id uuid;

CREATE OR REPLACE FUNCTION public.enforce_approval_maker_checker()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.action_taken IN ('Approved','Rejected')
     AND coalesce(OLD.action_taken,'Pending') = 'Pending'
     AND NEW.submitted_by_user_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND auth.uid() = NEW.submitted_by_user_id THEN
    RAISE EXCEPTION 'Maker-Checker: ผู้อนุมัติต้องไม่ใช่ผู้ยื่นคำขอ';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approval_maker_checker ON public.approval_logs;
CREATE TRIGGER trg_approval_maker_checker
  BEFORE UPDATE ON public.approval_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_approval_maker_checker();

-- Audit log = append-only (insert + select เท่านั้น)
DROP POLICY IF EXISTS audit_authenticated_all ON public.audit_log;
CREATE POLICY audit_authenticated_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY audit_authenticated_select ON public.audit_log FOR SELECT TO authenticated USING (true);

-- ================================================================
-- โค้ดที่เกี่ยวข้อง: เพิ่ม submitted_by_user_id = user.id (auth.uid) ทุกจุดสร้างคำขอ
--   [2nd Approval] ใช้ submitted_by_user_id ของผู้ยื่นเดิม
-- คงเหลือ Phase 1b: RPC อนุมัติฝั่ง DB (รวม 3 เส้นทาง + เช็ค role + escalate),
--   RLS scoping ตาม project_id/role, เกณฑ์วงเงินให้สอดคล้อง, mask เลขบัตร
-- ================================================================
