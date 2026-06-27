# 📋 งานของ Vee — รับช่วงต่อวันจันทร์

> สรุปจาก ONE (Claude Code) · อัปเดตล่าสุด: หลัง deploy **v6.81**
> Production deploy แล้วทุก branch (main = Vercel branch `claude/move-work-location-2CfBA` = `claude/inspiring-shannon-bnzeux`, commit `88fc942`)

---

## 🔴 งานที่ 1 — ตั้งค่า Vercel Env (สำคัญสุด ทำก่อน)

**เป้าหมาย:** เปิดให้ Push Notification + ปุ่มเพิ่มเพื่อน/QR LINE ทำงานจริง
(ตอนนี้ `push_subscriptions = 0` เพราะยังไม่มี VAPID key ใน Vercel)

**ทำที่:** Vercel → Project `aviva-one` → Settings → Environment Variables → เพิ่ม 4 ตัว → **Redeploy**

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY = BIFtMj238OV0xHfZpOqnfyC02atih8g7-hiKsjtP-bftH8DONAlNvXXpKMbr8MK_Ff6g7vy1K0dcnUVQ6_eoN7E
VAPID_PRIVATE_KEY            = << ขอค่าจาก ONE/Pom ทางแชต — ห้ามเขียนลงไฟล์/Git >>
VAPID_SUBJECT               = mailto:joyus818@gmail.com
NEXT_PUBLIC_LINE_OA_ID      = @xxxxxxx   ← ใส่ LINE OA ID จริงของบริษัท
```

⚠️ **ความปลอดภัย:** `VAPID_PRIVATE_KEY` (ค่าจริง ONE ส่งให้ทางแชต) เป็นความลับ — ใส่ใน Vercel env เท่านั้น **ห้ามลง database/โค้ด/Git** (ตามกฎ CLAUDE.md) · Public key ลง Git ได้ (เป็น public)

**ผลที่คาดหวังหลังตั้ง + redeploy:**
- กดปุ่ม "เปิดแจ้งเตือน" บนมือถือ (ที่ติดตั้งเป็น PWA) → subscribe สำเร็จ → แถว `push_subscriptions` เพิ่มขึ้น
- หน้า ตั้งค่า → "ผูกบัญชี LINE" → ปุ่ม "เพิ่มเพื่อน" + QR แสดงผล

---

## 🟡 งานที่ 2 — ทดสอบ v6.81 บน Production (หลัง Vercel redeploy)

**เป้าหมาย:** ยืนยันฟีเจอร์ใหม่ทำงานจริงบนมือถือ Pom

เช็คลิสต์ (เปิดในฐานะ CEO):
- [ ] Dashboard ขึ้น **v6.81** (badge มุมบนซ้าย)
- [ ] แถบเมนูล่าง **ไม่มี "กล่องงาน"** แล้ว · มี **"รายงานทีม"**
- [ ] หน้าหลักมีการ์ด **"งานที่ต้องทำ (X) →"** (แตะแล้วเปิดกล่องงาน)
- [ ] กล่องงาน → กดงาน "อนุมัติงวดงาน" → เด้งไป **/approvals มีปุ่มอนุมัติ/ปฏิเสธ** (ไม่ค้างแล้ว)
- [ ] รายงานประจำวัน: ปุ่ม **"🤖 ร่างรายงานให้"** + ใส่ **caption ใต้รูป** + เลือก **วันที่ย้อนหลัง** ได้
- [ ] รายงานทีม (ผู้บริหาร): กล่อง **"สรุปโดย AI"** + โหมด **ย่อ/ต้นฉบับ** + ปุ่ม **"ตีกลับให้แก้"**

---

## 🟢 งานที่ 3 — ให้ทีมผูก LINE (เพิ่ม adoption)

**เป้าหมาย:** ตอนนี้ผูก LINE จริงแค่ 1 คน → ให้พนักงานทุกคนผูกเพื่อรับแจ้งเตือน

**วิธี (บอกทีม):** เปิดแอป → ตั้งค่า → "ผูกบัญชี LINE" → กด "เริ่มผูกบัญชี" → สแกน QR เพิ่มเพื่อน OA → พิมพ์รหัส 6 หลักในแชต → ได้ข้อความยืนยัน ✅

**ตรวจผล (รันใน Supabase):**
```sql
-- เป้าหมาย: ดูจำนวนคนที่ผูก LINE แล้ว (ควรเพิ่มขึ้นเรื่อย ๆ)
SELECT COUNT(*) FILTER (WHERE linked_at IS NOT NULL) AS linked,
       COUNT(*) AS total_codes
