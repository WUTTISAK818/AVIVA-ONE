# AVIVA ONE v6.36 - Demo Users Master Checklist

**Go-Live Testing**: 18-20 June 2026  
**Demo Users**: 11 Total  
**Status**: ✅ READY FOR EXECUTION

---

## Phase 0: Pre-Execution Preparation

### Documentation Review
- [ ] Read: `DEMO_USERS_CREATION_EXECUTION_GUIDE.md` (main guide)
- [ ] Read: `DEMO_USERS_QUICK_REFERENCE.txt` (quick ref)
- [ ] Read: `DEMO_USERS_STATUS_REPORT_v6.36.md` (full status)
- [ ] Review: This checklist completely

### Environment Verification
- [ ] Verify: Supabase project is accessible
- [ ] Verify: Project ID is `ipxeraxcbxxsjimzougk`
- [ ] Verify: You have SQL Editor access
- [ ] Verify: Network connectivity to Supabase
- [ ] Optional: Export backup of existing profiles

### Credentials Preparation
- [ ] Print/Save: `DEMO_ACCOUNTS_CREDENTIALS.txt`
- [ ] Verify: All 11 credentials are unique
- [ ] Verify: Password format is `Demo@[Role]123`
- [ ] Prepare: Credential distribution method (secure)

---

## Phase 1: SQL Execution (10 minutes)

### SQL Script Preparation
- [ ] Open file: `SQL_DEMO_USERS_EXECUTE_NOW.sql` (or `SQL_CREATE_COMPLETE_DEMO_USERS.sql`)
- [ ] Copy: Entire script from `BEGIN;` to `COMMIT;`
- [ ] Verify: Script contains all 11 INSERT statements

### Supabase Dashboard Access
- [ ] Navigate to: https://supabase.com/dashboard/project/ipxeraxcbxxsjimzougk/sql/new
- [ ] OR: Manual navigation → SQL Editor → + New Query
- [ ] Verify: Connected to correct project
- [ ] Verify: SQL Editor is responsive

### SQL Execution
- [ ] Paste: Complete script into SQL editor
- [ ] Review: Script contents look correct
- [ ] Click: "Run" button (or Ctrl+Enter)
- [ ] Wait: 5-10 seconds for completion
- [ ] Verify: Green checkmark appears
- [ ] Expected Message: "Query executed successfully"
- [ ] Expected Result: "Rows affected: 11"

### Immediate Verification
- [ ] Check: No error messages appear
- [ ] Check: No "Permission denied" errors
- [ ] Check: No "Constraint violation" errors
- [ ] Copy: Output message for records

---

## Phase 2: Database Verification (5 minutes)

### Verification Query 1: Count Users
- [ ] Run Query: Copy from execution guide (Verification Query 1)
- [ ] Expected Result: 
  ```
  total_demo_users | 11
  ceo | 1
  coo | 1
  project_mgr | 1
  sales_mgr | 1
  finance_mgr | 1
  hr_mgr | 1
  engineer | 1
  qa_inspector | 1
  accountant | 1
  marketing | 1
  admin | 1
  ```

### Verification Query 2: List Users
- [ ] Run Query: Copy from execution guide (Verification Query 2)
- [ ] Verify: All 11 users appear in results
- [ ] Verify: Each user has correct email
- [ ] Verify: Each user has correct role
- [ ] Verify: Each user has correct department
- [ ] Verify: All users have `is_active = true`
- [ ] Verify: All users have `is_demo = true`

### Detailed Verification
- [ ] Check: demo.ceo@alisa.com exists with role=ceo
- [ ] Check: demo.coo@alisa.com exists with role=coo
- [ ] Check: demo.project_mgr@alisa.com exists with role=project_manager
- [ ] Check: demo.sales_mgr@alisa.com exists with role=sales_manager
- [ ] Check: demo.finance_mgr@alisa.com exists with role=finance_manager
- [ ] Check: demo.hr_mgr@alisa.com exists with role=hr_manager
- [ ] Check: demo.engineer@alisa.com exists with role=engineer
- [ ] Check: demo.qa_inspector@alisa.com exists with role=qa_inspector
- [ ] Check: demo.accountant@alisa.com exists with role=accountant
- [ ] Check: demo.marketing@alisa.com exists with role=marketing
- [ ] Check: demo.admin@alisa.com exists with role=admin

