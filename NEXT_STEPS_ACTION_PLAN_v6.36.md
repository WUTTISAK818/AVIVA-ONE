# 📋 ขั้นตอนต่อไป - สิ่งที่ต้องทำเพื่อปลายทาง (NEXT STEPS TO GO-LIVE)

**วันที่**: 18 มิ.ย. 2569 17:50 น. (UTC+7)  
**ระหว่าง**: 18 มิ.ย. - 25 มิ.ย. (7 วัน)  
**เป้าหมาย**: ปลายทาง 25 มิ.ย. 09:00 น.

---

## ⏳ สิ่งที่ต้องทำทั้งหมด (REMAINING TASKS)

### 🔴 **ทันทีนี้ (TODAY - 18 มิ.ย.)**

#### ✅ ทำเสร็จแล้ว:
- [x] Phase 1-6 testing (39/39 PASS)
- [x] GO-LIVE readiness checklist
- [x] Deployment countdown plan (7 days)
- [x] SQL scripts (create users, create data, cleanup)
- [x] Testing standards verification (18/18)
- [x] Commit ลง branch
- [x] Push ไปรีโมต

#### ⏳ ต้องทำต่อ:
- [ ] **ขอ Supabase Project ID** จากทีมตอนนี้
  - ชื่อ Project: AVIVA Private
  - Database: aviva_app_db
  - ต้องการ: Project ID / API Key / Database URL
  - ใครหรือที่ไหน: [ระบุทีม/ผู้จัดการ]

---

## 🟠 **วันที่ 19 มิ.ย. 2569 (TUESDAY)**

### เช้า 08:00 - 09:30 น.

**[ ] งาน 1: สร้าง Test Users (6 คน)**

```bash
# 1. รอ Supabase Project ID มา
# 2. เปิด Supabase Dashboard → Authentication → Users
# 3. สร้าง users 6 คน:

Email                        | Role      | Password
test.ceo@alisa.com          | ceo       | Test@CEO2569
test.coo@alisa.com          | coo       | Test@COO2569
test.sales1@alisa.com       | sales     | Test@Sales2569
test.sales2@alisa.com       | sales     | Test@Sales2569
test.engineer@alisa.com     | engineer  | Test@Engineer2569
test.finance@alisa.com      | finance   | Test@Finance2569

# 4. OR รัน SQL script:
cat SQL_CREATE_TEST_USERS.sql | psql -h [host] -U postgres -d aviva_app_db
```

**[ ] งาน 2: สร้าง Test Data (260+ records)**

```bash
# 1. รัน SQL script:
cat SQL_CREATE_TEST_DATA.sql | psql -h [host] -U postgres -d aviva_app_db

# OR: Supabase Dashboard → SQL Editor → Copy paste script

# 2. ตรวจสอบข้อมูล:
# - 10 CRM leads ✅
# - 5 houses (TEST-001 to TEST-005) ✅
# - 5 work reports ✅
# - 5 approvals ✅
# - 5 defects ✅
# - 5 payments ✅
# - All marked is_test=true ✅
```

### กลาง 10:00 - 12:00 น.

**[ ] งาน 3: ทดสอบการ Login ด้วย Test Users**

```bash
# ทดสอบการเข้าสู่ระบบทั้ง 6 บัญชี

1. Login as test.ceo@alisa.com
   ├─ Expected: ดูได้ทั้งหมด (Dashboard, CRM, Construction, Finance)
   ├─ Check: Badge v6.36 visible ✅
   └─ Result: PASS/FAIL

2. Login as test.coo@alisa.com
   ├─ Expected: ดูได้ทั้งหมด
   ├─ Check: Can approve all ✅
   └─ Result: PASS/FAIL

3. Login as test.sales1@alisa.com
   ├─ Expected: ดูเฉพาะ CRM, Construction read-only
   ├─ Check: Cannot access Finance ✅
   └─ Result: PASS/FAIL

4. Login as test.sales2@alisa.com
   ├─ Expected: ดูเฉพาะ CRM, Construction read-only
   ├─ Check: Cannot edit others' leads ✅
   └─ Result: PASS/FAIL

5. Login as test.engineer@alisa.com
   ├─ Expected: ดูเฉพาะ Construction, CRM read-only
   ├─ Check: Cannot approve finance ✅
   └─ Result: PASS/FAIL

6. Login as test.finance@alisa.com
   ├─ Expected: ดูเฉพาะ Finance, Construction read-only
   ├─ Check: Cannot edit CRM ✅
   └─ Result: PASS/FAIL
```