FROM line_links;
```

---

## 🧹 งานที่ 4 — ทบทวน/ล้าง Test Data (ระวัง scope)

**เป้าหมาย:** เอา test data ออกจาก production (ตามกฎ CLAUDE.md "ห้าม fake fixtures ลง production")
⚠️ **ห้ามลบมั่ว — ต้องมี WHERE ชัดเจน + review 2 ครั้ง**

สิ่งที่เป็น test data (ให้ Pom ยืนยันก่อนลบ):
- ใบลา test 4 ใบ (นางสาวพัชราภรณ์/ศิริลักษณ์, นายธีรภัทร, นางสาวจิรัชญา) — `leave_requests` status='pending'
- งวดงาน test (Demo Engineer · แปลงที่ 7) `6b58b18b-...` — ONE สร้าง approval_logs ให้แล้วเพื่อทดสอบ
- บัญชี `demo.*@alisa.com` (demo.ceo/coo/admin ฯลฯ) — ถ้าไม่ใช้แล้ว

```sql
-- เป้าหมาย: ดูรายการ test data ก่อนตัดสินใจ (ยังไม่ลบ)
SELECT 'leave' AS kind, id::text, employee_name FROM leave_requests WHERE status='pending'
UNION ALL
SELECT 'demo_user', id::text, email FROM auth.users WHERE email LIKE 'demo.%@alisa.com';
```

---

## ✅ สิ่งที่ ONE ทำเสร็จแล้วในเซสชันนี้ (เพื่อให้ Vee เห็นภาพ)

| เวอร์ชัน | งาน |
|---------|-----|
| v6.73 | แก้กล่องงานพัง (role detection) + ปุ่มอนุมัติใบลา + trigger `log_leave_request` พัง |
| v6.73 | แก้ CI deploy fail (supabaseUrl placeholder env) |
| v6.74 | caption รูปในรายงาน + เตือนแนบรูปก่อนส่ง |
| v6.75 | AI สรุปรายงาน (TL;DR) ฝั่งผู้บริหาร |
| v6.76 | AI ร่างรายงานให้พนักงาน + โหมดย่อ/ต้นฉบับผู้บริหาร |
| v6.77 | รายงานย้อนหลัง + แก้หลังส่ง + ตีกลับให้แก้ |
| v6.78 | เพิ่มเมนู "รายงานทีม" ให้ผู้บริหาร |
| v6.79 | **แก้ deploy ผิด branch** (Vercel branch ตามหลัง 21 commits → sync แล้ว) |
| v6.80 | แก้ `source_doc_index` varchar(50)→text (ต้นเหตุงานกำพร้าค้างกล่องงาน) |
| v6.81 | รวมกล่องงานเข้าหน้าหลัก + ลบเมนู + LINE link UX + คู่มือ push |

**Migrations ที่ apply เข้า live DB แล้ว** (ไฟล์อยู่ใน `supabase/migrations/`): fix_log_leave_request_projects_column, add_caption_to_work_report_attachments, add_ai_summary_to_work_reports, work_reports_backdate_edit_return, widen_approval_logs_source_doc_index — **ไม่ต้อง apply ซ้ำ**

---

## 📌 กฎสำคัญที่ ONE พลาดไปก่อนหน้า (Vee/ONE ระวัง)
**ทุก deploy ต้อง push เข้า `main` + `claude/move-work-location-2CfBA` (Vercel watched branch) เสมอ** — ไม่งั้น production ไม่อัปเดต (เคยตามหลัง 21 commits มาแล้ว)
