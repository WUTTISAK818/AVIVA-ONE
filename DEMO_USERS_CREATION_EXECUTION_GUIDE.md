# 🚀 AVIVA ONE v6.36 - Demo Users Creation Execution Guide

**Date**: 18 June 2026  
**Go-Live Window**: 18-20 June 2026  
**Status**: READY FOR IMMEDIATE EXECUTION

---

## Executive Summary

11 Demo users need to be created in Supabase for 2-day accelerated go-live testing. All SQL scripts are prepared and ready to execute.

**Time to Execute**: 5-10 minutes  
**Time to Verify**: 2-3 minutes  
**Total Setup Time**: ~15 minutes

---

## 📋 Demo Users List (11 Total)

| # | Name | Email | Password | Role | Department |
|---|------|-------|----------|------|------------|
| 1 | Demo CEO | demo.ceo@alisa.com | Demo@CEO123 | ceo | Executive |
| 2 | Demo COO | demo.coo@alisa.com | Demo@COO123 | coo | Operations |
| 3 | Demo Project Manager | demo.project_mgr@alisa.com | Demo@ProjectMgr123 | project_manager | Construction |
| 4 | Demo Sales Manager | demo.sales_mgr@alisa.com | Demo@SalesMgr123 | sales_manager | Sales |
| 5 | Demo Finance Manager | demo.finance_mgr@alisa.com | Demo@FinanceMgr123 | finance_manager | Finance |
| 6 | Demo HR Manager | demo.hr_mgr@alisa.com | Demo@HrMgr123 | hr_manager | HR |
| 7 | Demo Engineer | demo.engineer@alisa.com | Demo@Engineer123 | engineer | Construction |
| 8 | Demo QA Inspector | demo.qa_inspector@alisa.com | Demo@QaInspector123 | qa_inspector | Quality |
| 9 | Demo Accountant | demo.accountant@alisa.com | Demo@Accountant123 | accountant | Finance |
| 10 | Demo Marketing | demo.marketing@alisa.com | Demo@Marketing123 | marketing | Marketing |
| 11 | Demo Admin | demo.admin@alisa.com | Demo@Admin123 | admin | IT |

---

## Step 1: Access Supabase Dashboard

### Direct Link
```
https://supabase.com/dashboard/project/ipxeraxcbxxsjimzougk/sql/new
```

### Or Manual Navigation
1. Go to: https://app.supabase.com
2. Login with your credentials
3. Select Project: **ipxeraxcbxxsjimzougk**
4. Go to: **SQL Editor** (left menu)
5. Click: **+ New Query**

---

## Step 2: Copy & Execute SQL

### SQL Script (11 Demo Users)

```sql
-- =====================================================
-- AVIVA ONE v6.36 - Create 11 Demo Users
-- Execution Date: 18 June 2026
-- Purpose: Go-live testing (18-20 June)
-- =====================================================

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
```

### Execution Steps

1. **Copy the entire SQL script above** (from `BEGIN;` to `COMMIT;`)
2. **Paste into Supabase SQL Editor**
3. **Click the "Run" button** (or press Ctrl+Enter)
4. **Wait for completion** (should take 5-10 seconds)
5. **Look for green checkmark** ✓ indicating success

### Expected Result
```
Query executed successfully
Rows affected: 11
```

---

## Step 3: Verify Creation

### Verification Query 1: Count Demo Users

Run this query to verify all 11 users were created:

```sql
SELECT
  COUNT(*) as total_demo_users,
  COUNT(CASE WHEN role = 'ceo' THEN 1 END) as ceo,
  COUNT(CASE WHEN role = 'coo' THEN 1 END) as coo,
  COUNT(CASE WHEN role = 'project_manager' THEN 1 END) as project_mgr,
  COUNT(CASE WHEN role = 'sales_manager' THEN 1 END) as sales_mgr,
  COUNT(CASE WHEN role = 'finance_manager' THEN 1 END) as finance_mgr,
  COUNT(CASE WHEN role = 'hr_manager' THEN 1 END) as hr_mgr,
  COUNT(CASE WHEN role = 'engineer' THEN 1 END) as engineer,
  COUNT(CASE WHEN role = 'qa_inspector' THEN 1 END) as qa_inspector,
  COUNT(CASE WHEN role = 'accountant' THEN 1 END) as accountant,
  COUNT(CASE WHEN role = 'marketing' THEN 1 END) as marketing,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin
FROM public.profiles
WHERE is_demo = true;
```

