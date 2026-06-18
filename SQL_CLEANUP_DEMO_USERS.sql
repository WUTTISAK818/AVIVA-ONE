-- =====================================================
-- AVIVA ONE v6.36 - Cleanup Demo Users After Testing
-- =====================================================
-- Created: 18 มิ.ย. 2569
-- Purpose: Remove demo users after hands-on testing complete
-- WARNING: This deletes all demo user accounts

-- =====================================================
-- Show Demo Users Before Deletion
-- =====================================================

SELECT
  email,
  full_name,
  role,
  is_demo,
  created_at
FROM public.profiles
WHERE is_demo = true
ORDER BY role;

-- Count demo users
SELECT COUNT(*) as demo_users_count
FROM public.profiles
WHERE is_demo = true;

-- =====================================================
-- DELETE DEMO USERS
-- =====================================================

BEGIN;

-- Delete all demo users
DELETE FROM public.profiles
WHERE is_demo = true;

RAISE NOTICE 'Demo users deleted successfully';

COMMIT;

-- =====================================================
-- VERIFY DELETION
-- =====================================================

-- Should return 0
SELECT COUNT(*) as remaining_demo_users
FROM public.profiles
WHERE is_demo = true;

-- Show that production data still exists
SELECT COUNT(*) as production_houses
FROM public.houses
WHERE is_test IS NOT true OR is_test IS NULL;
-- Expected: 31

SELECT COUNT(*) as production_crm_leads
FROM public.crm_leads
WHERE is_test IS NOT true OR is_test IS NULL;
-- Expected: 134

-- =====================================================
-- FINAL REPORT
-- =====================================================

SELECT 'Demo User Cleanup Completed Successfully ✅' as status;

