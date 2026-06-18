# AVIVA ONE — Testing Framework & Standards
## Pre-Go-Live Testing Checklist (25 June 2026)

---

## 📋 1. TESTING STRUCTURE OVERVIEW

### Pyramid Model (Testing Coverage):
```
                  ▲
                 /|\
                / | \
               /  |  \     E2E Tests (Manual + Automated)
              /   |   \    ~10% - User workflows, critical paths
             /____|____\
            /     |     \
           /      |      \   Integration Tests
          /       |       \  ~30% - API, Database, 3rd-party
         /________|________\
        /         |         \
       /          |          \  Unit Tests
      /           |           \ ~60% - Functions, components
     /_____________|___________\
```

---

## 🎯 2. TESTING STANDARDS TO COVER (12-15 Standards)

### **TIER 1: Functional Testing (Must Pass)**
1. ✅ **User Authentication & Authorization**
   - Login/logout flows
   - Role-based access (CEO, COO, Admin, Manager, Engineer, Sales)
   - Permission gates on each page

2. ✅ **Core Business Workflows**
   - CRM: Add lead → Contact → Convert to sale
   - Construction: Track progress → Reports → QC defects
   - Finance: Create order → Approve → Execute → Record

3. ✅ **Data Integrity**
   - Create/Read/Update/Delete (CRUD) operations
   - Referential integrity (foreign keys)
   - No orphaned records

4. ✅ **API & Backend Integration**
   - All Supabase queries return correct data
   - Edge functions execute without errors
   - RLS policies enforce correctly

### **TIER 2: Performance & Reliability (Should Pass)**
5. ✅ **Performance Baselines**
   - Page load time < 2 seconds
   - API response time < 500ms
   - Database queries < 1000ms

6. ✅ **Error Handling & Recovery**
   - Network failures show proper UI feedback
   - Form validation displays errors
   - Graceful degradation for 3rd-party service failures

7. ✅ **Data Consistency**
   - No race conditions under concurrent writes
   - Transactional integrity (all-or-nothing)
   - Optimistic locking on critical updates

### **TIER 3: Security & Compliance (Critical)**
8. ✅ **Authentication Security**
   - Passwords never logged or transmitted plaintext
   - JWT tokens expire correctly
   - CORS policies properly configured

9. ✅ **Authorization (RBAC)**
   - Admin users cannot access employee data outside scope
   - Managers see only their team's records
   - Staff cannot access financial approvals

10. ✅ **Data Protection**
   - PII (phone, email) not exposed in logs
   - SQL injection prevention (parameterized queries)
   - XSS prevention in user input fields

### **TIER 4: Usability & UI/UX (Nice to Have)**
11. ✅ **UI Responsiveness**
   - Mobile layout works correctly (bottom nav)
   - Buttons are clickable and provide feedback
   - Forms are intuitive

12. ✅ **Accessibility**
   - Keyboard navigation works
   - Color contrast meets WCAG AA
   - Labels on form fields

