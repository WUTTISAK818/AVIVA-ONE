# 🏛️ AVIVA ONE — มาตรฐานการตรวจสอบคุณภาพ (QA Standard) v1.0

> **สถานะ: PERMANENT — บรรทัดฐานของทีม** อนุมัติโดย Pom (2026-07-03)
> **วิธีเรียกใช้:** Pom พูดว่า **"ตรวจสอบมาตรฐาน"** (+ ระบุเมนู/ฟีเจอร์) → ONE ตรวจตามเอกสารนี้ทั้งชุดโดยไม่ต้องสั่งเกณฑ์ใหม่
> ผลตรวจต้องจบด้วย: คะแนนรายหมวด + คะแนนรวม + ข้อเสนอแก้จัดลำดับ P1/P2/P3 + **ขออนุมัติ Pom ก่อนแก้ทุกครั้ง**

---

## ส่วน A — เกณฑ์หลัก 11 หมวด (กำหนดโดย Pom — ห้ามตัดทอน)

| # | หมวด | หัวข้อย่อยที่ต้องตรวจ |
|---|------|----------------------|
| 1 | กระบวนการทำงานหลัก (Core Business Process) | Happy Path · Alternative Path · Exception Path |
| 2 | ความถูกต้องและการเชื่อมต่อข้อมูล (Data & Integration) | Data Accuracy (การคำนวณ) · Data Flow ข้ามระบบ · Third-party Integration |
| 3 | การแสดงผลและ UX (UX/UI & Compatibility) | Responsive Design · Cross-Browser · Validation & Error Messages |
| 4 | สิทธิ์และความปลอดภัย (Access Control & Security) | Role-based Access Control (ต้องพิสูจน์ถึงชั้น RLS ใน DB) · Session Management |
| 5 | กรณีพิเศษ (Edge Cases) | Duplicate Submissions · Refresh & Back Navigation |
| 6 | ไฟล์และรายงาน (Files & Reports) | File Upload (ชนิด/ขนาด/แจ้งพลาด) · Export & Report |
| 7 | ปริมาณงานและการตอบสนอง (Performance & Load) | Page Load Time · Network Interruption |
| 8 | การเปลี่ยนผ่านระบบ (Data Migration & Deployment) | Data Migration · Post-Deployment Configuration |
| 9 | พฤติกรรมผิดพลาดของมนุษย์ (Human Errors & Edge Behaviors) | Input Injection & Format · Race Conditions (กดรัว/หลายหน้าต่าง) · Abandoned Process |
| 10 | ข้อจำกัดทางเทคนิค (Technical Constraints) | Localization & Time Zones (ไทย/พ.ศ./UTC+7) · Browser Extensions · Screen Zoom & Resolution |
| 11 | การช่วยเหลือเมื่อระบบมีปัญหา (Error Recovery & User Support) | User-friendly Error Messages (ภาษาไทย+วิธีแก้) · Fallback & Support |

## ส่วน B — มาตรฐานสากลอ้างอิง (ONE กำหนดเพิ่ม — ใช้ประกอบทุกครั้ง)

1. **ISO/IEC 25010 (Software Quality)** — map 11 หมวดเข้า 8 คุณลักษณะ: Functional Suitability(1,2) · Reliability(7,11) · Usability(3) · Security(4) · Performance(7) · Compatibility(3,10) · Maintainability · Portability(8)
2. **OWASP Top 10 (ย่อสำหรับแอปเรา)** — ทุกการตรวจหมวด 4/9 ต้องเช็ค: Broken Access Control (RLS จริงใน pg_policies ไม่ใช่แค่ UI) · Injection (parameterized เสมอ, esc() ในเอกสารพิมพ์) · Secrets ไม่อยู่ใน repo/DB · ไฟล์แนบข้อมูลอ่อนไหวต้องเป็น signed URL
3. **WCAG 2.1 ระดับพื้นฐาน** — หมวด 3: contrast อ่านได้, ปุ่มมี aria-label, focus state, ตัวหนังสือย่อขยายได้ (หน่วย rem)
4. **หลักบัญชีคู่ (Double-entry)** — ทุก flow ที่แตะเงิน: เดบิต=เครดิตเสมอ · ห้าม post ซ้ำ (idempotent/status guard) · มี audit log ทุกการแก้ไขหลังอนุมัติ
5. **Maker-Checker** — ผู้ขอห้ามอนุมัติของตัวเอง บังคับทั้ง UI และ DB trigger

## ส่วน C — กติกาการตรวจ (บังคับทุกครั้ง)

1. **หลักฐานจริงเท่านั้น** — ทุก finding ต้องอ้าง ไฟล์:บรรทัด หรือผล SQL จริง · ห้ามใช้ความจำ schema (query live เสมอ)
2. **แยก "บั๊กจริง" ออกจาก "เตือนผิด"** — สิ่งที่ตรวจแล้วผ่านต้องรายงานด้วย (กันตรวจซ้ำรอบหน้า)
3. **สิ่งที่ตรวจไม่ได้** (เช่น UI จริงติด login) ต้องระบุชัด + มอบ Pom/Vee ยืนยัน พร้อมขั้นตอนทดสอบ
4. **คะแนน:** รายหมวด 0-10 → คะแนนรวม = ค่าเฉลี่ย · 8+ = ผ่านดี · 6-8 = ใช้ได้มีจุดแก้ · <6 = ต้องแก้ก่อนขยายงาน
5. **จัดลำดับข้อเสนอ:** 🔴 P1 = กระทบเงิน/ข้อมูลหาย/ความปลอดภัย · 🟡 P2 = UX/ความถูกต้องรอง · 🟢 P3 = ต่อยอด
6. **ผลตรวจลง WORK-TRACKER เป็นชุดงานใหม่** สถานะ 🆕 รอ Pom อนุมัติ — **ห้ามแก้โค้ดก่อนได้รับอนุมัติ**
7. รายงานเป็นภาษาไทย ตาม Language Preferences ใน CLAUDE.md

## ส่วน D — มาตรฐานโค้ดที่ผู้พัฒนาต้องทำตาม (ใช้ review งานใหม่ทุกชิ้น)

- ทุกการเขียน DB ต้องเช็ค `error` และแจ้งผู้ใช้ — ห้ามล้มเหลวเงียบ
- ยอดเงินทุกฟอร์มผ่าน `parseAmount()` จาก `src/lib/money.ts` (กัน NaN/ติดลบ/ลูกน้ำ)
- ทุกการอนุมัติ/เปลี่ยนสถานะ ต้อง update แบบมีเงื่อนไขสถานะเดิม (`.eq("status","pending")`) + ตรวจแถวที่เปลี่ยนจริง
- อัปโหลดไฟล์: จำกัดชนิด (รูป/PDF) + ขนาด ≤10MB + แจ้งไฟล์ที่พลาดเป็นรายชื่อ
- แท็บ/หน้าจอที่มีสถานะ ต้อง sync ลง URL ให้ refresh แล้วไม่หลุด
- วันที่-เวลา: ใช้เวลาไทย (UTC+7) เป็นเกณฑ์เสมอ ห้ามใช้ `toISOString().split("T")[0]` กับข้อมูลเชิงวัน
- ลิสต์ข้อมูลต้องมี `.limit()` เสมอ (default ≤300) + ทางโหลดเพิ่มถ้าจำเป็น

---
*แก้ไขมาตรฐานนี้ได้เมื่อ Pom อนุมัติเท่านั้น · เวอร์ชันถัดไปให้บันทึกประวัติการแก้ท้ายไฟล์*
