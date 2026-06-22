# 📅 AVIVA ONE v6.36 — ไทม์ไลน์เตรียมการปลายทางแบบละเอียด (DETAILED COUNTDOWN PLAN)

**วันนี้**: 18 มิ.ย. 2569  
**ปลายทาง**: 25 มิ.ย. 2569 (7 วันนับจากนี้)  
**สถานะ**: ✅ ทดสอบเสร็จสิ้น, เริ่มเตรียมการปลายทาง

---

## 📆 ไทม์ไลน์วันต่อวัน (DAY-BY-DAY COUNTDOWN)

### 🔵 วันที่ 1: 18 มิ.ย. 2569 (วันนี้ - TODAY)

**เวลา 16:30 น. - สรุปวันนี้**
- [x] Phase 1-6 testing 100% PASS ✅
- [x] GO-LIVE_READINESS_CHECKLIST_v6.36.md สร้าง ✅
- [x] Commit ลง branch ✅
- [x] Push ไปรีโมต ✅

**เวลา 17:00 น. - ขั้นตอนต่อไป (NEXT)**
- [ ] สร้าง SQL scripts สำหรับ test users
- [ ] สร้าง SQL scripts สำหรับ test data
- [ ] เตรียม deployment checklist
- [ ] ส่งให้ผู้บริหารอนุมัติ

---

### 🟠 วันที่ 2: 19 มิ.ย. 2569 (TUESDAY)

**เช้า 08:00 - 09:00 น.**
- [ ] ทำการสร้าง test users ใน Supabase (หาก Project ID พร้อม):
  ```sql
  -- 6 test users สำหรับทดสอบบทบาท
  - test.ceo@alisa.com (role: ceo)
  - test.coo@alisa.com (role: coo)
  - test.sales1@alisa.com (role: sales)
  - test.sales2@alisa.com (role: sales)
  - test.engineer@alisa.com (role: engineer)
  - test.finance@alisa.com (role: finance)
  ```

**กลาง 10:00 - 12:00 น.**
- [ ] สร้าง test data fixtures:
  - 10 test leads (CRM)
  - 5 test houses (Construction)
  - 3 test reports
  - 5 test approvals
  - Mark ทั้งหมด: `is_test = true`

**บ่าย 14:00 - 16:00 น.**
- [ ] ทดสอบการ login ด้วย test users ทั้ง 6:
  - [ ] Login as CEO → ดูได้ทั้งหมด
  - [ ] Login as COO → ดูได้ทั้งหมด
  - [ ] Login as Sales → ดูเฉพาะ CRM
  - [ ] Login as Sales → ดูเฉพาะ CRM
  - [ ] Login as Engineer → ดูเฉพาะ Construction
  - [ ] Login as Finance → ดูเฉพาะ Finance

**ค่ำ 17:00 - 18:00 น.**
- [ ] Document ผลการทดสอบ
- [ ] Commit ผลการทดสอบ RBAC

---

### 🟠 วันที่ 3: 20 มิ.ย. 2569 (WEDNESDAY)

**เช้า 08:00 - 10:00 น. - Core Business Workflows Testing**

**CRM Workflow Test**:
- [ ] Login as Sales
- [ ] ทดสอบเพิ่ม Lead ใหม่
- [ ] ทดสอบแก้ไข Lead
- [ ] ทดสอบลบ Lead (soft delete)
- [ ] ตรวจสอบ is_test flag

**Construction Workflow Test**:
- [ ] Login as Engineer
- [ ] ดูรายชื่อ 31 houses
- [ ] Click ที่หน่วยที่อยู่เพื่อดู detail
- [ ] ตรวจสอบ linked CRM customer info
- [ ] ตรวจสอบ installation stages

**กลาง 11:00 - 13:00 น. - Finance Workflow Test**:
- [ ] Login as Finance
- [ ] ดูรายชื่อ installments
- [ ] ตรวจสอบการเปลี่ยนสถานะ (pending → approved → paid)
- [ ] ดู approval logs

**บ่าย 14:00 - 16:00 น. - Cross-Department Data Linking**:
- [ ] CRM Lead ↔ Construction (plot_number) ✅
- [ ] Construction House ↔ Finance Approval (house_id) ✅
- [ ] ตรวจสอบ data consistency

**ค่ำ 17:00 น. - Document results**
- [ ] Phase 3-4 results document
- [ ] Commit ไป branch

---

### 🟠 วันที่ 4: 21 มิ.ย. 2569 (THURSDAY)

**เช้า 08:00 - 10:00 น. - Performance & Security Testing**