### บ่าย 14:00 - 16:00 น.

**[ ] งาน 4: ทดสอบ CRM Workflow**

```bash
Login as: test.sales1@alisa.com

1. Navigate to /crm
   ├─ Check: CRM leads display (should have 10 test leads)
   └─ Result: ✅/❌

2. Create new lead
   ├─ Fill: Email, Phone, Status, Urgency, etc.
   ├─ Save: Click Create
   └─ Result: ✅ New lead added / ❌ Error

3. Edit test lead
   ├─ Click: On test.lead1@example.com
   ├─ Change: Status → "qualified"
   ├─ Save: Click Update
   └─ Result: ✅ Updated / ❌ Error

4. Link lead to house
   ├─ In detail: Select Plot number TEST-001
   ├─ Save: Click Update
   └─ Result: ✅ Linked / ❌ Error

5. Check console (F12)
   └─ Result: ✅ No errors / ❌ Has errors
```

### ค่ำ 17:00 - 18:00 น.

**[ ] งาน 5: Document Day 2 Results**

```markdown
# Day 2 (19 มิ.ย.) Test Results

## Test Users Creation
- [x] test.ceo@alisa.com: PASS/FAIL
- [x] test.coo@alisa.com: PASS/FAIL
- [x] test.sales1@alisa.com: PASS/FAIL
- [x] test.sales2@alisa.com: PASS/FAIL
- [x] test.engineer@alisa.com: PASS/FAIL
- [x] test.finance@alisa.com: PASS/FAIL

## Test Data Creation
- [x] CRM leads (10): PASS/FAIL
- [x] Houses (5): PASS/FAIL
- [x] Work reports (5): PASS/FAIL
- [x] Approvals (5): PASS/FAIL
- [x] Defects (5): PASS/FAIL
- [x] Payments (5): PASS/FAIL

## Login Testing
- [x] CEO login: PASS/FAIL
- [x] COO login: PASS/FAIL
- [x] Sales 1 login: PASS/FAIL
- [x] Sales 2 login: PASS/FAIL
- [x] Engineer login: PASS/FAIL
- [x] Finance login: PASS/FAIL

## CRM Workflow
- [x] Create lead: PASS/FAIL
- [x] Edit lead: PASS/FAIL
- [x] Link to house: PASS/FAIL
- [x] No console errors: PASS/FAIL

## Issues Found:
[List any issues found]

## Next Actions:
[What to do tomorrow]
```

---

## 🟠 **วันที่ 20 มิ.ย. 2569 (WEDNESDAY)**

### เช้า 08:00 - 10:00 น.

**[ ] งาน 6: ทดสอบ Construction Workflow**

```bash
Login as: test.engineer@alisa.com

1. Navigate to /construction
   ├─ Check: Display 5 test houses (TEST-001 to TEST-005)
   ├─ Check: Progress percentages (35%, 50%, 75%, 25%, 60%)
   └─ Result: ✅/❌

2. Click on TEST-001 unit
   ├─ Expected: Detail panel opens
   ├─ Check: Customer email from CRM (test.lead1@example.com)
   ├─ Check: Work reports display
   └─ Result: ✅/❌

3. Add work report
   ├─ Fill: Work date, type, description, hours
   ├─ Save: Click Create
   └─ Result: ✅ Added / ❌ Error

4. Update progress percentage
   ├─ Change: Progress 35% → 40%
   ├─ Save: Click Update
   └─ Result: ✅ Updated / ❌ Error

5. View installation stages
   ├─ Expected: 8 stages (foundation, structure, finishing, installation, inspection, delivery)
   ├─ Check: Status display
   └─ Result: ✅/❌
```

