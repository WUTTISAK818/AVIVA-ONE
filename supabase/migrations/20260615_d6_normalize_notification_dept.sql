-- D6 — รวมชื่อแผนกใน notifications ให้เป็นภาษาไทยชุดเดียว
-- เดิมมีบาง row เก็บค่าอังกฤษ (management/construction ฯลฯ) ทำให้ filter รายแผนก
-- + เจาะ LINE ส่วนตัว resolve ไม่เจอ. โค้ด createNotification ใหม่ normalize ขาเข้าแล้ว
-- migration นี้ล้างข้อมูล legacy ที่ค้างอยู่ให้ตรงกัน

UPDATE notifications SET to_dept = 'ผู้บริหาร'
  WHERE lower(to_dept) IN ('management', 'executive', 'admin', 'ceo', 'coo');
UPDATE notifications SET to_dept = 'ฝ่ายก่อสร้าง'
  WHERE lower(to_dept) IN ('construction', 'engineering', 'engineer');
UPDATE notifications SET to_dept = 'ฝ่ายขาย'        WHERE lower(to_dept) = 'sales';
UPDATE notifications SET to_dept = 'ฝ่ายการเงิน'    WHERE lower(to_dept) = 'finance';
UPDATE notifications SET to_dept = 'ฝ่ายบัญชี'      WHERE lower(to_dept) IN ('accounting', 'account');
UPDATE notifications SET to_dept = 'ฝ่ายบุคคล'      WHERE lower(to_dept) = 'hr';
UPDATE notifications SET to_dept = 'ฝ่ายการตลาด'   WHERE lower(to_dept) = 'marketing';
UPDATE notifications SET to_dept = 'ฝ่ายหลังการขาย' WHERE lower(to_dept) IN ('after-sales', 'aftersales');

UPDATE notifications SET from_dept = 'ผู้บริหาร'
  WHERE lower(from_dept) IN ('management', 'executive', 'admin', 'ceo', 'coo');
UPDATE notifications SET from_dept = 'ฝ่ายก่อสร้าง'
  WHERE lower(from_dept) IN ('construction', 'engineering', 'engineer');
UPDATE notifications SET from_dept = 'ฝ่ายขาย'        WHERE lower(from_dept) = 'sales';
UPDATE notifications SET from_dept = 'ฝ่ายการเงิน'    WHERE lower(from_dept) = 'finance';
UPDATE notifications SET from_dept = 'ฝ่ายบัญชี'      WHERE lower(from_dept) IN ('accounting', 'account');
UPDATE notifications SET from_dept = 'ฝ่ายบุคคล'      WHERE lower(from_dept) = 'hr';
UPDATE notifications SET from_dept = 'ฝ่ายการตลาด'   WHERE lower(from_dept) = 'marketing';
UPDATE notifications SET from_dept = 'ฝ่ายหลังการขาย' WHERE lower(from_dept) IN ('after-sales', 'aftersales');
