-- ================================================================
-- AVIVA ONE v2.9.14 — Approval System Enhancements
-- ================================================================
-- วิธีใช้: รัน SQL นี้ใน Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. เพิ่มคอลัมน์ใน approval_logs สำหรับ Audit Trail ที่สมบูรณ์
ALTER TABLE approval_logs
  ADD COLUMN IF NOT EXISTS requester_name    TEXT,
  ADD COLUMN IF NOT EXISTS requester_dept    TEXT,
  ADD COLUMN IF NOT EXISTS rule_applied      TEXT,
  ADD COLUMN IF NOT EXISTS due_by            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cost_center       TEXT;

-- 2. เพิ่มคอลัมน์ใน purchase_orders
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS delivery_date     DATE,
  ADD COLUMN IF NOT EXISTS attachment_url    TEXT,
  ADD COLUMN IF NOT EXISTS cost_center       TEXT;

-- 3. เพิ่มคอลัมน์ใน finance_transactions สำหรับ Cost Center
ALTER TABLE finance_transactions
  ADD COLUMN IF NOT EXISTS cost_center       TEXT,
  ADD COLUMN IF NOT EXISTS attachment_url    TEXT;

-- 4. สร้างตาราง leave_requests (สำหรับเก็บข้อมูลการลาแยกต่างหาก)
CREATE TABLE IF NOT EXISTS leave_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name    TEXT NOT NULL,
  employee_dept    TEXT,
  leave_type       TEXT NOT NULL CHECK (leave_type IN ('ลาพักร้อน','ลาป่วย','ลากิจ','ลาครอบครัว','ลาอื่นๆ')),
  date_from        DATE NOT NULL,
  date_to          DATE NOT NULL,
  days_count       INTEGER NOT NULL DEFAULT 1,
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by      TEXT,
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  approval_log_id  UUID REFERENCES approval_logs(approval_id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS สำหรับ leave_requests
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage leave_requests"
  ON leave_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. สร้างตาราง approval_matrix สำหรับ admin กำหนดวงเงิน
CREATE TABLE IF NOT EXISTS approval_matrix (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type    TEXT NOT NULL UNIQUE,
  label_th         TEXT NOT NULL,
  manager_max_thb  BIGINT NOT NULL DEFAULT 50000,
  admin_min_thb    BIGINT NOT NULL DEFAULT 50001,
  sla_days         INTEGER NOT NULL DEFAULT 3,
  requires_attachment BOOLEAN NOT NULL DEFAULT FALSE,
  requires_cost_center BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE approval_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read approval_matrix"
  ON approval_matrix FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can modify approval_matrix"
  ON approval_matrix FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed ข้อมูลเริ่มต้น approval_matrix
INSERT INTO approval_matrix (workflow_type, label_th, manager_max_thb, admin_min_thb, sla_days, requires_attachment, requires_cost_center)
VALUES
  ('Finance_Approval',   'ขออนุมัติรายจ่าย',      499999, 500000, 3, true,  true),
  ('Material_Purchase',  'ขออนุมัติจัดซื้อวัสดุ', 50000,  50001,  2, true,  true),
  ('Installment_Review', 'ตรวจสอบงวดงาน',          0,      0,      5, false, false),
  ('Leave_Request',      'ขออนุมัติการลา',          0,      0,      2, false, false),
  ('Document_Approval',  'ขออนุมัติเอกสาร',         0,      0,      3, true,  false),
  ('Booking_Deposit',    'อนุมัติเงินจอง',           0,      0,      1, false, false),
  ('Contract_Approval',  'อนุมัติสัญญา',             0,      0,      3, true,  false),
  ('Marketing_Budget',   'อนุมัติงบการตลาด',        50000,  50001,  3, false, true)
ON CONFLICT (workflow_type) DO NOTHING;

-- 6. Index สำหรับ performance
CREATE INDEX IF NOT EXISTS idx_approval_logs_workflow_pending
  ON approval_logs (workflow_type, action_taken)
  WHERE action_taken = 'Pending';

CREATE INDEX IF NOT EXISTS idx_approval_logs_doc_index
  ON approval_logs (source_doc_index text_pattern_ops);

-- 7. Immutability: ป้องกันการแก้ไข approved/rejected logs
CREATE OR REPLACE FUNCTION prevent_approval_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.action_taken IN ('Approved', 'Rejected') THEN
    RAISE EXCEPTION 'Cannot modify completed approval log (immutable audit trail)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_approval_log ON approval_logs;
CREATE TRIGGER trg_immutable_approval_log
  BEFORE UPDATE ON approval_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_approval_log_modification();

-- ================================================================
-- หมายเหตุ: หลังรัน SQL นี้แล้ว ให้ deploy โค้ด v2.9.14
-- ================================================================
