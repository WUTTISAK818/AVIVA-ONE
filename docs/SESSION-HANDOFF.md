# 🔖 SESSION HANDOFF — ส่งงานข้าม session (AVIVA ONE)

> ไฟล์นี้ = จุดเริ่มของ session ใหม่ อ่านไฟล์นี้ไฟล์เดียวก็ทำงานต่อได้ทันที
> อัปเดตล่าสุด: หลัง v6.88 · branch `claude/inspiring-shannon-bnzeux`

---

## ⚡ คำสั่งสำหรับวางในแชตใหม่ (คัดลอกทั้งบล็อกนี้)

```
ตึ๊ดตึ๊ดตึ๊ด — ทำงานต่อ AVIVA ONE

อ่าน docs/SESSION-HANDOFF.md + docs/WORK-TRACKER.md ก่อนเริ่ม
แล้วทำตามลำดับนี้:
1. ยืนยันเวอร์ชันปัจจุบันจาก src/lib/version.ts
2. รายงานสิ่งที่ค้าง (ชุดงาน #3 + Phase 4) ให้ผมเลือกว่าจะทำอันไหนก่อน
3. รอผมสั่งก่อนเริ่มแก้โค้ด

หมายเหตุ: ผมคือ Pom (เจ้าของ) · คุยภาษาไทย · build ต้องผ่านก่อน push เสมอ
```

---

## 📍 สถานะปัจจุบัน (ground truth)
- **Branch:** `claude/inspiring-shannon-bnzeux`
- **เวอร์ชัน:** `6.88` (ดูใน `src/lib/version.ts`)
- **Commit ล่าสุด:** `344a162` (v6.88)
- **Build:** ✓ เขียว (npm run build ผ่าน ไม่มี TS error)
- งานทั้งหมด push ขึ้น branch แล้ว ไม่มีงานค้างกลางอากาศ

---

## ✅ ทำเสร็จแล้ว (ชุดงาน #3 — UI ฝ่ายขาย)
ปรับ UI ฝ่ายขาย 7 หน้า จากเฉลี่ย 5.7 → 9.36 (อิง code review + build):

| หน้า | คะแนน | ไฟล์ |
|------|:---:|------|
| performance | 9.5 | `src/app/sales/performance/page.tsx` |
| daily-log | 9.5 | `src/app/sales/daily-log/page.tsx` |
| leads | 9.5 | `src/app/leads/page.tsx` |
| customers | 9.5 | `src/app/customers/page.tsx` |
| after-sales | 9.5 | `src/app/after-sales/page.tsx` |
| CRM | 9.0 | `src/app/crm/page.tsx` |
| doc-generate | 9.0 | `src/app/documents/generate/page.tsx` |

**Bug จริงที่แก้ไป:** performance page เคยแสดง KPI ลีด (อัตราจอง/สถานะลีด/สรุปขาย) เป็น 0 ตายตัว → ต่อ table `leads` จริงแล้ว (v6.87)

นอกจากนี้: แก้ GoTrue NULL bug หน้าจัดการผู้ใช้ (Pom ยืนยันใช้ได้แล้ว)

---

## 🟡 งานที่เหลือ (รอ Pom สั่ง / ตัดสินใจ)

### 1. CRM 9.0 → 9.5 (ต้อง Pom ตัดสินก่อน)
หน้า CRM มี AI panel ซ้อน 3 จุด: ปุ่ม AI ใน header (`showAI`) + `DeptBriefingPanel` + `DeptAIChat`
→ ควรยุบรวม แต่กระทบ logic ต้องให้ Pom ยืนยัน design ก่อนแก้

### 2. doc-generate 9.0 → 9.5
ฟอร์มยาว → ทำ accordion/step ทีละ section (`src/app/documents/generate/page.tsx`)

### 3. Phase 4 — ลดงานซ้ำซ้อนรายงานประจำวัน
แผนเต็มอยู่ใน `docs/WORK-TRACKER.md` หัวข้อ "แผนรอดำเนินการ (Phase 4)"
สรุป: พนักงานบันทึกงานระหว่างวันแล้ว แต่ตอนเย็นต้องพิมพ์รายงานใหม่ = ซ้ำซ้อน
ต้องแก้ 3 ไฟล์: DB migration (auth.uid() default) + `reports/page.tsx` (dedup + ปุ่มดึงงาน) + `activity/page.tsx` (count query)

### 4. รอ Vee/Pom ทดสอบ UI บนมือถือจริง
คะแนน 9.x ทั้งหมดยังเป็น "✅ build ผ่าน" จะเป็น "✔️ ตรวจผ่าน" เมื่อเปิดบนมือถือจริง

### 5. Deploy edge function (รอ Pom/Vee)
`supabase/functions/admin-user-management` (GoTrue bypass) commit แล้ว ต้อง deploy ด้วยมือ — MCP ไม่มีสิทธิ์

---

## 🔒 กฎความปลอดภัยที่ต้องคงไว้ (สำคัญ — repo เป็น PUBLIC)
- ❌ ห้ามเขียน password / API key / secret ลงไฟล์/repo/database
- ❌ VAPID_PRIVATE_KEY, service_role key, Vercel token ต้องอยู่แค่ใน env เท่านั้น
- ✅ Pom/Vee ต้อง rotate secret ที่เคยหลุด (ทำใน dashboard)

## 📋 กฎประจำที่ต้องทำทุก session
1. **อ่านเวอร์ชันจาก `src/lib/version.ts`** ก่อนเสมอ (ห้ามเดาจากความจำ)
2. **`npm run build` ต้องผ่าน** ก่อน push ทุกครั้ง
3. **อัปเดต `docs/WORK-TRACKER.md`** + commit ทุก session (แหล่งความจริง)
4. ภาษาหลัก = **ไทย** · เรียก Pom ว่า "Pom", Claude Code = "ONE", Cowork = "Vee"
5. AVIVA Plus แยกเด็ดขาด ห้ามปนใน AVIVA ONE
