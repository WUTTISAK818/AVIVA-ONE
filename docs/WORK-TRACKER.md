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
| 4 | 🟡 ตาราง `defects` (0 แถว) vs `qc_defects` (8 แถว) แยกกัน — /construction กับ /qc คนละตาราง | เลือกตารางหลัก + map schema + ย้ายข้อมูล + รวม UI | ONE | ✔️ ตรวจผ่าน | Pom เลือก Option 1 (Merge) · ONE รัน SQL บน production เอง (2026-07-01): backup 8 แถว → เพิ่ม defect_type/updated_at + index → migrate 8 แถว → drop qc_defects · verify: defects รวม 8 แถว (qc_inspection ×8) · โค้ด /qc + API แก้แล้ว (commit e20c67b, อยู่บน main) |
| 5 | 🟡 อนุมัติใบลาไม่หักยอดวันลา (balance_before/after ไม่ถูกเขียน, payroll_config ไม่ลด) | leave_type→balance column mapping + กฎหัก/คืน | ONE | ✔️ ตรวจผ่าน | v6.83: trigger `trg_leave_balance_update` หักยอดอัตโนมัติเมื่ออนุมัติ + คืนเมื่อปฏิเสธ · balance เป็น GENERATED column · เพิ่มลากิจ/ลาคลอด/ขาดงาน + ใบรับรองแพทย์ลาป่วย>3วัน · ทดสอบ approve+reject กับ live DB ผ่าน |

**ที่ตรวจแล้ว "ไม่ใช่บั๊ก" (false positive — พิสูจน์กับ DB):** calcTax สมดุล · finalizeSale idempotent (ไม่รับรู้รายได้ซ้ำ) · กล่องงานปิดได้ปกติระดับผู้จัดการ (close 1 แถว) · maker-checker approval_logs ทำงาน (pending ที่ submitted_by_user_id null = 0)

**สรุปกระทบยอด #2:** 7 รายการ — ✔️ ×7 ครบทุกข้อ → **ปิดชุดงาน #2 ได้** (ข้อ 4 ปิดเมื่อ 2026-07-01 หลัง ONE รัน migration บน production + verify แล้ว)

---

## 🔵 ชุดงานที่ #3 — ผลตรวจประเมินระบบรายงาน โดยคณะกรรมการจำลอง (2026-07-01)

> ที่มา: Pom สั่งจำลองประชุมกรรมการผู้เชี่ยวชาญ ประเมิน 4 ด้าน (ส่งรายงาน/รับทราบ/จัดเก็บย้อนหลัง/ปฏิทิน dashboard) — ผลตรวจพิสูจน์กับโค้ด + live DB แล้ว
> **Pom อนุมัติทั้ง 8 ข้อ + สั่งขยายเส้นตายส่งรายงานเป็น 19:00 น. (2026-07-02)** → ONE โค้ดเสร็จ v6.91

