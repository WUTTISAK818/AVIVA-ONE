# WinVote — คู่มือ Deploy แบบแยกขาด (Standalone — ไม่แตะ AVIVA ONE เด็ดขาด)

โมดูล WinVote (เครือข่ายฐานเสียง) เป็น **แอปอิสระเต็มตัว** แยกขาดจาก AVIVA ONE ทุกชั้น
เอกสารนี้คือสถานะล่าสุด + ขั้นตอน deploy เป็นโปรเจกต์ของตัวเองโดยไม่กระทบ AVIVA

> ⚠️ **กฎเหล็ก:** ห้ามแตะ AVIVA ONE / branch `main` / Vercel project `aviva-private` เด็ดขาด
> WinVote ต้อง deploy เป็น **Vercel project ใหม่แยกต่างหาก** เท่านั้น

---

## ✅ สิ่งที่แยกขาดแล้ว (ยืนยันแล้ว)

| ชั้น | WinVote | AVIVA ONE | ปนกันได้ไหม |
|---|---|---|---|
| โค้ด | branch `winvote-only` (3 หน้า: login, winvote, redirect) | branch `main` (~50 หน้า) | ❌ คนละ branch |
| ฐานข้อมูล | Supabase `gfnelofmgzqfwvlbaabd` | Supabase `lpxerxxcbxwsjimzougk` | ❌ คนละ project |
| Auth / API key | ของ WinVote เอง | ของ AVIVA เอง | ❌ แยกระบบ |

### ฐานข้อมูล WinVote (Supabase project แยก)
- Project ref: `gfnelofmgzqfwvlbaabd` · URL: `https://gfnelofmgzqfwvlbaabd.supabase.co`
- สถานะ: **ACTIVE_HEALTHY** (restore แล้ว)
- Schema ครบ: 7 ตาราง (`winvote_*`) + 4 view KPI + RLS + `auth_role()` + storage `winvote-proof`
- Seed โครงสร้าง: 1 เทศบาล / 4 เขต / 98 ชุมชน / 185 หน่วยเลือกตั้ง ✓
- ⚠️ ทีมงาน (members) / ราษฎร (residents) = **ว่าง** (มี backup ที่ `winvote-backup/seed-backup-2026-05-29.json` — กู้ได้เมื่อต้องการ)

### ผู้ใช้ล็อกอิน — สร้างแล้ว 8 บัญชี (รหัสผ่านทุกตัว = `Demo1234`)
| อีเมล | role | เข้า WinVote ได้ |
|---|---|---|
| `demo.admin@aviva.th` | admin | ✓ |
| `demo.sales / finance / construction / accounting / hr / marketing / aftersales @aviva.th` | manager | ✓ |

> สร้าง/รันซ้ำได้ด้วย `winvote-backup/create-demo-users.sql` (idempotent)

---

## 🚀 Deploy เป็น Vercel project ใหม่ (แยกขาด ไม่แตะ main)

ทำใน Vercel ของคุณ (ผมไม่มีสิทธิ์เข้า Vercel จึงทำขั้นนี้ให้ไม่ได้):

1. **สร้าง Vercel project ใหม่** (อย่าใช้ project `aviva-private` เดิม) → Import repo `wuttisak818/aviva-one`
2. **Settings → Git → Production Branch = `winvote-only`** ← สำคัญสุด เพื่อไม่ไปแตะ `main`
3. Framework = **Next.js** (auto-detect), Root Directory = `./`
4. **Environment Variables** (ดูเทียบกับ `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://gfnelofmgzqfwvlbaabd.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbmVsb2ZtZ3pxZnd2bGJhYWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzEwMDAsImV4cCI6MjA5NjE0NzAwMH0.zpAG-5MorIEhBjd21V5XTl6snJ_RWDewV9jqR0NfyOQ`
   - *(ตัวเลือก)* `SUPABASE_SERVICE_ROLE_KEY` = ดึงจาก Dashboard WinVote → Settings → API → service_role (ความลับ อย่า commit)
   - *(ตัวเลือก)* `OPENAI_API_KEY` (อ่านบัตร ปชช.), `LINE_OA_ID`, `LINE_CHANNEL_SECRET`
   - ❗ **อย่า** ตั้ง `NEXT_PUBLIC_DEMO_MODE` บน production — ปล่อยให้ใช้ DB จริง
5. **Deploy** → ได้ production URL ของ WinVote (เช่น `winvote-xxx.vercel.app`)
6. ทดสอบ: เปิด URL → ล็อกอิน `demo.admin@aviva.th` / `Demo1234`

### LINE Webhook (เฉพาะถ้าเปิดเฟส 2)
ตั้งใน LINE Developer Console: `<โดเมน WinVote>/api/winvote/line/webhook`

---

## 🧪 ดู UI ก่อน deploy — Codespaces preview (โหมด DEMO)
- `.devcontainer/devcontainer.json` ตั้ง `NEXT_PUBLIC_DEMO_MODE=1` ไว้ → เปิด Codespace แล้วดู UI ผ่าน http ได้ทันที **ด้วยข้อมูลจำลอง ไม่ต้องล็อกอิน ไม่แตะ DB จริง**
- โหมดนี้ **เฉพาะ preview** เท่านั้น — production ที่ deploy ตามขั้นตอนข้างบนใช้ข้อมูล/ล็อกอินจริง

---

## หมายเหตุ
- โค้ดไม่ต้องแก้เพื่อสลับฐานข้อมูล — แค่เปลี่ยน env
- ฐานข้อมูล `aviva-private` ถูกล้าง `winvote_*` ออกหมดแล้ว (ไม่เหลือร่องรอย)
- การ deploy นี้ **ไม่เกี่ยวกับ `main` / AVIVA ONE เลย** — แยก branch + แยก Vercel project + แยก Supabase
