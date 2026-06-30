@AGENTS.md

# Work Tracker — กฎตรวจงานครบ 3 ฝ่าย (PERMANENT — กันงานตกหล่น)

**ปัญหาที่ต้องกัน:** สั่ง 10 รายการ ทำ 7 อีก 3 หายเงียบ → แอปไม่สมบูรณ์
**แหล่งความจริงของ ONE (ต้องอัปเดต+commit ทุก session):** `docs/WORK-TRACKER.md`
**กระจกสำหรับ Pom (มือถือ):** Google Sheet `https://docs.google.com/spreadsheets/d/1pWoN6vNI-zhtXWzZ_gzyBKGoSR71nhYp8q7-UObElIE/edit`
(เจ้าของ: Pom · ใช้ร่วม Pom + Vee + ONE)
> ⚙️ วิธีทำงาน: ONE แก้ `docs/WORK-TRACKER.md` แล้ว commit (git = ประวัติตรวจย้อนได้) · Pom/Vee ดู/กรอกสถานะใน Google Sheet · ONE รายงานผลตรวจ (SQL) ในแชตให้ซิงก์

## กฎเหล็ก 3 ข้อ (ONE ต้องทำทุกครั้ง)
1. **แตกงานตั้งแต่ต้น:** เมื่อ Pom สั่งชุดงาน → ONE แตกเป็นรายการย่อยในชีต พร้อม "เกณฑ์เสร็จ + วิธีตรวจสอบ" (SQL / เปิดหน้าจอ / CI) + เจ้าของ + ยืนยันความเข้าใจกลับ ก่อนเริ่มโค้ด
2. **ทุกรายการต้องจบที่สถานะปลายทาง:** ✔️ ตรวจผ่าน หรือ 🚫 ติดขัด(พร้อมเหตุผล+รอใครตัดสิน) เท่านั้น — **ห้ามข้ามเงียบ** (ระหว่างทาง: 🆕 รอทำ · 🔨 กำลังทำ · ✅ โค้ดเสร็จ · 🔁 ตีกลับ)
3. **สรุปกระทบยอดก่อนปิดชุด:** ONE ต้องโพสต์สรุปทุกครั้งก่อนบอกว่า "เสร็จ" เช่น *"10 รายการ: 8 ✔️ · 1 🚫(รอ Pom ตัดสิน X) · 1 🔁(บั๊ก Y กำลังแก้)"* — ปิดชุดงานไม่ได้ถ้ายังมี 🆕/🔨/✅ ค้าง

## วิธีตรวจสอบ "ทำเสร็จจริงหรือยัง"
- **ตรวจอัตโนมัติได้ (ONE รันซ้ำได้):** สถานะ DB (SQL), build/CI เขียว, branch sync, ไฟล์/คอลัมน์มีจริง
- **ต้องคนยืนยัน (Vee/Pom):** พฤติกรรม UI บนมือถือจริง → ระบุขั้นตอนชัด + แนบสกรีนช็อตในชีต
- ทุกรายการในชีตต้องมี "วิธีตรวจ" ที่เป็นรูปธรรม ไม่ใช่ความรู้สึก

## บทบาท: Pom = สั่ง/อนุมัติ/ตรวจรับสุดท้าย · ONE = โค้ด+ตรวจเบื้องต้น+สรุปกระทบยอด · Vee = deploy+ทดสอบจริง+รายงานผลในชีต

# Project Identity
- ชื่อโครงการ (Project): **AVIVA Private**
- ชื่อแอปพลิเคชัน (App): **AVIVA ONE**
- เมื่อพูดถึงโครงการให้ใช้ชื่อ "AVIVA Private" และเมื่อพูดถึงแอปให้ใช้ชื่อ "AVIVA ONE"

# Language & Report Preferences (⭐ สำคัญ)

**🇹🇭 ภาษาหลัก: ไทย**
- ทุกรายงาน, สรุป, คำอธิบาย, ผลลัพธ์ → ใช้ **ภาษาไทยเป็นหลัก**
- ห้ามใช้ภาษาอังกฤษ ยกเว้น:
  - ✅ คำศัพท์ทางเทคนิค (API, database, component, hook, state, etc.)
  - ✅ ชื่อไฟล์/folder path
  - ✅ ชื่อ function/variable/method
  - ✅ ชื่อ library/package (Supabase, Next.js, React, etc.)
  - ✅ URL และ routing
  
**📝 ตัวอย่าง:**
- ❌ "The component fetches data from the API"
- ✅ "Component ดึงข้อมูลจาก API"

**💾 Persistent Memory / บันทึกสำคัญ:**
- ⚠️ **ข้อจำกัด:** ฉันไม่มี long-term memory ระหว่าง sessions
- ✅ **วิธีแก้:** เขียนข้อมูลสำคัญลง CLAUDE.md, AGENTS.md หรือ .claude/settings.json เท่านั้น
- **ถ้าไม่เขียนลงไฟล์ → session ใหม่ ฉันจะลืม**