---

## Phase 3: Auth User Creation (10 minutes)

### Access Supabase Auth Dashboard
- [ ] Navigate to: https://supabase.com/dashboard/project/ipxeraxcbxxsjimzougk/auth/users
- [ ] OR: Supabase Dashboard → Authentication → Users
- [ ] Verify: Currently showing 0 demo users (or existing users only)

### Create Auth User #1: CEO
- [ ] Click: "+ Add User" button
- [ ] Email: `demo.ceo@alisa.com`
- [ ] Password: `Demo@CEO123`
- [ ] Check: "Auto confirm user" checkbox
- [ ] Click: "Create user"
- [ ] Verify: User appears in list with status "Confirmed"

### Create Auth User #2: COO
- [ ] Click: "+ Add User" button
- [ ] Email: `demo.coo@alisa.com`
- [ ] Password: `Demo@COO123`
- [ ] Check: "Auto confirm user" checkbox
- [ ] Click: "Create user"
- [ ] Verify: User appears in list

### Create Auth User #3: Project Manager
- [ ] Click: "+ Add User" button
- [ ] Email: `demo.project_mgr@alisa.com`
- [ ] Password: `Demo@ProjectMgr123`
- [ ] Check: "Auto confirm user" checkbox
- [ ] Click: "Create user"
- [ ] Verify: User appears in list

### Create Auth User #4: Sales Manager
- [ ] Click: "+ Add User" button
- [ ] Email: `demo.sales_mgr@alisa.com`
- [ ] Password: `Demo@SalesMgr123`
- [ ] Check: "Auto confirm user" checkbox
- [ ] Click: "Create user"
- [ ] Verify: User appears in list

### Create Auth User #5: Finance Manager
- [ ] Click: "+ Add User" button
- [ ] Email: `demo.finance_mgr@alisa.com`
- [ ] Password: `Demo@FinanceMgr123`
- [ ] Check: "Auto confirm user" checkbox
- [ ] Click: "Create user"
- [ ] Verify: User appears in list

### Create Auth User #6: HR Manager
- [ ] Click: "+ Add User" button
- [ ] Email: `demo.hr_mgr@alisa.com`
- [ ] Password: `Demo@HrMgr123`
- [ ] Check: "Auto confirm user" checkbox
- [ ] Click: "Create user"
- [ ] Verify: User appears in list

### Create Auth User #7: Engineer
- [ ] Click: "+ Add User" button
- [ ] Email: `demo.engineer@alisa.com`
- [ ] Password: `Demo@Engineer123`
- [ ] Check: "Auto confirm user" checkbox
- [ ] Click: "Create user"
- [ ] Verify: User appears in list

### Create Auth User #8: QA Inspector
- [ ] Click: "+ Add User" button
- [ ] Email: `demo.qa_inspector@alisa.com`
- [ ] Password: `Demo@QaInspector123`
- [ ] Check: "Auto confirm user" checkbox
- [ ] Click: "Create user"
- [ ] Verify: User appears in list

### Create Auth User #9: Accountant
- [ ] Click: "+ Add User" button
- [ ] Email: `demo.accountant@alisa.com`
- [ ] Password: `Demo@Accountant123`
- [ ] Check: "Auto confirm user" checkbox
- [ ] Click: "Create user"
- [ ] Verify: User appears in list

### Create Auth User #10: Marketing
- [ ] Click: "+ Add User" button
- [ ] Email: `demo.marketing@alisa.com`
- [ ] Password: `Demo@Marketing123`
- [ ] Check: "Auto confirm user" checkbox
- [ ] Click: "Create user"
- [ ] Verify: User appears in list

### Create Auth User #11: Admin
- [ ] Click: "+ Add User" button
- [ ] Email: `demo.admin@alisa.com`
- [ ] Password: `Demo@Admin123`
- [ ] Check: "Auto confirm user" checkbox
- [ ] Click: "Create user"
- [ ] Verify: User appears in list

