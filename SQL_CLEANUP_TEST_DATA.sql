-- =====================================================
-- AVIVA ONE v6.36 - Cleanup Test Data After Testing Complete
-- =====================================================
-- Created: 18 มิ.ย. 2569
-- Purpose: Remove all test data and users marked with is_test = true
-- WARNING: ⚠️ This script DELETES data - use only after verification complete!
-- Expected to run: 24 มิ.ย. 2569 (before go-live)

-- =====================================================
-- VERIFICATION BEFORE CLEANUP
-- =====================================================

-- Show what will be deleted
SELECT
  'Payment Records' as record_type,
  COUNT(*) as count_to_delete,
  COUNT(DISTINCT plot_number) as unique_plots
FROM public.payment_records
WHERE is_test = true

UNION ALL

SELECT
  'Approval Logs' as record_type,
  COUNT(*) as count_to_delete,
  COUNT(DISTINCT plot_number) as unique_plots
FROM public.approval_logs
WHERE is_test = true

UNION ALL

SELECT
  'QC Defects' as record_type,
  COUNT(*) as count_to_delete,
  COUNT(DISTINCT plot_number) as unique_plots
FROM public.qc_defects
WHERE is_test = true

UNION ALL

SELECT
  'Work Reports' as record_type,
  COUNT(*) as count_to_delete,
  COUNT(DISTINCT reported_by) as unique_reporters
FROM public.work_reports
WHERE is_test = true

UNION ALL

SELECT
  'Houses' as record_type,
  COUNT(*) as count_to_delete,
  COUNT(DISTINCT plot_number) as unique_plots
FROM public.houses
WHERE is_test = true

UNION ALL

SELECT
  'CRM Leads' as record_type,
  COUNT(*) as count_to_delete,
  COUNT(DISTINCT email) as unique_emails
FROM public.crm_leads
WHERE is_test = true

UNION ALL

SELECT
  'Test Users' as record_type,
  COUNT(*) as count_to_delete,
  COUNT(DISTINCT email) as unique_emails
FROM public.profiles
WHERE is_test = true;

-- =====================================================
-- STEP 1: Verify Production Data is Protected
-- =====================================================

-- Show production houses (should have 31)
SELECT COUNT(*) as production_houses_count
FROM public.houses
WHERE is_test IS NOT true OR is_test IS NULL;

-- Show production CRM leads (should have 134)
SELECT COUNT(*) as production_leads_count
FROM public.crm_leads
WHERE is_test IS NOT true OR is_test IS NULL;

-- Show production approval logs (should have 26)
SELECT COUNT(*) as production_approvals_count
FROM public.approval_logs
WHERE is_test IS NOT true OR is_test IS NULL;

-- =====================================================
-- STEP 2: CLEANUP - Delete in Correct Order (with FK dependencies)
-- =====================================================
-- ⚠️ BACKUP BEFORE RUNNING ⚠️

-- Start transaction
BEGIN;

-- 1. Delete Payment Records (depends on houses)
DELETE FROM public.payment_records
WHERE is_test = true;

RAISE NOTICE 'Deleted payment records with is_test=true';

-- 2. Delete Approval Logs (depends on houses)
-- Note: approval_logs are normally immutable, but test records can be deleted
DELETE FROM public.approval_logs
WHERE is_test = true;

RAISE NOTICE 'Deleted approval logs with is_test=true';

-- 3. Delete QC Defects (depends on houses)
DELETE FROM public.qc_defects
WHERE is_test = true;

RAISE NOTICE 'Deleted QC defects with is_test=true';

-- 4. Delete Work Reports (depends on houses/users)
DELETE FROM public.work_reports
WHERE is_test = true;

RAISE NOTICE 'Deleted work reports with is_test=true';

-- 5. Delete Houses (depends on nothing critical, but CRM leads may reference)
DELETE FROM public.houses
WHERE is_test = true;

RAISE NOTICE 'Deleted houses with is_test=true';

