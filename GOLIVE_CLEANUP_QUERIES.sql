-- ========================================================================
-- AVIVA ONE — Go-Live Database Cleanup Queries
-- Purpose: Delete demo accounts + test data before 25 June 2026
-- Location: Supabase Dashboard → SQL Editor
-- ========================================================================

-- ========================================================================
-- SECTION 1: BACKUP DEMO ACCOUNTS (RUN FIRST)
-- ========================================================================

-- Export demo accounts for backup before deletion
-- PRESERVE THESE (DO NOT DELETE):
--   ✅ joyus818@gmail.com (CEO - Admin)
--   ✅ ceo@alisa.com (CEO)
--   ✅ coo@alisa.com (COO)
--   ✅ sale1@alisa.com (Sales - Faa)
--   ✅ sale2@alisa.com (Sales - Dearr)
--   ✅ engineer@alisa.com (Construction - Pete)

-- DELETE THESE 9 DEMO ACCOUNTS ONLY:
--   ❌ ceo.test@aviva.th
--   ❌ demo.admin@aviva.th
--   ❌ demo.sales@aviva.th
--   ❌ demo.finance@aviva.th
--   ❌ demo.construction@aviva.th
--   ❌ demo.accounting@aviva.th
--   ❌ demo.hr@aviva.th
--   ❌ demo.marketing@aviva.th
--   ❌ demo.aftersales@aviva.th

SELECT
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'role' as role,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users
WHERE email LIKE 'ceo.test@%'
  OR email IN (
    'demo.admin@aviva.th',
    'demo.sales@aviva.th',
    'demo.finance@aviva.th',
    'demo.construction@aviva.th',
    'demo.accounting@aviva.th',
    'demo.hr@aviva.th',
    'demo.marketing@aviva.th',
    'demo.aftersales@aviva.th'
  )
ORDER BY email;

-- Save above result as JSON/CSV to Google Drive → AVIVA-ONE-BACKUP-DemoAccounts-2026-06-18.json

-- ========================================================================
-- SECTION 2: COUNT DEMO ACCOUNTS (verify before deleting)
-- ========================================================================

SELECT COUNT(*) as total_demo_accounts
FROM auth.users
WHERE email LIKE 'ceo.test@%'
  OR email IN (
    'demo.admin@aviva.th',
    'demo.sales@aviva.th',
    'demo.finance@aviva.th',
    'demo.construction@aviva.th',
    'demo.accounting@aviva.th',
    'demo.hr@aviva.th',
    'demo.marketing@aviva.th',
    'demo.aftersales@aviva.th'
  );

-- Expected result: 9

-- ========================================================================
-- SECTION 2.5: BACKUP & DELETE DEMO WORK QUEUE (26 items)
-- ========================================================================

-- First, count demo work items
SELECT COUNT(*) as total_demo_work_items
FROM work_reports
WHERE user_email IN (
  'ceo.test@aviva.th',
  'demo.admin@aviva.th',
  'demo.sales@aviva.th',
  'demo.finance@aviva.th',
  'demo.construction@aviva.th',
  'demo.accounting@aviva.th',
  'demo.hr@aviva.th',
  'demo.marketing@aviva.th',
  'demo.aftersales@aviva.th'
);
-- Expected: 26 demo work items

-- Backup demo work items (save result to Google Drive)
SELECT
  id,
  user_email,
  employee_name,
  report_date,
  summary,
  status,
  created_at
FROM work_reports
WHERE user_email IN (
  'ceo.test@aviva.th',
  'demo.admin@aviva.th',
  'demo.sales@aviva.th',
  'demo.finance@aviva.th',
  'demo.construction@aviva.th',
  'demo.accounting@aviva.th',
  'demo.hr@aviva.th',
  'demo.marketing@aviva.th',
  'demo.aftersales@aviva.th'
)
ORDER BY created_at DESC;

-- Save above result as JSON/CSV to Google Drive → AVIVA-ONE-BACKUP-DemoWorkItems-2026-06-18.json

-- DELETE demo work items (CASCADE delete work_report_items)
DELETE FROM work_reports
WHERE user_email IN (
  'ceo.test@aviva.th',
  'demo.admin@aviva.th',
  'demo.sales@aviva.th',
  'demo.finance@aviva.th',
  'demo.construction@aviva.th',
  'demo.accounting@aviva.th',
  'demo.hr@aviva.th',
  'demo.marketing@aviva.th',
  'demo.aftersales@aviva.th'
);