### Final Auth Verification
- [ ] Count: All 11 users visible in auth users list
- [ ] Check: All users show "Confirmed" status
- [ ] Check: No errors in logs

---

## Phase 4: Login Testing (15 minutes)

### Test Login #1: CEO
- [ ] Go to: http://localhost:3000/auth/login (or deployed URL)
- [ ] Email: `demo.ceo@alisa.com`
- [ ] Password: `Demo@CEO123`
- [ ] Click: Login
- [ ] Expected: Dashboard loads successfully
- [ ] Check: No console errors
- [ ] Check: User name/role displays correctly
- [ ] Check: All modules visible (full access)
- [ ] Click: Logout

### Test Login #2: COO
- [ ] Go to: http://localhost:3000/auth/login
- [ ] Email: `demo.coo@alisa.com`
- [ ] Password: `Demo@COO123`
- [ ] Click: Login
- [ ] Expected: Dashboard loads successfully
- [ ] Check: No console errors
- [ ] Check: All modules visible (full access)
- [ ] Click: Logout

### Test Login #3: Project Manager
- [ ] Go to: http://localhost:3000/auth/login
- [ ] Email: `demo.project_mgr@alisa.com`
- [ ] Password: `Demo@ProjectMgr123`
- [ ] Click: Login
- [ ] Expected: Dashboard loads successfully
- [ ] Check: Construction module visible
- [ ] Check: Reports module visible
- [ ] Check: No access to Finance/HR/Admin
- [ ] Click: Logout

### Test Login #4: Sales Manager
- [ ] Go to: http://localhost:3000/auth/login
- [ ] Email: `demo.sales_mgr@alisa.com`
- [ ] Password: `Demo@SalesMgr123`
- [ ] Click: Login
- [ ] Expected: Dashboard loads successfully
- [ ] Check: CRM module visible
- [ ] Check: Reports module visible
- [ ] Check: No access to Construction/Finance/HR/Admin
- [ ] Click: Logout

### Test Login #5: Finance Manager
- [ ] Go to: http://localhost:3000/auth/login
- [ ] Email: `demo.finance_mgr@alisa.com`
- [ ] Password: `Demo@FinanceMgr123`
- [ ] Click: Login
- [ ] Expected: Dashboard loads successfully
- [ ] Check: Finance module visible
- [ ] Check: Reports module visible
- [ ] Check: No access to Construction/CRM/HR/Admin
- [ ] Click: Logout

### Test Login #6: HR Manager
- [ ] Go to: http://localhost:3000/auth/login
- [ ] Email: `demo.hr_mgr@alisa.com`
- [ ] Password: `Demo@HrMgr123`
- [ ] Click: Login
- [ ] Expected: Dashboard loads successfully
- [ ] Check: HR module visible
- [ ] Check: Reports module visible
- [ ] Check: No access to Construction/CRM/Finance/Admin
- [ ] Click: Logout

### Test Login #7: Engineer
- [ ] Go to: http://localhost:3000/auth/login
- [ ] Email: `demo.engineer@alisa.com`
- [ ] Password: `Demo@Engineer123`
- [ ] Click: Login
- [ ] Expected: Dashboard loads successfully
- [ ] Check: Construction module visible
- [ ] Check: No access to Management features
- [ ] Click: Logout

### Test Login #8: QA Inspector
- [ ] Go to: http://localhost:3000/auth/login
- [ ] Email: `demo.qa_inspector@alisa.com`
- [ ] Password: `Demo@QaInspector123`
- [ ] Click: Login
- [ ] Expected: Dashboard loads successfully
- [ ] Check: Quality Assurance features visible
- [ ] Check: Limited access as expected
- [ ] Click: Logout

### Test Login #9: Accountant
- [ ] Go to: http://localhost:3000/auth/login
- [ ] Email: `demo.accountant@alisa.com`
- [ ] Password: `Demo@Accountant123`
- [ ] Click: Login
- [ ] Expected: Dashboard loads successfully
- [ ] Check: Finance module visible (read-only)
- [ ] Check: No access to other modules
- [ ] Click: Logout

