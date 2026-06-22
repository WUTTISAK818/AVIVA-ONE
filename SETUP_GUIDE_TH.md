# 📋 คู่มือการตั้งค่า AVIVA ONE v6.55
## ระบบอัตโนมัติ: ระเบียบบัญชี, การเงิน, การตลาด

**วันที่ปรับปรุง:** 22 มิถุนายน 2569  
**เวอร์ชัน:** 6.55  
**สถานะ:** พร้อมดีพลอย ⚡

---

## 🎯 ภาพรวมอย่างรวดเร็ว

ระบบนี้มีประกอบด้วย 3 ฟีเจอร์หลัก:

| ฟีเจอร์ | ลักษณะการทำงาน | เวลาประหยัด |
|-------|-------------|---------|
| 📄 **ระเบียบเอกสารใบเสร็จ OCR** | อัปโหลด → ดึงข้อมูลอัตโนมัติ → เสนอ GL → อนุมัติ | 70-80% เวลาบัญชี |
| 💰 **การตั้งเวลาชำระเงินอัตโนมัติ** | ตรวจสอบ → สร้าง → ส่งอนุมัติ วนรอบ 7 วัน | 60% การท่างาน |
| 📈 **พยากรณ์กระแสเงินสดและการแจ้งเตือน** | คำนวณ 13 สัปดาห์ → ตรวจสอบความเสี่ยง → แจ้งเตือน | ทำนายถูกต้อง 85% |
| 🎯 **ลำดับเลี้ยงดูลูกค้า AI** | ส่ง SMS/Email/Line → ตรวจสอบการตอบสนอง → วัดผลสำเร็จ | นักขาย +60% |

---

## 📦 ขั้นตอนการตั้งค่า (6 ขั้นตอน)

### **ขั้นตอนที่ 1: ฐานข้อมูล Supabase (Migration)**

#### ตำแหน่งไฟล์:
```
supabase/migrations/
├── 20260621_receipt_ocr_system.sql          (ระบบเอกสาร + บัญชี + ค่าใช้จ่าย)
├── 20260621a_finance_automation_phase2.sql  (ชำระเงิน + พยากรณ์เงิน)
├── 20260621b_marketing_automation_phase3.sql (แคมเปญ + การส่งข้อมูล)
└── 20260621c_add_rls_activity_tables.sql    (ความปลอดภัยกลุ่มแผนก)
```