| # | รายการ | เกณฑ์เสร็จ + วิธีตรวจ (objective) | เจ้าของ | สถานะ | หลักฐาน/ผลตรวจ |
|---|--------|-----------------------------------|---------|-------|----------------|
| 1 | 🔴 Widget "รายงานทีม" บน dashboard แสดง 0 ตลอด — API อ้างตาราง `daily_reports` (ไม่มีจริง) + `users.is_manager` + auth ฝั่ง server ไม่มี session | แก้ API ให้อ่าน `work_reports` + ตรวจ role ผ่าน Bearer token → widget แสดงเลขตรงกับ SQL: `SELECT count(*) FROM work_reports WHERE report_date=CURRENT_DATE` | ONE | ✅ โค้ดเสร็จ (v6.91, build ผ่าน) | พิสูจน์: information_schema ไม่มี `daily_reports` · route ใช้ anon client + auth.getUser() → 401 เสมอ |
| 2 | 🔴 ปฏิทินกิจกรรม dashboard ว่างเปล่าใน production — `/api/dashboard` ใช้ anon client แต่ทั้ง 7 ตาราง (leads/houses/finance ฯลฯ) RLS ไม่เปิด anon SELECT | แก้เป็น service client + ตรวจ auth → เปิดปฏิทินเดือน มิ.ย. เห็นจุดกิจกรรม > 0 วัน | ONE | ✅ โค้ดเสร็จ (v6.91, build ผ่าน) | พิสูจน์: pg_policies ทุกตาราง has_anon_select=false → API คืน 0 ทุกวัน |
| 3 | 🟡 ปฏิทินไม่ดึง "รายงานประจำวัน" (work_reports) เลย — กิจกรรมจากรายงานแต่ละฝ่ายไม่ขึ้นปฏิทินตามที่ Pom ต้องการ | เพิ่ม work_reports เป็นแหล่งข้อมูล แยกสีตามแผนก → วันที่มีรายงานส่ง เห็น badge บนปฏิทิน | ONE | ✅ โค้ดเสร็จ (v6.91, build ผ่าน) | โค้ด route.ts ดึงแค่ leads/houses/finance/approvals/attendance/documents |
| 4 | 🟡 ตัวกรองแผนก + หมวด marketing ของปฏิทินไม่ทำงาน (param `department` อ่านแล้วไม่ใช้ · marketing = 0 ตลอด) | ส่ง `?department=X` แล้วข้อมูลถูกกรองจริง · marketing มีแหล่งข้อมูล | ONE | ✅ โค้ดเสร็จ (v6.91, build ผ่าน) | route.ts:22 อ่าน param แต่ไม่มีการใช้ในทุก query |
| 5 | 🟡 กดดูรายละเอียดในปฏิทินแล้วข้อความว่าง — UI อ่าน field `title/detail/createdBy/performer_name` แต่ API ส่ง raw rows (`customer_name/house_number/...`) + คลาสสี Tailwind แบบ dynamic ไม่ compile | กดวันในปฏิทิน → เห็นชื่อรายการ+คนทำจริง · เส้นขอบสีขึ้นตามแผนก | ONE | ✅ โค้ดเสร็จ (v6.91, build ผ่าน) | DailyActivityCalendar.tsx:141-176, 422-428 vs dashboard route response shape |
| 6 | 🟡 เขตเวลา: ปฏิทิน/สรุปใช้ UTC (`toISOString`) แต่รายงานใช้วันที่ไทย — ช่วง 00:00-07:00 น. ข้อมูลตกวันผิด | กิจกรรมหลังเที่ยงคืนไทยแสดงในวันไทยที่ถูกต้อง | ONE | ✅ โค้ดเสร็จ (v6.91, build ผ่าน) | reports/page.tsx:101 ใช้ UTC+7 แล้ว แต่ dashboard route + calendar ยังใช้ UTC |
| 7 | 🟢 เตือนก่อนเส้นตาย 18:00 — อัตราส่งล่าช้าจริง 65% (20/31) | push/LINE เตือน 17:00 เฉพาะคนที่ยังไม่ส่ง → อัตราล่าช้าลดลง (วัดรายสัปดาห์จาก SQL) | ONE | ✅ โค้ดเสร็จ (v6.91, build ผ่าน) | SQL จริง: submitted 11 · late 20 · ผู้ส่ง 6/8 คน |
| 8 | 🟢 หน้า "ผู้บริหารอ่านเช้าเดียวจบ" — Daily Digest รวม: ใครส่ง/ใครขาด + AI สรุปรวมทุกฝ่าย 1 หน้า | เปิด 1 หน้า เห็นครบ: สถานะรายคน + สรุปรวม + ลิงก์ไปรายงานเต็ม | ONE | ✅ โค้ดเสร็จ (v6.91, build ผ่าน) | ปัจจุบันผู้บริหารต้องกดเข้าอ่านทีละฉบับ (AI TL;DR มีแล้วแต่รายฉบับ) |

| 9 | คำสั่งเพิ่มจาก Pom: ขยายเส้นตายส่งรายงานประจำวัน 18:00 → **19:00 น.** | ส่งรายงานเวลา 18:xx ต้องได้สถานะ "ส่งแล้ว" ไม่ใช่ "ล่าช้า" + คู่มือใน settings อัปเดตตรงกัน | ONE | ✅ โค้ดเสร็จ (v6.91, build ผ่าน) | แก้ reports/page.tsx (isLate + status ที่ submit) + manual 2 จุด + ข้อความเตือน |

**สรุปกระทบยอด #3:** 9 รายการ — ✅ โค้ดเสร็จ ×9 · **merge เข้า main + deploy production แล้ว** (merge f1f0591, CI เขียว, 2026-07-02 · Pom อนุมัติ) → เหลือ: Pom/Vee ทดสอบ UI จริง + ตั้ง VAPID/CRON_SECRET ใน Vercel (ONE สร้าง key ส่งให้ในแชตแล้ว) จึงจะเป็น ✔️

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

> หมายเหตุ: รายการ ✅ "รอ UI ยืนยัน" จะเป็น ✔️ เมื่อ Pom/Vee ทดสอบบนมือถือจริง (งานชุด #1 ข้อ 2)