### Test Login #10: Marketing
- [ ] Go to: http://localhost:3000/auth/login
- [ ] Email: `demo.marketing@alisa.com`
- [ ] Password: `Demo@Marketing123`
- [ ] Click: Login
- [ ] Expected: Dashboard loads successfully
- [ ] Check: Marketing module visible
- [ ] Check: CRM module visible
- [ ] Check: No access to Finance/HR/Admin
- [ ] Click: Logout

### Test Login #11: Admin
- [ ] Go to: http://localhost:3000/auth/login
- [ ] Email: `demo.admin@alisa.com`
- [ ] Password: `Demo@Admin123`
- [ ] Click: Login
- [ ] Expected: Dashboard loads successfully
- [ ] Check: All modules visible (full access)
- [ ] Check: Settings menu accessible
- [ ] Check: Admin features visible
- [ ] Click: Logout

### Login Test Summary
- [ ] All 11 users logged in successfully
- [ ] No "invalid credentials" errors
- [ ] No "user not found" errors
- [ ] RBAC enforcement working correctly
- [ ] No console errors during any login

---

## Phase 5: Credential Distribution (10 minutes)

### Prepare Distribution Package
- [ ] Create: Credential spreadsheet or document
- [ ] Include: Email, password, role, access level
- [ ] Include: Testing guide link
- [ ] Include: Expected modules/access for each role
- [ ] Include: Support contact info

### Distribute to Testing Team
- [ ] Identify: All testers who need credentials
- [ ] Method: Secure channel only (encrypted email, secure link, etc.)
- [ ] NOT: Unencrypted email, Slack, Teams without encryption
- [ ] Confirm: Each tester received their credentials
- [ ] Confirm: Each tester understands their role/access level
- [ ] Share: Testing guide document

### Testing Team Onboarding
- [ ] Share: `DEMO_USER_TESTING_GUIDE_v6.36.md`
- [ ] Share: `DEMO_USERS_STATUS_REPORT_v6.36.md`
- [ ] Explain: What to test in their role
- [ ] Explain: How to report issues
- [ ] Provide: Support contact information

---

## Phase 6: Testing Execution (18-20 June)

### Day 1 - Morning Setup (9:00-9:30)
- [ ] All SQL executed successfully
- [ ] All 11 users verified in database
- [ ] All 11 users created in auth
- [ ] All 11 users can login
- [ ] All RBAC rules working

### Day 1 - Afternoon Testing (9:30-17:00)
- [ ] CEO user testing: 40 minutes
- [ ] COO user testing: 40 minutes
- [ ] Project Manager testing: 40 minutes
- [ ] Sales Manager testing: 40 minutes
- [ ] Finance Manager testing: 40 minutes
- [ ] Collect feedback from first 5 roles

### Day 2 - Full Day Testing (9:00-17:00)
- [ ] HR Manager testing: 40 minutes
- [ ] Engineer testing: 40 minutes
- [ ] QA Inspector testing: 40 minutes
- [ ] Accountant testing: 40 minutes
- [ ] Marketing testing: 40 minutes
- [ ] Admin testing: 40 minutes
- [ ] Bug fixes based on feedback: 2-4 hours
- [ ] Re-test affected features: 1-2 hours

### Day 3 - Final Verification (9:00-17:00)
- [ ] Sign-off testing from stakeholders
- [ ] Issue resolution: 2-3 hours
- [ ] Documentation: 1 hour
- [ ] Production data verification

### Testing Documentation
- [ ] Log: All issues found
- [ ] Screenshot: Any error messages
- [ ] Note: Which role/feature had issue
- [ ] Note: Steps to reproduce
- [ ] Priority: Critical, High, Medium, Low

---

## Phase 7: Cleanup & Verification

### Post-Testing Cleanup (After all testing complete)

#### Option 1: Keep Users (Short-term)
- [ ] Mark users as tested
- [ ] Keep for reference/demo if needed
- [ ] Plan deletion date

#### Option 2: Delete Users (Recommended)
- [ ] Run: SQL cleanup script from execution guide
  ```sql
  DELETE FROM auth.users WHERE email LIKE 'demo.%@alisa.com';
  DELETE FROM public.profiles WHERE is_demo = true;
  ```
