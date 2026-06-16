# AVIVA Plus → แยก Repo Extraction Manifest

> **เอกสารชั่วคราว** — ใช้เป็น checklist ระหว่างย้าย AVIVA Plus ไป repo ใหม่
> ลบทิ้งได้หลัง extract เสร็จ + ลบ branch นี้

---

## 🟢 SESSION 1 — เสร็จแล้ว (DB Migration Complete)

### Supabase project ใหม่ — `aviva-plus` พร้อมแล้ว
- **Project ID:** `azstncqpwyrabwvcuxjf`
- **URL:** `https://azstncqpwyrabwvcuxjf.supabase.co`
- **Region:** `ap-southeast-1` (Singapore)
- **Organization:** AVIVA (`dkvzrmjuznzweowpzxzn`)
- **Status:** ACTIVE_HEALTHY
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6c3RuY3Fwd3lyYWJ3dmN1eGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MjQ3MTEsImV4cCI6MjA5NjMwMDcxMX0.j0WiYyqcRHXr1au8xDMWWkQDY5filO5zmd2c_Bb319M`
- **Publishable key:** `sb_publishable_D0pvoxynqKJuzyY7CXvNiA_2Eau5g5e`

### Schema Applied (37 tables)
✅ Functions: `normalize_plate`, `set_updated_at`
✅ 37 tables พร้อม GENERATED columns (`license_plate_norm`, `annual_fee`)
✅ Primary keys + UNIQUE + CHECK constraints
✅ Foreign keys (intra-Plus + auth.users)
   - **ตัด FK ที่ชี้ AVIVA ONE tables ออก** (projects, customers, finance_transactions, ledger_accounts, users)
   - คอลัมน์ยังคงอยู่ (nullable UUID) แต่ไม่บังคับ referential integrity
✅ 21 secondary indexes
✅ RLS enabled บนทุก 37 tables (policies ต้องเขียนใหม่หลัง deploy)

### Data Migrated (12 ตารางที่มี data)
| ตาราง | rows |
|---|---|
| `houses` | 55 ✓ |
| `community_members` | 6 ✓ |
| `facilities` | 3 ✓ |
| `residents` | 3 ✓ (auth_user_id = NULL — รอ resident signup) |
| `resident_vehicles` | 3 ✓ |
| `guard_checkpoints` | 3 ✓ |
| `gates` | 2 ✓ |
| `visitors` | 1 ✓ |
| `visitor_passes` | 1 ✓ |
| `blacklist` | 1 ✓ |
| `meetings` | 13 ✓ (created_by = NULL — user UUID ของ ONE ไม่ portable) |
| `meeting_agendas` | 42 ✓ |

### หมายเหตุการ migrate
- `auth.users` ใน aviva-plus ว่าง — ต้องให้ resident signup ใหม่ใน Plus app
- `WinVote` ถูก paused ชั่วคราว (เพื่อปลด 2-project limit) — ค่อย unpause ทีหลัง
- FK ทั้งหมดที่ชี้ auth.users (เช่น `meetings.created_by`) ถูก SET NULL

---

## 🔴 SESSION 2 — ยังไม่ทำ (App + Deploy)

### ขั้นตอนที่เหลือ
1. **สร้าง GitHub repo:** `joyus818/aviva-plus` (private)
2. **Scaffold Next.js project** ใน repo ใหม่
3. **Copy ไฟล์ Plus-only** (รายการใน Section 1 ด้านล่าง)
4. **Merge/แปลงไฟล์ shared** (รายการใน Section 2)
5. **Update env vars** ด้วยค่า aviva-plus ด้านบน
6. **Create Vercel project** → deploy
7. **Test end-to-end**

### Prompt ที่ใช้เริ่ม Session 2
> "ทำต่อจาก spec ใน branch `claude/aviva-plus-resident-app-wdPCx` — DB พร้อมแล้ว ทำ GitHub repo `joyus818/aviva-plus` + copy Plus code + Vercel deploy"

### ก่อนเริ่ม Session 2 — ผู้ใช้ต้อง
1. ขยาย MCP scope เพิ่ม `joyus818/aviva-plus` (https://code.claude.com/docs/en/claude-code-on-the-web)
2. ยืนยัน Vercel account login ด้วย joyus818@gmail.com

---

## 1. ไฟล์ที่ต้องย้ายแบบ "copy ตรงๆ" (Plus only)

### หน้า (pages) — 47 ไฟล์
```
src/app/community/         # 17 ไฟล์ — Resident surface
  announcements/{[id]/,page}.tsx
  bills/{[id]/,page}.tsx
  facilities/page.tsx
  finance/page.tsx
  governance/page.tsx
  parcels/page.tsx
  polls/{[id]/,page}.tsx
  resolutions/[id]/page.tsx
  service-requests/{new/,page}.tsx
  visitors/{new/,page}.tsx
  layout.tsx, page.tsx

src/app/guard/             # 8 ไฟล์ — Security Guard surface
  incidents/{new/,page}.tsx
  parcels/page.tsx
  patrol/page.tsx
  queue/page.tsx
  walk-in/page.tsx
  layout.tsx, page.tsx

