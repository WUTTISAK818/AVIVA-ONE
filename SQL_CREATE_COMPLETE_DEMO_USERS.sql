-- =====================================================
-- AVIVA ONE v6.36 - Create COMPLETE Demo Users
-- =====================================================
-- Created: 18 มิ.ย. 2569
-- Purpose: Create 15 demo users (all roles for complete testing)
-- WARNING: Choose option A (11 roles) or B (15 roles) based on needs

-- =====================================================
-- OPTION A: 11 ROLES (RECOMMENDED - Balanced Testing)
-- =====================================================
-- Uncomment this section to run ONLY 11 essential roles

/*
BEGIN;

-- 1. CEO
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.ceo@alisa.com', 'Demo CEO - Full Access', 'ceo', 'Executive', '+66-8800-1111', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='ceo', full_name='Demo CEO - Full Access', is_demo=true, is_active=true, updated_at=NOW();

-- 2. COO
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.coo@alisa.com', 'Demo COO - Full Access', 'coo', 'Operations', '+66-8800-2222', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='coo', full_name='Demo COO - Full Access', is_demo=true, is_active=true, updated_at=NOW();

-- 3. Project Manager
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.project_mgr@alisa.com', 'Demo Project Manager', 'project_manager', 'Construction', '+66-8800-3333', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='project_manager', full_name='Demo Project Manager', is_demo=true, is_active=true, updated_at=NOW();

-- 4. Sales Manager
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.sales_mgr@alisa.com', 'Demo Sales Manager', 'sales_manager', 'Sales', '+66-8800-4444', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='sales_manager', full_name='Demo Sales Manager', is_demo=true, is_active=true, updated_at=NOW();

-- 5. Finance Manager
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.finance_mgr@alisa.com', 'Demo Finance Manager', 'finance_manager', 'Finance', '+66-8800-5555', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='finance_manager', full_name='Demo Finance Manager', is_demo=true, is_active=true, updated_at=NOW();

-- 6. HR Manager
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.hr_mgr@alisa.com', 'Demo HR Manager', 'hr_manager', 'HR', '+66-8800-6666', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='hr_manager', full_name='Demo HR Manager', is_demo=true, is_active=true, updated_at=NOW();

-- 7. Engineer
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.engineer@alisa.com', 'Demo Engineer', 'engineer', 'Construction', '+66-8800-7777', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='engineer', full_name='Demo Engineer', is_demo=true, is_active=true, updated_at=NOW();

-- 8. QA Inspector
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.qa_inspector@alisa.com', 'Demo QA Inspector', 'qa_inspector', 'Quality', '+66-8800-8888', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='qa_inspector', full_name='Demo QA Inspector', is_demo=true, is_active=true, updated_at=NOW();

-- 9. Accountant
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.accountant@alisa.com', 'Demo Accountant', 'accountant', 'Finance', '+66-8800-9999', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='accountant', full_name='Demo Accountant', is_demo=true, is_active=true, updated_at=NOW();

-- 10. Marketing
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.marketing@alisa.com', 'Demo Marketing', 'marketing', 'Marketing', '+66-8801-1111', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='marketing', full_name='Demo Marketing', is_demo=true, is_active=true, updated_at=NOW();

-- 11. Admin
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.admin@alisa.com', 'Demo Admin', 'admin', 'IT', '+66-8801-2222', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='admin', full_name='Demo Admin', is_demo=true, is_active=true, updated_at=NOW();

COMMIT;
*/

-- =====================================================
-- OPTION B: 15 ROLES (ENTERPRISE - Complete Coverage)
-- =====================================================
-- Uncomment this section to run ALL 15 roles

BEGIN;

-- 1. CEO
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.ceo@alisa.com', 'Demo CEO - Full Access', 'ceo', 'Executive', '+66-8800-1111', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='ceo', full_name='Demo CEO - Full Access', is_demo=true, is_active=true, updated_at=NOW();

-- 2. COO
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.coo@alisa.com', 'Demo COO - Full Access', 'coo', 'Operations', '+66-8800-2222', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='coo', full_name='Demo COO - Full Access', is_demo=true, is_active=true, updated_at=NOW();

-- 3. Project Manager
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.project_mgr@alisa.com', 'Demo Project Manager', 'project_manager', 'Construction', '+66-8800-3333', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='project_manager', full_name='Demo Project Manager', is_demo=true, is_active=true, updated_at=NOW();

