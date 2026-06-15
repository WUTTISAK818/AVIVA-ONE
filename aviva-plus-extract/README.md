# aviva-plus-extract/ — Scaffold for Session 2

> **คืออะไร:** เตรียมไฟล์ Plus-only (รุ่นแก้ไขแล้ว) + script copy ไฟล์ + env template
> **ใช้เมื่อไหร่:** Session 2 (หลังขยาย MCP scope) — สร้าง `joyus818/aviva-plus` repo แล้วโยนไฟล์ในนี้ลงไป

---

## Session 2 — ลำดับงาน (one-shot)

### Setup
Session ใหม่ต้องมี scope **`WUTTISAK818/aviva-plus`** (อ่าน + เขียน)

### Run
```bash
# 1. Clone ทั้งสอง repos
git clone https://github.com/WUTTISAK818/aviva-one.git /tmp/aviva-one
cd /tmp/aviva-one && git checkout claude/aviva-plus-resident-app-wdPCx && cd -
git clone https://github.com/WUTTISAK818/aviva-plus.git /tmp/aviva-plus

# 2. รัน deploy script — ทำทุกอย่างจบในคำสั่งเดียว
bash /tmp/aviva-one/aviva-plus-extract/scripts/deploy.sh /tmp/aviva-one /tmp/aviva-plus
```

Script จะ:
1. Scaffold Next.js (tsconfig + next.config + eslint + .gitignore)
2. Copy 80+ Plus surface files จาก ONE branch
3. Overlay Plus-only shared files (layout/manifest/page/login/BottomNav/user-context/icons)
4. สร้าง `.env.local` จาก `.env.example`
5. `npm install` + `npm run build` (ต้องไม่มี TypeScript error)
6. Commit + push to `main`

### Vercel deploy
ผ่าน UI (Vercel CLI ก็ได้):
1. Import `WUTTISAK818/aviva-plus`
2. Set env vars จาก `.env.example` (Supabase URL + publishable key)
3. Deploy → `aviva-plus.vercel.app`

### Smoke test
- `/` → redirect `/community/announcements`
- `/login` → form, submit สำเร็จไป `/community/announcements`
- `/community/announcements` — page load
- `/guard` — page load (ไม่มี BottomNav)
- `/security` — page load (ไม่มี BottomNav)
- สร้าง auth.user แรก: Supabase Studio → Authentication → Add user

### หลัง stable
- ลบ branch `claude/aviva-plus-resident-app-wdPCx` ใน wuttisak818/aviva-one
- ลบ `aviva-plus-extract/` folder + `AVIVA-PLUS-EXTRACTION.md` (ถ้ายังมี)
- Unpause Supabase `WinVote` project

---

## 📊 สถานะ Supabase `aviva-plus` (azstncqpwyrabwvcuxjf) — verified 12 Jun 2026

| Item | Count | Note |
|---|---|---|
| public tables | 37 | schema complete |
| auth tables | 23 | standard Supabase auth |
| houses | 55 | full village |
| residents | 3 | seed (ไม่มี auth_user_id ผูก) |
| facilities | 3 | seed |
| visitor_passes | 1 | test data |
| bills / announcements / polls / resolutions | 0 | สร้างผ่าน app |
| **auth.users** | **0** | ⚠️ ต้อง signup ก่อนใช้งาน |

## ⚠️ RLS state — ทุก table มี RLS เปิดอยู่แต่ยังไม่มี policy

40+ tables มี `rls_enabled_no_policy` warning จาก Supabase advisor:
- **ผลกระทบ:** anon/authenticated client query ผ่าน supabase-js → ได้ผลลัพธ์ว่างเปล่า
- **ทางออก:** API routes ใช้ service role → ทำงานได้ปกติ (ปัจจุบันโค้ดทำแบบนี้อยู่)
- **Session 2:** หลัง deploy แล้วถ้าพบหน้าไหน query ว่าง ต้อง:
  1. ตรวจว่า page ใช้ client supabase หรือ API route
  2. ถ้า client → ย้ายเป็น API route + service role
  3. หรือเขียน RLS policy ที่เหมาะสม

## ⚠️ Function security warnings
2 functions มี mutable search_path:
- `public.normalize_plate`
- `public.set_updated_at`

แก้ด้วย `ALTER FUNCTION ... SET search_path = ''` หลัง deploy
