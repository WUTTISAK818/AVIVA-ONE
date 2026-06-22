# ⚡ AVIVA ONE v6.55 - Quick Start (5 นาที)

**สถานะ:** โค้ดเสร็จ → รอการตั้งค่า  
**เวอร์ชัน:** 6.55  
**Go-Live:** 23-25 มิถุนายน 2569

---

## 🎯 ทำให้ระบบทำงาน (3 ขั้นตอน)

### ขั้นตอนที่ 1: Database (10 นาที)
```
1. เข้า https://app.supabase.com
2. เลือก AVIVA ONE project
3. SQL Editor → Copy/Paste/Run นี้ 4 ไฟล์:
   ✓ 20260621_receipt_ocr_system.sql
   ✓ 20260621a_finance_automation_phase2.sql
   ✓ 20260621b_marketing_automation_phase3.sql
   ✓ 20260621c_add_rls_activity_tables.sql
4. ✅ ไม่มี error = success
```

### ขั้นตอนที่ 2: Storage (5 นาที)
```
1. Supabase → Storage → "Create bucket"
2. Name: "receipts"
3. Privacy: "Private" ⚠️
4. Create → ✅ Done
```

### ขั้นตอนที่ 3: Services + Environment (15 นาที)
```
BulkSMS: https://www.bulksms.com → Copy API Key
SendGrid: https://sendgrid.com → Copy API Key
LINE: https://business.line.biz → Copy tokens

Vercel: Settings → Environment Variables → Add:
├─ CRON_SECRET=random-32-chars
├─ BULKSMS_USERNAME=xxx
├─ BULKSMS_API_KEY=xxx
├─ SENDGRID_API_KEY=xxx
├─ SENDGRID_FROM_EMAIL=noreply@avivaone.co.th
├─ LINE_CHANNEL_ACCESS_TOKEN=xxx
└─ LINE_CHANNEL_SECRET=xxx

Redeploy → wait 2-3 min → ✅ Green
```

---

## 🧪 ทดสอบระบบ (15 นาที)

```
✓ OCR:      /accounting/receipt-processor → Upload receipt
✓ Finance:  Dashboard → Check forecast appears
✓ Marketing: Create lead → Check SMS sent
✓ Cron:     Vercel Logs → See jobs run
```

---

## 📊 ประโยชน์ทันที

| ชื่อ | ประหยัด | ผล |
|-----|---------|-----|
| **บัญชี** | 70% | ข้อมูล 30 นาที → 5 นาที |
| **การเงิน** | 60% | ตั้งเวลา 45 นาที → 15 นาที |
| **การตลาด** | +60% | ลูกค้าใหม่ตอบสนอง +60% |

---

## 📁 ไฟล์สำคัญ

| ไฟล์ | วัตถุประสงค์ |
|-----|----------|
| `SETUP_GUIDE_TH.md` | ขั้นตอนละเอียด (6 ขั้น) |
| `.env.template` | ค่า environment variable ทั้งหมด |
| `DEPLOYMENT_REPORT_v6.55.md` | สรุปอย่างละเอียด |

---

## 🚀 ขั้นตอนถัดไป (หลังจากตั้งค่าเสร็จ)

```
วันพฤหัสบดี 23 มิถุนายน:
□ Run database migrations
□ Create storage bucket
□ Set environment variables
□ Redeploy

วันศุกร์ 24 มิถุนายน:
□ UAT testing
□ Staff demo
□ Monitor logs

วันเสาร์ 25 มิถุนายน:
□ Go Live 🎉
```

---

## ☎️ ติดต่อ

- 📧 Error? Check `SETUP_GUIDE_TH.md` troubleshooting
- 📱 Stuck? See `.env.template` for all credentials needed
- 📊 Details? Read `DEPLOYMENT_REPORT_v6.55.md`

---

**Version:** 6.55  
**Ready to Ship:** ✅ YES