- [ ] Verify: `SELECT COUNT(*) FROM public.profiles WHERE is_demo = true;`
- [ ] Expected: 0 (zero results)
- [ ] Check: No demo users remain in system

### Final Verification
- [ ] Verify: All production data intact
- [ ] Verify: No test data mixed in
- [ ] Verify: Database performance normal
- [ ] Verify: No orphaned auth records
- [ ] Backup: Archive testing reports

### Documentation & Handoff
- [ ] Archive: Testing reports
- [ ] Document: All issues found & resolutions
- [ ] Create: Post-testing summary report
- [ ] Distribute: Final report to stakeholders
- [ ] Close: Demo user project

---

## Troubleshooting During Execution

### If SQL Execution Fails
- [ ] Check: Supabase service status
- [ ] Check: Project access permissions
- [ ] Check: Network connectivity
- [ ] Retry: Execute script again
- [ ] Review: Error message carefully
- [ ] Check: Duplicate email handling (ON CONFLICT)

### If Login Fails
- [ ] Verify: Auth user created in auth tab
- [ ] Verify: Profile user created in profiles table
- [ ] Verify: Password entered correctly (case-sensitive)
- [ ] Verify: Email matches exactly
- [ ] Check: Supabase auth logs
- [ ] Check: Browser console for errors

### If RBAC Not Working
- [ ] Check: Role value in profiles table
- [ ] Review: src/lib/roles.ts configuration
- [ ] Verify: User role matches ALLOWED_ROLES
- [ ] Check: RLS policies in Supabase
- [ ] Verify: user-context.tsx implementation

### If Features Not Visible
- [ ] Check: User role has permission for feature
- [ ] Check: Feature gate implementation
- [ ] Review: DEMO_USER_TESTING_GUIDE for expected access
- [ ] Verify: No console errors blocking feature
- [ ] Check: Feature is implemented in v6.36

---

## Sign-Off & Completion

### Completion Checklist
- [ ] All 11 users created successfully
- [ ] All 11 users verified in database
- [ ] All 11 users can login
- [ ] RBAC working correctly for each role
- [ ] Testing completed for all roles
- [ ] All critical issues resolved
- [ ] Documentation complete
- [ ] Demo users cleaned up (if required)
- [ ] Production data verified safe
- [ ] Go-live readiness confirmed

### Final Approval
- [ ] Testing Lead: Approves all testing complete
- [ ] Project Manager: Approves readiness for go-live
- [ ] Technical Lead: Confirms system stability
- [ ] Operations: Confirms cleanup complete

### Sign-Off
- **Status**: ✅ COMPLETE & READY FOR GO-LIVE
- **Date Completed**: [Date]
- **Time Taken**: [Total time]
- **Issues Found**: [Number]
- **Issues Resolved**: [Number]
- **Next Step**: Go-live deployment

---

## Quick Reference

### Key Dates
- **Setup Day**: 18 June 2026 (9:00-9:30)
- **Testing Phase 1**: 18 June 2026 (9:30-17:00)
- **Testing Phase 2**: 19 June 2026 (9:00-17:00)
- **Final Verification**: 20 June 2026 (9:00-17:00)
- **Cleanup**: After all testing

### Key Resources
- SQL Script: `SQL_DEMO_USERS_EXECUTE_NOW.sql`
- Execution Guide: `DEMO_USERS_CREATION_EXECUTION_GUIDE.md`
- Testing Guide: `DEMO_USER_TESTING_GUIDE_v6.36.md`
- Credentials: `DEMO_ACCOUNTS_CREDENTIALS.txt`

### Key Contacts
- User Email: joyus818@gmail.com
- Support: Check files in /AVIVA-ONE directory

### Success Metrics
- All 11 demo users created: ✓
- All users tested: ✓
- RBAC verified working: ✓
- No critical issues: ✓
- Go-live ready: ✓

---

**Checklist Version**: AVIVA ONE v6.36  
**Created**: 18 June 2026  
**Status**: READY FOR EXECUTION

