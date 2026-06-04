-- ================================================================
-- AVIVA ONE v2.9.20 — Management Meeting Round 2
-- ================================================================
-- วิธีใช้: รัน SQL นี้ใน Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. warranty_claims — เพิ่ม house tracking
ALTER TABLE warranty_claims
  ADD COLUMN IF NOT EXISTS house_number TEXT,
  ADD COLUMN IF NOT EXISTS house_id     UUID REFERENCES houses(id);

-- 2. contractor_installments — เพิ่ม notes จากผู้รับเหมา
ALTER TABLE contractor_installments
  ADD COLUMN IF NOT EXISTS contractor_notes TEXT;

-- 3. customer_installments — เพิ่มข้อมูลการโอนเงิน
ALTER TABLE customer_installments
  ADD COLUMN IF NOT EXISTS transfer_ref  TEXT,
  ADD COLUMN IF NOT EXISTS transfer_date DATE,
  ADD COLUMN IF NOT EXISTS paid_by       TEXT;

-- 4. Index สำหรับ audit_log viewer
CREATE INDEX IF NOT EXISTS idx_audit_log_module ON audit_log (module);

-- ================================================================
-- v2.9.20 checklist:
-- [x] warranty_claims — house tracking
-- [x] contractor_installments — contractor_notes
-- [x] customer_installments — transfer_ref, transfer_date, paid_by
-- [x] audit_log — module index
-- ================================================================