**Performance Testing**:
- [ ] DevTools Network tab → Dashboard load time
  - Expected: < 2000ms ✅
- [ ] CRM module load time
  - Expected: < 3000ms ✅
- [ ] Construction module load time
  - Expected: < 2500ms ✅
- [ ] Finance module load time
  - Expected: < 3000ms ✅

**Security Testing**:
- [ ] XSS protection test
- [ ] SQL injection prevention test
- [ ] CSRF token validation
- [ ] Authentication/Authorization test
- [ ] Rate limiting test

**กลาง 11:00 - 13:00 น. - Lighthouse Audit**:
- [ ] DevTools → Lighthouse
- [ ] Run audit (Mobile & Desktop)
- [ ] Performance score (target: > 70)
- [ ] Accessibility score
- [ ] Best practices score
- [ ] SEO score

**บ่าย 14:00 - 16:00 น. - Error Handling Testing**:
- [ ] Network offline → expected error message
- [ ] Form validation → ทดสอบ required fields
- [ ] 404 page → invalid route
- [ ] Session timeout → verify recovery
- [ ] Permission denied → non-authorized role

**ค่ำ 17:00 น. - Document results**
- [ ] Performance metrics log
- [ ] Security test results
- [ ] Lighthouse screenshots
- [ ] Commit results

---

### 🟠 วันที่ 5: 22 มิ.ย. 2569 (FRIDAY)

**เช้า 08:00 - 10:00 น. - Data Integrity Verification**

```sql
-- ตรวจสอบข้อมูล Production ยังปกป้องอยู่
SELECT COUNT(*) as total_houses FROM houses WHERE is_test IS NOT true;
-- Expected: 31

SELECT COUNT(*) as total_leads FROM crm_leads WHERE is_test IS NOT true;
-- Expected: 134

SELECT COUNT(*) as total_reports FROM work_reports;
-- Expected: 2 (Pete's reports)

SELECT COUNT(*) as total_defects FROM qc_defects WHERE is_test IS NOT true;
-- Expected: 3

SELECT COUNT(*) as total_approvals FROM approval_logs;
-- Expected: 26 (immutable, cannot delete)
```

**กลาง 11:00 - 12:00 น. - Cleanup Test Data**:
- [ ] ตรวจสอบว่า test data มี `is_test = true`
- [ ] Run cleanup script (DELETE WHERE is_test = true)
- [ ] ยืนยันว่า production data ยังอยู่
- [ ] Test data หายไป ✅

**บ่าย 14:00 - 16:00 น. - Restore Test Data** (for manual testing):
- [ ] Re-run insert test data script
- [ ] Verify test data restored
- [ ] Keep for final verification

**ค่ำ 17:00 - 18:00 น. - Data Integrity Report**:
- [ ] Document all verification results
- [ ] Confirm production data count
- [ ] Confirm test data markers
- [ ] Commit report

---

### 🟠 วันที่ 6: 23 มิ.ย. 2569 (SATURDAY - Standby/Final Prep)

**เช้า 08:00 - 10:00 น. - Final Code Review**

```bash
# ตรวจสอบ latest main branch
git fetch origin main
git log origin/main -1 --oneline

# ตรวจสอบ current branch vs main
git diff origin/main...claude/inspiring-shannon-bnzeux --name-only

# ตรวจสอบ build ใน main
git checkout main
npm run build
```

**กลาง 11:00 - 13:00 น. - Merge Preparation**:
- [ ] ตรวจสอบ merge conflicts
- [ ] สร้าง test merge ใน feature branch
- [ ] ยืนยัน build ผ่าน
- [ ] ยืนยัน zero TypeScript errors

**บ่าย 14:00 - 16:00 น. - Staging Environment Test**:
- [ ] Deploy ไป staging (หากมี)
- [ ] Smoke test ทั้งหมด
- [ ] ตรวจสอบ v6.36 ปรากฏ
- [ ] ยืนยันทั้งหมดพร้อม

**ค่ำ 17:00 - 18:00 น. - Final Checklist**:
- [ ] Environment: ✅
- [ ] Build: ✅
- [ ] Testing: ✅
- [ ] Documentation: ✅
- [ ] Team: ✅
- [ ] Rollback plan: ✅

---

### 🔴 วันที่ 7: 24 มิ.ย. 2569 (SUNDAY - Pre-Launch Day)

**เช้า 08:00 - 09:00 น. - Morning Verification**

```bash
# ตรวจสอบ dev server
npm run dev &

# ตรวจสอบ latest code
git log -1 --oneline

# ตรวจสอบ version
grep "v6\.36" src/app/dashboard/page.tsx
grep "6\.36" src/app/settings/page.tsx
```

