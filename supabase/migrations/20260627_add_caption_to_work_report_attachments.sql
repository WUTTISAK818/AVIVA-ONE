-- เพิ่มคำบรรยายต่อรูป (caption) ในรายงานประจำวัน
-- เพื่อให้ผู้บริหารเข้าใจว่ารูปแต่ละรูปคืออะไร/ที่ไหน (แก้ปัญหา "กองรูปไม่สื่อความ")
ALTER TABLE public.work_report_attachments ADD COLUMN IF NOT EXISTS caption text;
