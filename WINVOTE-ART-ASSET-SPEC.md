# WINVOTE — ใบสั่งงานศิลป์ (Art Asset Work Order)
### มติฝ่ายศิลป์ · รายการ asset ทั้งหมดที่ต้องผลิต พร้อมสเปก + prompt สำหรับ AI

> ## 🔄 UPDATE V2 — คอนเซปต์ "สว่าง · อ่านง่าย · เพื่อผู้สูงอายุ" (ใช้เป็นค่าเริ่มต้น)
> ผู้ใช้กลุ่มหลัก = ผู้สูงอายุ → ปรับจาก "เขียวเข้ม-ทอง (พรีเมียม)" เป็น **โหมดสว่าง คอนทราสต์สูง ตัวใหญ่ปรับได้**
> - พื้น `#F4F7F4` · การ์ด `#FFFFFF` · ตัวอักษร `#1C2925` (คอนทราสต์ >12:1)
> - **สีหลัก = เขียว `#15803D`** (อ่านชัดบนขาว) · ทอง `#B07D1E` เป็น accent เท่านั้น
> - สถานะ: ชนะ `#15803D`/พื้น`#DCFCE7` · ก้ำกึ่ง `#B45309`/`#FEF3C7` · เสี่ยง `#DC2626`/`#FEE2E2`
> - ฟอนต์ปรับได้ 4 ระดับ (16/18/21/25px) — มี `AccessibilityControls` แล้ว
> - โลโก้พื้นสว่างใช้ `winvote-mark-green.svg` (วงเขียว + ✓ ทองเข้ม)
> - โทนเขียว-ทองเข้ม (เดิม) = เก็บไว้เป็น "โหมดกลางคืน/นำเสนอ"
> (ส่วนรายการ asset ด้านล่างยังใช้ได้ — เปลี่ยนแค่ปรับสีตามตารางนี้ให้สว่าง/อ่านง่าย)



> เอกสารนี้ = "คำสั่งผลิตงานศิลป์" ละเอียดพอให้ AI สร้างไฟล์ + ผู้พัฒนานำไปวางในแอปได้ทันที
> Concept: **"ป่าทอง · Trusted Prestige"** — เขียวเข้มไทย + ทอง สื่อความน่าเชื่อถือ มั่นคง มีเกียรติ เข้าถึงง่าย

---

## 🎨 0. ART DIRECTION (ใช้กับทุก asset — ห้ามหลุดกรอบ)

| รายการ | ค่า |
|---|---|
| สีพื้นเข้ม (BG) | `#0D1F1B` (เขียวป่าเข้ม) |
| สีการ์ด | `#17332D` |
| ทองหลัก | `#D4AF37` |
| ทองอ่อน/ไฮไลต์ | `#E6C77A` |
| ขาว/ตัวอักษร | `#FFFFFF` |
| โหมดสว่าง: พื้น | `#EFF3EF` · ทองเข้ม `#6B5512` |
| ฟอนต์ | IBM Plex Sans Thai |
| สถานะ | ชนะ `#4ADE80` · ก้ำกึ่ง `#FACC15` · เสี่ยง `#F87171` |

**Style keywords:** flat, minimal, premium, geometric, line-based, Thai-modern, gold-on-dark
**DO:** ทองใช้เป็น accent/แสง · เส้นคม · มุมมน 16-24px · พื้นที่ว่างเยอะ · ลายไทย (กนก/รวงข้าว) แบบ minimal
**DON'T:** ทองเป็นพื้นใหญ่ · gradient รุนแรง · ตัวอักษรในไอคอน (ใส่ทีหลังด้วยฟอนต์) · สีหลุด palette · ภาพรก

---

## 🔱 1. LOGO / BRAND MARK
**Concept สัญลักษณ์:** ตราวงกลม (seal) เส้นทอง — **เครื่องหมายถูก ✓ อยู่กลาง** ล้อมด้วย **รวงข้าว/ใบไม้ 2 ข้าง** สื่อ "เลือกตั้ง + ท้องถิ่น + ความเจริญงอกงาม"

