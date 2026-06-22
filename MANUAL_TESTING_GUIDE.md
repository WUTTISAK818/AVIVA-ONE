# AVIVA ONE v6.36 — Manual Testing Execution Guide
**เอกสารฉุกเฉิน: ไม่มี Supabase Direct Access**  
**Status**: 🔄 Ready for Manual Execution  
**Target**: ดำเนินการ Phase 1-5 Testing ตั้งแต่วันนี้

---

## 🎯 Strategy: Test with Production Data ด้วย Safety Measures

เนื่องจากไม่สามารถเข้าถึง Supabase Project ID ได้ (สภาพแวดล้อม remote), ให้ทำการทดสอบโดยใช้:

### ✅ ผลิตภัณฑ์ข้อมูล (Production Data)
- 31 production houses (AVA + VIVA)
- 134 CRM leads (real customer data)
- 2 Pete work reports (17-18 มิ.ย.)
- 3 QC defects (demo data)

**ปลอดภัย**: ข้อมูล **ไม่ได้ลบ** เพียงแต่ **ทดสอบ** (read-only หรือ log-only operations)

---

## 📋 Manual Phase 1 Testing (Can Execute Now!)

### Prerequisites
```bash
✅ Dev server running: npm run dev
✅ All routes accessible on localhost:3000
✅ Build passes: npm run build
```

### Phase 1.1: Login Testing ✅ (Can Do Now)

**Test Case 1: CEO Login**
```
Step 1: Open http://localhost:3000/
Step 2: Click "Sign In" (if visible) or wait for redirect
Step 3: Observe: Does it show login form?
Step 4: If production users exist, try:
   Email: joyus818@gmail.com
   Password: (your password)
   
Expected: ✅ Login successful → Dashboard v6.36
```

**Test Case 2: Role-Based Dashboard**
```
Step 1: Login as CEO
Step 2: Observe dashboard content:
   - KPI Cards visible? ✅/❌
   - Bottom navigation visible? ✅/❌
   - Version badge shows v6.36? ✅/❌
   
Step 3: Check browser console (F12 → Console):
   - Any errors? ✅ None / ❌ Has errors
   - Network tab shows Supabase URL? ✅/❌
```

### Phase 1.2: Route Accessibility Testing ✅ (Can Do Now)

**Test Each Module**:

```bash
# Test 1: CRM Module
curl -s http://localhost:3000/crm | grep -i "crm\|lead\|customer" && echo "✅ CRM loads" || echo "⏳ May need auth"

# Test 2: Construction Module
curl -s http://localhost:3000/construction | grep -i "construction\|house\|progress" && echo "✅ Construction loads" || echo "⏳ May need auth"

# Test 3: Office Module
curl -s http://localhost:3000/office | grep -i "office\|document" && echo "✅ Office loads" || echo "⏳ May need auth"

# Test 4: Reports Module
curl -s http://localhost:3000/reports | grep -i "report" && echo "✅ Reports loads" || echo "⏳ May need auth"

# Test 5: Settings Module
curl -s http://localhost:3000/settings | grep -i "settings\|version\|6\.36" && echo "✅ Settings loads" || echo "⏳ May need auth"
```

### Phase 1.3: Version Verification ✅ (Can Do Now)

**Verify v6.36 is deployed:**

```bash
# Check dashboard page
curl -s http://localhost:3000/ | grep -o "v6\.36\|6\.36" && echo "✅ Version v6.36 found" || echo "❌ Version not v6.36"

# Check settings page
curl -s http://localhost:3000/settings | grep -o "6\.36\|Version 6\.36" && echo "✅ Settings shows v6.36" || echo "⏳ Check manually"
```

**Manual Verification**:
1. Open browser DevTools (F12)
2. Go to Settings page
3. Look for "Version 6.36" text
4. Expected: ✅ Shows version number

---

## 🚀 Phase 2: Functional Testing (Production Data)

### Test 2.1: CRM Read Access

**What to Test**: Can login users view CRM data?

```
Step 1: Navigate to /crm module
Step 2: Observe:
   - Do any CRM leads display? ✅/❌
   - Are columns visible (Name, Phone, Status)? ✅/❌
   - Can you search/filter? ✅/❌
   
Step 3: Check browser console:
   - Any GraphQL/API errors? ✅ None / ❌ Has errors
   - Data loading spinner appears then disappears? ✅/❌
```

### Test 2.2: Construction Read Access

**What to Test**: Can view all 31 houses?

```
Step 1: Navigate to /construction module
Step 2: Observe grid/list:
   - Do house items appear? ✅/❌
   - Total count shows ~31? ✅/❌
   - Can click on unit to see details? ✅/❌
   
Step 3: Click on first house unit:
   - Detail panel opens? ✅/❌
   - Customer info shows (from CRM)? ✅/❌
   - Progress percentage displays? ✅/❌
   - Work reports visible? ✅/❌
```

### Test 2.3: Finance Data Access

**What to Test**: Can view installment/approval data?

```
Step 1: Navigate to /construction → Installments section
Step 2: Observe:
   - List of houses with stages appears? ✅/❌
   - Each house shows 8 stages (foundation, structure, etc.)? ✅/❌
   - Status shows (pending, approved, paid)? ✅/❌
```

---

## 🔐 Phase 3: RBAC Testing (Role-Based Access Control)

**How to Test Without Creating New Users**:

Use Browser DevTools to simulate different roles:

```javascript
// In Browser Console (F12 → Console):

// Check current user role
console.log(localStorage.getItem('userRole')); 
// Or check from auth state

// Try to access restricted API
fetch('/api/admin/settings', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(d => console.log('Admin API response:', d))
.catch(e => console.log('Expected error:', e));
```

