-- รองรับ 3 ความสามารถใหม่ของรายงานประจำวัน (แบบมีการควบคุม):
-- 1) ย้อนทำรายงานวันก่อน — is_backdated ติดป้ายให้ผู้บริหารรู้ว่าไม่ใช่ real-time
-- 2) พนักงานแก้หลังส่ง (เฉพาะก่อนผู้บริหารรับทราบ) — last_edited_at ติดป้าย "แก้ไขแล้ว"
-- 3) ผู้นำตีกลับให้แก้ — returned_at + return_reason (ไม่แก้เนื้อหาเอง รักษา audit)
ALTER TABLE public.work_reports ADD COLUMN IF NOT EXISTS is_backdated boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_reports ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;
ALTER TABLE public.work_reports ADD COLUMN IF NOT EXISTS returned_at timestamptz;
ALTER TABLE public.work_reports ADD COLUMN IF NOT EXISTS return_reason text;
