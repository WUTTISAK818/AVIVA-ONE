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

EXECUTION STEPS:
1. BACKUP FIRST: Always save query results to Google Drive before running deletes
2. RUN SECTION 1: Export all demo accounts to JSON (emergency backup)
3. RUN SECTION 2: Count — should show 9 demo accounts
4. RUN SECTION 5: Verify all 6 production users are present ✅
5. RUN SECTIONS 3-6: Back up test houses + dependencies
6. RUN SECTION 7: Delete test data in order (Step 1-5)
7. RUN SECTION 8: Verify all deletions successful
8. RUN SECTION 11: Final check — 0 demo accounts, 6 production users remain
9. DOCUMENT CLEANUP: Save all results + timestamps to deployment report

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
