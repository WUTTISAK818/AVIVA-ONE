# AVIVA ONE v6.36 — Testing Manual & Execution Guide
**Version**: 1.0  
**Date Created**: 18 มิ.ย. 2569  
**For**: Go-Live Testing Before 25 มิ.ย. 2569

---

## 🎯 Testing Overview

This manual provides step-by-step instructions for executing the comprehensive 18-standard testing framework for AVIVA ONE v6.36 in real-world simulation mode.

**Key Principles**:
- ✅ Test data is marked with `is_test=true` for easy cleanup
- ✅ Production data (31 houses, 134 leads, 2 Pete reports) is PROTECTED
- ✅ No cleanup of test data until all testing and improvements are verified
- ✅ All testing is done in staging environment (localhost:3000 or Vercel preview)

---

## 📋 Pre-Testing Checklist

Before starting Phase 1, verify:

- [ ] Dev server running: `npm run build && npm run dev`
- [ ] Supabase connection verified (can access Supabase dashboard)
- [ ] Test user credentials prepared (6 accounts needed)
- [ ] Test data fixture SQL scripts ready
- [ ] Version v6.36 deployed and confirmed
- [ ] Production data baseline documented

---

## 🚀 Phase 1: Environment Setup (18-19 มิ.ย.)

### Step 1.1: Verify Staging Environment

```bash
# Check dev server
curl -s http://localhost:3000/ | head -20

# Expected: Login page or redirect to /dashboard
# Status Code: 200 or 307
```

### Step 1.2: Create 6 Test User Accounts

**Accounts needed** (use Supabase Dashboard → Authentication → Users):

```
1. test.ceo@alisa.com (password: test123456)
   - Role: ceo
   - Access: All modules

2. test.coo@alisa.com (password: test123456)
   - Role: coo
   - Access: All modules

3. test.sales1@alisa.com (password: test123456)
   - Role: sales
   - Access: CRM, Read-only Construction

4. test.sales2@alisa.com (password: test123456)
   - Role: sales
   - Access: CRM, Read-only Construction

5. test.engineer@alisa.com (password: test123456)
   - Role: engineer
   - Access: Construction, Read-only CRM

6. test.finance@alisa.com (password: test123456)
   - Role: finance
   - Access: Finance, Read-only Construction
```

**Verification SQL** (run in Supabase SQL Editor):
```sql
SELECT id, email, user_metadata->>'role' as role, created_at
FROM auth.users
WHERE email LIKE 'test.%@alisa.com'
ORDER BY created_at DESC;
-- Expected: 6 rows
```

### Step 1.3: Create Test Data Fixtures

Run the SQL script in Supabase → SQL Editor:

```bash
# Execute the full script from /tmp/create_test_data.sql
```

This creates:
- 50 test CRM leads
- 10 test houses
- 30 test work reports
- 20 test contractor installments
- 50 test QC defects
- 100 test work queue items

**Total**: ~260 test records (all marked `is_test=true`)

**Verification SQL**:
```sql
SELECT
  'crm_leads' as table_name, COUNT(*) as count FROM public.crm_leads WHERE is_test = true
UNION ALL SELECT 'houses', COUNT(*) FROM public.houses WHERE is_test = true
UNION ALL SELECT 'work_reports', COUNT(*) FROM public.work_reports WHERE is_test = true
UNION ALL SELECT 'contractor_installments', COUNT(*) FROM public.contractor_installments WHERE is_test = true
UNION ALL SELECT 'qc_defects', COUNT(*) FROM public.qc_defects WHERE is_test = true
UNION ALL SELECT 'work_queue', COUNT(*) FROM public.work_queue WHERE is_test = true;
-- Expected total: ~260 records
```

### Step 1.4: Production Data Baseline

Verify production data is intact:

```sql
-- Verify 31 production houses
SELECT COUNT(*) as production_houses FROM public.houses WHERE is_test IS NOT true OR is_test = false;
-- Expected: 31

-- Verify 134 production CRM leads
SELECT COUNT(*) as production_leads FROM public.crm_leads WHERE is_test IS NOT true OR is_test = false;
-- Expected: 134

-- Verify Pete's 2 work reports
SELECT COUNT(*) as pete_reports FROM public.work_reports
WHERE reported_by = 'engineer@alisa.com' AND is_test IS NOT true;
-- Expected: 2

-- Verify 3 demo QC defects
SELECT COUNT(*) as demo_defects FROM public.qc_defects WHERE is_test IS NOT true;
-- Expected: 3
```

---

## 🔐 Phase 2: Login & RBAC Testing (19-20 มิ.ย.)

### Test 2.1: CEO Login & Dashboard

```
1. Open http://localhost:3000/
2. Click "Sign In"
3. Email: test.ceo@alisa.com
4. Password: test123456
5. Click "Sign In"
```

**Expected Results**:
- ✅ Login successful
- ✅ Redirected to /dashboard
- ✅ Version badge shows v6.36
- ✅ All 5 bottom nav buttons visible (Dashboard, CRM, Construction, Office, Reports, Settings)
- ✅ All KPI cards visible
- ✅ No console errors

### Test 2.2: Sales User Access Control

```
1. Log out (Settings → Sign Out)
2. Log in as: test.sales1@alisa.com / test123456
```

**Expected Results**:
- ✅ Login successful
- ✅ Dashboard shows limited data (only own sales)
- ✅ CRM module accessible
- ✅ Construction module accessible (read-only)
- ✅ Finance module NOT accessible
- ✅ Settings limited options

### Test 2.3: Engineer Access Control

```
1. Log out
2. Log in as: test.engineer@alisa.com / test123456
```

**Expected Results**:
- ✅ Login successful
- ✅ Construction module shows all data
- ✅ Can create work reports
- ✅ Can report defects
- ✅ CRM read-only
- ✅ Cannot access Finance module

### Test 2.4: Finance Access Control

```
1. Log out
2. Log in as: test.finance@alisa.com / test123456
```

**Expected Results**:
- ✅ Login successful
- ✅ Can view approvals
- ✅ Can submit approvals for review
- ✅ Construction read-only
- ✅ CRM limited access
- ✅ Cannot modify production data

---

## 💼 Phase 3: Core Business Flows (20-21 มิ.ย.)

### Test 3.1: CRM Journey (Create → Edit → Assign → Convert)

**Login**: test.sales1@alisa.com

**Steps**:
```
1. Go to CRM module
2. Click "+ Add Lead"
3. Fill in:
   - Name: Test Customer A
   - Phone: 0812345678
   - Email: testcustomer@test.com
   - Status: Prospect
   - Financing: Bank
4. Save
5. Edit: Change status to "Booking", add plot number 101
6. Save
7. Verify in database:
   SELECT * FROM crm_leads WHERE customer_name = 'Test Customer A' AND is_test = true;
```

**Expected Results**:
- ✅ Lead created successfully
- ✅ Lead edited and plot assigned
- ✅ Status shows as "Booking"
- ✅ Data persisted in database
- ✅ Timestamp recorded

### Test 3.2: Construction Flow (Report → Review → Defect)

**Login**: test.engineer@alisa.com

**Steps**:
```
1. Go to Construction module
2. View test house #101
3. Click "Add Daily Report"
4. Fill in:
   - Progress: 50%
   - Work Type: Foundation
   - Issues: Minor concrete issues
   - Photos: (optional)
5. Save
6. Click "Report Defect"
7. Fill in:
   - Description: Test defect - concrete cracks
   - Severity: Medium
8. Save
9. Verify in database:
   SELECT * FROM work_reports WHERE house_id = (SELECT id FROM houses WHERE plot_number = 101 AND is_test = true) AND is_test = true;
   SELECT * FROM qc_defects WHERE house_id = (SELECT id FROM houses WHERE plot_number = 101 AND is_test = true) AND is_test = true;
```