#### ขั้นตอน:
1. เข้า [Supabase Dashboard](https://app.supabase.com)
2. เลือกโปรเจกต์ AVIVA ONE
3. ไปที่ **SQL Editor**
4. สำหรับแต่ละไฟล์ migration:
   - **คัดลอก** เนื้อหาทั้งหมด
   - **วาง** ลงใน SQL Editor
   - **เรียก** ปุ่ม "Run"
   - **ตรวจสอบ** ว่าไม่มี error

#### ตัวอักษรวิเศษ: การรันในลำดับนี้เท่านั้น
```
1️⃣  20260621_receipt_ocr_system.sql
2️⃣  20260621a_finance_automation_phase2.sql  
3️⃣  20260621b_marketing_automation_phase3.sql
4️⃣  20260621c_add_rls_activity_tables.sql
```

---

### **ขั้นตอนที่ 2: Storage Bucket สำหรับเอกสาร**

1. เข้า [Supabase Dashboard](https://app.supabase.com)
2. ไปที่ **Storage**
3. คลิก **"Create bucket"** (ปุ่มสีน้ำเงิน)
4. ใส่ชื่อ: `receipts`
5. **สำคัญ:** ตั้ง Privacy ไป **Private** (ไม่ใช่ Public)
6. คลิก **"Create bucket"**

**ตรวจสอบ:** ไปที่ **Policies** ของ bucket `receipts` และดู:
```
✅ SELECT: authenticated & role = 'accounting|finance|admin'
✅ INSERT: authenticated & role = 'accounting|finance|admin'
✅ UPDATE: authenticated & role = 'accounting|finance|admin'
```

---

### **ขั้นตอนที่ 3: บริการภายนอก (3 บริการ)**

#### ตัวเลือก A: SMS - BulkSMS
```
หนึ่ง: ไปที่ https://www.bulksms.com
สอง: สมัครสมาชิก → รับ API Key
สาม: ตั้งค่า:
  • Username: YOUR_BULKSMS_USERNAME
  • API Key: YOUR_BULKSMS_API_KEY
```

#### ตัวเลือก B: Email - SendGrid  
```
หนึ่ง: ไปที่ https://sendgrid.com
สอง: สมัครสมาชิก → สร้าง API Key
สาม: ตั้งค่า:
  • API Key: YOUR_SENDGRID_API_KEY
  • From Email: noreply@avivaone.co.th (ที่อนุมัติแล้ว)
```

#### ตัวเลือก C: LINE Bot
```
หนึ่ง: ไปที่ https://business.line.biz
สอง: สร้าง Official Account หรือ Bot
สาม: เข้า Messaging API settings
สี่: ตั้งค่า:
  • Channel Access Token: YOUR_LINE_CHANNEL_ACCESS_TOKEN
  • Channel Secret: YOUR_LINE_CHANNEL_SECRET
  • Webhook URL: https://aviva-one.vercel.app/api/line/webhook
```

---

### **ขั้นตอนที่ 4: ตัวแปรสภาพแวดล้อม (Vercel)**

1. เข้า [Vercel Dashboard](https://vercel.com/dashboard)
2. เลือกโปรเจกต์ AVIVA ONE
3. ไปที่ **Settings** → **Environment Variables**
4. **เพิ่มตัวแปร** ตามด้านล่าง:

```bash
# ✅ Cron Job Security
CRON_SECRET=your-random-secret-32-chars

# SMS Provider (BulkSMS)
SMS_PROVIDER=bulksms
BULKSMS_USERNAME=your_bulksms_username
BULKSMS_API_KEY=your_bulksms_api_key

# Email Provider (SendGrid)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@avivaone.co.th

# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_WEBHOOK_URL=https://aviva-one.vercel.app/api/line/webhook
```

#### ⚠️ ข้อมูลความปลอดภัย:
- ห้ามใช้ค่าทั่วไป (เก็บ credentials ในสถานที่ปลอดภัย)
- ทำการ rotate API keys ทุก 3 เดือน
- ไม่ต้องเก็บใน git (อ่าน `.env.template`)

---

### **ขั้นตอนที่ 5: Redeploy ใน Vercel**

1. เข้า [Vercel Dashboard](https://vercel.com/dashboard)
2. เลือกโปรเจกต์ AVIVA ONE
3. ไปที่ **Deployments** → หาตัวล่าสุด
4. คลิก **⋮ (เมนู)** → **Redeploy**
5. ตรวจสอบ:
   - ✅ สถานะกำลังสร้างให้เปลี่ยนเป็นสีเขียว (Deployment successful)
   - ✅ ไฟล์ log ไม่มี error
   - ✅ เวลาประมาณ 2-3 นาที

---

### **ขั้นตอนที่ 6: User Acceptance Testing (UAT)**

#### ทดสอบที่ 1: ระเบียบเอกสาร OCR 📄
```
1. เข้า /accounting/receipt-processor
2. อัพโหลดรูปใบเสร็จ 5+ ใบ (jpg/png)
3. ตรวจสอบ:
   ✅ ฟิลด์ทั้งหมดถูกดึงข้อมูล (ชื่อผู้ขาย, วันที่, จำนวน, ภาษีมูลค่าเพิ่ม)
   ✅ เสนอบัญชี GL ที่ถูกต้อง
   ✅ แฟล็กความผิดปกติหากมี
   ✅ ส่งการอนุมัติ/บันทึกทำงาน
```

#### ทดสอบที่ 2: การตั้งเวลาชำระเงิน 💰
```
1. สร้าง INST (ใบสั่งซื้อ) ใหม่ที่จะครบกำหนด 3-7 วัน
2. อนุมัติ INST
3. รอสำหรับ cron job ที่ 9 AM (+7 UTC)
4. ตรวจสอบ:
   ✅ สร้าง payment_instruction ใหม่
   ✅ ส่ง notification ไปให้ Finance Manager
   ✅ บันทึก log ใน /api/cron/finance/auto-schedule-payments
```

#### ทดสอบที่ 3: พยากรณ์เงินสดและการแจ้งเตือน 📈
```
1. เข้า /finance/cash-flow-forecast (หากมี)
2. ตรวจสอบ:
   ✅ ประมาณการ 13 สัปดาห์ (วันนี้ +91 วัน)
   ✅ แยกรายการไหลเข้า/ไหลออก
   ✅ แฟล็กความเสี่ยง (ยอดเงินติดลบ, ยอดที่ใหญ่มากอย่างฉับพลัน)
3. รอสำหรับ cron job ที่ 7 AM (+7 UTC)
4. ตรวจสอบ notification ถูกส่ง (ถ้ามีความเสี่ยง)
```

#### ทดสอบที่ 4: ลำดับเลี้ยงดูลูกค้า 🎯
```
1. สร้าง Lead ใหม่ (แหล่งข้อมูล = Prospect/Demo)
2. ทำเครื่องหมาย "ใจอักษร" ว่าเป็น NEW_LEAD
3. ตรวจสอบ:
   ✅ SMS ลงทะเบียนแรกส่งไป (1 ชม. หลังสร้าง)
   ✅ Email ส่ง (1 ชม. หลังสร้าง)
   ✅ ข้อความ LINE (ถ้าเชื่อมต่อ) ส่งไป
4. รอสำหรับทริกเกอร์ cron:
   - 24h: ข้อความ "Check In" ส่ง
   - 3d: "No Response" ทำงาน (ถ้าไม่ตอบรับ)
   - 7d: ลำดับเลิก
5. ตรวจสอบ metrics:
   ✅ Sent count
   ✅ Response count  
   ✅ Conversion rate
```

#### ทดสอบที่ 5: Cron Jobs
```
ตรวจสอบใน Vercel Logs:
1. 01:00 → /api/cron/sla-reminder
2. 07:00 → /api/cron/finance/cash-flow-alerts
3. 09:00 → /api/cron/finance/auto-schedule-payments
4. 11:00 → /api/cron/evening-report
5. */15 → /api/cron/marketing/dispatch-messages (ทุก 15 นาที)

เศษส่วนคือ UTC → แปลงเป็นเวลาไทย (UTC+7):
  01:00 UTC = 08:00 น. ไทย
  07:00 UTC = 14:00 น. ไทย
  09:00 UTC = 16:00 น. ไทย
  11:00 UTC = 18:00 น. ไทย
```

---

## 🚀 คำสั่งดำเนินการอย่างรวดเร็ว

### ดึง Logs ล่าสุดจาก Vercel
```bash
# ยังไม่พร้อม - ใช้ Vercel UI แทน
# Vercel Dashboard → Deployments → View Logs
```

### ทดสอบ API ในเครื่อง (Local)
```bash
# ทดสอบ Receipt OCR
curl -X POST http://localhost:3000/api/documents/process \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "file=@receipt.jpg"

# ทดสอบ Forecast
curl -X GET "http://localhost:3000/api/finance/cash-flow/forecast" \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## ⚠️ การแก้ไขปัญหา

| ปัญหา | สาเหตุ | วิธีแก้ไข |
|------|-------|---------|
| Migration ล้มเหลว | RLS policy ขัดแย้ง | ลบ table เก่า → รัน migration ใหม่ |
| Receipt OCR ล้มเหลว | Image ไม่ชัด หรือ confidence < 85% | ถ่ายรูปใหม่ในแสงสว่างดีขึ้น |
| SMS/Email ไม่ส่ง | Credentials ผิด | ตรวจสอบ API Key ใน Vercel |
| Cron ไม่ทำงาน | CRON_SECRET ขาดหาย | เพิ่ม CRON_SECRET ใน Vercel env |
| 404 API endpoint | Migration ยังไม่ถูกรัน | รัน migration ทั้ง 4 ไฟล์ |

---

## 📞 บันทึกเพิ่มเติม

### จำนวน API ใหม่
- `POST /api/documents/upload` - อัพโหลดเอกสาร
- `POST /api/documents/process` - ประมวลผล OCR
- `POST /api/accounting/record-expense` - บันทึกค่าใช้จ่าย
- `GET /api/finance/cash-flow/forecast` - ดึงพยากรณ์
- `POST /api/finance/payments/auto-schedule` - จัดตั้งเวลาชำระเงิน
- `POST /api/marketing/campaigns/schedule` - ตั้งเวลาแคมเปญ
- `GET /api/marketing/campaigns/analytics` - ดึง metrics

### ตาราง Database ใหม่
- `documents` - เก็บเอกสาร/ใบเสร็จ
- `general_ledger` - บันทึกบัญชีทั่วไป
- `expenses` - ค่าใช้จ่าย
- `gl_accounts` - ตัวอักษรบัญชี
- `payment_instructions` - คำสั่งชำระเงิน
- `marketing_campaigns` - แคมเปญ
- `marketing_messages` - ข้อความส่ง
- `marketing_analytics` - ผลการวิเคราะห์

### Storage Bucket ใหม่
- `receipts` - เก็บรูปใบเสร็จ (Private)

---

## ✅ เช็คลิสต์การดำเนินการจริง

- [ ] รัน 4 ไฟล์ migration ใน Supabase
- [ ] สร้าง bucket `receipts` ใน Storage
- [ ] สมัครสมาชิก BulkSMS / SendGrid / LINE
- [ ] เพิ่ม environment variables ใน Vercel
- [ ] Redeploy ใน Vercel
- [ ] ทดสอบ Receipt OCR (5+ ใบ)
- [ ] ทดสอบ Auto-Schedule Payments
- [ ] ทดสอบ Cash Flow Forecast
- [ ] ทดสอบ Lead Nurturing (SMS/Email/LINE)
- [ ] ตรวจสอบ Cron logs
- [ ] ✅ พร้อมใช้งาน!

---

**สร้างเมื่อ:** 22 มิถุนายน 2569  
**เวอร์ชันสุดท้าย:** 6.55  
**สถานะ:** ✅ พร้อมเปิดตัว
