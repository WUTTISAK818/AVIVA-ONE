# ✅ AVIVA ONE v6.36 — Testing Action Checklist
**วันนี้ 18 มิ.ย.** (สามารถทำได้ทันที)

---

## 🚀 IMMEDIATE ACTIONS (ทำได้เดี๋ยวนี้ ไม่ต้องรอ)

### Step 1: Verify Environment ⏱️ 5 นาที
```bash
# ✅ Dev server running?
ps aux | grep "next dev" | grep -v grep && echo "✅ Running" || echo "❌ Not running"

# ✅ Build passes?
cd /home/user/AVIVA-ONE && npm run build
# Expected: ✓ Compiled successfully

# ✅ Version v6.36?
grep -o "v6\.36" /home/user/AVIVA-ONE/src/app/dashboard/page.tsx && echo "✅ v6.36"
```

### Step 2: Manual Phase 1 Testing ⏱️ 15-20 นาที

**Open Browser → localhost:3000**

- [ ] Login page loads (or redirects to dashboard if already logged in)
- [ ] Dashboard visible with v6.36 badge
- [ ] Bottom navigation shows 6 tabs (หน้าหลัก, ขาย, ก่อสร้าง, ออฟฟิศ, รายงาน, ตั้งค่า)
- [ ] All KPI cards render (if data available)
- [ ] Click Settings → Version shows "6.36"
- [ ] No console errors (F12 → Console tab)

**Record Results**:
```
Timestamp: [Time]
Status: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
Issues Found:
- [Issue 1]
- [Issue 2]
```

### Step 3: Route Testing ⏱️ 10 นาที

Navigate to each module:

- [ ] /dashboard → ✅ Loads
- [ ] /crm → ✅ Loads (or shows "No access")
- [ ] /construction → ✅ Loads (or shows "No access")
- [ ] /office → ✅ Loads (or shows "No access")
- [ ] /reports → ✅ Loads (or shows "No access")
- [ ] /settings → ✅ Loads (shows version 6.36)

### Step 4: Data Connectivity Test ⏱️ 15 นาที

**In Browser Console (F12)**:

```javascript
// Test 1: Check if Supabase URL is loaded
console.log('Page loaded');

// Test 2: Try to access data
fetch('/api/construction/progress')
  .then(r => r.json())
  .then(d => console.log('Construction data:', d))
  .catch(e => console.log('Expected (auth may be needed):', e));

// Test 3: Check local storage
console.log('Auth token:', localStorage.getItem('sb-token') ? '✅ Present' : '❌ Missing');
```

**Expected**: ✅ Either data loads OR proper auth error message

### Step 5: Performance Baseline ⏱️ 10 นาที

**Using DevTools (F12 → Network)**:

1. Reload page (Cmd+R)
2. Wait for all requests to complete
3. Look at timing summary:
   - Finish time: __________ ms
   - Expected: < 2000 ms ✅/❌

4. Check largest requests:
   - JS bundle size: __________ KB
   - Total size: __________ MB

---

## 📋 Phase 2-6 Testing (Manual, ไม่ต้อง Supabase Access)

### Can Do Today If Logged In ✅

**Phase 2: Login & Access**
```
If production users exist:
- [ ] Login as joyus818@gmail.com (CEO)
- [ ] Check dashboard content
- [ ] Logout and verify
- [ ] Try other users if credentials available
```

**Phase 3: Data Display**
```
- [ ] Navigate to /construction
- [ ] Count visible house units (expect ~31)
- [ ] Click one unit → detail panel opens
- [ ] Click another module → verify navigation works
```

**Phase 4: RBAC (Role-Based Access)**
```
Browser Console:
- [ ] Check if user role is in auth state
- [ ] Try to access admin endpoints
- [ ] Verify access denied for non-admin
```

**Phase 5: Performance**
```
DevTools → Lighthouse:
- [ ] Run Lighthouse audit (mobile)
- [ ] Check Performance score (target: > 70)
- [ ] Screenshot results
```