-- Verify deletion
SELECT COUNT(*) as remaining_demo_work_items
FROM work_reports
WHERE user_email IN (
  'ceo.test@aviva.th',
  'demo.admin@aviva.th',
  'demo.sales@aviva.th',
  'demo.finance@aviva.th',
  'demo.construction@aviva.th',
  'demo.accounting@aviva.th',
  'demo.hr@aviva.th',
  'demo.marketing@aviva.th',
  'demo.aftersales@aviva.th'
);
-- Expected: 0

-- ========================================================================
-- SECTION 3: BACKUP TEST HOUSES (RUN BEFORE DELETION)
-- ========================================================================

-- Check if test houses exist
SELECT
  id,
  house_number,
  plot_code,
  house_model,
  status,
  created_at
FROM houses
WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05')
  OR house_model ILIKE '%test%'
  OR house_number ILIKE 'TEST%'
ORDER BY created_at DESC;

-- Save above result as JSON/CSV to Google Drive → AVIVA-ONE-BACKUP-TestHouses-2026-06-18.json

-- ========================================================================
-- SECTION 4: BACKUP TEST HOUSE PROGRESS
-- ========================================================================

SELECT
  hp.id,
  hp.house_id,
  h.house_number,
  h.plot_code,
  hp.progress,
  hp.status,
  hp.created_at
FROM houses_progress hp
LEFT JOIN houses h ON hp.house_id = h.id
WHERE h.plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05')
  OR h.house_model ILIKE '%test%'
  OR h.house_number ILIKE 'TEST%'
ORDER BY hp.created_at DESC;

-- Save above result as JSON/CSV to Google Drive → AVIVA-ONE-BACKUP-TestHouses-Progress-2026-06-18.json

-- ========================================================================
-- SECTION 5: VERIFY PRODUCTION USERS EXIST (6 production accounts)
-- ========================================================================

-- Verify 6 production users are intact
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'role' as role,
  email_confirmed_at,
  last_sign_in_at,
  created_at
FROM auth.users
WHERE email IN (
  'joyus818@gmail.com',  -- Admin/CEO
  'ceo@alisa.com',       -- CEO
  'coo@alisa.com',       -- COO
  'sale1@alisa.com',     -- Sales (Faa)
  'sale2@alisa.com',     -- Sales (Dearr)
  'engineer@alisa.com'   -- Construction (Pete)
)
ORDER BY created_at DESC;

-- Expected: 6 rows, all production accounts intact
-- Expected roles: ceo (2x), coo (1x), engineer (1x), plus admin flag for joyus818
-- If any missing, use admin-user-management edge function to create them

-- ========================================================================
-- SECTION 6: FIND DEPENDENCIES OF TEST HOUSES (before deletion)
-- ========================================================================

-- Find audit defects linked to test houses
SELECT
  id,
  house_id,
  (SELECT house_number FROM houses WHERE id = audit_defects.house_id) as house_number,
  defect_status,
  created_at
