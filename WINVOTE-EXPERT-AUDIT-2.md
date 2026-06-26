# WinVote — รายงานคณะกรรมการผู้เชี่ยวชาญ (การประเมินครั้งที่ 2)
### Expert Committee Review · Round 2 · 26 มิถุนายน 2569

> คณะกรรมการ 5 ท่าน: Software Architect · Cybersecurity · DevOps & Performance · UX/UI · Product Owner & QA
> ประเมินโค้ดจริง + ดีไซน์ + สถานะล่าสุด (หลังอัปเกรด Monte Carlo, data contract, bug fixes)
> เทียบครั้งที่ 1: ~54/100 → ครั้งนี้ ~5.4/10 (สอดคล้องกัน — ยังเป็น "ดีไซน์ A− / โค้ดบังคับใช้จริง C")

---

## บทเปิดจากประธานคณะกรรมการ
WinVote คิดมาดีเกินมาตรฐานทั่วไป และรอบนี้เห็นพัฒนาการชัด (โมเดลพยากรณ์ Monte Carlo, data contract เทียบบัญชี, แก้ bug หลายจุด)
มติเอกฉันท์: ช่องว่างอันตรายสุดยังเป็น **"ดีไซน์ระดับ A− แต่โค้ดที่บังคับใช้จริงระดับ C"** — กลไกความปลอดภัย/กันโกงสำคัญเตรียม SQL ไว้แล้วแต่ยังไม่บังคับใช้ (ติด DB ปิด) → **ยังไม่ควรแตะข้อมูลประชาชนจริง**

---

## กรรมการที่ 1 — Software Architect (7.0/10)
**หัวข้อ:** การแบ่งชั้นโค้ด · schema · ความยืดหยุ่น · state

**จุดเด่น:** แบ่งชั้นสะอาด (lib/UI/api) · schema normalize ดี (partial unique, on-delete เหมาะสม) · data contract + checkVoterRoll (DEMO+RPC) · TS strict ผ่าน · มีข้อมูลจริง 185 หน่วย

**ข้อกังวล:**
1. page.tsx ~950 บรรทัด รวม 8 component — เทอะทะ
2. state drill-down ซ้อน + refetch cascade manual → เปราะ (ควร React Query)
3. dedup ขัดกัน (unique vs contested) → ต้อง partial unique (มีใน 03)
4. trust_score ควร compute (มี computeTrustScore แล้ว)
5. AGENTS.md พูดถึง aviva-app-gpt คนละโปรเจกต์

**Checklist:** แยก page.tsx · React Query · รัน 03 (partial unique) · ตรวจ setForm ครบ field · type contract ตรง schema · แยก AGENTS.md

**คะแนน 7.0/10** — สถาปัตยกรรมแข็งแรง แต่ page.tsx ใหญ่ + state เปราะ

---

## กรรมการที่ 2 — Cybersecurity Expert (4.0/10)
**หัวข้อ:** ล็อกอิน · RLS/สิทธิ์ · PII/PDPA · API · secrets

**จุดเด่น:** anon บล็อกสนิท · webhook ตรวจ signature (timingSafeEqual) · OCR ไม่เก็บรูปบัตร · service_role server-only · ปุ่ม demo ซ่อน · มี SQL 02/04 เตรียมแก้

**ข้อกังวล:**
1. [CRITICAL] RLS using(true) ยังบังคับใช้จริง → ทุก login เห็น/แก้/ลบ PII ทุกเขต (02 ยังไม่รัน)
2. [CRITICAL] PDPA: เลขบัตร plaintext + ไม่มี consent/retention จริง (04 ยังไม่รัน) + รูปบัตรไป OpenAI ข้ามประเทศ
3. [HIGH] DEMO_MODE=1 = ปิด auth ทั้งระบบ (แค่ warn ไม่บังคับ)
4. [HIGH] Demo1234 บน 5 บัญชีจริง + public signup ไม่บังคับในโค้ด
5. [MEDIUM] บัญชีผู้มีสิทธิ์บนมือถือลูกทีมไม่เข้ารหัส/ลบ

**Checklist:** รัน 02 + ทดสอบ JWT non-admin · เติม user_districts · build fail ถ้า DEMO_MODE+prod · ปิด signup + ลบรหัส demo · รัน 04 + consent flow + retention · Storage bucket private · DPA OpenAI

**คะแนน 4.0/10** — มีของแก้เตรียมดี แต่ของจริงวันนี้เปิด PII ทุกเขต = ห้ามใช้จริง

---

## กรรมการที่ 3 — DevOps & Performance Engineer (5.0/10)
**หัวข้อ:** ความเร็ว/memory มือถือ · scale · deploy · offline

**จุดเด่น:** Next 16 + plugin · แก้ netlify.toml ถูก (ลบ publish=.next + Node 22) · Monte Carlo client-side

**ข้อกังวล:**
1. Monte Carlo 2000×4 รันใหม่ทุกครั้งขยับ slider → มือถือเก่ากระตุก (ควร debounce+cache)
2. rate limit in-memory Map บน serverless = ไร้ผล → OCR ถูกยิงไม่จำกัด
3. PollingTab ดึง residents ทั้งหมดนับ client-side (ไม่มี pagination)
4. offline อ้างในดีไซน์แต่ไม่มีจริง + KillServiceWorker ฆ่า SW
5. Next 16 + plugin v5 (ไม่มี v6) ยังต้องพิสูจน์บน build จริง

**Checklist:** debounce+cache Monte Carlo · rate limit store ภายนอก · จำกัด payload รูป · pagination+count ฝั่ง DB · ตัดสินใจ offline (IndexedDB หรือถอด KillSW) · ทดสอบ Netlify build Next16 · วัด bundle+Lighthouse 3G

