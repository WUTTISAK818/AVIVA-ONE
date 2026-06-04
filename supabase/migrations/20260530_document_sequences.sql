-- ================================================================
-- AVIVA ONE v2.9.15 — Document Sequences (Atomic Counter)
-- ================================================================
-- วิธีใช้: รัน SQL นี้ใน Supabase Dashboard → SQL Editor
-- จุดประสงค์: ป้องกัน race condition ในการออกเลขที่เอกสาร
-- ================================================================

-- 1. ตาราง document_sequences สำหรับเก็บลำดับเลขเอกสารแต่ละประเภท
CREATE TABLE IF NOT EXISTS document_sequences (
  workflow_type  TEXT PRIMARY KEY,
  prefix         TEXT NOT NULL,
  year           INTEGER NOT NULL,
  last_seq       INTEGER NOT NULL DEFAULT 0,
  total_issued   BIGINT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Seed ค่าเริ่มต้น (ระบบจะอัปเดตอัตโนมัติเมื่อมีการใช้งาน)
INSERT INTO document_sequences (workflow_type, prefix, year, last_seq)
VALUES
  ('Finance_Approval',   'FIN',      2026, 0),
  ('Material_Purchase',  'PO',       2026, 0),
  ('Installment_Review', 'INST',     2026, 0),
  ('Leave_Request',      'LEAVE',    2026, 0),
  ('Document_Approval',  'DOC',      2026, 0),
  ('Booking_Deposit',    'BOOK',     2026, 0),
  ('Contract_Approval',  'CONTRACT', 2026, 0),
  ('Marketing_Budget',   'MKTG',     2026, 0),
  ('Warranty_Claim',     'WR',       2026, 0)
ON CONFLICT (workflow_type) DO NOTHING;

-- RLS
ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read document_sequences"
  ON document_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update document_sequences"
  ON document_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Function: next_doc_number — Atomic increment (ป้องกัน race condition)
--    ใช้ FOR UPDATE SKIP LOCKED เพื่อรองรับ concurrent requests
CREATE OR REPLACE FUNCTION next_doc_number(p_workflow_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year    INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_seq     INTEGER;
  v_prefix  TEXT;
BEGIN
  -- Lock row สำหรับ workflow_type นี้
  SELECT prefix, last_seq INTO v_prefix, v_seq
  FROM document_sequences
  WHERE workflow_type = p_workflow_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown workflow_type: %', p_workflow_type;
  END IF;

  -- Reset ลำดับถ้าเปลี่ยนปี
  IF v_seq IS NULL OR (SELECT year FROM document_sequences WHERE workflow_type = p_workflow_type) != v_year THEN
    v_seq := 0;
  END IF;

  v_seq := v_seq + 1;

  UPDATE document_sequences
  SET last_seq   = v_seq,
      year       = v_year,
      total_issued = total_issued + 1,
      updated_at = NOW()
  WHERE workflow_type = p_workflow_type;

  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$;

-- 3. ตาราง document_registry_view — View รวมข้อมูลเอกสารทั้งหมด
--    Admin/Executive ใช้ query ตรงได้ โดยไม่ต้อง parse source_doc_index
CREATE OR REPLACE VIEW document_registry AS
SELECT
  al.approval_id,
  split_part(al.source_doc_index, ' | ', 1)                         AS doc_number,
  al.workflow_type,
  CASE al.workflow_type
    WHEN 'Finance_Approval'   THEN 'ขออนุมัติรายจ่าย'
    WHEN 'Material_Purchase'  THEN 'ขออนุมัติจัดซื้อวัสดุ'
    WHEN 'Installment_Review' THEN 'ตรวจสอบงวดงาน'
    WHEN 'Leave_Request'      THEN 'ขออนุมัติการลา'
    WHEN 'Document_Approval'  THEN 'ขออนุมัติเอกสาร'
    WHEN 'Booking_Deposit'    THEN 'อนุมัติเงินจอง'
    WHEN 'Contract_Approval'  THEN 'อนุมัติสัญญาซื้อขาย'
    WHEN 'Marketing_Budget'   THEN 'อนุมัติงบการตลาด'
    ELSE al.workflow_type
  END                                                                AS workflow_label_th,
  CASE al.workflow_type
    WHEN 'Finance_Approval'   THEN 'ฝ่ายการเงิน'
    WHEN 'Material_Purchase'  THEN 'ฝ่ายก่อสร้าง'
    WHEN 'Installment_Review' THEN 'ฝ่ายก่อสร้าง'
    WHEN 'Leave_Request'      THEN 'ฝ่ายบุคคล'
    WHEN 'Document_Approval'  THEN 'ฝ่ายออฟฟิศ'
    WHEN 'Booking_Deposit'    THEN 'ฝ่ายขาย'
    WHEN 'Contract_Approval'  THEN 'ฝ่ายขาย'
    WHEN 'Marketing_Budget'   THEN 'ฝ่ายการตลาด'
    ELSE 'ระบบ'
  END                                                                AS department,
  split_part(al.source_doc_index, ' | ', 2)                         AS description,
  -- ดึงชื่อผู้ส่งจาก "โดย ชื่อ (ฝ่าย)"
  CASE
    WHEN al.source_doc_index LIKE '%| โดย %'
    THEN trim(split_part(split_part(al.source_doc_index, '| โดย ', 2), '|', 1))
    ELSE NULL
  END                                                                AS submitted_by,
  al.amount,
  al.current_approver_role                                           AS required_approver,
  al.action_taken                                                    AS status,
  al.approver_email,
  al.rejection_comment,
  al.created_at                                                      AS submitted_at,
  al.action_timestamp                                                AS decided_at,
  -- คำนวณว่าเกิน SLA หรือไม่
  CASE
    WHEN al.action_taken = 'Pending'
    THEN EXTRACT(DAY FROM (NOW() - al.created_at))::INTEGER
    ELSE NULL
  END                                                                AS days_pending
FROM approval_logs al
ORDER BY al.created_at DESC;

-- 4. Index เพิ่มเติมสำหรับ Registry Query Performance
CREATE INDEX IF NOT EXISTS idx_approval_logs_created_at
  ON approval_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_logs_workflow_status
  ON approval_logs (workflow_type, action_taken);

-- ================================================================
-- วิธีใช้ View สำหรับ Executive:
--
-- SELECT * FROM document_registry
-- WHERE submitted_at >= '2026-01-01'
--   AND workflow_type = 'Finance_Approval'
-- ORDER BY submitted_at DESC;
--
-- SELECT workflow_label_th, COUNT(*), SUM(amount)
-- FROM document_registry
-- WHERE EXTRACT(YEAR FROM submitted_at) = 2026
-- GROUP BY workflow_label_th;
-- ================================================================