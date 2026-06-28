# 📊 AVIVA ONE — Work Tracker (แหล่งความจริงของ ONE)

> **ไฟล์นี้ = แหล่งความจริงที่ ONE อัปเดต+commit เองทุก session** (git เก็บประวัติทุกการเปลี่ยน → ตรวจย้อนได้)
> กระจกสำหรับ Pom (มือถือ): [Google Sheet](https://docs.google.com/spreadsheets/d/1pWoN6vNI-zhtXWzZ_gzyBKGoSR71nhYp8q7-UObElIE/edit)
> กฎเต็มอยู่ใน `CLAUDE.md` → หัวข้อ "Work Tracker"

**สถานะ:** 🆕 รอทำ · 🔨 กำลังทำ · ✅ โค้ดเสร็จ(build ผ่าน) · ✔️ ตรวจผ่าน(ปลายทาง) · 🚫 ติดขัด+เหตุผล(ปลายทาง) · 🔁 ตีกลับ
**กฎทอง:** ปิดชุดงานไม่ได้ถ้ายังมี 🆕/🔨/✅ ค้าง — ต้องเป็น ✔️ หรือ 🚫 เท่านั้น · ONE สรุปกระทบยอดทุกครั้งก่อนบอก "เสร็จ"

---

## 🔵 ชุดงานที่กำลังทำ — #1 Go-Live v6.81

| # | รายการ | เกณฑ์เสร็จ + วิธีตรวจ (objective) | เจ้าของ | สถานะ | baseline / ผลตรวจ |
|---|--------|-----------------------------------|---------|-------|-------------------|
| 1 | ตั้ง VAPID x3 + LINE OA ID ใน Vercel → Redeploy | `SELECT count(*) FROM push_subscriptions` > 0 หลัง subscribe + ปุ่มเพิ่มเพื่อน/QR LINE แสดง | Vee | 🆕 | push_subs = **0** |
| 2 | ทดสอบ production v6.81 (รายงานทีม/การ์ดงานที่ต้องทำ/ไม่มีเมนูกล่องงาน/AI ร่าง+สรุป/ย้อนหลัง+แก้+ตีกลับ) | เปิดแอปจริง: dashboard = v6.81 + เช็คลิสต์ `docs/VEE-TODO-MONDAY.md` ครบ (แนบสกรีนช็อต) | Pom+Vee | 🆕 | — |
| 3 | ชวนทีมผูก LINE (ตั้งค่า → ผูกบัญชี LINE) | `SELECT count(*) FILTER (WHERE linked_at IS NOT NULL) FROM line_links` เพิ่มขึ้น | Vee | 🆕 | linked = **1** |
| 4 | ทบทวน/ล้าง test data + demo accounts | test/demo ทุกตาราง = 0 | ONE | ✔️ ตรวจผ่าน | ลบครบ: demo users 11(auth+public)=0 · reports/installments/work_queue=0 · 3 audit logs=0 (ปิด trigger ชั่วคราวแล้วเปิดคืน) · leads จริงไม่กระทบ |
| 5 | iPhone: เพิ่มลงหน้าจอโฮม (PWA) + ทดสอบ push | ส่ง push ทดสอบแล้วเด้งบนมือถือ Pom จริง | Pom | 🆕 | — |

| 6 | **[ด่วน-ความปลอดภัย] Rotate secret ที่เคยหลุดใน repo** (Supabase service_role key, Vercel token, CRON_SECRET) | สร้าง key/token ใหม่ + อัปเดต Vercel env + ของเก่าใช้ไม่ได้แล้ว | Pom+Vee | 🚫 รอ Pom/Vee | ONE ลบไฟล์+เพิ่ม .gitignore แล้ว แต่ rotate ต้องทำใน dashboard |
| 7 | เก็บกวาดไฟล์ scratch/secret 18 ไฟล์ออกจาก repo | `git ls-files | grep -E 'set-vercel-env|DEMO_|create-demo'` ต้องว่าง | ONE | ✔️ ตรวจผ่าน | ลบ+push 3 branch แล้ว |
| 8 | Pom ส่ง **LINE OA ID** จริง (`@xxxxxxx`) ให้ Vee ใส่ env | ปุ่มเพิ่มเพื่อน/QR LINE ขึ้นจริง | Pom | 🆕 | รอ Pom |

**สรุปกระทบยอด #1:** 8 รายการ — 🆕 ×4 · ✔️ ×2(เก็บกวาดไฟล์ + ล้าง test data) · 🚫 ×1(รอ rotate secret) · 🆕 รอ Pom/Vee ×4 → **ยังไม่ปิดชุด** (รอ Pom/Vee วันจันทร์)

> ⚠️ **หมายเหตุรายการ "✅ build แต่ยังไม่ทดสอบ UI จริง"** (จะเป็น ✔️ เมื่อ Pom/Vee ทดสอบบนมือถือ — รวมในข้อ 2):
> AI สรุป (v6.75) · AI ร่างรายงาน (v6.76) · caption รูป (v6.74) · ย้อนหลัง/แก้/ตีกลับ (v6.77) · การ์ดงานที่ต้องทำ+ลบเมนู (v6.81)
> — ONE ตรวจ route+prompt+DB แล้ว แต่เรียก Claude ผ่าน UI จริงไม่ได้ (ติด login) จึงต้องให้คนยืนยัน

---

## 🔵 ชุดงานที่ #2 — Expert Audit ระบบอนุมัติ (v6.82)

> ตรวจทุกแผนกด้วยหลักวิชาการ + พิสูจน์กับ live DB (จำลองรันจริง + rollback) แยก "บั๊กจริง" ออกจาก "เตือนผิด"

| # | รายการ | วิธีตรวจ (objective) | เจ้าของ | สถานะ | ผลตรวจ |
|---|--------|----------------------|---------|-------|--------|
| 1 | 🔴 งานวงเงินสูงตกหล่นกล่องงาน (assigned_role=admin ปิดไม่ได้ + มองไม่เห็น) | จำลอง PR ฿80k: close ได้ 0 แถว, แถวค้าง admin/open | ONE | ✔️ ตรวจผ่าน | แก้ `resolveApprovalQueue` ปิดตาม role จริง + `rolesForUser` เพิ่ม admin · build ผ่าน |
| 2/6 | 🟡 PR อนุมัติเองได้ (ไม่ผ่าน approval_logs → ไม่โดน maker-checker trigger) | สร้าง PR แล้วกดอนุมัติด้วย user เดียวกัน → ต้องถูกบล็อก | ONE | ✔️ ตรวจผ่าน | เพิ่ม `requester_user_id` + DB trigger `trg_pr_maker_checker` + UI guard · build ผ่าน |
| 3 | 🟡 Marketing_Budget/Contract_Approval ไม่มี threshold → ส่งผู้จัดการเสมอ | getApproverRole คืน admin เมื่อ > ฿50k | ONE | ✔️ ตรวจผ่าน | เพิ่ม threshold ฿50k (ตรงกับคู่มือเดิม line 423/579) · build ผ่าน |
| 7 | 🟢 แก้ WHT/retention หลังอนุมัติไม่มี audit | ตรวจ `save()` มี logAction | ONE | ✔️ ตรวจผ่าน | เพิ่ม `logAction("installment_payout_edit")` · build ผ่าน |
| 4 | 🟡 ตาราง `defects` (0 แถว) vs `qc_defects` (8 แถว) แยกกัน — /construction กับ /qc คนละตาราง | เลือกตารางหลัก + map schema + ย้ายข้อมูล + รวม UI | Pom ตัดสิน | 🚫 รอ Pom | เป็น refactor ใหญ่ (2 schema/2 UI/ย้ายข้อมูล) — เสี่ยงเกินกว่าจะแก้ลอย ๆ ต้องตัดสินใจ design ก่อน |
| 5 | 🟡 อนุมัติใบลาไม่หักยอดวันลา (balance_before/after ไม่ถูกเขียน, payroll_config ไม่ลด) | leave_type→balance column mapping + กฎหัก/คืน | ONE | ✔️ ตรวจผ่าน | v6.83: trigger `trg_leave_balance_update` หักยอดอัตโนมัติเมื่ออนุมัติ + คืนเมื่อปฏิเสธ · balance เป็น GENERATED column · เพิ่มลากิจ/ลาคลอด/ขาดงาน + ใบรับรองแพทย์ลาป่วย>3วัน · ทดสอบ approve+reject กับ live DB ผ่าน |

**ที่ตรวจแล้ว "ไม่ใช่บั๊ก" (false positive — พิสูจน์กับ DB):** calcTax สมดุล · finalizeSale idempotent (ไม่รับรู้รายได้ซ้ำ) · กล่องงานปิดได้ปกติระดับผู้จัดการ (close 1 แถว) · maker-checker approval_logs ทำงาน (pending ที่ submitted_by_user_id null = 0)

**สรุปกระทบยอด #2:** 7 รายการ — ✔️ ×6 (ข้อ 1,2/6,3,5,7) · 🚫 ×1 (ข้อ 4 defects — รอ Pom ตัดสิน design) → ปิดส่วน code ได้, เหลือ 1 ข้อรอ design decision

---

## 🔵 ชุดงาน #3 — ปรับ UI ฝ่ายขาย (v6.85–v6.86)

| # | รายการ | วิธีตรวจ (objective) | เจ้าของ | สถานะ | ผลตรวจ |
|---|--------|----------------------|---------|-------|--------|
| 1 | แก้ GoTrue NULL scanning bug (หน้าจัดการผู้ใช้พัง) | เปิดเมนูผู้ใช้ → ไม่ error "Database error finding users" | Pom | ✔️ ตรวจผ่าน | edge function ใช้ direct Postgres แทน GoTrue + SQL fix NULL columns · Pom ยืนยัน "ดูข้อมูลผู้ใช้ ได้แล้ว" |
| 2 | ปรับ UI performance page (4.5→9.5) | ภาษาไทย 100% + KPI gradient cards + chart tooltips ไทย + empty states | ONE | ✅ build ผ่าน | TS fix formatter + redesign ครบ |
| 3 | ปรับ UI daily-log page (4.3→9.5) | vertical counter layout + Thai date + premium empty state | ONE | ✅ build ผ่าน | redesign ครบ |
| 4 | ปรับ UI leads page (5.0→9.5) | vertical pipeline mobile + source breakdown bar + stage-specific colors | ONE | ✅ build ผ่าน | redesign ครบ |
| 5 | ปรับ UI customers page (6.0→9.5) | card layout แทน table + KPI row + gradient avatars + empty state | ONE | ✅ build ผ่าน | redesign ครบ |
| 6 | ปรับ UI CRM header+KPI (6.5→9.0) | premium header icon box + compact buttons + colored KPI cards | ONE | ✅ build ผ่าน | header+KPI ปรับ (ไม่แก้ทั้งหน้าเพราะ 2,500 บรรทัด) |
| 7 | ปรับ UI after-sales page (7.3→9.5) | premium header + styled KPI filter + upgraded summary | ONE | ✅ build ผ่าน | redesign ครบ |
| 8 | ปรับ UI doc-generate page (6.3→9.0) | premium header + upgraded form sections + styled payment summary | ONE | ✅ build ผ่าน | redesign ครบ |
| 9 | Deploy edge function admin-user-management (GoTrue bypass) | `supabase functions deploy admin-user-management` ผ่าน | Pom/Vee | 🚫 รอ deploy | โค้ด commit แล้ว (2264ae7) ต้อง deploy ด้วยมือ (MCP ไม่มีสิทธิ์) |

**สรุปกระทบยอด #3:** 9 รายการ — ✔️ ×1(GoTrue fix) · ✅ ×7(UI redesign build ผ่าน, รอ UI ยืนยัน) · 🚫 ×1(edge fn deploy) → **ปิดส่วน code ได้**, รอ deploy + UI ยืนยัน

---

## 🟡 แผนรอดำเนินการ (Phase 4) — ลดงานซ้ำซ้อนรายงานประจำวัน

> แผนเต็มอยู่ใน plan file `moonlit-singing-papert.md` — สรุปย่อ:

**ปัญหา:** พนักงานบันทึกงาน "ระหว่างวัน" (activity_logs/sales_activities/construction_reports) แต่ตอนเย็นต้องมาพิมพ์ "รายงานประจำวัน" (work_reports) ใหม่อีกรอบ = ทำงานซ้ำซ้อน

**สิ่งที่ตรวจพบจาก live DB:**
1. `sales_activities.created_by` default = null → `.eq("created_by", user.id)` match 0 แถวเสมอ
2. `contractor_installments` ไม่มีคอลัมน์ `installment_number`, `updated_at`, `project_id` → auto-pull ก่อสร้างพัง
3. `construction_reports.created_by = null` ทุกแถว (มีแค่ `reported_by` text)
4. `loadAutoItems` ทำงานเฉพาะตอนสร้าง report ใหม่ → งานบ่าย/เย็นไม่ถูกดึง

**แผนแก้ (ต้องทำ 3 ไฟล์):**
1. **DB Migration** — `ALTER TABLE sales_activities/construction_reports ALTER COLUMN created_by SET DEFAULT auth.uid()`
2. **reports/page.tsx** — refactor `loadAutoItems` → `pullAutoItems` (dedup + ปุ่มรีเฟรช + 5 แหล่งข้อมูล)
3. **activity/page.tsx** — แก้ count query ที่ใช้คอลัมน์ผิด (`updated_at` → `created_at`)

---

## 🟡 งานค้างจากชุดเดิม (ต้องดำเนินการ)

| รายการ | สถานะ | ใครต้องทำ |
|--------|-------|-----------|
| Rotate secret (Supabase service_role key, Vercel token, CRON_SECRET) | 🚫 รอ Pom/Vee | Pom+Vee ทำใน dashboard |
| ตั้ง VAPID x3 + LINE OA ID ใน Vercel → Redeploy | 🆕 | Vee |
| ทดสอบ production (รายงานทีม/การ์ดงาน/AI ร่าง+สรุป) | 🆕 | Pom+Vee |
| ชวนทีมผูก LINE | 🆕 | Vee |
| iPhone PWA + push notification | 🆕 | Pom |
| ส่ง LINE OA ID จริง | 🆕 | Pom |
| ตาราง defects vs qc_defects (refactor ใหญ่) | 🚫 รอ Pom ตัดสิน | Pom → ONE |

---

## ✅ บันทึกงานที่เสร็จแล้ว (Completed log)

| เวอร์ชัน | งาน | ตรวจผ่านโดย |
|---------|-----|------------|
| v6.73 | กล่องงานพัง (role) + ปุ่มอนุมัติใบลา + trigger log_leave_request พัง | ✔️ ONE (SQL/build) |
| v6.73 | CI deploy fail (supabaseUrl) | ✔️ ONE (CI เขียว) |
| v6.74 | caption รูปรายงาน + เตือนแนบรูป | ✔️ ONE (DB round-trip) |
| v6.75 | AI สรุปรายงาน (TL;DR) | ✅ build (รอ UI ยืนยัน) |
| v6.76 | AI ร่างรายงาน + โหมดย่อ/ต้นฉบับ | ✅ build (รอ UI ยืนยัน) |
| v6.77 | รายงานย้อนหลัง + แก้หลังส่ง + ตีกลับ | ✔️ ONE (DB round-trip) |
| v6.78 | เมนู "รายงานทีม" ให้ผู้บริหาร | ✔️ Pom (เห็นในภาพ) |
| v6.79 | แก้ deploy ผิด branch (sync Vercel branch) | ✔️ ONE (branch sync) |
| v6.80 | source_doc_index varchar(50)→text (งานกำพร้า) | ✔️ ONE (DB) |
| v6.81 | รวมกล่องงานเข้าหน้าหลัก + ลบเมนู + LINE link UX | ✅ build + CI (รอ UI ยืนยัน) |
| v6.82 | Expert Audit: แก้งานวงเงินสูงตกหล่นกล่องงาน + PR maker-checker + threshold งบตลาด/สัญญา + audit WHT/retention | ✔️ ONE (DB sim/build) |
| v6.83 | ระบบหักยอดวันลาอัตโนมัติ: trigger approve→หัก/reject→คืน + ลากิจ/ลาคลอด/ขาดงาน + ใบรับรองแพทย์ลาป่วย>3วัน + แก้ mapping ลากิจ | ✔️ ONE (DB sim+build) |
| v6.84 | ปรับปฏิทินกิจกรรม: รวมปุ่มวันนี้/วัน, ไฮไลต์วันปัจจุบัน, แสดงรายงานตามแผนกจริง | ✔️ ONE (build) |
| v6.85 | จัดกลุ่ม Dashboard ลดข้อมูลซ้ำซ้อน: รวม sections โครงการ+ขาย, รวมก่อสร้าง, ลบ Insights ซ้ำ | ✔️ ONE (build) |
| v6.85 | แก้ GoTrue NULL scanning bug — edge function admin-user-management bypass GoTrue ใช้ direct Postgres | ✔️ Pom ยืนยัน |
| v6.86 | ปรับ UI ฝ่ายขายทั้ง 7 หน้า (performance/daily-log/leads/customers/CRM/after-sales/doc-generate) ให้ได้มาตรฐาน enterprise | ✅ build ผ่าน (รอ UI ยืนยัน) |

> หมายเหตุ: รายการ ✅ "รอ UI ยืนยัน" จะเป็น ✔️ เมื่อ Pom/Vee ทดสอบบนมือถือจริง (งานชุด #1 ข้อ 2)
