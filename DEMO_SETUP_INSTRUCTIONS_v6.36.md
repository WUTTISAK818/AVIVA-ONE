# 🎬 คำแนะนำการตั้งค่า Demo Users (DEMO SETUP INSTRUCTIONS)

**วันที่**: 18 มิ.ย. 2569  
**เป้าหมาย**: ตั้งค่าบัญชี demo 6 คนเพื่อให้ผู้บริหารลองใช้จริง  
**ระยะเวลา**: 15-30 นาที

---

## 📋 ขั้นตอน 1: ตรวจสอบความพร้อม (PRE-SETUP)

### ✅ ตรวจสอบว่ามีทั้งหมด:

```
☐ Supabase Project ID / Access
☐ Database URL
☐ Dev server running (http://localhost:3000/)
☐ SQL_CREATE_DEMO_USERS_FINAL.sql (prepared)
```

### 🔍 ตรวจสอบ Dev Server:

```bash
# Check if dev server is running
npm run dev

# Should see: ✓ Ready in X.XXs
# Server running at: http://localhost:3000/
```

---

## 📋 ขั้นตอน 2: สร้าง Demo Users (2 วิธี)

### **วิธีที่ 1: ใช้ Supabase Dashboard (ง่ายสุด)**

#### ขั้นตอน A: ไปที่ Supabase Dashboard

```
1. เปิด: https://supabase.com/dashboard
2. Select Project: AVIVA Private
3. Go to: Authentication → Users
```

#### ขั้นตอน B: สร้างผู้ใช้ที่ 1 (CEO)

```
1. Click "Add User" or "Create User"
2. Fill in:
   Email:    demo.ceo@alisa.com
   Password: Demo@CEO123
3. Click "Create User"
4. Wait for confirmation ✅
```

#### ขั้นตอน C: สร้างผู้ใช้ที่ 2-6 (ทำซ้ำสำหรับแต่ละบัญชี)

```
Repeat step B for each:
1. demo.coo@alisa.com          / Demo@COO123
2. demo.sales@alisa.com        / Demo@Sales123
3. demo.engineer@alisa.com     / Demo@Engineer123
4. demo.finance@alisa.com      / Demo@Finance123
5. demo.admin@alisa.com        / Demo@Admin123

Total: 6 users created ✅
```

#### ขั้นตอน D: ตั้งค่าบทบาท (Role) และส่วนงาน (Department)

**ไปที่:** Supabase Dashboard → Database Editor → profiles table

สำหรับแต่ละ user ที่สร้าง ให้ update:

```sql
-- Update Demo CEO
UPDATE public.profiles
SET 
  role = 'ceo',
  full_name = 'Demo CEO - Full Access',
  department = 'Executive',
  is_demo = true
WHERE email = 'demo.ceo@alisa.com';

-- Update Demo COO
UPDATE public.profiles
SET 
  role = 'coo',
  full_name = 'Demo COO - Full Access',
  department = 'Operations',
  is_demo = true
WHERE email = 'demo.coo@alisa.com';

-- Update Demo Sales
UPDATE public.profiles
SET 
  role = 'sales',
  full_name = 'Demo Sales - CRM Department',
  department = 'Sales',
  is_demo = true
WHERE email = 'demo.sales@alisa.com';

-- Update Demo Engineer
UPDATE public.profiles
SET 
  role = 'engineer',
  full_name = 'Demo Engineer - Construction Department',
  department = 'Construction',
  is_demo = true
WHERE email = 'demo.engineer@alisa.com';

-- Update Demo Finance
UPDATE public.profiles
SET 
  role = 'finance',
  full_name = 'Demo Finance - Finance Department',
  department = 'Finance',
  is_demo = true
WHERE email = 'demo.finance@alisa.com';

-- Update Demo Admin
UPDATE public.profiles
SET 
  role = 'admin',
  full_name = 'Demo Admin - System Administrator',
  department = 'IT/Admin',
  is_demo = true
WHERE email = 'demo.admin@alisa.com';
```

### **วิธีที่ 2: ใช้ SQL Script (เร็วกว่า)**

#### ขั้นตอน A: เปิด SQL Editor ใน Supabase

```
1. Supabase Dashboard
2. Go to: SQL Editor
3. Click "New Query"
```

#### ขั้นตอน B: Copy SQL Script