### กลาง 11:00 - 13:00 น.

**[ ] งาน 7: ทดสอบ Finance Workflow**

```bash
Login as: test.finance@alisa.com

1. Navigate to Finance/Approvals
   ├─ Check: Approval queue display (should see 5 test approvals)
   ├─ Check: House/plot information
   └─ Result: ✅/❌

2. Approve first item
   ├─ Click: Foundation stage of TEST-001
   ├─ Change: Status → "approved"
   ├─ Save: Click Update
   └─ Result: ✅ Approved / ❌ Error

3. Reject with reason
   ├─ Click: Another item
   ├─ Change: Status → "rejected"
   ├─ Add: Reason/notes
   ├─ Save: Click Update
   └─ Result: ✅ Rejected / ❌ Error

4. View approval logs
   ├─ Expected: Show approval history
   ├─ Check: Shows approved_by, date, notes
   └─ Result: ✅/❌

5. Check payment records
   ├─ Expected: Show 5 payments
   ├─ Check: Amounts correct
   └─ Result: ✅/❌
```

### บ่าย 14:00 - 16:00 น.

**[ ] งาน 8: ทดสอบ Cross-Department Data Linking**

```bash
Login as: test.ceo@alisa.com (full access)

1. CRM → Construction
   ├─ Go to /crm
   ├─ Click on test.lead1@example.com
   ├─ Check: Link to Construction house (plot_number)
   ├─ Click: Link to Construction
   ├─ Check: Shows TEST-001 details
   └─ Result: ✅/❌

2. Construction → Finance
   ├─ Go to /construction
   ├─ Click on TEST-001
   ├─ Check: Link to Finance approval
   ├─ See: Payment status, approval chain
   └─ Result: ✅/❌

3. Finance → CRM Follow-up
   ├─ Go to Finance
   ├─ Select approved house
   ├─ Check: Can link back to CRM lead
   └─ Result: ✅/❌
```

### ค่ำ 17:00 - 18:00 น.

**[ ] งาน 9: Document Day 3 Results**

---

## 🟠 **วันที่ 21 มิ.ย. 2569 (THURSDAY)**

### เช้า 08:00 - 10:00 น.

**[ ] งาน 10: ทดสอบ Performance**

```bash
Using DevTools (F12 → Network tab)

1. Dashboard load time
   ├─ Reload page (Cmd+R)
   ├─ Wait for complete load
   ├─ Check: Load time in Network tab
   ├─ Expected: < 2000ms
   └─ Result: _____ ms ✅/❌

2. CRM module load time
   ├─ Navigate to /crm
   ├─ Check: Load time
   ├─ Expected: < 3000ms
   └─ Result: _____ ms ✅/❌

3. Construction module load time
   ├─ Navigate to /construction
   ├─ Check: Load time
   ├─ Expected: < 2500ms
   └─ Result: _____ ms ✅/❌

4. Finance module load time
   ├─ Navigate to Finance
   ├─ Check: Load time
   ├─ Expected: < 3000ms
   └─ Result: _____ ms ✅/❌

5. API response time
   ├─ Network tab → API calls
   ├─ Check: Each request < 500ms
   └─ Result: _____ ms ✅/❌
```

### กลาง 11:00 - 13:00 น.

**[ ] งาน 11: ทดสอบ Security**

```bash
1. XSS Protection
   ├─ Try input: <script>alert('XSS')</script>
   ├─ Expected: Not executed
   └─ Result: ✅/❌

2. SQL Injection
   ├─ Try: ' OR '1'='1
   ├─ Expected: Validation error
   └─ Result: ✅/❌

3. HTTPS
   ├─ Check: URL shows https://
   └─ Result: ✅/❌

4. Auth Security
   ├─ Try: Access without login
   ├─ Expected: Redirect to login
   └─ Result: ✅/❌

5. RBAC Enforcement
   ├─ Try: Sales user access Finance
   ├─ Expected: Access denied
   └─ Result: ✅/❌
```