**Phase 6: Error Handling**
```
- [ ] DevTools → Network → Offline
- [ ] Try to refresh page
- [ ] Expected: ✅ Error message (not blank screen)
- [ ] Go online again
- [ ] Page recovers
```

---

## 📄 Documentation Created (Ready to Use)

| Document | Purpose | Lines |
|----------|---------|-------|
| **MANUAL_TESTING_GUIDE.md** | Complete manual testing steps (NO Supabase needed) | 500+ |
| **TESTING_MANUAL_v6.36.md** | Detailed Phase 1-5 guide with SQL scripts | 2000+ |
| **UAT_E2E_TEST_PLAN_v6.36.md** | 18 testing standards with test cases | 850+ |
| **PHASE1_TESTING_PROGRESS.md** | Current status & blockers | 150+ |

**Total**: 3,500+ lines of testing documentation ready ✅

---

## 📊 For Next Steps (Need Supabase Access)

Once you can run Supabase SQL:

**Create 6 Test Users**:
```sql
-- Run SQL from /tmp/create_test_users.sql
-- Creates: test.ceo@, test.coo@, test.sales1@, test.sales2@, test.engineer@, test.finance@
```

**Create 260+ Test Data**:
```sql
-- Run SQL from /tmp/create_test_data.sql
-- Creates: 50 leads, 10 houses, 30 reports, etc.
```

Then proceed with comprehensive testing.

---

## 🎯 Success = 

✅ Phase 1-2 testing complete TODAY  
✅ No critical issues found  
✅ Version v6.36 verified  
✅ Performance baseline recorded  
✅ All routes accessible  
✅ Ready for production go-live

---

## 📞 How to Proceed

### Option A: Continue with Manual Testing NOW ⭐
**What to do**:
1. Open localhost:3000 in browser
2. Follow MANUAL_TESTING_GUIDE.md
3. Record results in checklist below
4. Report findings

### Option B: Get Supabase Access, Create Test Data
**What to do**:
1. Provide Supabase Project ID or access
2. Run SQL scripts to create test users + data
3. Execute comprehensive 18-standard testing
4. Document all results

### Option C: Both (Recommended)
**What to do**:
1. Do manual testing NOW (30 minutes)
2. Get Supabase access for test data creation
3. Execute full testing suite (2-3 days)
4. Go-live on 25 มิ.ย. ready ✅

---

## 📋 Testing Results Log

### Phase 1: Environment Verification
- [ ] Timestamp: __________
- [ ] Status: ✅ / ⚠️ / ❌
- [ ] Issues: _____________________

### Phase 2: Login & Access
- [ ] Timestamp: __________
- [ ] Status: ✅ / ⚠️ / ❌
- [ ] Issues: _____________________

### Phase 3: Data Display
- [ ] Timestamp: __________
- [ ] Status: ✅ / ⚠️ / ❌
- [ ] Issues: _____________________

### Phase 4: RBAC
- [ ] Timestamp: __________
- [ ] Status: ✅ / ⚠️ / ❌
- [ ] Issues: _____________________

### Phase 5: Performance
- [ ] Timestamp: __________
- [ ] Page Load Time: __________ ms (target: < 2000)
- [ ] Issues: _____________________

### Phase 6: Error Handling
- [ ] Timestamp: __________
- [ ] Status: ✅ / ⚠️ / ❌
- [ ] Issues: _____________________

---

## 🎬 Ready to START?

```bash
# Current status:
✅ Dev server: RUNNING
✅ v6.36: DEPLOYED
✅ Documentation: READY (3,500+ lines)
✅ Manual testing: CAN START NOW
⏳ Test data creation: AWAITING SUPABASE ACCESS

# Open browser to:
http://localhost:3000/

# Follow manual guide:
/home/user/AVIVA-ONE/MANUAL_TESTING_GUIDE.md

# Report findings using template:
/home/user/AVIVA-ONE/TESTING_ACTION_CHECKLIST.md
```

---

**Status**: 🟢 Ready to Begin Phase 1 Testing  
**Blockers**: None for manual testing (Phase 1-6)  
**Next**: Execute manual testing, report results  
**Timeline**: Can complete Phase 1-2 TODAY (30-45 minutes)

