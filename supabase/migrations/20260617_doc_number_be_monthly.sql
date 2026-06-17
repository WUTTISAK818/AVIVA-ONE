-- ================================================================
-- AVIVA ONE — เปลี่ยนรูปแบบเลขที่เอกสารเป็น PREFIX-ปปดด-ลำดับ
-- ================================================================
-- รูปแบบใหม่: PREFIX-ปปดด-ลำดับ (พ.ศ. 2 หลัก + เดือน 2 หลัก + ลำดับ 3 หลัก)
--   เช่น FIN-6906-009 = ฝ่ายการเงิน พ.ศ.2569 เดือนมิถุนายน ลำดับที่ 9
--   - ปีใช้ พ.ศ. (เดิมเป็น ค.ศ.) ให้สอดคล้องเอกสารราชการไทย
--   - เพิ่ม "เดือน" และ reset ลำดับรายเดือน (เดิม reset รายปี ไม่มีเดือน)
--   - ใช้เวลาไทย (Asia/Bangkok) กันคลาดเคลื่อนช่วงข้ามวัน/เดือน
-- หมายเหตุ: เลขเก่ายังคงรูปแบบเดิมในประวัติ ไม่ชนกันเพราะคนละรูปแบบ
-- เลขที่ "สัญญาจะซื้อจะขาย" ในตัวเอกสาร ยังใช้รูปแบบราชการ ดดปป/ลำดับ (แยกต่างหาก)
-- ================================================================

-- 1) เพิ่มคอลัมน์เดือน
ALTER TABLE document_sequences ADD COLUMN IF NOT EXISTS month INTEGER NOT NULL DEFAULT 1;

-- 2) เริ่มลำดับรายเดือนใหม่ตั้งแต่เดือนปัจจุบัน
UPDATE document_sequences
SET last_seq = 0,
    year  = EXTRACT(YEAR  FROM (NOW() AT TIME ZONE 'Asia/Bangkok'))::INTEGER,
    month = EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'Asia/Bangkok'))::INTEGER,
    updated_at = NOW();

-- 3) ฟังก์ชันออกเลขใหม่ (atomic, reset รายเดือน, ใช้เวลาไทย, พ.ศ.)
CREATE OR REPLACE FUNCTION next_doc_number(p_workflow_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_now    TIMESTAMP := (NOW() AT TIME ZONE 'Asia/Bangkok');
  v_year   INTEGER := EXTRACT(YEAR  FROM v_now)::INTEGER;
  v_month  INTEGER := EXTRACT(MONTH FROM v_now)::INTEGER;
  v_be2    TEXT := LPAD(((v_year + 543) % 100)::TEXT, 2, '0');   -- พ.ศ. 2 หลักท้าย
  v_mm     TEXT := LPAD(v_month::TEXT, 2, '0');
  v_seq    INTEGER;
  v_prefix TEXT;
  v_pyear  INTEGER;
  v_pmonth INTEGER;
BEGIN
  SELECT prefix, last_seq, year, month
    INTO v_prefix, v_seq, v_pyear, v_pmonth
  FROM document_sequences
  WHERE workflow_type = p_workflow_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown workflow_type: %', p_workflow_type;
  END IF;

  -- reset ลำดับเมื่อข้ามเดือนหรือข้ามปี
  IF v_seq IS NULL OR v_pyear IS DISTINCT FROM v_year OR v_pmonth IS DISTINCT FROM v_month THEN
    v_seq := 0;
  END IF;

  v_seq := v_seq + 1;

  UPDATE document_sequences
  SET last_seq = v_seq,
      year     = v_year,
      month    = v_month,
      total_issued = total_issued + 1,
      updated_at = NOW()
  WHERE workflow_type = p_workflow_type;

  RETURN v_prefix || '-' || v_be2 || v_mm || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$;