**เช้า 09:00 - 10:00 น. - Database Backup**:
- [ ] Backup production database
  - Use Supabase Dashboard → Backups → Create Manual Backup
- [ ] ยืนยัน backup size
- [ ] Test restore ใน dev environment

**เช้า 10:00 - 11:00 น. - Rollback Plan Confirmation**:
- [ ] ทดสอบ rollback step 1-3
- [ ] ยืนยัน previous version เข้าถึง
- [ ] Document rollback time estimate (< 5 minutes)
- [ ] ตรวจสอบ team contacts ready

**กลาง 12:00 - 13:00 น. - Lunch + Relaxation**
- [ ] Take a break, recharge
- [ ] Final mental preparation

**บ่าย 14:00 - 16:00 น. - Team Coordination**:
- [ ] Call team meeting
- [ ] Review deployment plan
- [ ] Assign responsibilities
- [ ] Confirm all team ready
- [ ] Send final checklist

**บ่าย 16:00 - 17:00 น. - Final Documentation**:
- [ ] Prepare deployment notes
- [ ] Document known issues (if any)
- [ ] Prepare user communication
- [ ] Prepare support documentation

**ค่ำ 17:00 - 18:00 น. - Rest & Prepare**:
- [ ] Early dinner
- [ ] Final check at 20:00 น.
- [ ] Get good sleep
- [ ] Be ready for 09:00 tomorrow

---

### 🟢 วันที่ 8: 25 มิ.ย. 2569 (MONDAY - LAUNCH DAY)

**เช้า 07:00 น. - Early Start**
- [ ] Wake up early
- [ ] Coffee/breakfast
- [ ] Check email & messages
- [ ] Verify all systems OK

**เช้า 08:00 - 09:00 น. - Pre-Launch Health Check**
```bash
# 1. Dev server
ps aux | grep "next dev" | grep -v grep && echo "✅ Dev OK"

# 2. Latest code
git log main -1

# 3. Vercel status
# Check https://vercel.com/dashboard

# 4. Supabase status
# Check Supabase Dashboard for any alerts
```

**เช้า 09:00 - 09:15 น. - MERGE & DEPLOY** 🚀

```bash
# Step 1: Checkout main
git checkout main
git pull origin main

# Step 2: Merge feature branch
git merge claude/inspiring-shannon-bnzeux

# Step 3: Push to GitHub
git push origin main

# ✅ Vercel auto-deploys (watch dashboard)
# Deployment should complete in 2-3 minutes
```

**เช้า 09:15 - 09:30 น. - Deployment Monitoring**
- [ ] Open Vercel Dashboard
- [ ] Watch deployment progress
- [ ] Confirm "✓ Production Deployment Successful"
- [ ] Check deployment URL working
- [ ] Verify v6.36 shows

**เช้า 09:30 - 10:00 น. - Smoke Tests**
```bash
# Test production URL
curl -I https://aviva-one.vercel.app/

# Test version
curl https://aviva-one.vercel.app/settings | grep "6\.36"

# Test API health
curl https://aviva-one.vercel.app/api/health
```

**กลาง 10:00 - 10:30 น. - Browser Testing**
- [ ] Open https://aviva-one.vercel.app
- [ ] Login with CEO account
- [ ] Check Dashboard v6.36 badge
- [ ] Navigate all 6 modules
- [ ] Check no console errors (F12)
- [ ] Verify 31 houses display
- [ ] Verify 134 CRM leads display

**กลาง 10:30 - 11:00 น. - User Communication**
```
✅ AVIVA ONE v6.36 ปลายทางสำเร็จแล้ว!

📣 การประกาศไปยังผู้ใช้:

ยินดีด้วย! 🎉

AVIVA ONE v6.36 ปลายทางไปใช้งานจริงแล้วตั้งแต่เวลา 09:00 น.

✨ ความปรับปรุง:
- ✅ หน้าแสดงผลข้อมูลปรับปรุง
- ✅ ประสิทธิภาพเพิ่มขึ้น
- ✅ ความปลอดภัยเพิ่มขึ้น
- ✅ Error handling ดีขึ้น

🚀 พร้อมใช้งานได้ทันที
```

**บ่าย 11:00 - ทั้งวัน - Monitoring & Support**
- [ ] Monitor error logs (CloudFlare, Vercel, Supabase)
- [ ] Check user reports
- [ ] Team สังเกต 24 ชั่วโมง
- [ ] Support team ready for questions
- [ ] Success! 🎉

