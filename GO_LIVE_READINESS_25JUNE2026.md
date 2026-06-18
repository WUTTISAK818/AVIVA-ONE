# AVIVA ONE — Go-Live Readiness Checklist
**Production Deployment: 25 June 2026 (6 days remaining)**

**Status: PRE-PRODUCTION CLEANUP PHASE**
- Current Date: 18 June 2026
- Deploy Target: 25 June 2026
- Version: 6.34 (if badge update needed)

---

## CRITICAL PATH — MUST DO BEFORE 25 JUNE

### 1️⃣ DEMO ACCOUNTS — DELETE FROM SUPABASE

**Demo Accounts to Remove (9 total):**
```
ceo.test@aviva.th             (role: admin/ceo)
demo.admin@aviva.th           (role: admin)
demo.sales@aviva.th           (role: sales)
demo.finance@aviva.th         (role: finance)
demo.construction@aviva.th    (role: engineer)
demo.accounting@aviva.th      (role: accountant)
demo.hr@aviva.th              (role: hr)
demo.marketing@aviva.th       (role: marketing)
demo.aftersales@aviva.th      (role: after_sales)
```

**Steps to Delete:**

#### A. BACKUP DEMO ACCOUNTS (REQUIRED)
Use Supabase Dashboard → SQL Editor:
```sql
-- Export current demo accounts data
SELECT 
  id, email, raw_user_meta_data->'full_name' as full_name,
  raw_app_meta_data->'role' as role,
  raw_app_meta_data->'department' as department,
  created_at, last_sign_in_at
FROM auth.users
WHERE email LIKE 'ceo.test@%' 
  OR email LIKE 'demo.%@aviva.th'
ORDER BY email;

-- Save result as JSON/CSV → Google Drive with timestamp
```

#### B. DELETE DEMO ACCOUNTS
**Option 1: Via Supabase Dashboard (Recommended for confirmation)**
1. Go to: Supabase Console → Authentication → Users
2. Search for: `@aviva.th` or each demo email
3. Select each user → Delete button → Confirm
4. Verify all 9 are gone

**Option 2: Via Edge Function (if you have Admin/CEO login)**
- Use admin-user-management edge function: DELETE method
- Requires Bearer token from authenticated admin user
- Endpoint: `https://[SUPABASE_URL]/functions/v1/admin-user-management`
- Body: `{ "userId": "user-id-from-backup" }`

#### C. VERIFY DELETION
```sql
-- Verify no demo accounts remain
SELECT COUNT(*) as remaining_demo_accounts
FROM auth.users
WHERE email LIKE '%aviva.th' 
  AND email NOT IN ('sale1@alisa.com', 'sale2@alisa.com', 'engineer@alisa.com');
  -- Production employee emails
```

---

### 2️⃣ TEST DATA — DELETE TEST HOUSES + DATA

**Task:** Remove any test houses (A01-A05 or similar) + associated data

**Questions to Verify:**
- [ ] Are there test houses in `houses` table? (plot codes: A01, A02, A03, A04, A05, etc.)
- [ ] Are test contractor records linked?
- [ ] Are test sales leads/CRM records linked?

**Steps:**
1. **List test houses:**
   ```sql
   SELECT id, house_number, plot_code, house_model, status
   FROM houses
   WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05')
     OR house_model ILIKE '%test%'
     OR house_number ILIKE 'TEST%'
   ORDER BY created_at DESC;
   ```

2. **BACKUP test data before delete:**
   ```sql
   -- Export to CSV/JSON
   SELECT * FROM houses WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05');
   SELECT * FROM houses_progress WHERE house_id IN (SELECT id FROM houses WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05'));
   -- Save to Google Drive
   ```

3. **Delete cascade (order matters):**
   ```sql
   -- Delete audit defects referencing test houses
   DELETE FROM audit_defects 
   WHERE house_id IN (SELECT id FROM houses WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05'));

   -- Delete progress records
   DELETE FROM houses_progress 
   WHERE house_id IN (SELECT id FROM houses WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05'));

   -- Delete house records
   DELETE FROM houses 
   WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05');
   ```

4. **Verify deletion:**
   ```sql
   SELECT COUNT(*) as test_houses_remaining FROM houses WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05');
   -- Expected: 0
   ```

---

### 3️⃣ VERIFY PRODUCTION EMPLOYEE DATA — 3 REAL USERS

**Requirement:** These 3 employees must exist + have valid data:

#### Employee #1: SALES (ฟ้า)
- **Email:** sale1@alisa.com
- **Full Name:** ฟ้า (or actual Thai name)
- **Department:** ฝ่ายขาย (Sales)
- **Role:** sales or employee
- **Status:** Email confirmed ✓

#### Employee #2: SALES (เดียร์)
- **Email:** sale2@alisa.com
- **Full Name:** เดียร์ (or actual Thai name)
- **Department:** ฝ่ายขาย (Sales)
- **Role:** sales or employee
- **Status:** Email confirmed ✓