**Expected Results**:
- ✅ Work report created
- ✅ Defect logged
- ✅ Data visible in detail panel
- ✅ Progress percentage updated
- ✅ Issue count incremented

### Test 3.3: Finance Approval Flow

**Login**: test.finance@alisa.com

**Steps**:
```
1. Go to Construction module
2. View test house #102 with pending installment
3. Click on installment stage
4. Review: Labor cost, Material cost, Total
5. Submit for approval: Click "Submit for Review"
6. Add comment: "Verified on-site"
7. Click "Submit"
```

**Login as**: test.ceo@alisa.com

**Steps**:
```
1. Go to Construction → Finance Queue
2. Find the submission from finance team
3. Review details
4. Click "Approve"
5. Add signature/acknowledgment
6. Click "Confirm Approval"
7. Verify status changed to "Approved"
```

**Database Verification**:
```sql
SELECT * FROM contractor_installments WHERE house_id = (SELECT id FROM houses WHERE plot_number = 102 AND is_test = true);
-- Expected: status = 'approved'

SELECT * FROM approval_logs WHERE installment_id = ... ORDER BY created_at DESC LIMIT 1;
-- Expected: Latest approval logged with timestamp and approver
```

---

## 🔍 Phase 4: Data Integrity & Integration (21-22 มิ.ย.)

### Test 4.1: Cross-Department Data Flow

**Scenario**: CRM lead → Construction unit → Finance approval

**Steps**:
```
1. In CRM: Verify Test Customer A is assigned to plot 101
2. In Construction: Verify plot 101 shows customer "Test Customer A" in detail panel
3. In Finance: Verify installment approval for plot 101 shows customer name
```

**Database Check**:
```sql
-- Verify data linkage
SELECT
  cl.customer_name,
  h.plot_number,
  h.id as house_id,
  ci.stage_name,
  ci.status
FROM crm_leads cl
LEFT JOIN houses h ON cl.plot_number = h.plot_number
LEFT JOIN contractor_installments ci ON ci.house_id = h.id
WHERE cl.is_test = true AND h.is_test = true
LIMIT 10;
```

### Test 4.2: CRUD Operations

**Create**: ✅ Already tested in Phase 3

**Read**:
```
1. As CEO: Can view all test data
2. As Sales: Can view only own leads
3. As Engineer: Can view all construction
4. As Finance: Can view all approvals

Expected: All users see consistent data
```

**Update**:
```
1. Edit Test Lead: Change name to "Updated Test A"
2. Edit Test House: Change progress to 55%
3. Edit Work Report: Change issues to "Resolved"
4. Verify changes reflected immediately
5. Check database for timestamp update
```

**Delete**:
```
1. (Optional) Delete test lead
2. Verify cascading deletes (if applicable)
3. Check no orphaned records remain
4. In database:
   SELECT * FROM crm_leads WHERE customer_name LIKE 'Test%' AND id = <deleted-id>;
   -- Should return: No rows (soft delete) or be flagged as deleted
```

### Test 4.3: RBAC Enforcement

**Matrix Testing**:

| Module | CEO | COO | Sales | Engineer | Finance |
|--------|-----|-----|-------|----------|---------|
| Dashboard | Full | Full | Limited | Limited | Limited |
| CRM | Read/Write | Read/Write | Own Only | Read | Read |
| Construction | Full | Full | Read | Full | Read |
| Finance | Full | Full | None | None | Full |
| Settings | Full | Full | None | None | None |

**Test Case**:
```
1. Login as Sales user
2. Try to access Finance module
3. Expected: Either redirect or "No Access" message
4. Check browser console for no leaking data
```

---

## ⚡ Phase 5: Performance & Security (22 มิ.ย.)

### Test 5.1: Performance Baselines