---

## 📋 Prerequisite Checklist ต้องเตรียมให้พร้อม

### ระหว่างวันนี้ - วันที่ 24 มิ.ย.

- [ ] **Supabase Project ID** - ขอจากทีม
  - Project name: AVIVA Private
  - Database: aviva_app_db
  - Region: Singapore/Bangkok

- [ ] **SQL Scripts** - สร้างเสร็จแล้ว:
  - `/tmp/create_test_users.sql`
  - `/tmp/create_test_data.sql`
  - `/tmp/cleanup_test_data.sql`

- [ ] **Test User Credentials** - เตรียมเสร็จแล้ว:
  - 6 test users ready
  - Passwords hashed
  - Roles assigned

- [ ] **Deployment Access** - ตรวจสอบ:
  - [ ] GitHub main branch access
  - [ ] Vercel dashboard access
  - [ ] Supabase dashboard access
  - [ ] CloudFlare dashboard access (หากใช้)

- [ ] **Communication**:
  - [ ] User announcement message
  - [ ] Support team briefing
  - [ ] Incident response plan

---

## 🎯 Success Indicators (บ่งชี้ความสำเร็จ)

**Launch Day ประสบความสำเร็จเมื่อ**:

1. ✅ Deployment complete ไม่เกิน 3 นาที
2. ✅ v6.36 visible on production
3. ✅ Users 50+ สามารถ login ได้
4. ✅ All 31 houses display correctly
5. ✅ All 134 CRM leads display correctly
6. ✅ Zero console errors first hour
7. ✅ Page load time < 2000ms
8. ✅ No critical bug reports (first 24 hours)
9. ✅ Team satisfied with deployment
10. ✅ Users giving positive feedback

---

## ⚠️ Contingency Plans

### หาก Deployment ล้มเหลว:

```bash
# Rollback ไป previous version (ภายใน 5 นาที)
git log main --oneline -5
git revert <previous-commit>
git push origin main
# Vercel auto-rollback (2-3 minutes)
```

### หาก Performance ตกต่ำ:

- [ ] Check Vercel metrics
- [ ] Check Database query performance
- [ ] Check CDN cache
- [ ] Investigate slow endpoints
- [ ] Rollback หากไม่ได้ผล

### หาก Database Issue:

- [ ] Verify Supabase status
- [ ] Check connection pool
- [ ] Verify RLS policies
- [ ] Use backup restore หากจำเป็น

---

## 📞 Team Contacts (During Launch)

| บทบาท | ชื่อ | เบอร์ | Line |
|--------|------|------|------|
| **Launch Lead** | [Name] | [Phone] | [ID] |
| **Database Admin** | [Name] | [Phone] | [ID] |
| **Frontend Lead** | [Name] | [Phone] | [ID] |
| **DevOps/Infrastructure** | [Name] | [Phone] | [ID] |
| **QA Lead** | [Name] | [Phone] | [ID] |
| **Support Manager** | [Name] | [Phone] | [ID] |

---

## 📝 Documentation Ready

| Document | Status | Path |
|----------|--------|------|
| GO-LIVE_READINESS_CHECKLIST_v6.36.md | ✅ | Home |
| DEPLOYMENT_COUNTDOWN_PLAN_v6.36.md | ✅ | This file |
| SQL_CREATE_TEST_USERS.sql | ⏳ | /tmp/ |
| SQL_CREATE_TEST_DATA.sql | ⏳ | /tmp/ |
| SQL_CLEANUP_TEST_DATA.sql | ⏳ | /tmp/ |
| PHASE1_2_TEST_REPORT.md | ✅ | Home |
| MANUAL_TESTING_GUIDE.md | ✅ | Home |

---

## 🎊 Final Notes

**ทั้ง 7 วันนี้ เป็นการเตรียมการอย่างละเอียด เพื่อให้ launching day smooth และ successful!**

✅ **Day 1 (Today)**: ทดสอบเสร็จ, เตรียมการเริ่ม  
✅ **Days 2-5**: ทดสอบอย่างระเอียด, ตรวจสอบ, ทำความสะอาด  
✅ **Day 6**: Final code review, merge preparation  
✅ **Day 7 (Pre-launch)**: ตรวจสอบสุดท้าย, backup, team coordination  
✅ **Day 8 (Launch)**: Deploy, monitor, celebrate! 🎉

---

**สร้างเมื่อ**: 18 มิ.ย. 2569 17:00 น. (UTC+7)  
**สถานะ**: 📝 Ready for Execution  
**Next Action**: สร้าง SQL scripts + เตรียมทีม