### Expected Output
```
total_demo_users | ceo | coo | project_mgr | sales_mgr | finance_mgr | hr_mgr | engineer | qa_inspector | accountant | marketing | admin
11               | 1   | 1   | 1           | 1         | 1           | 1      | 1        | 1            | 1          | 1         | 1
```

### Verification Query 2: List All Demo Users

Run this query to see all demo users with their details:

```sql
SELECT
  email,
  full_name,
  role,
  department,
  phone,
  is_active,
  is_demo,
  created_at
FROM public.profiles
WHERE is_demo = true
ORDER BY role;
```

### Expected Output (11 rows)
```
Email                           | Full Name                  | Role             | Department   | Is Active | Is Demo
demo.ceo@alisa.com              | Demo CEO - Full Access     | ceo              | Executive    | true      | true
demo.coo@alisa.com              | Demo COO - Full Access     | coo              | Operations   | true      | true
demo.project_mgr@alisa.com      | Demo Project Manager       | project_manager  | Construction | true      | true
demo.sales_mgr@alisa.com        | Demo Sales Manager         | sales_manager    | Sales        | true      | true
demo.finance_mgr@alisa.com      | Demo Finance Manager       | finance_manager  | Finance      | true      | true
demo.hr_mgr@alisa.com           | Demo HR Manager            | hr_manager       | HR           | true      | true
demo.engineer@alisa.com         | Demo Engineer              | engineer         | Construction | true      | true
demo.qa_inspector@alisa.com     | Demo QA Inspector          | qa_inspector     | Quality      | true      | true
demo.accountant@alisa.com       | Demo Accountant            | accountant       | Finance      | true      | true
demo.marketing@alisa.com        | Demo Marketing             | marketing        | Marketing    | true      | true
demo.admin@alisa.com            | Demo Admin                 | admin            | IT           | true      | true
```

---

## Step 4: Create Demo Accounts in Auth

The profiles have been created in the `public.profiles` table. Now you need to create corresponding authentication accounts in Supabase Auth.

### Option A: Manual Creation (Simple)

In Supabase Dashboard:

1. Go to: **Authentication** → **Users**
2. Click: **+ Add User** (top right)
3. For each demo user:
   - **Email**: (from list above, e.g., `demo.ceo@alisa.com`)
   - **Password**: (from list above, e.g., `Demo@CEO123`)
   - Check: **Auto confirm user** ✓
   - Click: **+ Create user**

### Option B: Automated Creation (Recommended)

Use the provided script: `/home/user/AVIVA-ONE/SQL_CREATE_COMPLETE_DEMO_USERS.sql`

Alternatively, use an edge function or API endpoint if available in your project.

---

## Step 5: Test Login

### Test Each User

For each of the 11 demo users:

1. **Go to**: http://localhost:3000/auth/login (or your deployed URL)
2. **Enter email**: (e.g., `demo.ceo@alisa.com`)
3. **Enter password**: (e.g., `Demo@CEO123`)
4. **Click**: Login
5. **Expected**: User logs in successfully and sees dashboard

### Verification Checklist

