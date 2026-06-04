# AVIVA Plus → แยก Repo Extraction Manifest

> **เอกสารชั่วคราว** — ใช้เป็น checklist ระหว่างย้าย AVIVA Plus ไป repo ใหม่
> ลบทิ้งได้หลัง extract เสร็จ + ลบ branch นี้

สถานะปัจจุบัน: PR #9 ปิดแล้ว, ไม่ merge เข้า main, branch ยังอยู่เป็นแหล่ง extract

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

## 3. Database — 32 ตาราง Plus ใน Supabase project `lpxerxxcbxwsjimzougk`

### 3a. ตาราง Plus ที่ต้องย้าย (มี data จริง)
| ตาราง | rows |
|---|---|
| `houses` | 55 |
| `community_members` | 6 |
| `facilities` | 3 |
| `residents` | 3 |
| `resident_vehicles` | 3 |
| `guard_checkpoints` | 3 |
| `gates` | 2 |
| `visitors` | 1 |
| `visitor_passes` | 1 |
| `blacklist` | 1 |
| `reservations` | 4 |
| `meetings` | 12 |
| `meeting_agendas` | 33 |

### 3b. ตาราง Plus ที่ว่าง (แค่ schema)
`announcements, bills, committee_members, community_events, facility_bookings, gate_events, guard_shifts, incidents, juristic_documents, juristic_journals, juristic_journal_lines, meeting_minutes, parcels, patrol_logs, polls, poll_options, poll_votes, resolutions, resolution_votes, service_requests`

### 3c. ตาราง "ใช้ร่วม" — ตัดสินใจก่อน
| ตาราง | ปัญหา | ทางเลือก |
|---|---|---|
| `users` (32 rows) | มีทั้ง staff + resident ปนกัน | A) ดึงเฉพาะ resident users / B) ใช้ Supabase auth ใหม่ใน Plus project + import เฉพาะ resident emails |
| `user_roles, roles, permissions` | shared RBAC | สร้างใหม่ใน Plus project ด้วย role ที่จำกัด (resident/guard/juristic) |
| `notifications` (80 rows) | ทั้ง ONE + Plus | filter เฉพาะที่ Plus เป็นเจ้าของ |
| `documents, audit_log` | shared infrastructure | สร้างใหม่ใน Plus project |
| `events` (92 rows) | คลุมเครือ — เป็น calendar events หรือ Plus community events? | check schema ก่อน |

### 3d. ตาราง AVIVA ONE — ไม่ย้าย (สรุปไว้กันลืม)
`accounting_entries, ai_logs, alert_rules, approval_logs, approvals, attendance, bank_*, budget_lines, campaigns, cash_flow, commissions, construction_reports, contractor_installments, contracts, crm_logs, customer*, dashboard_config, defects, document_sequences, employees, finance_transactions, goods_receipts, installment_*, invoices, journal_entries, kpi_settings, leads, leave_requests, ledger_accounts, marketing_budgets, materials, payments, payroll_runs, projects, purchase_orders, qc_defects, receipts, salary_records, sales_activities, stock_transactions, tax_invoices, vendors, warranty_claims, work_*`

---

## 4. Decisions ที่ owner ต้องเลือกก่อน extract

### D1. Supabase project ใหม่
- [ ] สร้าง project ชื่ออะไร? (แนะนำ `aviva-plus` หรือ `condo-plus`)
- [ ] region — เลือก `ap-southeast-1` เหมือนเดิม
- [ ] organization — ใหม่หรือใช้ org เดิม (`dkvzrmjuznzweowpzxzn`)?

### D2. ตาราง `users` จะจัดการยังไง
- [ ] **A:** Plus auth แยก — resident ต้อง login ด้วย account ใหม่ (cleanest)
- [ ] **B:** Supabase shared auth — สอง project ใช้ auth pool เดียวกัน (ซับซ้อนกว่า แต่ user ไม่ต้องสร้าง account ใหม่)

### D3. Domain name
- [ ] subdomain เช่น `plus.condo-name.com` หรือ root domain เช่น `condo-plus.app`

### D4. Repo name + visibility
- [ ] `aviva-plus`? `condo-plus`? `your-condo-app`?
- [ ] private (default) — ผ่อนคลายเป็น public ทีหลังได้

---

## 5. Step-by-step extraction (หลัง owner ตอบ D1–D4)

```bash
# 1. สร้าง repo เปล่าใน GitHub (joyus818)
# 2. Clone + scaffold Next.js
npx create-next-app@latest aviva-plus --typescript --tailwind --app

# 3. Copy ไฟล์ Plus-only จาก branch claude/aviva-plus-resident-app-wdPCx
#    ใช้ rsync/cp ตามรายการ Section 1

# 4. Merge/แปลงไฟล์ shared (Section 2) — เขียนใหม่ให้สะอาด

# 5. Setup Supabase project ใหม่ (ดู Section 3)
#    - pg_dump เฉพาะ Plus tables จาก lpxerxxcbxwsjimzougk
#    - แก้ FK ที่ชี้ users → ใช้ Plus auth (D2)
#    - apply schema + data ใน project ใหม่

# 6. Deploy บน Vercel ใหม่
#    - new project pointing to new repo
#    - env vars ของ Plus Supabase + Cormorant font + brand

# 7. ทดสอบ end-to-end บน preview
# 8. Cutover DNS
# 9. ลบ branch claude/aviva-plus-resident-app-wdPCx
# 10. ลบไฟล์นี้
```

---

## 6. สิ่งที่ผมช่วยได้ต่อไป

- เขียน `pg_dump --schema-only` script สำหรับ Plus tables เฉพาะ (Section 3)
- Scaffold ไฟล์ shared แบบใหม่สำหรับ Plus repo (Section 2)
- เขียน data migration script (export → transform → import)
- ตรวจ env vars + Supabase RLS policies ที่ต้อง port ตามไป

ต้องการให้เริ่มอันไหนก่อน?