```
1. Open file: SQL_CREATE_DEMO_USERS_FINAL.sql
2. Copy entire content
3. Paste into Supabase SQL Editor
```

#### ขั้นตอน C: Run Script

```
1. Click "Run" or press Cmd+Enter
2. Wait for completion
3. Should see: ✅ Query executed successfully
```

#### ขั้นตอน D: Verify Results

```
Run this query to verify:

SELECT email, full_name, role, department, is_demo
FROM public.profiles
WHERE is_demo = true
ORDER BY role;

Expected: 6 rows returned (all demo users)
```

---

## 📋 ขั้นตอน 3: ทดสอบการเข้าสู่ระบบ

### ทดสอบแต่ละบัญชี:

```bash
1. Open browser: http://localhost:3000/
2. Click "Sign In"
3. Enter email: demo.ceo@alisa.com
4. Enter password: Demo@CEO123
5. Click "Sign In"
6. Should see: Dashboard with v6.36 badge ✅

Repeat for other 5 accounts:
- demo.coo@alisa.com / Demo@COO123
- demo.sales@alisa.com / Demo@Sales123
- demo.engineer@alisa.com / Demo@Engineer123
- demo.finance@alisa.com / Demo@Finance123
- demo.admin@alisa.com / Demo@Admin123
```

---

## 📋 ขั้นตอน 4: ให้สิทธิ์และเตรียม

### ตรวจสอบ RBAC ทำงาน:

```
For demo.sales@alisa.com:
☐ Can see CRM module ✅
☐ Can see Construction (read-only) ✅
☐ Cannot see Finance ❌
☐ Cannot access /finance URL ❌

For demo.engineer@alisa.com:
☐ Can see Construction module ✅
☐ Can see CRM (read-only) ✅
☐ Cannot see Finance ❌
☐ Cannot access /finance URL ❌

For demo.finance@alisa.com:
☐ Can see Finance module ✅
☐ Can see Construction (read-only) ✅
☐ Cannot see CRM ❌
☐ Cannot access /crm URL ❌

For demo.ceo@alisa.com & demo.coo@alisa.com:
☐ Can see all modules ✅
☐ Can approve everything ✅
```

---

## 📋 ขั้นตอน 5: เตรียมคู่มือและเอกสาร

### ให้ผู้บริหารแต่ละคน:

```
1. DEMO_ACCOUNTS_CREDENTIALS.txt
   └─ บัญชี username/password สำหรับแต่ละคน

2. DEMO_USER_TESTING_GUIDE_v6.36.md
   └─ คำแนะนำการทดสอบแบบ step-by-step

3. ลิงก์เข้าสู่ระบบ:
   └─ URL: http://localhost:3000/
   └─ หรือ https://aviva-one.vercel.app/ (ถ้า production)
```

---

## 📋 ขั้นตอน 6: แจ้งให้ผู้บริหารทราบ

### ส่งข้อความ/Email:

```
เรื่อง: AVIVA ONE v6.36 - โปรดทดลองใช้งาน

สวัสดีค่ะ,

🎯 AVIVA ONE v6.36 พร้อมสำหรับการทดลองใช้งานแล้ว!

📋 บัญชีทดสอบของคุณ:
  Email:    [demo.xxx@alisa.com]
  Password: [Demo@XXX123]
  บทบาท:   [Role]
  ส่วนงาน: [Department]

📱 วิธีเข้าสู่ระบบ:
  1. เปิด: http://localhost:3000/
  2. ป้อน Email และ Password ด้านบน
  3. Click "Sign In"

📝 ทดสอบเพื่อตรวจสอบ:
  ✅ Version v6.36 ปรากฏ
  ✅ เข้าถึงส่วนงานของคุณได้
  ✅ ไม่มี errors
  ✅ Performance ตามคาด
  ✅ ต้องปรับอะไรอีกไหม?

📋 ส่วนที่ต้องทดสอบ:
  [See DEMO_USER_TESTING_GUIDE_v6.36.md]

🗓️ ระยะเวลา: 30-40 นาที

📧 เมื่อเสร็จแล้ว กรุณาส่งความเห็นกลับ:
  - ปัญหาที่พบ
  - ส่วนที่ดี
  - สิ่งที่ต้องปรับ
  - Ready for Go-Live? (Yes/No/Partial)

ขอบคุณค่ะ! 🙏
```

---

## ✅ Checklist ก่อนปล่อยให้ผู้บริหารทดสอบ