### **TIER 5: Go-Live Specific (Required)**
13. ✅ **Demo Data Cleanup**
   - All 9 demo accounts deleted
   - 143 work queue items cleared
   - 33 demo work reports deleted (keep Pete's 2)

14. ✅ **Production Data Integrity**
   - 4 production users present and confirmed
   - 31 houses with correct construction progress
   - 134 CRM leads intact

15. ✅ **Deployment & Infrastructure**
   - Build succeeds (npm run build)
   - Vercel deployment works
   - No TypeScript errors

---

## 🔄 3. TESTING METHODOLOGIES & PROCESSES

### **3A. Unit Testing (Code Level)**
```
Tool: Jest / Vitest
Scope: Functions, React components, utilities
Coverage Target: 70%+ critical paths
```

**Example Tests:**
```typescript
// src/lib/roles.ts
describe('RBAC', () => {
  test('isSuperRole("ceo") === true', () => { });
  test('isManagerRole("sales") === false', () => { });
  test('SUPER_ROLES includes CEO and COO', () => { });
});

// src/components/LoginForm.tsx
describe('LoginForm', () => {
  test('Renders email and password inputs', () => { });
  test('Calls onSubmit when form submitted', () => { });
  test('Shows error on invalid credentials', () => { });
});
```

---

### **3B. Integration Testing (API/Database Level)**
```
Tool: Playwright (API testing) or SuperTest
Scope: API routes, Database queries, RLS policies
Coverage Target: 100% critical APIs
```

**Test Cases:**
```sql
-- Test RLS: Anonymous user cannot read construction_logs
-- Expected: 0 rows returned

-- Test API: POST /api/crm/leads
-- Expected: 201 Created, lead record inserted

-- Test Approval Flow: Create → Submit → Approve
-- Expected: All transitions succeed with proper status changes
```

---

### **3C. End-to-End Testing (User Workflows)**
```
Tool: Playwright (browser automation)
Scope: Complete user journeys
Coverage Target: 5-10 critical paths
```

**Test Scenarios:**
```
1. [CRM Flow]
   - Login as sales1@alisa.com
   - Create new lead (name, phone, source)
   - Assign to house plot
   - Convert to booking
   - Verify database record created

2. [Approval Flow]
   - Login as sales2@alisa.com
   - Create approval request
   - Submit for approval
   - Login as ceo@alisa.com
   - Review and approve
   - Verify status updated

3. [Report Flow]
   - Login as engineer@alisa.com
   - Navigate to reports
   - View existing reports
   - Submit new daily report
   - Verify appears in dashboard
```

---

### **3D. Performance Testing**
```
Tool: Lighthouse, WebPageTest, k6
Metrics:
  • First Contentful Paint (FCP): < 1.5s
  • Largest Contentful Paint (LCP): < 2.5s
  • Cumulative Layout Shift (CLS): < 0.1
  • Time to Interactive (TTI): < 3.5s
```

---

### **3E. Security Testing**
```
Tool: OWASP ZAP, Burp Suite (manual), npm audit
Checks:
  • SQL Injection attempts on APIs
  • XSS payloads in form fields
  • CSRF token validation
  • Authentication bypass attempts
  • Privilege escalation tests
```

---

### **3F. Manual Testing Checklist**
```
Device Coverage:
  ✓ Desktop (Chrome, Firefox, Safari)
  ✓ Tablet (iPad)
  ✓ Mobile (iPhone SE, Android)

Browser Compatibility:
  ✓ Chrome 120+
  ✓ Safari 17+
  ✓ Firefox 121+
  ✓ Edge 120+
```

---

## 📊 4. TEST EXECUTION PLAN (25 June 2026)

### **Phase 1: Pre-Cleanup Testing (T-6 hours)**
- [ ] Run all unit tests (Jest)
- [ ] Run integration tests (API + RLS)
- [ ] Run E2E tests (Playwright)
- [ ] Manual smoke test all 6 user roles
- [ ] Performance baseline check

### **Phase 2: Demo Cleanup (T-4 hours)**
- [ ] Execute Section 1-6.5 of GOLIVE_CLEANUP_QUERIES.sql
- [ ] Verify demo accounts deleted (count = 0)
- [ ] Verify production users intact (count = 6)
- [ ] Verify production data intact (CRM 134, Houses 31)

### **Phase 3: Post-Cleanup Testing (T-2 hours)**
- [ ] Re-run critical E2E tests
- [ ] Verify CRM leads still accessible
- [ ] Verify Pete's reports (17-18 Jun) still visible
- [ ] Check approval logs clean but history preserved

### **Phase 4: Deployment (T-0)**
- [ ] npm run build (must pass ✅)
- [ ] git push to main + claude/move-work-location-2CfBA
- [ ] Vercel auto-deploys
- [ ] Test production URL

### **Phase 5: Post-Go-Live (T+1 to T+24 hours)**
- [ ] Monitor error logs
- [ ] Check all 4 users can login
- [ ] Spot-check CRM, Construction, Finance flows
- [ ] Monitor performance metrics

---

## ✅ 5. SIGN-OFF CRITERIA (Must ALL pass)

**Functional:**
- [ ] All 6 user roles can login
- [ ] CRM: 134 leads visible
- [ ] Construction: 31 houses, progress tracking works
- [ ] Finance: Approval workflow functions
- [ ] Reports: Pete's 2 production reports accessible

**Technical:**
- [ ] Build succeeds (npm run build ✅)
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] API response times < 500ms
- [ ] Database queries < 1000ms

**Security:**
- [ ] No demo accounts in auth.users
- [ ] RLS policies enforce access correctly
- [ ] No sensitive data in error messages
- [ ] JWT tokens working

**Data Quality:**
- [ ] Demo work queue cleared (143 items)
- [ ] Demo reports deleted (33 items, kept Pete's 2)
- [ ] Demo approval logs cleared (26 items)
- [ ] Production data 100% intact

---

## 📝 6. TEST DOCUMENTATION TEMPLATE

**For Each Test Case:**
```
Test ID: TC-001-Login
Title: User login with valid credentials
Precondition: User not logged in
Steps:
  1. Navigate to /login
  2. Enter email: sale1@alisa.com
  3. Enter password: [production password]
  4. Click "เข้าสู่ระบบ"
Expected Result: Redirects to /dashboard, user profile visible
Actual Result: [Fill after test]
Status: PASS / FAIL
Notes: [If failed, why]

Test Data:
  - User: sale1@alisa.com (Faa - Sales)
  - Browser: Chrome 120
  - Device: Desktop
  - Date: 2026-06-25
```

---

## 🎓 7. TESTING BEST PRACTICES

### **Isolation:**
- Each test is independent (no shared state)
- Mock external APIs (Supabase in unit tests)
- Use real database for integration tests

### **Repeatability:**
- Tests pass/fail consistently
- Seed test data before each run
- Clean up test data after run

### **Coverage Priority:**
1. **Critical Path (100%)**: Login, CRM, Approvals, Reports
2. **High Priority (80%)**: Construction, Finance
3. **Medium Priority (60%)**: Office, Community
4. **Low Priority (40%)**: Settings, Help

### **Failure Handling:**
- Screenshot on E2E test failure
- Capture logs on API failure
- Video recording for flaky tests

---

## 📞 7. RESPONSIBLE PARTIES & SIGN-OFF

| Role | Responsible For | Sign-Off |
|------|-----------------|----------|
| Developer | Unit + Integration tests | Claude Code ✓ |
| QA Lead | E2E + Manual testing | [Assign person] |
| Security | Security testing | [Assign person] |
| Product Owner | Acceptance criteria | [Product PM] |
| DevOps | Infrastructure/Deploy | [Vercel + Supabase] |

**Final Go-Live Approval:** ______________________ (Date: 2026-06-25)

---

**Generated:** 2026-06-18
**Last Updated:** 2026-06-18 
**Status:** Ready for Testing