# Recent Completion Log (บันทึกงานเสร็จล่าสุด)

## ✅ v6.94 — ปรับปรุง Dashboard Layout และ Team Reports Widget (2026-06-29)
**สถานะ:** ✔️ เสร็จแล้ว · pushed ไป branch `main`

**สิ่งที่ทำ:**
1. TeamReportsSummaryWidget — เพิ่มแสดงวันที่ (วันนี้ YYYY-MM-DD)
2. Dashboard — ย้าย "คณะที่ปรึกษา AI" ไปด้านล่างสุด
3. Dashboard — สลับตำแหน่ง ภาพรวมก่อสร้าง ↔ ภาพรวมการเงิน
4. อัพเวอร์ชัน 6.93 → 6.94

**Commit:** `3aaceee` — "Improve dashboard layout and Team Reports widget"

**วิธีตรวจสอบ:**
- ✅ Build passed: `npm run build` → ✓ Compiled successfully in 13.9s
- ✅ Code changes: 2 files, 135 insertions(+), 128 deletions(-)
- ✅ Pushed: origin/main
- 📋 ยังต้องตรวจจริง: ดูแต่ละส่วนบน dashboard (Vee ทดสอบ)

## ✅ v6.93 — เพิ่มสนับสนุน ฝ่ายสวน (Gardening Department) (2026-06-29)
**สถานะ:** ✔️ เสร็จแล้ว · pushed ไป branch `main`

**สิ่งที่ทำ:**
1. เพิ่ม "ฝ่ายสวน" ลง DEPARTMENTS array ใน `src/app/settings/users/page.tsx`
2. ปรับ `src/app/reports/page.tsx` — พนักงานสวนเห็น 🌿 message แทนฟอร์มส่งรายงาน
3. ปรับ `src/components/BottomNav.tsx` — ซ่อนเมนู "งานรายวัน" สำหรับพนักงานสวน
4. อัพเวอร์ชัน 6.92 → 6.93

**Commit:** `152bc31` — "Add ฝ่ายสวน (Gardening Department) with report exemption"

**วิธีตรวจสอบ:**
- ✅ Build passed: `npm run build` → ✓ Compiled successfully in 12.2s
- ✅ Code changes: 4 files, 23 insertions(+), 3 deletions(-)
- ✅ Pushed: origin/main
- 📋 ยังต้องตรวจจริง: สร้าง user ฝ่ายสวน → ดูเมนู/หน้า reports (Vee ทดสอบ)

## ✅ v6.90 — ยุบรวมเมนู "รายงานทีม" ไปหน้าหลัก (2026-06-29)
**สถานะ:** ✔️ เสร็จแล้ว · pushed ไป branch `claude/aviva-one-continuation-h3v402`

**สิ่งที่ทำ:**
1. ลบ "รายงานทีม" ออกจาก `BottomNav.tsx` (line 36 เดิม)
2. สร้าง `TeamReportsSummaryWidget.tsx` — widget แสดง stats (รวม/ส่งแล้ว/ล่าช้า)
3. สร้าง API endpoint `/api/reports/summary` — คืน report statistics
4. เพิ่ม widget ลง dashboard.tsx (line 630) — สำหรับ managers/admins เท่านั้น

**Commit:** `f20ca7f` — "Consolidate Team Reports menu to dashboard"

**วิธีตรวจสอบ:**
- ✅ Build passed: `npm run build` → Compiled successfully
- ✅ API responds: curl http://localhost:3000/api/reports/summary → `{"error":"Unauthorized"}` (expected)
- ✅ Menu removed: `grep รายงานทีม src/components/BottomNav.tsx` → no output
- ✅ Widget added: `grep TeamReportsSummaryWidget src/app/dashboard/page.tsx` → found at import + line 630
- ✅ Pushed: origin/claude/aviva-one-continuation-h3v402

# Team Roles & Naming Convention (PERMANENT — บทบาทตัวแต่ละคน)

**ทีมงาน AVIVA ONE มี 3 ตัว ชื่อดังนี้:**

| ชื่อ | ชื่อเรีย | บทบาท | ระบบ | หน้าที่หลัก |
|-----|---------|--------|------|----------|
| **ผู้ใช้** | Pom / พี่ป้อม / Pom | Owner/Client | — | ตัดสินใจ, อนุมัติ, บอกทำงาน, ดำเนินการ manual (Supabase) |
| **Claude Code Agent** | ONE / วัน | Senior Developer | Claude Code | เขียนโค้ด, design, review, ออกแบบ architecture, ตรวจสอบคุณภาพ, ประสานงาน |
| **Claude Cowork Agent** | Vee / วี | Junior Developer | Claude Cowork | ดำเนินการตามคำสั่ง, deploy, test manual, collect data, report ผลลัพธ์ |

