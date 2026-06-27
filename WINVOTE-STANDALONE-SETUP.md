# WINVOTE — Playbook แยกร่างเป็นเอกเทศ + Deploy (พร้อมหยิบไปทำ)

> เป้าหมาย: WinVote เป็น **repo + deploy + DB แยกขาดจาก AVIVA สมบูรณ์** — main = แอป WinVote, ไม่มี branch ปนกัน
> สถานะโค้ด: `winvote-dev` (ใน AVIVA-ONE) = WinVote app, build เขียว, พร้อมย้ายออก
> ⚠️ งานในเอกสารนี้ต้องทำจากที่ที่ **เข้า GitHub/Netlify ได้** (Claude Backend ติดกำแพง network + GitHub ล็อก aviva-one) → เหมาะให้ผู้ใช้ หรือ Cowork ทำ

---

## สถาปัตยกรรมเป้าหมาย
```
GitHub: WUTTISAK818/WINVOTE   (ใหม่ แยกจาก AVIVA-ONE)
   └─ main = แอป WinVote ล้วน
        ├─ Netlify/Vercel site → deploy จาก main อัตโนมัติ
        └─ Supabase project WinVote (gfnelofmgzqfwvlbaabd) = ฐานข้อมูลของตัวเอง
```
→ ไม่แตะ AVIVA · main = WinVote · deploy เองทุก push · ไม่ต้องเลือก branch

---

## ค่าที่ต้องใช้ (อ้างอิง)
| รายการ | ค่า |
|---|---|
| Source repo | `https://github.com/WUTTISAK818/AVIVA-ONE` |
| Source branch | `winvote-dev` (โค้ด WinVote ล่าสุด build เขียว) |
| Repo ปลายทาง | `WUTTISAK818/WINVOTE` (สร้างใหม่) |
| Supabase project | WinVote = `gfnelofmgzqfwvlbaabd` (ap-southeast-1) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gfnelofmgzqfwvlbaabd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (อยู่ใน `.env.example` — public ปลอดภัย) |
| `NEXT_PUBLIC_DEMO_MODE` | `1` = โหมดทดสอบ (ไม่ต้องมี DB) / production ใช้ DB จริง = ปล่อยว่าง |

---

## PHASE 1 — สร้าง repo WINVOTE (main = WinVote)

### วิธี A — git CLI (สะอาดสุด, แนะนำ)
```bash
# 1. สร้าง repo เปล่า WUTTISAK818/WINVOTE ก่อนที่ https://github.com/new (Private)

# 2. clone source + เลือก branch WinVote
git clone https://github.com/WUTTISAK818/AVIVA-ONE.git winvote
cd winvote
git checkout winvote-dev

# 3. ดัน winvote-dev ขึ้นเป็น main ของ WINVOTE
git push https://github.com/WUTTISAK818/WINVOTE.git winvote-dev:main
```
ผลลัพธ์: `WINVOTE` มี `main` = แอป WinVote ทันที

### วิธี B — เบราว์เซอร์ล้วน (ไม่ต้อง git)
1. `https://github.com/new/import`
2. Source: `https://github.com/WUTTISAK818/AVIVA-ONE` · ชื่อ `WINVOTE` · Private
3. หลัง import: **Settings → Branches → Default branch** → เปลี่ยนเป็น `winvote-dev`
   (หรือ rename `winvote-dev` → `main`)
> หมายเหตุ: วิธี B จะติด branch อื่นของ AVIVA มาด้วย (ลบทีหลังได้) — วิธี A สะอาดกว่า

---

## PHASE 2 — Deploy (เลือก Netlify หรือ Vercel)

### Netlify
1. app.netlify.com → **Add new site → Import from GitHub** → เลือก `WUTTISAK818/WINVOTE`
2. Production branch = `main` (default — ไม่ต้องแก้แล้ว เพราะ main = WinVote)
3. Build settings ขึ้นเองจาก `netlify.toml` (`npm run build` + `@netlify/plugin-nextjs`)
4. **Environment variables:**
   ```
   NEXT_PUBLIC_DEMO_MODE = 1        # ทดสอบไม่ต้องมี DB
   # production จริง: เอา DEMO_MODE ออก แล้วใส่ 3 ตัวนี้แทน
   NEXT_PUBLIC_SUPABASE_URL = https://gfnelofmgzqfwvlbaabd.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = <จาก .env.example>
   SUPABASE_SERVICE_ROLE_KEY = <จาก Supabase dashboard → Settings → API>
   ```
5. Deploy → ได้ URL

### Vercel (ทางเลือก — Next.js native)
1. vercel.com (บัญชีใหม่ที่เตรียมไว้) → Add New → Project → Import `WUTTISAK818/WINVOTE`
2. Framework = Next.js (auto) · Production branch = `main`
3. Environment Variables = เหมือน Netlify ข้างบน
4. Deploy

---

## PHASE 3 — เปิดฐานข้อมูล + รัน migration (ทำเมื่อพร้อม)
> ติด Supabase free 2-project limit → ต้อง pause AVIVA PLUS หรือ upgrade ก่อน (คนละเรื่องกับ Netlify/Vercel)

เมื่อ WinVote DB = ACTIVE → รัน SQL ตามลำดับ (Supabase SQL Editor หรือ MCP):
```
1. winvote-backup/winvote-schema-migration.sql   (schema + tables + views)
2. winvote-backup/seed-winvote-schema.sql        (ข้อมูล + 185 units)
3. winvote-backup/create-demo-users.sql          (ผู้ใช้ล็อกอิน)
4. winvote-backup/01-voter-roll.sql              (เทียบบัญชี — แก้ C1)
5. winvote-backup/02-rls-district-scoping.sql    (RLS แยกเขต — แก้ C2)  *ทดสอบ JWT non-admin
6. winvote-backup/03-verification-tables.sql     (fields + dedup + log + reconciliation)
7. winvote-backup/04-consent-retention.sql       (PDPA — แก้ C4)
```
ตรวจ: `select count(*) from winvote.unit_results;` ควรได้ **185**

---

## Checklist ยืนยันว่า "แยกขาด"
- [ ] repo `WINVOTE` แยก (main = WinVote, ไม่มีโค้ด AVIVA)
- [ ] Netlify/Vercel site เชื่อม `WINVOTE` (ไม่ใช่ AVIVA-ONE)
- [ ] เปิดเว็บเห็นหน้า "WinVote · ระบบเครือข่ายฐานเสียง"
- [ ] DB ชี้ project WinVote เท่านั้น (ไม่แตะ AVIVA ONE/PLUS)
- [ ] ลบ AVIVA-ONE ทิ้ง WinVote ยังทำงานได้ = แยกขาดสมบูรณ์

---

## สิ่งที่ทำเสร็จแล้ว (จุดเริ่มต้น)
- ✅ `winvote-dev` = WinVote app build เขียว (Monte Carlo, checkVoterRoll, trust score, ฯลฯ)
- ✅ `netlify.toml` แก้แล้ว (ลบ publish=.next — กัน Site not found)
- ✅ SQL 01-04 + schema/seed/users เขียนครบ รอรัน
- ✅ เอกสาร: DESIGN, AUDIT 1&2, SECURITY-NOTES, HANDOFF, STATUS, MESSAGES, EXECUTIVE-SUMMARY

> เหลือแค่ PHASE 1-2 (ย้ายออก + deploy) = งานที่ผู้ใช้/Cowork ทำ · PHASE 3 (DB) รอปลดล็อก Supabase
