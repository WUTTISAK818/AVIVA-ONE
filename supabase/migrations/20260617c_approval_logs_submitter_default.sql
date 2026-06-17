-- บันทึก "ผู้ยื่นคำขอ" อัตโนมัติทุกจุด submit (ครอบ insert ทุกหน้าโดยไม่ต้องแก้โค้ดทีละจุด)
-- auth.uid() = ผู้ใช้ที่ล็อกอินขณะ insert; insert จาก service_role จะได้ NULL (ยอมรับได้)
-- เปิดใช้งาน "แจ้งผู้ขออัตโนมัติเมื่อเกินกำหนด" ใน cron sla-reminder
ALTER TABLE approval_logs ALTER COLUMN submitted_by_user_id SET DEFAULT auth.uid();