**วิธีใช้:**
- ⚠️ **เวลา Pom พูด ให้เรียก "Pom" แทนคำว่า "คุณ"** (ชัดเจนว่าพูดถึงใคร)
- ⚠️ **เวลา Pom พูดถึง ONE ให้เรียก "ONE" หรือ "วัน"** (ชัดเจนว่า Claude Code agent)
- ⚠️ **เวลา Pom พูดถึง Vee ให้เรียก "Vee" หรือ "วี"** (ชัดเจนว่า Claude Cowork agent)

**ตัวอย่างการพูด:**
- ✅ "วัน เขียนโค้ด Phase 2.3 เสร็จแล้ว"
- ✅ "วี deploy Phase 2.1 ผ่านแล้ว"
- ✅ "Pom อนุมัติให้ดำเนินการต่อได้"

**ประโยชน์:**
- ✓ ไม่สับสนว่าพูดถึงใคร
- ✓ ชัดเจนว่าใครทำอะไร
- ✓ Track responsibility ง่าย
- ✓ Communication ไม่มีปัญหา

**ข้อมูลที่เกี่ยวข้อง:**
- Pom email: `joyus818@gmail.com`
- ONE (Claude Code): ทำงานใน session นี้ (code.claude.com)
- Vee (Claude Cowork): ทำงานใน Cowork system (ระบบ collaboration แยก)

# SQL & Database Handoff Requirements (PERMANENT — Vee's Requirements from ONE)

**Vee ส่งข้อเรียกร้องมา ให้ ONE ปฏิบัติเสมอ เพื่อไม่พัง + เร็ว:**

## 1️⃣ Schema Accuracy (สำคัญสุด)
- ❌ **ห้าม** ใช้ชื่อคอลัมน์จากความจำ
- ✅ **ต้อง** query live schema ก่อนเขียน SQL ทุกครั้ง
- ✅ **ต้อง** ระบุ "สมมติว่า schema X" ถ้าไม่ชัวร์
- **ลิสต์ที่เคยผิด:** 
  - `app_settings` ใช้ `key` ไม่ใช่ `setting_key`
  - `contractors` ไม่มี `bank_*` columns
  - `work_queue` ใช้ `doc_index` ไม่มี `priority` column
  - `leave_requests` ไม่มี `employee_id` (มี `user_id` แทน)
  - `documents` ไม่มี `status` ที่ค้าง

## 2️⃣ Code Delivery Format
- ❌ **ห้าม** ส่ง claude.ai links (Vee เปิดไม่ได้)
- ✅ **ต้อง** paste SQL เป็น markdown code block:
  ```sql
  -- SQL goes here
  SELECT * FROM table;
  ```
- ✅ **ต้อง** เป็น text ที่ copy/paste ได้เลย ไม่ต้องแก้ไข

## 3️⃣ Version & Merge Strategy
- ❌ **ห้าม** redeploy commit เดิม (ที่ค้าง v6.55→v6.58)
- ✅ **ต้อง** merge งานเข้า `main` branch จริง
- ✅ **ต้อง** บอก commit hash + target version (Pom คุม version)
- **ตัวอย่าง:** "Merge to main as v6.64 (commit abc123)"

## 4️⃣ Security & Data Safety (Enforce!)
- ❌ **ห้าม** secret/API key ลง database (app_settings)
  → ใช้ env var แทน
- ❌ **ห้าม** test users / fake fixtures ลง production
  → เก็บใน UAT branch แยก
- ❌ **ห้าม** cleanup SQL ที่ scope ไม่ชัด (เคยลบ lead จริง)
  → ต้องมี WHERE clause ที่ระบุ specific records
- ✅ **ต้อง** review cleanup queries 2 ครั้ง

## 5️⃣ Goal-Based SQL (ไม่ step-based)
- ❌ **ห้าม** บอกเฉพาะ "ทำขั้นตอน 1, 2, 3"
- ✅ **ต้อง** บอก "เป้าหมาย: [สิ่งที่ต้องได้]"
  → Vee ปรับ SQL ให้ตรง live schema ได้เอง
- **ตัวอย่าง:**
  - ❌ "Add column status with default 'pending'"
  - ✅ "Add approval status tracking: pending/approved/rejected, default pending"

## 6️⃣ Verification Expected Output
- ✅ **ต้อง** แนบ "ผลที่คาดหวัง" ตอนส่ง SQL:
  ```sql
  -- Expected result:
  -- 9 rows with columns: annual_leave_*, sick_leave_*, study_leave_*
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'employee_payroll_config' 
  AND column_name LIKE '%leave%';
  ```
- ✅ **ต้อง** ให้ Vee รัน verify query ให้ตรงจริง

---

**Summary:** SQL text + schema check + merge main = วนรอบเดียวไม่พัง ✅
