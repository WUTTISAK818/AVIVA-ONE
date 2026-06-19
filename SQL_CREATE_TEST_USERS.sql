-- =====================================================
-- AVIVA ONE v6.36 - Create 6 Test Users for RBAC Testing
-- =====================================================
-- Created: 18 มิ.ย. 2569
-- Purpose: Create test users for Phase 2-4 testing
-- WARNING: ข้อมูลนี้สำหรับ testing เท่านั้น ลบหลังจากทดสอบเสร็จ

-- =====================================================
-- STEP 1: Create auth users (Supabase Auth)
-- =====================================================
-- Note: Run these via Supabase Dashboard → Authentication → Users
-- OR use Supabase CLI: supabase auth admin create-user --email test.ceo@alisa.com --password <password>

-- Create 6 test users with different roles:
-- 1. test.ceo@alisa.com / password: Test@CEO2569 / role: ceo
-- 2. test.coo@alisa.com / password: Test@COO2569 / role: coo
-- 3. test.sales1@alisa.com / password: Test@Sales2569 / role: sales
-- 4. test.sales2@alisa.com / password: Test@Sales2569 / role: sales
-- 5. test.engineer@alisa.com / password: Test@Engineer2569 / role: engineer
-- 6. test.finance@alisa.com / password: Test@Finance2569 / role: finance

-- =====================================================
-- STEP 2: Create user profiles in public.profiles
-- =====================================================

BEGIN;

-- Create test CEO user
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test.ceo@alisa.com',
  'Test CEO User',
  'ceo',
  'Executive',
  '+66-1234-5678',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'ceo',
  is_test = true,
  updated_at = NOW();

-- Create test COO user
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test.coo@alisa.com',
  'Test COO User',
  'coo',
  'Operations',
  '+66-2345-6789',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'coo',
  is_test = true,
  updated_at = NOW();

-- Create test Sales 1 user
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test.sales1@alisa.com',
  'Test Sales User 1',
  'sales',
  'Sales',
  '+66-3456-7890',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'sales',
  is_test = true,
  updated_at = NOW();

-- Create test Sales 2 user
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test.sales2@alisa.com',
  'Test Sales User 2',
  'sales',
  'Sales',
  '+66-4567-8901',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'sales',
  is_test = true,
  updated_at = NOW();

-- Create test Engineer user
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test.engineer@alisa.com',
  'Test Engineer User',
  'engineer',
  'Construction',
  '+66-5678-9012',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'engineer',
  is_test = true,
  updated_at = NOW();

-- Create test Finance user
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_test,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test.finance@alisa.com',
  'Test Finance User',
  'finance',
  'Finance',
  '+66-6789-0123',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  role = 'finance',
  is_test = true,
  updated_at = NOW();

COMMIT;

-- =====================================================
-- STEP 3: Verify test users created
-- =====================================================

-- Count test users
SELECT
  COUNT(*) as test_users_count,
  COUNT(CASE WHEN role = 'ceo' THEN 1 END) as ceo_count,
  COUNT(CASE WHEN role = 'coo' THEN 1 END) as coo_count,
  COUNT(CASE WHEN role = 'sales' THEN 1 END) as sales_count,
  COUNT(CASE WHEN role = 'engineer' THEN 1 END) as engineer_count,
  COUNT(CASE WHEN role = 'finance' THEN 1 END) as finance_count
FROM public.profiles
WHERE is_test = true;

-- List all test users
SELECT email, role, department, is_active
FROM public.profiles
WHERE is_test = true
ORDER BY role, email;

-- =====================================================
-- STEP 4: Cleanup (Run ONLY after testing complete)
-- =====================================================
-- To delete all test users, run:
/*
DELETE FROM public.profiles WHERE is_test = true AND email LIKE 'test.%@alisa.com';

-- Verify deletion
SELECT COUNT(*) FROM public.profiles WHERE is_test = true;
*/

