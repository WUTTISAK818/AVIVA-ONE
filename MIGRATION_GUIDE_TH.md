# 📋 คู่มือการประยุกต์ใช้ Activity Logging Migrations

**เวลา:** 5 นาที | **ความยาก:** ง่าย | **ไม่ต้อง code**

---

## 🎯 วัตถุประสงค์

ติดตั้ง automatic activity logging สำหรับ:
- 🏗️ **Construction** - บันทึกความคืบหน้าและข้อบกพร่อง QC
- 💰 **Finance** - บันทึกการเปลี่ยนแปลงสถานะเอกสารชำระเงิน  
- 👥 **HR** - บันทึกการอนุมัติ/ปฏิเสธคำขอลา

---

## ✅ ขั้นตอนการติดตั้ง

### ขั้นตอนที่ 1: เตรียม SQL

ไฟล์ SQL ที่พร้อมใช้อยู่ที่:
```
supabase/migrations/COMBINED_MIGRATIONS.sql
```

### ขั้นตอนที่ 2: เข้า Supabase Dashboard

1. **เปิด URL นี้:**
   ```
   https://app.supabase.com/project/ipxeraxcbxxsjimzougk
   ```

2. **เข้าสู่ระบบ** ด้วย Supabase account

3. **เลือก project** "AVIVA ONE"

### ขั้นตอนที่ 3: ไปที่ SQL Editor

1. ในเมนูด้านซ้าย คลิก **SQL Editor**

2. คลิกปุ่ม **New Query** (สีน้ำเงิน)

### ขั้นตอนที่ 4: คัดลอก SQL

1. **เปิด** ไฟล์ `supabase/migrations/COMBINED_MIGRATIONS.sql` 

2. **เลือกทั้งหมด** (Ctrl+A หรือ Cmd+A)

3. **คัดลอก** (Ctrl+C หรือ Cmd+C)

### ขั้นตอนที่ 5: วาง SQL ใน Editor

1. **คลิก** ใน query editor (พื้นที่ว่างทีมา)

2. **วาง** (Ctrl+V หรือ Cmd+V)

3. ควร**เห็น SQL ทั้งหมด** ที่วางลงมา

### ขั้นตอนที่ 6: รัน Migrations

1. **คลิกปุ่ม Run** (สีเขียว) ที่มุมบนขวา

2. **รอให้เสร็จ** (ควรใช้เวลา 5-10 วินาที)

3. **ไม่ควรมี error** - ถ้ามี error ให้เช็ค:
   - ✓ SQL syntax ถูกต้อง
   - ✓ ตาราง `daily_activity_log` มีอยู่
   - ✓ ตาราง `houses`, `qc_defects`, `payment_vouchers`, `leave_requests` มีอยู่

---

## ✔️ ตรวจสอบว่าติดตั้งสำเร็จ

หลังจากรัน SQL สำเร็จแล้ว ให้:

1. **คลิก New Query** อีกครั้ง

2. **วาง** คำสั่งนี้:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name LIKE '%log_%'
   ORDER BY routine_name;
   ```

3. **คลิก Run**

### ผลลัพธ์ที่คาดหวัง

ควรเห็น **4 functions**:
```
log_construction_progress
log_leave_request
log_payment_voucher
log_qc_defect
```

✅ ถ้าเห็นทั้ง 4 แสดงว่า **ติดตั้งสำเร็จ**!

---

## 🆘 แก้ไขปัญหา

### ❌ "Syntax error"
- **สาเหตุ:** SQL ไม่ครบ หรือเพิ่มเนื้อหาสุ่มเข้าไป
- **วิธีแก้:** 
  1. ลบทั้งหมด (Ctrl+A, Delete)
  2. คัดลอก SQL ใหม่จากไฟล์ (ทั้งหมด)
  3. รัน

### ❌ "Table does not exist"
- **สาเหตุ:** ตาราง `daily_activity_log` ยังไม่มี
- **วิธีแก้:** 
  1. รันไฟล์นี้ก่อน: `supabase/migrations/20260619_create_daily_activity_log.sql`
  2. แล้วค่อย run migrations ใหม่

### ❌ "Permission denied"
- **สาเหตุ:** ไม่มี role ที่ถูกต้อง
- **วิธีแก้:** ใช้ account ที่เป็น owner หรือ admin ของ project

---

## 📊 หลังจากติดตั้งเสร็จ

### ระบบจะบันทึก activity โดยอัตโนมัติเมื่อ:

**🏗️ Construction:**
- ✓ อัปเดตความคืบหน้าของบ้าน
- ✓ เพิ่มข้อบกพร่อง QC

**💰 Finance:**
- ✓ ยื่นเอกสารชำระเงิน
- ✓ อนุมัติเอกสารชำระเงิน
- ✓ ทำการชำระเงิน
- ✓ ปฏิเสธเอกสารชำระเงิน

**👥 HR:**
- ✓ อนุมัติคำขอลา
- ✓ ปฏิเสธคำขอลา

### ข้อมูลจะปรากฏ:
- 📅 ในแดชบอร์ด **Activity Calendar**
- 📊 สามารถดูสรุป activities ต่อวัน/สัปดาห์/เดือน
- 👤 ดูว่าใครทำอะไรเมื่อไหร่

---

## 🎉 เสร็จแล้ว!

เมื่อติดตั้งสำเร็จ:
1. ✅ ระบบ activity logging ทำงาน
2. ✅ Version bump เป็น v6.46
3. ✅ Ready to deploy

---

## 📞 ถ้ามีปัญหา

บอกปัญหาให้ชัดเจน พร้อม error message
ฉันจะช่วยแก้ไข 💪