**คะแนน 5.0/10** — deploy แก้ถูกทาง แต่ rate-limit ไร้ผล + ไม่มี offline จริง + คำนวณหนัก client

---

## กรรมการที่ 4 — UX/UI Designer (6.0/10)
**หัวข้อ:** Navigation · สี/contrast · ฟอนต์ · ความง่าย · accessibility ผู้สูงอายุ

**จุดเด่น:** มือถือสะอาด ธีมสม่ำเสมอ · มี AccessibilityControls · flow เพิ่มผู้มีสิทธิ์รวมใน sheet เดียว · มี loading/empty state

**ข้อกังวล:**
1. โหมดง่ายผู้สูงอายุ (บัตร+เบอร์+ส่ง) ยังไม่มีในโค้ด — ฟอร์มจริง ~8 ช่อง+2 กล้อง
2. ธีมพื้นเข้ม/ตัวอักษรทอง — กลางแดด contrast อาจต่ำ
3. 5 แท็บจอแคบ + ฟอนต์เล็ก (10-11px) — touch/อ่านยาก
4. หน้าวิเคราะห์ slider 8 ตัว/เขต — overwhelm
5. ผล Monte Carlo ขยับทุกครั้ง (สุ่ม) อาจสับสน

**Checklist:** โหมดง่าย 3 สเต็ป · contrast+ฟอนต์ใหญ่ (โหมดกลางแจ้ง) · ฟอนต์ ≥14px / touch ≥44px · ตรวจ 5 แท็บจอ ≤360px · preset+คำอธิบายในหน้าวิเคราะห์ · ทดสอบกับผู้สูงอายุ 3-5 คน

**คะแนน 6.0/10** — ฐาน UI ดี แต่ยังไม่ตอบโจทย์ผู้สูงอายุภาคสนามกลางแดด

---

## กรรมการที่ 5 — Product Owner & QA Lead (5.0/10)
**หัวข้อ:** ความถูกต้อง core logic · ช่องว่าง design vs build · edge cases

**จุดเด่น:** โมเดลพยากรณ์ถูกขึ้นมาก (plurality + max(v1,v3,v4) + Monte Carlo) · validateThaiId checksum · checkDuplicate+checkVoterRoll พร้อมในlib · แยกตัวตน/เจตนา = ไอเดียดีสุด

**ข้อกังวล:**
1. [CRITICAL] checkVoterRoll มีในlib แต่ยังไม่เชื่อมเข้าหน้าเก็บข้อมูล → กรอกเลขปลอม 50 ใบได้
2. [CRITICAL] double opt-in เจตนายังไม่ build (LINE เช็คแค่เจ้าของเบอร์) → เคส "พ่อแม่เอาบัตรลูกมา" จับไม่ได้จริง
3. reconciliation + lifecycle ยังเป็นกระดาษ
4. dedup "captured_at ก่อน=เจ้าของ" ยังไม่ใช่พฤติกรรมจริง
5. edge cases ไม่จัดการ: offline save / GPS deny / OCR ผิด / จำนวนผู้สมัครเปลี่ยน

**Checklist:** เชื่อม checkVoterRoll เข้าฟอร์ม (gate บันทึก) · build intent_status flow จริง · ทดสอบเลขปลอม-ผ่าน-checksum · ทดสอบ dedup ข้ามลูกทีม · ทดสอบ edge offline/GPS/OCR · เพิ่ม input จำนวนผู้สมัคร · build reconciliation+lifecycle

**คะแนน 5.0/10** — โมเดลดีขึ้น แต่ฟีเจอร์กันโกงแกน (roll-match+เจตนา) ยังไม่บังคับใช้จริง

---

## ตารางคะแนนรวม
| ด้าน | กรรมการ | คะแนน |
|---|---|---|
| โครงสร้างระบบ | Software Architect | 7.0/10 |
| ความปลอดภัย | Cybersecurity | 4.0/10 |
| ความเร็ว/เสถียร | DevOps & Performance | 5.0/10 |
| UX/UI | UX/UI Designer | 6.0/10 |
| ฟังก์ชัน/QA | Product Owner & QA | 5.0/10 |
| **เฉลี่ยรวม** | | **5.4/10** |

---

## คำสั่งเร่งด่วน 3 ข้อแรก (Critical Fixes)
> ข้อ 1-2 ต้องเปิด DB ก่อน (ติด Supabase free 2-project limit = ตัวขวางอันดับ 1)

1. **ปิดช่อง PII รั่ว + กันโกง** — รัน 02-rls-district-scoping.sql (RLS แยกเขต) + เชื่อม checkVoterRoll เข้าหน้าเก็บข้อมูล → หยุด "ทุก login เห็น PII ทุกเขต" + "กรอกเลขปลอม"
2. **ปิดสวิตช์อันตราย** — บังคับ DEMO_MODE ปิดบน production (CI guard) + ปิด public signup + เปลี่ยน/ลบรหัส Demo1234
3. **build ฟีเจอร์กันโกงแกน** — ทำ double opt-in เจตนาให้เป็น flow จริง (ไม่ใช่แค่ phone_verified)

---
*การประเมินครั้งที่ 1 = ~54/100 (5 ด้าน: สถิติ/ข้อมูล/ความปลอดภัย/โค้ด/ภาคสนาม) · ครั้งที่ 2 = ~5.4/10 (5 ด้านตามบทบาทคณะกรรมการ) — ทิศทางสอดคล้องกัน*