-- 4. Sales Manager
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.sales_mgr@alisa.com', 'Demo Sales Manager', 'sales_manager', 'Sales', '+66-8800-4444', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='sales_manager', full_name='Demo Sales Manager', is_demo=true, is_active=true, updated_at=NOW();

-- 5. Finance Manager
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.finance_mgr@alisa.com', 'Demo Finance Manager', 'finance_manager', 'Finance', '+66-8800-5555', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='finance_manager', full_name='Demo Finance Manager', is_demo=true, is_active=true, updated_at=NOW();

-- 6. HR Manager
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.hr_mgr@alisa.com', 'Demo HR Manager', 'hr_manager', 'HR', '+66-8800-6666', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='hr_manager', full_name='Demo HR Manager', is_demo=true, is_active=true, updated_at=NOW();

-- 7. Engineer
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.engineer@alisa.com', 'Demo Engineer', 'engineer', 'Construction', '+66-8800-7777', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='engineer', full_name='Demo Engineer', is_demo=true, is_active=true, updated_at=NOW();

-- 8. QA Inspector
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.qa_inspector@alisa.com', 'Demo QA Inspector', 'qa_inspector', 'Quality', '+66-8800-8888', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='qa_inspector', full_name='Demo QA Inspector', is_demo=true, is_active=true, updated_at=NOW();

-- 9. Accountant
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.accountant@alisa.com', 'Demo Accountant', 'accountant', 'Finance', '+66-8800-9999', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='accountant', full_name='Demo Accountant', is_demo=true, is_active=true, updated_at=NOW();

-- 10. Marketing
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.marketing@alisa.com', 'Demo Marketing', 'marketing', 'Marketing', '+66-8801-1111', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='marketing', full_name='Demo Marketing', is_demo=true, is_active=true, updated_at=NOW();

-- 11. Admin
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.admin@alisa.com', 'Demo Admin', 'admin', 'IT', '+66-8801-2222', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='admin', full_name='Demo Admin', is_demo=true, is_active=true, updated_at=NOW();

-- 12. Customer Service
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.customer_service@alisa.com', 'Demo Customer Service', 'customer_service', 'Sales', '+66-8801-3333', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='customer_service', full_name='Demo Customer Service', is_demo=true, is_active=true, updated_at=NOW();

-- 13. Director
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.director@alisa.com', 'Demo Director', 'director', 'Executive', '+66-8801-4444', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='director', full_name='Demo Director', is_demo=true, is_active=true, updated_at=NOW();

-- 14. Office Manager
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.office_mgr@alisa.com', 'Demo Office Manager', 'office_manager', 'Admin', '+66-8801-5555', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='office_manager', full_name='Demo Office Manager', is_demo=true, is_active=true, updated_at=NOW();

-- 15. Procurement
INSERT INTO public.profiles (id, email, full_name, role, department, phone, is_active, is_demo, created_at, updated_at)
VALUES (gen_random_uuid(), 'demo.procurement@alisa.com', 'Demo Procurement', 'procurement', 'Admin', '+66-8801-6666', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET role='procurement', full_name='Demo Procurement', is_demo=true, is_active=true, updated_at=NOW();

COMMIT;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Show all demo users
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
  COUNT(*) as total_demo_users,
  COUNT(CASE WHEN role = 'ceo' THEN 1 END) as ceo,
  COUNT(CASE WHEN role = 'coo' THEN 1 END) as coo,
  COUNT(CASE WHEN role = 'project_manager' THEN 1 END) as project_mgr,
  COUNT(CASE WHEN role = 'sales_manager' THEN 1 END) as sales_mgr,
  COUNT(CASE WHEN role = 'finance_manager' THEN 1 END) as finance_mgr,
  COUNT(CASE WHEN role = 'hr_manager' THEN 1 END) as hr_mgr,
  COUNT(CASE WHEN role = 'engineer' THEN 1 END) as engineer,
  COUNT(CASE WHEN role = 'qa_inspector' THEN 1 END) as qa,
  COUNT(CASE WHEN role = 'accountant' THEN 1 END) as accountant,
  COUNT(CASE WHEN role = 'marketing' THEN 1 END) as marketing,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin,
  COUNT(CASE WHEN role = 'customer_service' THEN 1 END) as cust_service,
  COUNT(CASE WHEN role = 'director' THEN 1 END) as director,
  COUNT(CASE WHEN role = 'office_manager' THEN 1 END) as office_mgr,
  COUNT(CASE WHEN role = 'procurement' THEN 1 END) as procurement
FROM public.profiles
WHERE is_demo = true;

