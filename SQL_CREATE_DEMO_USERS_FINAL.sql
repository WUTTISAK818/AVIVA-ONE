-- =====================================================
-- AVIVA ONE v6.36 - Create DEMO Users (1 per Department)
-- =====================================================
-- Created: 18 มิ.ย. 2569
-- Purpose: Create demo users for hands-on testing by end user
-- Users: 6 demo accounts (CEO, COO, Sales, Engineer, Finance, Admin)
-- All users marked with is_demo = true for easy cleanup later

BEGIN;

-- =====================================================
-- DEMO USER 1: CEO - Full Access
-- =====================================================
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  is_demo,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'demo.ceo@alisa.com',
  'Demo CEO - Full Access',
  'ceo',
  'Executive',
  '+66-8800-1111',
  true,
  false,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'ceo',
  full_name = 'Demo CEO - Full Access',
  is_demo = true,
  is_active = true,
  updated_at = NOW();

-- =====================================================
-- DEMO USER 2: COO - Full Access
-- =====================================================
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  is_demo,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'demo.coo@alisa.com',
  'Demo COO - Full Access',
  'coo',
  'Operations',
  '+66-8800-2222',
  true,
  false,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'coo',
  full_name = 'Demo COO - Full Access',
  is_demo = true,
  is_active = true,
  updated_at = NOW();

-- =====================================================
-- DEMO USER 3: SALES - CRM Department
-- =====================================================
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  is_demo,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'demo.sales@alisa.com',
  'Demo Sales - CRM Department',
  'sales',
  'Sales',
  '+66-8800-3333',
  true,
  false,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'sales',
  full_name = 'Demo Sales - CRM Department',
  is_demo = true,
  is_active = true,
  updated_at = NOW();

-- =====================================================
-- DEMO USER 4: ENGINEER - Construction Department
-- =====================================================
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  is_demo,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'demo.engineer@alisa.com',
  'Demo Engineer - Construction Department',
  'engineer',
  'Construction',
  '+66-8800-4444',
  true,
  false,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'engineer',
  full_name = 'Demo Engineer - Construction Department',
  is_demo = true,
  is_active = true,
  updated_at = NOW();

-- =====================================================
-- DEMO USER 5: FINANCE - Finance Department
-- =====================================================
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  is_demo,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'demo.finance@alisa.com',
  'Demo Finance - Finance Department',
  'finance',
  'Finance',
  '+66-8800-5555',
  true,
  false,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'finance',
  full_name = 'Demo Finance - Finance Department',
  is_demo = true,
  is_active = true,
  updated_at = NOW();

-- =====================================================
-- DEMO USER 6: ADMIN - System Administrator
-- =====================================================
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  is_demo,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'demo.admin@alisa.com',
  'Demo Admin - System Administrator',
  'admin',
  'IT/Admin',
  '+66-8800-6666',
  true,
  false,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  full_name = 'Demo Admin - System Administrator',
  is_demo = true,
  is_active = true,
  updated_at = NOW();

COMMIT;

-- =====================================================
-- VERIFICATION: Show Demo Users Created
-- =====================================================

SELECT
  email,
  full_name,
  role,
  department,
  is_active,
  is_demo,
  created_at
FROM public.profiles
WHERE is_demo = true
ORDER BY role;

-- Count demo users
SELECT
  COUNT(*) as demo_users_count,
  COUNT(CASE WHEN role = 'ceo' THEN 1 END) as ceo_count,
  COUNT(CASE WHEN role = 'coo' THEN 1 END) as coo_count,
  COUNT(CASE WHEN role = 'sales' THEN 1 END) as sales_count,
  COUNT(CASE WHEN role = 'engineer' THEN 1 END) as engineer_count,
  COUNT(CASE WHEN role = 'finance' THEN 1 END) as finance_count,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count
FROM public.profiles
WHERE is_demo = true;

-- =====================================================
-- CLEANUP: Remove Demo Users (Run ONLY when done testing)
-- =====================================================
-- To delete all demo users, run:
/*
DELETE FROM public.profiles WHERE is_demo = true;

-- Verify deletion
SELECT COUNT(*) FROM public.profiles WHERE is_demo = true;
*/