| ไฟล์ | ขนาด | format | ใช้ที่ |
|---|---|---|---|
| `winvote-mark.svg` | vector (1:1) | SVG | สัญลักษณ์ล้วน (ไอคอน/แอป) |
| `winvote-logo-horizontal.svg` | vector | SVG | สัญลักษณ์ + คำว่า "WinVote" แนวนอน (header) |
| `winvote-logo-stacked.svg` | vector | SVG | สัญลักษณ์บน + ชื่อล่าง (login) |
| variants | — | SVG | gold-on-green / dark-on-light / white mono |

**AI prompt (mark):** *"Minimalist gold line emblem on deep forest green background, a circular seal containing a centered check mark, flanked by two symmetric rice-stalk/leaf motifs, Thai modern heraldic style, flat vector, color #D4AF37 on #0D1F1B, no text, clean geometric, 1:1"*
> คำว่า "WinVote" ใส่ด้วยฟอนต์ IBM Plex Sans Thai/Sans น้ำหนัก Bold สีทอง — ไม่ generate เป็นภาพ

---

## 📱 2. APP ICONS (มือถือ / iPad / PWA / favicon)
ทุกไอคอน = `winvote-mark` กลางพื้นเขียว `#0D1F1B` + แสงทองบางๆ มุมบน · ขอบ OS จัดการเอง (ยกเว้น maskable เว้น safe zone)

| ไฟล์ | ขนาด | format | ใช้ที่ | วางที่ (Next.js) |
|---|---|---|---|---|
| `favicon.ico` | 16/32/48 multi | ICO | แท็บเบราว์เซอร์ | `src/app/favicon.ico` |
| `icon.svg` | vector | SVG | scalable | `src/app/icon.svg` |
| `icon-192.png` | 192×192 | PNG | Android/PWA | `public/` + manifest |
| `icon-512.png` | 512×512 | PNG | PWA/สโตร์ | `public/` + manifest |
| `icon-maskable-512.png` | 512×512 (มาร์ค 70% เว้นขอบเขียว) | PNG | Android maskable | manifest `purpose:maskable` |
| `apple-touch-icon.png` | 180×180 | PNG | iPhone home | `src/app/apple-icon.png` |
| `apple-touch-icon-167.png` | 167×167 | PNG | iPad Pro | `public/` |
| `apple-touch-icon-152.png` | 152×152 | PNG | iPad | `public/` |

> หมายเหตุ: ไอคอนห้ามมีตัวอักษรเล็ก (อ่านไม่ออกตอนย่อ) — ใช้ "มาร์ค" อย่างเดียว

---

## 🖼️ 3. หน้าปก LOGIN (Cover / Hero)
| ไฟล์ | ขนาด | format | ใช้ที่ |
|---|---|---|---|
| `login-hero.png` | 1242×2208 (มือถือแนวตั้ง) | PNG/WebP | พื้นหลังหน้า login |
| `login-hero-tablet.png` | 2048×2732 | PNG/WebP | iPad |

**AI prompt:** *"Vertical mobile hero background, deep forest green gradient (#0D1F1B top to #17332D bottom), faint Thai kanok pattern in gold at 4% opacity, soft central gold glow, subtle network-of-connected-dots motif suggesting a grassroots voter network, premium minimal, no text, no people"*
> โลโก้ stacked + ปุ่มเข้าสู่ระบบ ซ้อนทับด้วยโค้ด (ไม่ฝังในรูป)

---

## 🎭 4. ภาพประกอบในหน้าต่างๆ (Illustrations)
สไตล์เดียวกัน: **เส้นทอง minimal บนพื้นโปร่ง** (โทนเขียว-ทอง)

| ไฟล์ | ขนาด | format | ใช้ที่ |
|---|---|---|---|
| `empty-residents.svg` | 240×240 | SVG | ว่าง: ยังไม่มีฐานเสียง |
| `empty-units.svg` | 240×240 | SVG | ว่าง: ไม่มีหน่วยเลือกตั้ง |
| `empty-generic.svg` | 240×240 | SVG | ว่างทั่วไป |
| `success-check.svg` | 200×200 | SVG/Lottie | ยืนยันสำเร็จ (✓ ทองเด้ง) |
| `overview-hero.svg` | 800×400 | SVG | หน้าภาพรวม: แผนผังเครือข่ายฐานเสียง |
| `onboarding-1/2/3.svg` | 320×320 | SVG | (ตัวเลือก) แนะนำการใช้งาน |