- [ ] demo.ceo@alisa.com logs in ✓
- [ ] demo.coo@alisa.com logs in ✓
- [ ] demo.project_mgr@alisa.com logs in ✓
- [ ] demo.sales_mgr@alisa.com logs in ✓
- [ ] demo.finance_mgr@alisa.com logs in ✓
- [ ] demo.hr_mgr@alisa.com logs in ✓
- [ ] demo.engineer@alisa.com logs in ✓
- [ ] demo.qa_inspector@alisa.com logs in ✓
- [ ] demo.accountant@alisa.com logs in ✓
- [ ] demo.marketing@alisa.com logs in ✓
- [ ] demo.admin@alisa.com logs in ✓

---

## Step 6: Distribute Credentials

### Credential Distribution

Create a secure document with:

```
User 1 - CEO Testing
Email: demo.ceo@alisa.com
Password: Demo@CEO123
Role: ceo
Access: Full app access (all modules)

User 2 - COO Testing
Email: demo.coo@alisa.com
Password: Demo@COO123
Role: coo
Access: Full app access (all modules)

... (continue for all 11 users)
```

Share with testers via secure channel (email, encrypted message, etc.)

---

## Cleanup After Testing

### To Delete Demo Users

Run this SQL query after testing is complete:

```sql
-- Delete demo auth users
DELETE FROM auth.users
WHERE email LIKE 'demo.%@alisa.com';

-- Delete demo profiles
DELETE FROM public.profiles
WHERE is_demo = true;
```

### Verify Cleanup

```sql
SELECT COUNT(*) as remaining_demo_users
FROM public.profiles
WHERE is_demo = true;
-- Should return: 0
```

---

## Troubleshooting

### Issue: "Permission denied" when running SQL

**Solution**: Make sure you're logged in with the correct Supabase account that has admin access to the project.

### Issue: Users created but cannot login

**Solution**: 
- Check that users were also created in Auth tab
- Verify passwords match exactly (case-sensitive)
- Check email in auth table matches profile table

### Issue: Users see 403/Unauthorized errors

**Solution**:
- Verify `is_active = true` in profiles table
- Check RLS policies on tables the user is trying to access
- Verify role exists in the `ALLOWED_ROLES` constant in your code

### Issue: Some users see different features

**Solution**:
- This is expected! Different roles have different access levels based on RBAC
- Review role permissions in: `/src/lib/roles.ts`
- Check RLS policies in Supabase dashboard

---

## Timeline

| Task | Time | Start | End |
|------|------|-------|-----|
| Copy SQL script | 2 min | T+0 | T+2 |
| Execute SQL | 5 min | T+2 | T+7 |
| Verify creation | 3 min | T+7 | T+10 |
| Create auth users | 10 min | T+10 | T+20 |
| Test login | 5 min | T+20 | T+25 |
| Distribute creds | 5 min | T+25 | T+30 |
| **Total** | **30 min** | | |

---

## Success Criteria

✓ All 11 demo users created in profiles table  
✓ All 11 demo users created in auth table  
✓ All 11 users can login successfully  
✓ Each user sees their correct role/department  
✓ RBAC enforcement working correctly  
✓ No errors in browser console  
✓ No errors in Supabase logs  

---

## Resources

| Resource | Location |
|----------|----------|
| Demo User List | This file (top) |
| SQL Scripts | `/home/user/AVIVA-ONE/SQL_CREATE_COMPLETE_DEMO_USERS.sql` |
| Testing Guide | `/home/user/AVIVA-ONE/DEMO_USER_TESTING_GUIDE_v6.36.md` |
| Role Analysis | `/home/user/AVIVA-ONE/ROLE_ANALYSIS_AND_RECOMMENDATIONS.md` |
| Credentials Backup | `/home/user/AVIVA-ONE/DEMO_ACCOUNTS_CREDENTIALS.txt` |

---

## Support

If you encounter issues:

1. Check the Troubleshooting section above
2. Review Supabase logs: Dashboard → Logs → Auth
3. Check RLS policies: Dashboard → SQL Editor → Policies
4. Verify project ID: `ipxeraxcbxxsjimzougk`

---

**Status**: READY FOR GO-LIVE  
**Last Updated**: 18 June 2026  
**Next Step**: Execute SQL script and verify creation  