FROM audit_defects
WHERE house_id IN (SELECT id FROM houses WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05'));

-- Find sales leads linked to test houses
SELECT
  id,
  lead_name,
  house_id,
  (SELECT house_number FROM houses WHERE id = crm_leads.house_id) as house_number,
  status,
  created_at
FROM crm_leads
WHERE house_id IN (SELECT id FROM houses WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05'));

-- ========================================================================
-- SECTION 6.5: BACKUP & DELETE DEMO DATA TABLES (143 work queue + more)
-- ========================================================================

-- Backup work queue (143 demo items)
SELECT
  id,
  assigned_to,
  task_type,
  status,
  created_at,
  description
FROM work_queue
LIMIT 50;
-- Save above to Google Drive → AVIVA-ONE-BACKUP-WorkQueue-2026-06-18.json

-- DELETE demo work queue (143 items)
DELETE FROM work_queue
WHERE assigned_to IN (
  'ceo.test@aviva.th',
  'demo.admin@aviva.th',
  'demo.sales@aviva.th',
  'demo.finance@aviva.th',
  'demo.construction@aviva.th',
  'demo.accounting@aviva.th',
  'demo.hr@aviva.th',
  'demo.marketing@aviva.th',
  'demo.aftersales@aviva.th'
);
-- Expected deleted: ~143 items

-- DELETE demo work reports (35 items total, EXCEPT engineer@alisa.com reports 17-18 Jun)
DELETE FROM work_reports
WHERE user_email IN (
  'ceo.test@aviva.th',
  'demo.admin@aviva.th',
  'demo.sales@aviva.th',
  'demo.finance@aviva.th',
  'demo.construction@aviva.th',
  'demo.accounting@aviva.th',
  'demo.hr@aviva.th',
  'demo.marketing@aviva.th',
  'demo.aftersales@aviva.th'
)
AND NOT (
  -- KEEP: engineer@alisa.com reports on 17-18 June 2026
  user_email = 'engineer@alisa.com'
  AND report_date IN ('2026-06-17', '2026-06-18')
);
-- Expected deleted: ~33 items (keeping 2 production reports from Pete)

-- DELETE demo approval logs (26 items) - these are historical approvals from demo accounts
DELETE FROM approval_logs
WHERE created_by IN (
  'ceo.test@aviva.th',
  'demo.admin@aviva.th',
  'demo.sales@aviva.th',
  'demo.finance@aviva.th',
  'demo.construction@aviva.th',
  'demo.accounting@aviva.th',
  'demo.hr@aviva.th',
  'demo.marketing@aviva.th',
  'demo.aftersales@aviva.th'
);
-- Expected deleted: ~26 items

-- DELETE demo petty cash entries (3 items)
DELETE FROM petty_cash_entries
WHERE created_by IN (
  'ceo.test@aviva.th',
  'demo.admin@aviva.th',
  'demo.sales@aviva.th',
  'demo.finance@aviva.th',
  'demo.construction@aviva.th',
  'demo.accounting@aviva.th',
  'demo.hr@aviva.th',
  'demo.marketing@aviva.th',
  'demo.aftersales@aviva.th'
);
-- Expected deleted: ~3 items

-- DELETE demo office documents (20 items)
DELETE FROM documents
WHERE created_by IN (
  'ceo.test@aviva.th',
  'demo.admin@aviva.th',
  'demo.sales@aviva.th',
  'demo.finance@aviva.th',
  'demo.construction@aviva.th',
  'demo.accounting@aviva.th',
  'demo.hr@aviva.th',
  'demo.marketing@aviva.th',
  'demo.aftersales@aviva.th'
);
-- Expected deleted: ~20 items

-- DELETE demo AI chat logs (1 item)
DELETE FROM ai_chat_logs
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'ceo.test@aviva.th',
    'demo.admin@aviva.th',
    'demo.sales@aviva.th',
    'demo.finance@aviva.th',
    'demo.construction@aviva.th',
    'demo.accounting@aviva.th',
    'demo.hr@aviva.th',
    'demo.marketing@aviva.th',
    'demo.aftersales@aviva.th'
  )
);
-- Expected deleted: ~1 item

-- Verify all demo data deleted
SELECT 'Work Queue Remaining' as check_item, COUNT(*) as count FROM work_queue WHERE assigned_to LIKE 'demo.%'
UNION ALL
SELECT 'Work Reports (Demo Only)', COUNT(*) FROM work_reports WHERE user_email LIKE 'demo.%'
UNION ALL
SELECT 'Approval Logs (Demo)', COUNT(*) FROM approval_logs WHERE created_by LIKE 'demo.%'
UNION ALL
SELECT 'Petty Cash (Demo)', COUNT(*) FROM petty_cash_entries WHERE created_by LIKE 'demo.%'
UNION ALL
SELECT 'Documents (Demo)', COUNT(*) FROM documents WHERE created_by LIKE 'demo.%'
UNION ALL
SELECT 'Work Reports (Pete 17-18 Jun)', COUNT(*) FROM work_reports
  WHERE user_email = 'engineer@alisa.com'
  AND report_date IN ('2026-06-17', '2026-06-18');
-- Expected: All demo items = 0, Pete reports = 2

-- ========================================================================
-- SECTION 7: DELETE TEST DATA (EXECUTE IN ORDER)
-- ========================================================================

-- WARNING: These deletes are PERMANENT. Only run if backup is confirmed saved.

-- Step 1: Delete audit defects for test houses
DELETE FROM audit_defects
WHERE house_id IN (
  SELECT id FROM houses
  WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05')
);

-- Step 2: Delete sales leads for test houses
DELETE FROM crm_leads
WHERE house_id IN (
  SELECT id FROM houses
  WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05')
);

-- Step 3: Delete contractor scorecard entries for test houses
DELETE FROM contractor_scorecards
WHERE house_id IN (
  SELECT id FROM houses
  WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05')
);

-- Step 4: Delete house progress records
DELETE FROM houses_progress
WHERE house_id IN (
  SELECT id FROM houses
  WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05')
);

-- Step 5: Delete house records themselves
DELETE FROM houses
WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05');

-- ========================================================================
-- SECTION 8: VERIFY TEST DATA DELETION
-- ========================================================================

-- Verify no test houses remain
SELECT COUNT(*) as test_houses_remaining
FROM houses
WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05');
-- Expected: 0

-- Verify no audit defects for test houses
SELECT COUNT(*) as orphaned_defects
FROM audit_defects
WHERE house_id NOT IN (SELECT id FROM houses);
-- Expected: 0