```
Device: Desktop (Chrome)
Network: Full Speed

1. Login page load time: < 1s
   - Measure: Open http://localhost:3000/, time to form render
   
2. Dashboard load time (after auth): < 2s
   - Measure: Time from /dashboard to fully rendered with all KPIs
   
3. CRM list load (50 test + 134 production): < 3s
   - Measure: Navigate to /crm, time to list render
   
4. Construction grid (10 test + 31 production): < 2.5s
   - Measure: Navigate to /construction, time to grid render
```

**Tool**: Browser DevTools → Network tab, record timings

**Expected**:
- ✅ All pages load within targets
- ✅ No blocking JavaScript
- ✅ Images lazy-load
- ✅ Database queries < 500ms

### Test 5.2: Security Checks

#### XSS Prevention
```
1. In CRM add lead form:
   - Name field: <script>alert('xss')</script>
   - Expected: Text escaped or sanitized
   
2. Check database:
   SELECT customer_name FROM crm_leads WHERE customer_name LIKE '%script%';
   -- Expected: No script tags stored (escaped as &lt;script&gt;)
```

#### SQL Injection Prevention
```
1. In Lead search:
   - Search term: '; DROP TABLE crm_leads; --
   - Expected: No error, treated as literal search term
   
2. Verify table still exists:
   SELECT COUNT(*) FROM crm_leads;
   -- Expected: Still works, returns count
```

#### CSRF Protection
```
1. Open two browser tabs
2. Tab A: Logged in as test.ceo@alisa.com
3. Tab B: Open malicious site trying to make requests
4. Expected: Tab B cannot make authenticated requests
5. Check: Network tab shows CSRF token validation
```

#### Authentication
```
1. Logout from /settings
2. Browser: Delete auth tokens (DevTools → Application → Cookies → Remove)
3. Try to access /dashboard directly
4. Expected: Redirect to login page, cannot access protected routes
```

---

## 🗑️ Cleanup & Go-Live (23-24 มิ.ย.)

### Pre-Cleanup Verification

```sql
-- Confirm all test data exists before cleanup
SELECT 'Test Records Summary' as summary;
SELECT
  (SELECT COUNT(*) FROM crm_leads WHERE is_test = true) as test_leads,
  (SELECT COUNT(*) FROM houses WHERE is_test = true) as test_houses,
  (SELECT COUNT(*) FROM work_reports WHERE is_test = true) as test_reports,
  (SELECT COUNT(*) FROM contractor_installments WHERE is_test = true) as test_installments,
  (SELECT COUNT(*) FROM qc_defects WHERE is_test = true) as test_defects,
  (SELECT COUNT(*) FROM work_queue WHERE is_test = true) as test_tasks;

-- Confirm production data is intact
SELECT 'Production Records Summary' as summary;
SELECT
  (SELECT COUNT(*) FROM crm_leads WHERE is_test IS NOT true) as prod_leads,
  (SELECT COUNT(*) FROM houses WHERE is_test IS NOT true) as prod_houses;
```

### Cleanup Execution

```sql
-- Run ONLY when ready for go-live
BEGIN;

DELETE FROM work_queue WHERE is_test = true;
DELETE FROM qc_defects WHERE is_test = true;
DELETE FROM contractor_installments WHERE is_test = true;
DELETE FROM work_reports WHERE is_test = true;
DELETE FROM crm_leads WHERE is_test = true;
DELETE FROM houses WHERE is_test = true;

-- Delete test users (if applicable)
-- DELETE FROM auth.users WHERE email LIKE 'test.%@alisa.com';

COMMIT;

-- Verification
SELECT COUNT(*) as remaining_test_records FROM (
  SELECT 1 FROM crm_leads WHERE is_test = true
  UNION ALL SELECT 1 FROM houses WHERE is_test = true
  UNION ALL SELECT 1 FROM work_reports WHERE is_test = true
  UNION ALL SELECT 1 FROM contractor_installments WHERE is_test = true
  UNION ALL SELECT 1 FROM qc_defects WHERE is_test = true
  UNION ALL SELECT 1 FROM work_queue WHERE is_test = true
) as all_test;
-- Expected: 0 records
```