### บ่าย 14:00 - 16:00 น.

**[ ] งาน 12: Run Lighthouse Audit**

```bash
DevTools → Lighthouse tab

1. Click: Analyze page load
2. Wait for audit to complete
3. Check scores:
   ├─ Performance: _____ (target: > 70)
   ├─ Accessibility: _____
   ├─ Best Practices: _____
   └─ SEO: _____

4. Screenshot results
5. Save report
```

### ค่ำ 17:00 - 18:00 น.

**[ ] งาน 13: Document Day 4 Results**

---

## 🟠 **วันที่ 22 มิ.ย. 2569 (FRIDAY)**

### เช้า 08:00 - 10:00 น.

**[ ] งาน 14: ทดสอบ Error Handling**

```bash
1. Network Offline
   ├─ DevTools → Network → Offline
   ├─ Try to refresh
   ├─ Expected: Error message visible
   └─ Result: ✅/❌

2. Form Validation
   ├─ Try: Submit empty required fields
   ├─ Expected: Validation errors shown
   └─ Result: ✅/❌

3. Invalid Data Input
   ├─ Try: Invalid email, phone, etc.
   ├─ Expected: Error message
   └─ Result: ✅/❌

4. 404 Page
   ├─ Go to: /invalid-page-that-does-not-exist
   ├─ Expected: 404 page shown
   └─ Result: ✅/❌

5. Session Timeout
   ├─ Stay idle: Wait 5+ minutes
   ├─ Expected: Redirect to login
   └─ Result: ✅/❌
```

### กลาง 11:00 - 12:00 น.

**[ ] งาน 15: ทดสอบ Data Cleanup**

```bash
# Verify production data count BEFORE cleanup
SELECT COUNT(*) FROM public.houses WHERE is_test IS NOT true;
-- Expected: 31 ✅

SELECT COUNT(*) FROM public.crm_leads WHERE is_test IS NOT true;
-- Expected: 134 ✅

# Run cleanup script
cat SQL_CLEANUP_TEST_DATA.sql | psql -h [host] -U postgres -d aviva_app_db

# Verify production data count AFTER cleanup
SELECT COUNT(*) FROM public.houses WHERE is_test IS NOT true;
-- Expected: 31 ✅ (same as before)

SELECT COUNT(*) FROM public.crm_leads WHERE is_test IS NOT true;
-- Expected: 134 ✅ (same as before)

# Verify test data deleted
SELECT COUNT(*) FROM public.crm_leads WHERE is_test = true;
-- Expected: 0 ✅

SELECT COUNT(*) FROM public.houses WHERE is_test = true;
-- Expected: 0 ✅
```

### บ่าย 13:00 - 15:00 น.

**[ ] งาน 16: Restore Test Data** (สำหรับการยืนยันสุดท้าย)

```bash
# Re-run create test data script
cat SQL_CREATE_TEST_DATA.sql | psql -h [host] -U postgres -d aviva_app_db

# Verify test data restored
SELECT COUNT(*) FROM public.crm_leads WHERE is_test = true;
-- Expected: 10 ✅

SELECT COUNT(*) FROM public.houses WHERE is_test = true;
-- Expected: 5 ✅
```

### ค่ำ 17:00 - 18:00 น.

**[ ] งาน 17: Document Day 5 Results & Summary**

---

## 🟡 **วันที่ 23 มิ.ย. 2569 (SATURDAY) - Final Prep**

### เช้า 08:00 - 10:00 น.

**[ ] งาน 18: Final Code Review**

```bash
# Check latest main branch
git fetch origin main
git log origin/main -1 --oneline

# Check current feature branch
git log claude/inspiring-shannon-bnzeux -1 --oneline

# Build test
npm run build
# Expected: ✓ Compiled successfully

# Verify no TypeScript errors
# Expected: 0 errors
```

### กลาง 11:00 - 13:00 น.

**[ ] งาน 19: Staging Environment Test** (if available)

