-- เฟส 2 ปฏิทินสรุปงาน — เติม created_by_id (ผู้บันทึก) อัตโนมัติให้ตารางที่ขาด
-- default auth.uid() → ทุก insert ฝั่งผู้ใช้บันทึกผู้ทำเอง → สรุปงานอัตโนมัติรายคนครบ
ALTER TABLE crm_logs        ADD COLUMN IF NOT EXISTS created_by_id uuid DEFAULT auth.uid();
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_by_id uuid DEFAULT auth.uid();
ALTER TABLE documents       ADD COLUMN IF NOT EXISTS created_by_id uuid DEFAULT auth.uid();