**Expected Results**:
- ✅ Admin/CEO: Can access admin endpoints
- ✅ Sales: Cannot access admin endpoints
- ✅ Engineer: Cannot access finance endpoints

---

## 📊 Phase 4: Data Integrity Check

### SQL Verification (Run on Supabase Dashboard directly)

```sql
-- Verify production data is intact
SELECT COUNT(*) as total_houses FROM houses WHERE is_test IS NOT true;
-- Expected: 31

SELECT COUNT(*) as total_leads FROM crm_leads WHERE is_test IS NOT true;
-- Expected: 134

SELECT COUNT(*) as pete_reports FROM work_reports 
WHERE reported_by = 'engineer@alisa.com';
-- Expected: 2

SELECT COUNT(*) as demo_defects FROM qc_defects WHERE is_test IS NOT true;
-- Expected: 3
```

### Browser Console Data Verification

```javascript
// In Browser Console (logged in as CEO/COO):

// Check if data loaded
console.log('Houses loaded:', document.querySelectorAll('[data-house-id]').length);
// Expected: ~31

console.log('CRM leads loaded:', document.querySelectorAll('[data-lead-id]').length);
// Expected: Some number > 0
```

---

## ⚡ Phase 5: Performance Testing

### Page Load Time Measurement

**Using Browser DevTools**:
1. Open DevTools (F12)
2. Go to Network tab
3. Reload page (Cmd+R or Ctrl+R)
4. Look for metrics:
   - `Load`: Total page load time
   - `DOMContentLoaded`: Time to render DOM

**Expected**:
```
✅ Dashboard load: < 2 seconds
✅ CRM load: < 3 seconds
✅ Construction load: < 2.5 seconds
✅ Each API request: < 500ms
```

### Console Performance Logging

```javascript
// In Browser Console:
performance.measure('pageLoad');
const measures = performance.getEntriesByName('pageLoad');
console.log('Page load time:', measures[0].duration, 'ms');
// Expected: < 2000ms
```

---

## 🔍 Phase 6: Error Handling Testing

### Test Error Cases

**Test 1: Disconnect Network**
```
Step 1: Open DevTools (F12) → Network tab
Step 2: Click "Offline" checkbox
Step 3: Try to navigate or refresh
Step 4: Expected: ✅ Error message shows "No internet"
Step 5: Go "Online" again, page recovers
```

**Test 2: Invalid Data Input**
```
Step 1: Try to create/edit a lead (if button available)
Step 2: Leave required fields empty
Step 3: Click Save
Step 4: Expected: ✅ Validation error appears
```

**Test 3: Simulate Slow Network**
```
Step 1: DevTools → Network tab
Step 2: Set throttling to "Slow 3G"
Step 3: Navigate to /construction
Step 4: Expected: ✅ Loading spinner appears, data loads (slowly)
Step 5: No blank screen or hard error
```

---

## 📝 Testing Checklist

### Phase 1: Environment ✅
- [ ] Dev server running and responsive
- [ ] All routes accessible
- [ ] Version v6.36 deployed
- [ ] No TypeScript errors in build

### Phase 2: Login & Access ✅
- [ ] Production users can login
- [ ] Dashboard shows correct role-based content
- [ ] No console errors
- [ ] All modules accessible

### Phase 3: Data Display ✅
- [ ] 31 houses display in Construction
- [ ] 134 CRM leads display (or sample)
- [ ] Customer info linked correctly
- [ ] Progress percentages show

### Phase 4: RBAC Enforcement ✅
- [ ] Different roles see different data
- [ ] Admin can access admin endpoints
- [ ] Sales cannot access Finance
- [ ] Engineer cannot access Settings

### Phase 5: Performance ✅
- [ ] Pages load within baselines
- [ ] No JavaScript errors
- [ ] Network requests complete
- [ ] Data renders fully

### Phase 6: Error Handling ✅
- [ ] Offline detection works
- [ ] Form validation works
- [ ] Slow network handled gracefully
- [ ] No blank screens

---

## 🐛 Issue Reporting Template

**When you find an issue:**

```markdown
## Issue: [Title]

**Date/Time**: [When found]
**Browser**: Chrome / Firefox / Safari
**URL**: http://localhost:3000/[page]
**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Screenshot/Error**:
[Paste console error or screenshot]

**Severity**: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low
```

---

## 📞 When You Complete Testing

1. ✅ Document all findings
2. ✅ Screenshot results for each phase
3. ✅ Collect any error messages
4. ✅ Note down performance metrics
5. ✅ List all issues found
6. ✅ Share results back

Then we can:
- [ ] Fix any issues found
- [ ] Re-test fixes
- [ ] Prepare for go-live
- [ ] Cleanup production data (if using test data)

---

## 🎯 Success Criteria

**Testing is complete when**:
- ✅ All Phase 1-6 tests executed
- ✅ No critical issues found (or all documented)
- ✅ Performance meets baselines
- ✅ RBAC working correctly
- ✅ Data integrity verified
- ✅ Error handling functional

**Go-Live Ready When**:
- ✅ All tests passing
- ✅ Issues triaged and fixed
- ✅ Team sign-off obtained
- ✅ Production data verified safe

---

## 📅 Timeline

- **18 มิ.ย. (Today)**: Execute Phase 1-2
- **19 มิ.ย.**: Execute Phase 3-4
- **20 มิ.ย.**: Execute Phase 5-6
- **21 มิ.ย.**: Review issues, prioritize fixes
- **22-23 มิ.ย.**: Implement fixes, re-test
- **24 มิ.ย.**: Final verification
- **25 มิ.ย.**: Go-Live ✅

---

**Start Testing Now**: Open localhost:3000 and begin Phase 1!