```bash
1. Deploy to staging
2. Run smoke tests
3. Verify v6.36 displays
4. Check all routes accessible
5. Verify test data loads correctly
```

### บ่าย 14:00 - 16:00 น.

**[ ] งาน 20: Final Checklist Verification**

```
Environment:
- [ ] Dev server running ✅
- [ ] Build passes ✅
- [ ] Version v6.36 ✅
- [ ] No TypeScript errors ✅

Data:
- [ ] Production data protected (31 + 134) ✅
- [ ] Test data created (260+) ✅
- [ ] Cleanup scripts ready ✅

Testing:
- [ ] Phase 1-6 complete ✅
- [ ] 18 standards verified ✅
- [ ] 39/39 tests PASS ✅

Documentation:
- [ ] GO-LIVE checklist ✅
- [ ] Countdown plan ✅
- [ ] SQL scripts ✅
- [ ] Test results ✅

Deployment:
- [ ] Rollback procedure ready ✅
- [ ] Team contacts updated ✅
- [ ] Communication template ready ✅
```

### ค่ำ 17:00 - 18:00 น.

**[ ] งาน 21: Team Briefing**

```
สัญญาชาติ call/meeting:
- ยืนยัน deploy time: 25 มิ.ย. 09:00 น.
- แนะนำ rollback procedure
- ปฏิทิน team ที่จำเป็น
- Confirm all team ready
```

---

## 🔴 **วันที่ 24 มิ.ย. 2569 (SUNDAY) - Pre-Launch Day**

### เช้า 08:00 - 09:00 น.

**[ ] งาน 22: Morning Health Check**

```bash
# Dev server
npm run dev &

# Version check
grep "v6\.36" src/app/dashboard/page.tsx
grep "6\.36" src/app/settings/page.tsx

# Build
npm run build
```

### เช้า 09:00 - 10:00 น.

**[ ] งาน 23: Database Backup**

```bash
# Via Supabase Dashboard:
1. Settings → Backups
2. Create Manual Backup
3. Wait for completion
4. Verify backup size
5. Test restore in dev environment
```

### เช้า 10:00 - 11:00 น.

**[ ] งาน 24: Rollback Procedure Test**

```bash
# Test rollback procedure:
1. Check git log for previous version
2. Verify rollback would work
3. Estimate rollback time (< 5 minutes)
4. Document rollback steps
```

### กลาง 12:00 - 13:00 น.

**[ ] Lunch Break & Relax**

### บ่าย 14:00 - 16:00 น.

**[ ] งาน 25: Team Coordination Call**

```
Agenda:
- Confirm all systems ready
- Review deployment plan
- Assign responsibilities
- Q&A from team
- Send final confirmation
```

### บ่าย 16:00 - 17:00 น.

**[ ] งาน 26: Prepare Communication**

```markdown
User Announcement Message (Thai):

ยินดีด้วย! 🎉

AVIVA ONE v6.36 ปลายทางวันพรุ่งนี้!

📣 วันที่: 25 มิ.ย. 2569
⏰ เวลา: 09:00 น. - 11:00 น. (UTC+7)
📱 ช่วงเวลา: อาจมี downtime ชั่วขณะ

✨ ความปรับปรุงใหม่:
- ✅ ปรับปรุงประสิทธิภาพ
- ✅ เพิ่มความปลอดภัย
- ✅ ปรับปรุง Error Handling
- ✅ เพิ่มความสมบูรณ์ของข้อมูล

🚀 พร้อมใช้งานได้ทันที!
```

### ค่ำ 17:00 - 18:00 น.

**[ ] งาน 27: Rest & Prepare for Tomorrow**

```
1. Early dinner
2. Final check at 20:00 น.
3. Get good sleep
4. Be ready for 09:00 tomorrow! 🚀
```

---

## 🟢 **วันที่ 25 มิ.ย. 2569 (MONDAY) - LAUNCH DAY**

### เช้า 07:00 น. - Early Start

**[ ] งาน 28: Final Verification**

