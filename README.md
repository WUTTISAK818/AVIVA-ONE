# WinVote — ระบบจัดการฐานเสียงเลือกตั้งท้องถิ่น

แอปจัดการเครือข่ายหัวคะแนน / ชุมชน / หน่วยเลือกตั้ง และเก็บข้อมูลผู้มีสิทธิ์เลือกตั้ง
สร้างด้วย **Next.js (App Router)** + **Supabase**

> **แยกอิสระสมบูรณ์จาก AVIVA ONE / AVIVA PLUS** — ใช้ Supabase project ของตัวเอง
> (`gfnelofmgzqfwvlbaabd`), คนละฐานข้อมูล คนละ env คนละ deploy
> โค้ดชุดนี้ไม่มีการเชื่อมต่อกับฐานข้อมูลหรือระบบของ AVIVA แต่อย่างใด

---

## โครงสร้างหลัก

| เส้นทาง | หน้าที่ |
|---|---|
| `/` | หน้าแรก / redirect |
| `/login` | เข้าสู่ระบบ |
| `/winvote` | แดชบอร์ดหลัก (เขต/ชุมชน/หัวคะแนน/หน่วย/ผู้มีสิทธิ์) |
| `/api/winvote/extract-id` | อ่านบัตรประชาชนด้วย OpenAI Vision |
| `/api/winvote/line/*` | ยืนยันเบอร์ผ่าน LINE OA (เฟส 2) |

ข้อมูลทั้งหมดอ่าน/เขียนผ่าน schema `winvote` ใน Supabase project ของ WinVote เท่านั้น

---

## 1. ตั้งค่า Environment

คัดลอก `.env.example` เป็น `.env.local` แล้วเติมค่าจริง:

```bash
cp .env.example .env.local
```

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL ของ Supabase project WinVote |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (public, ป้องกันด้วย RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role — ตั้งใน Vercel env เท่านั้น ห้าม commit |
| `OPENAI_API_KEY` | อ่านบัตร ปชช (ไม่มีก็ได้ จะ fallback ให้กรอกเอง) |
| `LINE_OA_ID`, `LINE_CHANNEL_SECRET` | ยืนยันเบอร์ผ่าน LINE (เฟส 2) |

> ค่า URL/anon ของ project WinVote ใส่ไว้ใน `.env.example` ให้แล้ว

---

## 2. ตั้งค่าฐานข้อมูล (รันครั้งเดียวตอนเริ่ม)

รัน SQL ใน `winvote-backup/` ตามลำดับนี้ ผ่าน **Supabase Dashboard → SQL Editor**
(target = project WinVote `gfnelofmgzqfwvlbaabd`):

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 1 | `winvote-schema-migration.sql` | สร้าง schema `winvote` + ตาราง + view ทั้งหมด |
| 2 | `seed-winvote-schema.sql` | ใส่ข้อมูลครบชุด: เทศบาล/เขต/ชุมชน + **185 polling_units + 185 unit_results** — idempotent |
| 3 | `create-demo-users.sql` | สร้างผู้ใช้สำหรับล็อกอินจริง |

> **หมายเหตุ:** `seed-winvote-schema.sql` โหลดผลคะแนน 185 หน่วยให้ครบในตัวแล้ว
> ไฟล์ `import-unit-results.sql` เป็น **ตัวเลือกเสริม** ไว้ใช้ re-import เฉพาะผลคะแนนภายหลัง
> (idempotent, `on conflict do update`) — **ไม่ต้องรันในการ setup ปกติ**

ตรวจหลัง setup: `select count(*) from winvote.unit_results;` ควรได้ **185**

---

## 3. รันบนเครื่อง (Local)

```bash
npm install
npm run dev      # http://localhost:3000
```

## 4. Build ก่อน deploy (บังคับ)

```bash
npm run build    # ต้องเห็น ✓ Compiled successfully โดยไม่มี type error
```

## 5. Deploy (Vercel)

1. เชื่อม repo นี้กับ Vercel project
2. ตั้ง Environment Variables ให้ครบตามตารางข้อ 1
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, …)
3. Deploy จาก branch ที่ต้องการ

---

## หมายเหตุการแยกร่าง

โค้ดนี้เดิมพัฒนาอยู่ในเรปอ AVIVA-ONE แล้วแยกออกมาเป็นเรปออิสระ
หลังแยกแล้ว **ไม่มีการ sync / fork / เชื่อมต่อกลับไปที่ AVIVA-ONE** — เป็นเรปอที่ยืนด้วยตัวเองสมบูรณ์
ทั้งระดับโค้ด, ฐานข้อมูล และการ deploy