src/app/security/          # 22 ไฟล์ — Juristic Manager surface
  announcements/, bills/, blacklist/, committee/, documents/,
  gate-events/, gates/, governance/, incidents/, meetings/,
  mock-alpr/, polls/, reports/, residents/, resolutions/,
  service-requests/, treasury/{,budget/}, vendors/, visitor-logs/
  layout.tsx, page.tsx

src/app/v/[qr_token]/page.tsx  # 1 ไฟล์ — Visitor pass landing
```

### API routes — 8 ไฟล์
```
src/app/api/announcements/
src/app/api/bills/
src/app/api/gate-events/
src/app/api/gates/
src/app/api/juristic-journals/
src/app/api/residents/
src/app/api/resolutions/
src/app/api/visitor-passes/
```

### Components — 9 ไฟล์
```
src/components/community/   # 3 ไฟล์
  AvivaPlusWordmark.tsx
  CommunityHero.tsx
  CommunityQuickActions.tsx

src/components/security/    # 6 ไฟล์
  ComingSoon.tsx
  GateTrafficChart.tsx
  GuardShell.tsx
  QRCodeDisplay.tsx
  QrCameraScanner.tsx
  RoleGate.tsx
```

### Libs — 2 ไฟล์
```
src/lib/aviva-plus-font.ts
src/lib/gate-events.ts
```

---

## 2. ไฟล์ที่ "ต้อง merge/แปลง" (ใช้ร่วม, ไม่ copy ตรง)

| ไฟล์ | จัดการยังไง |
|---|---|
| `src/app/layout.tsx` | ไม่ copy ตรง — ใน Plus repo เขียนใหม่ให้ใช้ Cormorant + IBM Plex Sans Thai เป็น default (ไม่ต้องมี TARGET branching อีก) |
| `src/components/BottomNav.tsx` | ใน Plus repo เก็บแค่ `residentTabs` + `/guard/*` early return (ไม่ต้องมี staffTabs) |
| `src/app/login/page.tsx` | ใน Plus repo redirect ไป `/community/announcements` เสมอ — ไม่ต้องมี DEMO_ACCOUNTS ของ ONE |
| `src/app/manifest.ts` | เขียนใหม่: `name: "AVIVA Plus"`, theme `#0A1F1A`, categories `["lifestyle","social"]` |
| `src/app/icon.tsx`, `apple-icon.tsx` | เขียนใหม่: ใช้ Plus brand เท่านั้น |
| `src/proxy.ts` | **ลบทิ้ง** — Plus repo ไม่ต้อง gate routes แล้ว |
| `src/lib/user-context.tsx` | Plus repo เก็บแค่ `isResident`, `isGuard`, `isJuristic` — ตัด CRM/department flags ออก |

---

## 3. env vars ที่ต้องตั้งใน Vercel

```env
NEXT_PUBLIC_SUPABASE_URL=https://azstncqpwyrabwvcuxjf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_D0pvoxynqKJuzyY7CXvNiA_2Eau5g5e
# Optional — JWT legacy key (เผื่อ library เก่าใช้):
# NEXT_PUBLIC_SUPABASE_LEGACY_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6c3RuY3Fwd3lyYWJ3dmN1eGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MjQ3MTEsImV4cCI6MjA5NjMwMDcxMX0.j0WiYyqcRHXr1au8xDMWWkQDY5filO5zmd2c_Bb319M
```

---

## 4. Step-by-step extraction (Session 2)

```bash
# 1. สร้าง repo เปล่าใน GitHub (joyus818/aviva-plus, private)

# 2. Scaffold Next.js + copy Plus files
npx create-next-app@latest aviva-plus --typescript --tailwind --app
cd aviva-plus
# rsync Section 1 ไฟล์ทั้งหมด

# 3. Merge/แปลงไฟล์ shared ตาม Section 2

# 4. ตั้ง .env.local + push ไป GitHub

# 5. Vercel: import repo → set env vars จาก Section 3 → deploy

# 6. Test:
#    - /login → redirect /community/announcements
#    - /community/* — list 47 routes accessible
#    - /guard/* — guard view
#    - /security/* — juristic view
#    - Resident signup → check auth.users + residents row creation

# 7. หลัง stable:
#    - ลบ branch claude/aviva-plus-resident-app-wdPCx ใน wuttisak818/aviva-one
#    - ลบ AVIVA-PLUS-EXTRACTION.md ไฟล์นี้
#    - Unpause WinVote ใน Supabase
```

---

## 5. Decisions ที่ตัดสินใจแล้ว (สำหรับ Session 2)

| # | คำถาม | คำตอบ |
|---|---|---|
| D1 | Supabase project name | `aviva-plus` ✓ (สร้างแล้ว) |
| D2 | Users table strategy | **A** — Plus auth แยกออกจาก ONE |
| D3 | Domain | `aviva-plus.vercel.app` (free) — custom domain ทีหลัง |
| D4 | Repo | `joyus818/aviva-plus` (private) — รอ MCP scope ใน Session 2 |