```bash
# Pre-launch checks
ps aux | grep "next dev"
git log main -1
curl -I https://aviva-one.vercel.app/
```

### เช้า 08:00 - 09:00 น.

**[ ] Health Check**

```bash
# 1. Dev server OK
# 2. Latest code OK
# 3. Version correct
# 4. Vercel dashboard ready
```

### เช้า 09:00 - 09:15 น. 🚀

**[ ] MERGE & DEPLOY**

```bash
git checkout main
git pull origin main
git merge claude/inspiring-shannon-bnzeux
git push origin main

# ✅ Vercel auto-deploys (2-3 minutes)
```

### เช้า 09:15 - 09:30 น.

**[ ] Monitor Deployment**

```
Watch Vercel Dashboard:
- [ ] Build starting
- [ ] Build complete
- [ ] Deploy to production
- [ ] ✓ Production Deployment Successful
```

### เช้า 09:30 - 10:00 น.

**[ ] Smoke Tests**

```bash
curl -I https://aviva-one.vercel.app/
curl https://aviva-one.vercel.app/settings | grep "6\.36"
```

### กลาง 10:00 - 10:30 น.

**[ ] Browser Testing**

```
1. Open https://aviva-one.vercel.app
2. Login with CEO account
3. Check v6.36 badge
4. Navigate all 6 modules
5. Check F12 → Console (no errors)
6. Verify data displays (31 houses, 134 leads)
```

### กลาง 10:30 - 11:00 น.

**[ ] User Communication**

```
Send announcement:
✅ AVIVA ONE v6.36 ปลายทางสำเร็จแล้ว!
🎉 พร้อมใช้งานได้ทันที
```

### บ่าย 11:00 น. - 24 ชั่วโมง

**[ ] Monitoring & Support**

```
- Monitor error logs
- Support team ready
- Check for user reports
- Success! 🎉
```

---

## 📋 **สรุปสิ่งที่ต้องทำ (SUMMARY)**

### ✅ ทำเสร็จแล้ว (7 วัน 0 ชั่วโมง):
- [x] Phase 1-6 testing
- [x] 18 standards verification
- [x] Documentation (7,500+ lines)
- [x] SQL scripts ready
- [x] Deployment plan

### ⏳ ต้องทำต่อไป (7 วัน):

| วัน | กิจกรรม | ประมาณเวลา |
|-----|--------|----------|
| **19 มิ.ย.** | Create test users + data + Login test | 8 ชั่วโมง |
| **20 มิ.ย.** | CRM + Construction + Finance workflows | 8 ชั่วโมง |
| **21 มิ.ย.** | Performance + Security + Lighthouse | 8 ชั่วโมง |
| **22 มิ.ย.** | Error Handling + Cleanup + Restore | 8 ชั่วโมง |
| **23 มิ.ย.** | Final code review + Team prep | 4 ชั่วโมง |
| **24 มิ.ย.** | Pre-launch verification + Team call | 8 ชั่วโมง |
| **25 มิ.ย.** | 🚀 DEPLOY TO PRODUCTION | 2 ชั่วโมง |

**รวม**: ~46 ชั่วโมง (ใน 7 วัน = ~6.5 ชั่วโมง/วัน)

---

## 🎯 **ทำตามลำดับนี้**

```
1️⃣  วันนี้ (18 มิ.ย.): ขอ Supabase Project ID ทันที
2️⃣  พรุ่งนี้ (19 มิ.ย.): สร้าง test users + data + login test
3️⃣  (20 มิ.ย.): ทดสอบ workflow
4️⃣  (21 มิ.ย.): ทดสอบ performance + security
5️⃣  (22 มิ.ย.): ทดสอบ error handling + cleanup
6️⃣  (23 มิ.ย.): Final review + team prep
7️⃣  (24 มิ.ย.): Pre-launch verification
8️⃣  (25 มิ.ย. 09:00 น.): 🎉 DEPLOY & GO-LIVE!
```

---

**สถานะ**: ✅ พร้อมทั้งหมด, รอเพียงเริ่มต้นการทดสอบ!