-- 6. Delete CRM Leads (no dependencies)
DELETE FROM public.crm_leads
WHERE is_test = true;

RAISE NOTICE 'Deleted CRM leads with is_test=true';

-- 7. Delete Test User Profiles
DELETE FROM public.profiles
WHERE is_test = true
AND email LIKE 'test.%@alisa.com';

RAISE NOTICE 'Deleted test user profiles';

-- Commit if all successful
COMMIT;

-- =====================================================
-- STEP 3: Verification After Cleanup
-- =====================================================

-- Verify all test data deleted
SELECT
  COUNT(*) as remaining_test_records
FROM (
  SELECT * FROM public.payment_records WHERE is_test = true
  UNION ALL
  SELECT * FROM public.approval_logs WHERE is_test = true
  UNION ALL
  SELECT * FROM public.qc_defects WHERE is_test = true
  UNION ALL
  SELECT * FROM public.work_reports WHERE is_test = true
  UNION ALL
  SELECT * FROM public.houses WHERE is_test = true
  UNION ALL
  SELECT * FROM public.crm_leads WHERE is_test = true
  UNION ALL
  SELECT * FROM public.profiles WHERE is_test = true
) as all_remaining_test;

-- Verify production data still intact
SELECT
  (SELECT COUNT(*) FROM public.houses WHERE is_test IS NOT true OR is_test IS NULL) as production_houses,
  (SELECT COUNT(*) FROM public.crm_leads WHERE is_test IS NOT true OR is_test IS NULL) as production_leads,
  (SELECT COUNT(*) FROM public.approval_logs WHERE is_test IS NOT true OR is_test IS NULL) as production_approvals,
  (SELECT COUNT(*) FROM public.work_reports WHERE reported_by LIKE '%alisa.com' AND is_test IS NOT true) as production_reports,
  (SELECT COUNT(*) FROM public.qc_defects WHERE is_test IS NOT true OR is_test IS NULL) as production_defects
AS cleanup_verification;

-- Show summary report
SELECT 'Test Data Cleanup Completed Successfully ✅' as status;

-- =====================================================
-- STEP 4: Database Statistics (for monitoring)
-- =====================================================

-- Get current database size
SELECT
  datname as database_name,
  pg_size_pretty(pg_database_size(datname)) as database_size
FROM pg_database
WHERE datname = 'aviva_app_db';

-- Get table sizes before/after cleanup
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('houses', 'crm_leads', 'approval_logs', 'work_reports', 'qc_defects', 'payment_records', 'profiles')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- ERROR RECOVERY (If cleanup fails)
-- =====================================================
-- If any step fails, the entire transaction will rollback
-- No data will be deleted if there's an error
-- Check the error message and fix the issue before retrying

-- To see what test data exists before cleanup:
/*
SELECT
  'Houses' as type,
  COUNT(*) as count,
  COUNT(CASE WHEN is_test = true THEN 1 END) as test_count
FROM public.houses

UNION ALL

SELECT
  'CRM Leads' as type,
  COUNT(*) as count,
  COUNT(CASE WHEN is_test = true THEN 1 END) as test_count
FROM public.crm_leads

UNION ALL

SELECT
  'Work Reports' as type,
  COUNT(*) as count,
  COUNT(CASE WHEN is_test = true THEN 1 END) as test_count
FROM public.work_reports;
*/

-- =====================================================
-- FINAL CHECKLIST - Run after cleanup
-- =====================================================
/*
After running cleanup, verify:

[ ] Test payment records: 0 remaining
[ ] Test approval logs: 0 remaining
[ ] Test QC defects: 0 remaining
[ ] Test work reports: 0 remaining
[ ] Test houses: 0 remaining
[ ] Test CRM leads: 0 remaining
[ ] Test users: 0 remaining
[ ] Production houses: 31
[ ] Production CRM leads: 134
[ ] Production approval logs: 26
[ ] Database size reduced

If all checks pass: ✅ READY FOR GO-LIVE
*/

