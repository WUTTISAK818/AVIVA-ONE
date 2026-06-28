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
| 4 | ทบทวน/ล้าง test data (Pom อนุมัติก่อนลบ) | รายการ test ที่ตกลง เหลือ 0 (WHERE ชัดเจน review 2 ครั้ง) | Vee+Pom | 🆕 | demo_users=**11** · ใบลา test=**0** |
| 5 | iPhone: เพิ่มลงหน้าจอโฮม (PWA) + ทดสอบ push | ส่ง push ทดสอบแล้วเด้งบนมือถือ Pom จริง | Pom | 🆕 | — |

| 6 | **[ด่วน-ความปลอดภัย] Rotate secret ที่เคยหลุดใน repo** (Supabase service_role key, Vercel token, CRON_SECRET) | สร้าง key/token ใหม่ + อัปเดต Vercel env + ของเก่าใช้ไม่ได้แล้ว | Pom+Vee | 🚫 รอ Pom/Vee | ONE ลบไฟล์+เพิ่ม .gitignore แล้ว แต่ rotate ต้องทำใน dashboard |
| 7 | เก็บกวาดไฟล์ scratch/secret 18 ไฟล์ออกจาก repo | `git ls-files | grep -E 'set-vercel-env|DEMO_|create-demo'` ต้องว่าง | ONE | ✔️ ตรวจผ่าน | ลบ+push 3 branch แล้ว |
| 8 | Pom ส่ง **LINE OA ID** จริง (`@xxxxxxx`) ให้ Vee ใส่ env | ปุ่มเพิ่มเพื่อน/QR LINE ขึ้นจริง | Pom | 🆕 | รอ Pom |

**สรุปกระทบยอด #1:** 8 รายการ — 🆕 ×5 · ✔️ ×1 · 🚫 ×1(รอ rotate) · ✅ ×0 → **ยังไม่ปิดชุด** (รอ Pom/Vee วันจันทร์)

> ⚠️ **หมายเหตุรายการ "✅ build แต่ยังไม่ทดสอบ UI จริง"** (จะเป็น ✔️ เมื่อ Pom/Vee ทดสอบบนมือถือ — รวมในข้อ 2):
> AI สรุป (v6.75) · AI ร่างรายงาน (v6.76) · caption รูป (v6.74) · ย้อนหลัง/แก้/ตีกลับ (v6.77) · การ์ดงานที่ต้องทำ+ลบเมนู (v6.81)
> — ONE ตรวจ route+prompt+DB แล้ว แต่เรียก Claude ผ่าน UI จริงไม่ได้ (ติด login) จึงต้องให้คนยืนยัน

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

> หมายเหตุ: รายการ ✅ "รอ UI ยืนยัน" จะเป็น ✔️ เมื่อ Pom/Vee ทดสอบบนมือถือจริง (งานชุด #1 ข้อ 2)