-- ========================================================================
-- SECTION 9: PRODUCTION DATA VALIDATION
-- ========================================================================

-- Count active houses (production data)
SELECT COUNT(*) as total_active_houses FROM houses WHERE status != 'deleted';

-- Check project integrity
SELECT
  id,
  project_name,
  total_units,
  (SELECT COUNT(*) FROM houses WHERE project_id = projects.id) as houses_count,
  created_at
FROM projects
ORDER BY created_at DESC;

-- ========================================================================
-- SECTION 10: RLS POLICY VERIFICATION
-- ========================================================================

-- Check that auth_role() function exists and is working
SELECT 1 FROM public.auth_role() LIMIT 1;
-- Should return current user's role

-- List all RLS policies to verify they use auth_role()
SELECT
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ========================================================================
-- SECTION 11: POST-DEPLOYMENT CHECKS
-- ========================================================================

-- Verify demo accounts are ACTUALLY deleted from auth.users
SELECT COUNT(*) as remaining_demo_accounts
FROM auth.users
WHERE email LIKE 'ceo.test@%'
  OR email LIKE 'demo.%@aviva.th';
-- Expected: 0

-- Verify ALL 6 production users exist + email confirmed
SELECT
  COUNT(*) as production_users,
  COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmed,
  STRING_AGG(DISTINCT email, ', ') as user_emails
FROM auth.users
WHERE email IN (
  'joyus818@gmail.com',
  'ceo@alisa.com',
  'coo@alisa.com',
  'sale1@alisa.com',
  'sale2@alisa.com',
  'engineer@alisa.com'
);
-- Expected: 6 users, all 6 confirmed email addresses

-- ========================================================================
-- NOTES FOR ADMIN
-- ========================================================================

/*
PRODUCTION USERS — DO NOT DELETE (6 users):
  ✅ joyus818@gmail.com (CEO - Main Admin)
  ✅ ceo@alisa.com (CEO)
  ✅ coo@alisa.com (COO)
  ✅ sale1@alisa.com (Sales - Faa)
  ✅ sale2@alisa.com (Sales - Dearr)
  ✅ engineer@alisa.com (Construction - Pete)

DEMO ACCOUNTS — DELETE ONLY THESE 9 (by email match):
  ❌ ceo.test@aviva.th
  ❌ demo.admin@aviva.th
  ❌ demo.sales@aviva.th
  ❌ demo.finance@aviva.th
  ❌ demo.construction@aviva.th
  ❌ demo.accounting@aviva.th
  ❌ demo.hr@aviva.th
  ❌ demo.marketing@aviva.th
  ❌ demo.aftersales@aviva.th

PRODUCTION DATA — KEEP (DO NOT DELETE):
  ✅ All CRM Leads (134 items) — customer data is REAL
  ✅ Work Reports from engineer@alisa.com (Pete) on 17-18 June — KEEP (2 reports)
  ✅ All production user accounts

EXECUTION STEPS:
1. BACKUP FIRST: Always save query results to Google Drive before running deletes
2. RUN SECTION 1: Export all demo accounts to JSON (emergency backup)
3. RUN SECTION 2: Count — should show 9 demo accounts
4. RUN SECTION 2.5: Backup + DELETE demo work items (26 work items)
5. RUN SECTION 6.5: DELETE ALL demo data ← NEW SECTION (DELETE WORK QUEUE + REPORTS + LOGS + ETC)
   • Deletes: 143 work queue items + 33 work reports (keeps Pete's 17-18 Jun) + 26 approval logs + 3 petty cash + 20 documents + 1 AI chat
   • Keeps: ALL CRM leads (134 items) + Pete's 2 production reports
6. RUN SECTION 5: Verify all 6 production users are present ✅
7. RUN SECTIONS 3-6 (old): Back up test houses + dependencies
8. RUN SECTION 7 (old): Delete test data in order (Step 1-5)
9. RUN SECTION 8 (old): Verify all deletions successful
10. RUN SECTION 11 (old): Final check — 0 demo accounts, 6 production users remain
11. DOCUMENT CLEANUP: Save all results + timestamps to deployment report

If you cannot delete via SQL (no direct access):
- Use Supabase Dashboard → Authentication → Users → Delete each demo account manually
  (Only the 9 listed above — keep all production users)
- For houses: Use dashboard → each table → filter by plot_code → delete
- This is slower but safer if unsure about SQL constraints

Questions? Verify:
- Edge function: supabase/functions/admin-user-management/index.ts
- RLS policies: supabase/migrations/20260611_phase2.sql
- Production user roles: joyus818=admin, ceo@=ceo, coo@=coo, engineer@=engineer
*/
