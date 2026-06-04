# WinVote — คู่มือแยกโปรเจกต์ & Deploy (อิสระจาก aviva-private)

โมดูล WinVote (เครือข่ายฐานเสียง) ถูกแยกออกจากแอป AVIVA ONE แล้ว
เอกสารนี้สรุปสถานะการแยกและขั้นตอนที่เหลือเพื่อให้เป็นโปรเจกต์อิสระสมบูรณ์

## ✅ สิ่งที่แยกแล้ว (ผมทำให้แล้ว)

### ฐานข้อมูล — Supabase project ใหม่ "WinVote" (แยกขาดจาก aviva-private)
- Project ref: `gfnelofmgzqfwvlbaabd`
- URL: `https://gfnelofmgzqfwvlbaabd.supabase.co`
- คนละ database / คนละ API key / คนละระบบ auth → **ข้อมูลปะปนกันไม่ได้**
- Schema ครบ: 7 ตาราง (`winvote_*`) + 4 view + RLS + ฟังก์ชัน `auth_role()` + storage bucket `winvote-proof`
- Seed: 1 เทศบาล / 4 เขต / 98 ชุมชน / 185 หน่วยเลือกตั้ง
- ฐานข้อมูลของ aviva-private ถูกล้าง `winvote_*` ออกหมดแล้ว (ไม่เหลือร่องรอย)

## ⏳ ขั้นตอนที่เหลือ (ต้องการคุณช่วย เพราะผมไม่มีสิทธิ์)

### 1) แยก repo (ผมสร้าง repo ใหม่ให้ไม่ได้ — จำกัดที่ aviva-one)
ตัวเลือก:
- **ก.** สร้าง repo ใหม่ชื่อ `winvote` แล้วผมช่วยจัดโค้ดลงให้ (รวมถึงตัดโมดูลอื่นของ AVIVA ONE ออกให้เหลือเฉพาะ WinVote)
- **ข.** ชั่วคราว: เชื่อม Netlify เข้ากับ branch `claude/id-card-data-extraction-bfaRS` ของ repo นี้ไปก่อน (จะได้ทั้งแอปแต่ใช้ /winvote ได้)

### 2) ตั้ง Environment Variables ใน Netlify (หรือ Vercel)
ดูรายการใน `.env.example` — ค่าที่ต้องตั้ง:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://gfnelofmgzqfwvlbaabd.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (อยู่ใน `.env.example` แล้ว — เป็น public key)
- `SUPABASE_SERVICE_ROLE_KEY` = **ความลับ** ดึงจาก Dashboard project WinVote → Settings → API → service_role (อย่า commit)
- `OPENAI_API_KEY`, `LINE_OA_ID`, `LINE_CHANNEL_SECRET` = ตามต้องการ

### 3) LINE Webhook (ถ้าเปิดใช้เฟส 2)
ตั้ง Webhook URL ใน LINE Developer Console เป็น: `<โดเมน WinVote>/api/winvote/line/webhook`

## หมายเหตุ
- โค้ดไม่ต้องแก้เพื่อสลับฐานข้อมูล — แค่เปลี่ยน env ก็ชี้ไปฐานใหม่
- ผู้ใช้ใน Supabase ใหม่ยังไม่มี — ต้องสร้าง user + ตั้ง `user_metadata.role` เป็น `admin`/`manager`
  เพื่อให้เข้าถึงข้อมูล (RLS จำกัด role privileged)
- backup ข้อมูล seed เดิม: `winvote-backup/seed-backup-2026-05-29.json`
