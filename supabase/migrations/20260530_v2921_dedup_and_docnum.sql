-- ================================================================
-- AVIVA ONE v2.9.21 — Dedup Guards & Document Numbering
-- ================================================================
-- วิธีใช้: รัน SQL นี้ใน Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. warranty_claims — เพิ่ม doc_number สำหรับเลขเอกสารอัตโนมัติ
ALTER TABLE warranty_claims
  ADD COLUMN IF NOT EXISTS doc_number TEXT;

-- 2. leave_requests — เพิ่ม doc_number
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS doc_number TEXT;

-- 3. UNIQUE constraint ป้องกันจองซ้ำ (plot + status ระดับ DB)
-- ป้องกัน race condition ที่ application layer ไม่จับได้
-- Note: ใช้ partial index เฉพาะ status ที่ active
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_plot_booking_unique
  ON leads (project_id, plot_number)
  WHERE status IN ('Booking', 'Loan Process', 'Closed Deal')
    AND plot_number IS NOT NULL;

-- 4. UNIQUE constraint ป้องกันงวดงานซ้ำ
CREATE UNIQUE INDEX IF NOT EXISTS idx_contractor_installments_unique
  ON contractor_installments (house_id, installment_no);

-- ================================================================
-- v2.9.21 checklist:
-- [x] warranty_claims — doc_number column
-- [x] leave_requests — doc_number column
-- [x] leads — partial unique index ป้องกัน double-booking
-- [x] contractor_installments — unique constraint per house+installment_no
-- ================================================================
