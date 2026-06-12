# aviva-plus-extract/ — Scaffold for Session 2

> **คืออะไร:** เตรียมไฟล์ Plus-only (รุ่นแก้ไขแล้ว) + script copy ไฟล์ + env template
> **ใช้เมื่อไหร่:** Session 2 (หลังขยาย MCP scope) — สร้าง `joyus818/aviva-plus` repo แล้วโยนไฟล์ในนี้ลงไป

---

## Session 2 — ลำดับงาน

### 1. สร้าง GitHub repo
```bash
gh repo create joyus818/aviva-plus --private --description "AVIVA Plus — Resident/Guard/Juristic surfaces"
# หรือใช้ mcp__github__create_repository
```

### 2. Scaffold Next.js + clone
```bash
cd /tmp
git clone https://github.com/joyus818/aviva-plus.git
cd aviva-plus
npx create-next-app@latest . --typescript --tailwind --app \
  --eslint --src-dir --import-alias "@/*" --no-turbo
```

### 3. Copy ไฟล์ Plus-only จาก ONE branch
รัน `scripts/copy-plus-files.sh` (อยู่ใน folder นี้):
```bash
bash /path/to/aviva-plus-extract/scripts/copy-plus-files.sh \
  /path/to/aviva-one /path/to/aviva-plus
```

### 4. Replace ไฟล์ shared ด้วย Plus-only versions
Copy ไฟล์ใน `src/` ของ folder นี้ไป overwrite ของ Plus repo:
- `src/app/layout.tsx` — Cormorant + IBM Plex Sans Thai (ไม่มี TARGET branching)
- `src/app/manifest.ts` — Plus brand เท่านั้น
- `src/app/page.tsx` — root redirect → `/community/announcements`
- `src/app/login/page.tsx` — login form ส่งไป `/community/announcements`
- `src/app/icon.tsx` + `apple-icon.tsx` — `A+` brand icons
- `src/components/BottomNav.tsx` — residentTabs + guard/security early return
- `src/lib/user-context.tsx` — เก็บแค่ isResident/isGuard/isJuristic
- `package.json` — ลบ `@netlify/plugin-nextjs` + `playwright` (ไม่ใช้ใน Plus)
- ลบ `src/proxy.ts` (ถ้ามี)
- **review `next.config.ts.from-one`** ก่อน rename → `next.config.ts`

### 5. Setup env
Copy `.env.example` → `.env.local`:
```bash
cp aviva-plus-extract/.env.example .env.local
```
ค่าใน `.env.example` มีของจริงเอาไปใช้ได้เลย

### 6. Build + push
```bash
npm install
npm run build  # ต้องไม่มี TypeScript error
git add . && git commit -m "Initial AVIVA Plus extraction"
git push -u origin main
```

### 7. Vercel deploy
```bash
# ผ่าน Vercel UI:
# 1. Import GitHub repo joyus818/aviva-plus
# 2. Set env vars (ดู .env.example)
# 3. Deploy → ได้ aviva-plus.vercel.app
```

### 8. Test
- `/login` → redirect `/community/announcements`
- `/community/*` — 17 routes accessible
- `/guard/*` — 8 routes
- `/security/*` — 22 routes
- Resident signup → check `auth.users` + `residents` row creation

### 9. หลัง stable
- ลบ branch `claude/aviva-plus-resident-app-wdPCx` ใน wuttisak818/aviva-one
- ลบ `aviva-plus-extract/` folder + `AVIVA-PLUS-EXTRACTION.md`
- Unpause Supabase `WinVote` project