```
Pre-Demo Checklist:

[ ] 6 demo users created in Supabase ✅
[ ] Roles assigned correctly ✅
[ ] RBAC working correctly ✅
[ ] Dev server running ✅
[ ] Credentials document prepared ✅
[ ] Testing guide prepared ✅
[ ] Notified all team members ✅
[ ] Ready for hands-on testing ✅

Status: READY FOR DEMO USER TESTING ✅
```

---

## 📊 ตัวอย่างผลลัพธ์ที่คาดหวัง

### Demo CEO Login:

```
✅ Dashboard loads
✅ v6.36 badge shows
✅ Bottom navigation shows 6 tabs:
   - หน้าหลัก (Dashboard)
   - ขาย (CRM) ✅ Can access
   - ก่อสร้าง (Construction) ✅ Can access
   - ออฟฟิศ (Office) ✅ Can access
   - รายงาน (Reports) ✅ Can access
   - ตั้งค่า (Settings) ✅ Can access
✅ Can see all data (31 houses, 134 leads)
✅ No errors in console (F12)
```

### Demo Sales Login:

```
✅ Dashboard loads
✅ v6.36 badge shows
✅ Bottom navigation shows:
   - หน้าหลัก (Dashboard)
   - ขาย (CRM) ✅ Can access
   - ก่อสร้าง (Construction) ✅ Read-only
   - ออฟฟิศ (Office) ✅
   - รายงาน (Reports) ✅
   - ตั้งค่า (Settings) ✅
❌ Finance NOT visible (hidden)
❌ Cannot edit construction items
✅ Can create/edit CRM leads
```

### Demo Engineer Login:

```
✅ Dashboard loads
✅ Bottom navigation shows:
   - หน้าหลัก (Dashboard)
   - ขาย (CRM) ✅ Read-only
   - ก่อสร้าง (Construction) ✅ Can access
   - ออฟฟิศ (Office) ✅
   - รายงาน (Reports) ✅
   - ตั้งค่า (Settings) ✅
❌ Finance NOT visible
✅ Can add work reports
✅ Can update progress %
```

---

## 🎯 เมื่อผู้บริหารทดสอบเสร็จแล้ว

### ให้ส่งรายงาน:

```
สิ่งที่ต้องจดบันทึก:
1. Issues found (if any)
   - Critical
   - Important
   - Minor

2. Positive feedback
3. Features request
4. Ready for Go-Live? (Yes/No/Partial)
5. Recommended actions
```

### ตัวอย่าง Issue Report:

```
Issue #1: CRM leads not loading
Severity: CRITICAL
Steps: Login as Sales → Click CRM → No leads displayed
Expected: Should see 134 leads
Actual: Blank page with error
Impact: Cannot work
Fix by: [Date]

Issue #2: Typo in menu
Severity: MINOR
Location: Settings page
Fix: Change "Setings" to "Settings"
```

---

## 🗑️ เมื่อทดสอบเสร็จสิ้น (After Testing Complete)

### ลบ Demo Users:

```sql
-- Run this in Supabase SQL Editor
-- After all testing is complete

cat SQL_CLEANUP_DEMO_USERS.sql | psql
```

### Verify:

```sql
-- Verify demo users deleted
SELECT COUNT(*) FROM public.profiles WHERE is_demo = true;
-- Should return: 0

-- Verify production data intact
SELECT COUNT(*) FROM public.houses;      -- Should be: 31
SELECT COUNT(*) FROM public.crm_leads;   -- Should be: 134
```

---

## ✨ สรุป

**Step-by-step Process:**

1. ✅ Create 6 demo users (Supabase)
2. ✅ Set roles & departments
3. ✅ Test login for each
4. ✅ Verify RBAC working
5. ✅ Give credentials to team
6. ✅ Team performs hands-on testing (~1-2 hours)
7. ✅ Collect feedback
8. ✅ Fix critical issues
9. ✅ Delete demo users
10. ✅ Final approval
11. 🎉 Go-Live!

**Timeline:**
- Setup: 15-30 minutes
- Testing: 1-2 hours per person (6 people = 6-12 hours parallel)
- Feedback: 1-2 hours
- Fix issues: 1-8 hours (depends on issues found)
- Cleanup: 5 minutes

**Total: 1-3 days for complete demo testing cycle**

---

**Status: READY TO START DEMO TESTING ✅**

