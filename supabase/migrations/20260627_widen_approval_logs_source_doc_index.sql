-- บั๊ก: approval_logs.source_doc_index เป็น varchar(50) แต่รูปแบบจริง
-- "DOCNUM | title | โดย name" ยาวเกิน 50 ตัวอักษร → insert approval_logs ของ flow อนุมัติ
-- (งวดงาน/ใบลา ฯลฯ) ล้มเหลวเงียบ ๆ เพราะหุ้มด้วย best-effort try/catch
-- ผลคือเกิดงาน "กำพร้า" ใน work_queue ที่ไม่มีคำขออนุมัติจริง → ค้างกล่องงาน กดแล้วไปต่อไม่ได้
-- แก้: ขยายเป็น text (ไม่จำกัดความยาว) — ต้อง drop view ที่ผูกอยู่ก่อนแล้วสร้างใหม่
DROP VIEW IF EXISTS public.approval_overdue;
ALTER TABLE public.approval_logs ALTER COLUMN source_doc_index TYPE text;
CREATE VIEW public.approval_overdue AS
  SELECT approval_id, workflow_type, source_doc_index, amount, sla_due_at,
         assigned_to_name, current_approver_role,
         now() - sla_due_at AS overdue_duration
  FROM approval_logs
  WHERE action_taken::text = 'Pending'::text AND sla_due_at IS NOT NULL AND sla_due_at < now();