#### Employee #3: CONSTRUCTION (พีท)
- **Email:** engineer@alisa.com
- **Full Name:** พีท (or actual Thai name)
- **Department:** ฝ่ายก่อสร้าง (Construction)
- **Role:** engineer or employee
- **Status:** Email confirmed ✓

**Verification SQL:**
```sql
SELECT 
  id, email, raw_user_meta_data->'full_name' as full_name,
  raw_app_meta_data->'role' as role,
  raw_app_meta_data->'department' as department,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email IN ('sale1@alisa.com', 'sale2@alisa.com', 'engineer@alisa.com');

-- Expected: 3 rows, all with email_confirmed_at NOT NULL
```

**If Data Missing:**
Use admin-user-management edge function (POST method) to create:
```json
{
  "email": "sale1@alisa.com",
  "password": "TempPassword123",
  "full_name": "ฟ้า",
  "role": "sales",
  "department": "ฝ่ายขาย"
}
```

Then have the user change password on first login.

---

## GO-LIVE READINESS CHECKLIST

### ✅ LOGIN & AUTHENTICATION
- [ ] Remember username feature works (localStorage)
- [ ] Demo accounts removed from login page dropdown + Supabase auth.users
- [ ] JWT auth_role() working in RLS policies
- [ ] Session management + auto-logout working

**Test:**
1. Clear browser cache
2. Login with sale1@alisa.com
3. Verify "จดจำอีเมล" checkbox works
4. Check JWT token has correct role in app_metadata

---

### ✅ SALES TEAM (ฟ้า, เดียร์)

**Pages:**
- [ ] /crm — CRM leads page loads + displays fields
- [ ] /sales/daily-log — Daily logs create + save
- [ ] /reports — Sales can view own reports
- [ ] /reports/review — Manager can review sales reports

**Data Fields (must be saved):**
- [ ] visit_date, visit_time, reported_by, at (location)
- [ ] All CRM fields required by business rules

**Test Scenario:**
1. Login as sale1@alisa.com
2. Go to /crm → Create new lead
3. Fill all required fields → Save
4. View /sales/daily-log → Create entry → Save
5. Go to /reports → Filter by date → View own report with attachments

---

### ✅ CONSTRUCTION TEAM (พีท)

**Pages:**
- [ ] /construction — Construction progress page loads
- [ ] Plot codes, house model, construction_status, progress % display correctly
- [ ] /construction/reports — Can view progress reports
- [ ] /construction/scorecard — Contractor scorecard displays

**Test Scenario:**
1. Login as engineer@alisa.com
2. Go to /construction → View house list
3. Click one house → See plot_code, progress %
4. Update progress (if allowed) → Save
5. View /construction/scorecard → Filter by contractor

---

### ✅ DASHBOARD

**Key Indicators:**
- [ ] "สร้างเสร็จแล้ว" vs "กำลังสร้าง" houses count correct
- [ ] Data loads from houses table + houses_progress table
- [ ] No demo data (test houses A01-A05) showing in counts

**Test Data References:**
- Pom (Project) — 13 total units (100% complete = 13 units built)
- A07 — 85% progress
- 17 — 0% progress (not started)

**Verify:**
```sql
SELECT 
  house_number, 
  progress,
  (SELECT COUNT(*) FROM houses WHERE status = 'completed') as completed_count,
  (SELECT COUNT(*) FROM houses WHERE status = 'in_progress') as in_progress_count
FROM houses
ORDER BY house_number;
```

---

### ✅ REPORTS

**Daily Report:**
- [ ] /reports/my-reports loads user's reports
- [ ] Shows "ไม่มีรูป" (no image) message when attachment not found
- [ ] Report filters (date range, department) work
- [ ] Export to PDF/Excel option available (if implemented)

**Manager Review:**
- [ ] /reports/review shows reports pending manager approval
- [ ] Manager can approve/reject with comments
- [ ] History visible with approval workflow

**Test:**
1. Login as sales → Submit daily report with items
2. Logout → Login as manager
3. Go to /reports/review → Approve report
4. Check notification sent to sales

---

### ✅ NOTIFICATIONS & APPROVALS

**Push Notifications:**
- [ ] Web push working (browser notifications)
- [ ] Duplicate notification prevention active
- [ ] Dismiss tracking working

**Approval Workflow:**
- [ ] Purchase requests require approval chain
- [ ] Approvers see pending items in dashboard
- [ ] Notification sent when action required
- [ ] Cannot double-approve same item

**Test:**
1. Create purchase request (< 10,000 THB = Direct Approval, 10k-50k = Dept Manager, >50k = Director)
2. Check notification received
3. Approve → Check status updated
4. Verify second approval not allowed

---

### ✅ DATABASE INTEGRITY

**Demo Data:**
- [ ] ✅ DONE: Demo accounts deleted from auth.users
- [ ] ✅ DONE: Test houses (A01-A05) deleted from houses table
- [ ] ✅ DONE: Backup of deleted data saved to Google Drive

