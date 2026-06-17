-- TC-06: กันจองซ้ำระดับฐานข้อมูล (race condition)
-- 1 แปลง (project + plot) = ได้แค่ 1 lead ที่อยู่ในสถานะ "ครอบครอง" (จองขึ้นไป)
-- เซลส์ 2 คนกดจองแปลงเดียวกันพร้อมกัน → คนที่สองถูก DB ปฏิเสธ (UI แปลงเป็นข้อความเข้าใจง่าย)
-- หมายเหตุ: ก่อนสร้าง index ต้องไม่มีแปลงที่ถูกจองซ้ำค้างอยู่
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_active_plot
ON leads (project_id, plot_number)
WHERE plot_number IS NOT NULL
  AND status IN ('Booking','Contract','Loan Approved','Transfer','Closed Deal');