### Post-Cleanup Production Verification

```sql
-- Verify production data is still intact
SELECT 'Final Production Count' as verification;
SELECT
  (SELECT COUNT(*) FROM crm_leads) as total_crm_leads,
  (SELECT COUNT(*) FROM houses) as total_houses,
  (SELECT COUNT(*) FROM work_reports) as total_work_reports,
  (SELECT COUNT(*) FROM qc_defects) as total_defects;

-- Expected results:
-- total_crm_leads: 134
-- total_houses: 31
-- total_work_reports: 2 (Pete's reports)
-- total_defects: 3
```

---

## 📊 Testing Results Template

After each test, record:

```markdown
## Test Result: [Standard #] - [Test Name]

**Date/Time**: [Timestamp UTC+7]
**Tester**: [Name]
**Environment**: [Dev Server / Staging / Production]
**Status**: ✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL

### Test Steps Executed
1. [Step 1]
2. [Step 2]
3. ...

### Expected Results
- ✅ [Expected 1]
- ✅ [Expected 2]

### Actual Results
- ✅ [Actual 1]
- ✅ [Actual 2]

### Issues Found
- [Issue 1]
- [Issue 2]

### Evidence (Screenshots/Logs)
- [Screenshots or error logs]

### Follow-up Actions
- [ ] [Action 1]
- [ ] [Action 2]
```

---

## ✅ Testing Completion Checklist

- [ ] Phase 1: Environment setup complete (18-19 มิ.ย.)
- [ ] Phase 2: Login & RBAC verified (19-20 มิ.ย.)
- [ ] Phase 3: Core workflows tested (20-21 มิ.ย.)
- [ ] Phase 4: Data integrity verified (21-22 มิ.ย.)
- [ ] Phase 5: Performance & security checked (22 มิ.ย.)
- [ ] All issues documented and triaged
- [ ] Fixes implemented (if any)
- [ ] Cleanup script prepared
- [ ] Final production verification done (23 มิ.ย.)
- [ ] Test data deleted (24 มิ.ย.)
- [ ] Go-live approved (25 มิ.ย.)

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue**: Cannot log in with test user
- [ ] Check if user created in Supabase auth.users
- [ ] Verify email is correct
- [ ] Check if role is set in user_metadata
- [ ] Check browser console for auth errors

**Issue**: Test data not appearing
- [ ] Run verification SQL to check if inserts succeeded
- [ ] Check if is_test=true flag is set
- [ ] Verify RLS policies allow test user to see data

**Issue**: RBAC not enforced
- [ ] Check if role mapping is correct in auth.users
- [ ] Verify role in user_metadata matches expected value
- [ ] Check if UI components use correct role checks
- [ ] Verify RLS policies in Supabase

**Issue**: Performance baseline not met
- [ ] Check browser DevTools Network tab
- [ ] Look for slow SQL queries (Supabase logs)
- [ ] Check if images are optimized
- [ ] Verify database indexes exist

---

## 🎯 Go-Live Readiness

Final sign-off checklist:

- [ ] All 18 testing standards completed
- [ ] No critical issues remaining
- [ ] Performance within targets
- [ ] Security verified
- [ ] RBAC enforced at all 3 levels (UI, API, RLS)
- [ ] All test data cleaned up
- [ ] Production data verified intact (31 houses, 134 leads, 2 Pete reports)
- [ ] Build passes: npm run build
- [ ] Deployment prepared
- [ ] Team sign-off obtained

---

**Status**: Ready for testing execution  
**Next**: Execute Phase 1 (Step 1.2 - Create Test Users)  
**Target**: Go-Live 25 มิ.ย. 2569