**Backup Files Required:**
```
Google Drive:
  ├── AVIVA-ONE-BACKUP-DemoAccounts-2026-06-18.json
  ├── AVIVA-ONE-BACKUP-TestHouses-2026-06-18.json
  └── AVIVA-ONE-Prod-Schema-Snapshot-2026-06-18.sql
```

**Production Data:**
- [ ] Employee records in `employees` table
- [ ] At least 3 active employees (sale1, sale2, engineer)
- [ ] Project records in `projects` table with correct unit counts
- [ ] No orphaned records (houses without project_id, etc.)

**RLS Policies:**
- [ ] RLS enabled on all production tables
- [ ] auth_role() function correctly identifies user role
- [ ] CEO/COO can access all data
- [ ] Manager can access team data
- [ ] Employee can only access own records + shared project data

---

### ✅ BUILD & DEPLOYMENT

- [ ] `npm run build` passes with ✓ Compiled successfully
- [ ] No TypeScript errors in build output
- [ ] No missing interface fields (common v2.9.8 errors prevented)
- [ ] Version number updated in both dashboard + settings pages
- [ ] All production env vars set in Vercel

**Pre-Push Checklist:**
```bash
npm run build
# Must see: ✓ Compiled successfully
# Must NOT see: Type error / Failed to type check

# If errors, check:
grep -n "setForm({" src/app/[FILENAME].tsx  # All fields present?
grep "interface.*{" src/lib/*.ts             # All types complete?
```

---

### ✅ DEPLOYMENT TO PRODUCTION

**Version Bump (do before push):**
- [ ] `/src/app/dashboard/page.tsx` — Update badge to v6.35 (or next patch)
- [ ] `/src/app/settings/page.tsx` — Update Version to 6.35

**Push to GitHub:**
```bash
# Ensure branch is clean
git status

# Commit changes
git add src/app/dashboard/page.tsx src/app/settings/page.tsx
git commit -m "v6.35 — Pre-launch cleanup: Demo accounts deleted"

# Push to BOTH branches (Vercel watches both)
git push origin main
git push origin claude/move-work-location-2CfBA

# Verify Vercel deployment starts
# → Go to https://vercel.com → Select AVIVA ONE project → Check deployment status
```

**Create Deploy Report:**
```
Filename: AVIVA-ONE-deploy-report-v6.35-2026-06-18.txt
Location: Google Drive → AVIVA ONE folder

Content:
===========================================
AVIVA ONE — Deploy Report
Version: 6.35
Date: 18 June 2026
Time: [HH:MM น. UTC+7]
===========================================

Changes Made:
1. Deleted 9 demo accounts from Supabase auth.users
2. Deleted test houses (A01-A05) from database
3. Verified production employees (3 users)
4. Backup files created and stored

Files Modified:
- src/app/dashboard/page.tsx (version bump)
- src/app/settings/page.tsx (version bump)

Commits:
- [commit-hash] v6.35 — Pre-launch cleanup

Branches Pushed:
✓ main
✓ claude/move-work-location-2CfBA

Database Cleanup:
- Demo accounts: 9 deleted
- Test houses: 5 deleted
- Backups: Stored in Google Drive

Go-Live Status: READY ✓
Next Deploy: 25 June 2026
===========================================
```

---

## DEPLOYMENT TIMELINE

| Date | Task | Owner | Status |
|------|------|-------|--------|
| **18 Jun (Today)** | Delete demo accounts + backup | Admin | ⏳ IN PROGRESS |
| **18 Jun** | Delete test houses + backup | Admin | ⏳ IN PROGRESS |
| **18-24 Jun** | Verify production data + UAT | Team | ⏳ PENDING |
| **24 Jun** | Final smoke tests | QA | ⏳ PENDING |
| **25 Jun 08:00** | Production deployment | DevOps | ⏳ PENDING |
| **25 Jun 09:00** | Go-live announcement | CEO/COO | ⏳ PENDING |

---

## ROLLBACK PROCEDURE (if needed)

**If production issue found after deploy:**
1. Restore backup: `AVIVA-ONE-BACKUP-DemoAccounts-2026-06-18.json`
   ```sql
   -- Re-create demo accounts for testing (if rollback needed)
   -- Use admin-user-management edge function POST method
   ```
2. Revert Git commit:
   ```bash
   git revert [commit-hash]  # Do NOT use reset --hard
   git push origin main
   ```
3. Vercel will auto-deploy previous stable version
4. Notify team of rollback status

---

## SIGN-OFF

- [ ] CEO/COO approved cleanup
- [ ] QA verified all features
- [ ] Database admin confirmed backup + cleanup
- [ ] Deployment ready to proceed

**Questions? Contact: joyus818@gmail.com**

---

*Document Generated: 18 June 2026*
*For: AVIVA ONE Go-Live 25 June 2026*