**AI prompt (empty state):** *"Minimal gold line illustration on transparent background, [subject: empty ballot box / people network / map pin], single weight thin gold strokes #D4AF37, flat, friendly, lots of negative space, Thai modern, no text"*

---

## 🔣 5. สัญลักษณ์/ไอคอนสถานะ (Custom status icons)
ใช้เป็น SVG เล็ก สี่ตามระบบสถานะ

| ไฟล์ | ขนาด | สี | ความหมาย |
|---|---|---|---|
| `status-win.svg` / `tossup` / `risk` | 20×20 | เขียว/เหลือง/แดง | โอกาสชนะ |
| `badge-chip.svg` / `photo` / `manual` | 24×24 | ทอง | วิธีเก็บข้อมูล (ชิป/ถ่าย/พิมพ์) |
| `intent-confirmed/pending/rejected.svg` | 20×20 | เขียว/เทา/แดง | เจตนา (ยืนยัน/รอ/ปฏิเสธ) |
| `roll-in/other/notfound.svg` | 20×20 | เขียว/เหลือง/แดง | เทียบบัญชี (ในหน่วย/คนละหน่วย/ไม่พบ) |
| `trust-ring.svg` | 48×48 | ทองไล่เฉด | วงแหวนคะแนนความเชื่อมั่น 0-100 |

> ส่วนใหญ่ใช้ lucide ได้อยู่แล้ว — รายการนี้ทำเฉพาะตัวที่ต้องการเอกลักษณ์ (badge/trust-ring)

---

## 🌐 6. SOCIAL / SPLASH
| ไฟล์ | ขนาด | format | ใช้ที่ |
|---|---|---|---|
| `opengraph-image.png` | 1200×630 | PNG | แชร์ลิงก์ (LINE/FB) | `src/app/opengraph-image.png` |
| `splash-*.png` | ตามอุปกรณ์ iOS | PNG | หน้า splash PWA | `public/` + meta |

**AI prompt (OG):** *"Social share banner 1200x630, deep forest green background, centered gold WinVote emblem, tagline area, premium minimal Thai political-tech, gold accents"* (ใส่ข้อความด้วยฟอนต์)

---

## 📦 7. การส่งมอบ + การนำไปใช้
- **format:** ไอคอน/โลโก้/สัญลักษณ์ = **SVG** (+ PNG export ตามตาราง) · ภาพปก = PNG/WebP
- **ตั้งชื่อไฟล์** ตามตารางเป๊ะ → ผู้พัฒนา map เข้า `src/app/` + `public/` + `manifest` ได้ทันที
- **ต้องมี `manifest`** (PWA): สร้าง `src/app/manifest.ts` อ้าง icon-192/512/maskable + theme_color `#0D1F1B`
- **metadata** ใน `layout.tsx`: apple-touch-icon, opengraph-image
- ส่งมาเป็นชุด zip หรือวางใน `public/brand/` แล้วผู้พัฒนาเชื่อมต่อ

---

## ✅ สรุปจำนวน asset ที่สั่งผลิต
- โลโก้/มาร์ค: **4** (+ variants)
- App icons: **8**
- หน้าปก login: **2**
- ภาพประกอบ: **6**
- สัญลักษณ์สถานะ: **~13**
- Social/splash: **2+**
**รวม ~35 ไฟล์** — ทุกตัวมีขนาด/format/prompt/ตำแหน่งวางครบ พร้อมสั่ง AI ผลิต

> ผู้ผลิต (AI/ดีไซเนอร์) ทำตามนี้ได้เลย — ส่งกลับเป็นชุดไฟล์ → ผู้พัฒนา (Cowork/Frontend) วางลงแอปตามคอลัมน์ "วางที่"
