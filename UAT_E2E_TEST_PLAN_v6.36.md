# AVIVA ONE v6.36 — Comprehensive UAT & E2E Test Plan
**Status**: 🔄 ACTIVE TESTING  
**Date Started**: 18 มิ.ย. 2569, 21:30 น. (UTC+7)  
**Target Completion**: 22 มิ.ย. 2569  
**Go-Live Date**: 25 มิ.ย. 2569

---

## 📊 16+ TESTING STANDARDS (Complete Framework)

### **SECTION A: BUSINESS ENVIRONMENT & DATA (4 Standards)**

#### **Standard 1: Test Environment & Data Setup**
**Objective**: ตั้งค่าสภาพแวดล้อมและข้อมูลทดสอบให้พร้อมสำหรับการทดสอบ

**Test Cases**:
- [ ] **1.1** Staging environment accessible (http://localhost:3000)
- [ ] **1.2** Database connection verified (Supabase live)
- [ ] **1.3** Test data fixtures created:
  - [ ] 6 test user accounts (all roles)
  - [ ] 50 test CRM leads
  - [ ] 10 test houses (with customers)
  - [ ] 30 test work reports
  - [ ] 20 test approvals
  - [ ] 50 test defects
  - [ ] 100 test work items
- [ ] **1.4** Mock third-party APIs (LINE, email) ready
- [ ] **1.5** Test data marked with `is_test = true` flag

**Expected Results**:
```
✅ All test data created successfully
✅ Total test records: ~260 items
✅ All marked with is_test = true for easy cleanup
```

**Status**: 🔄 IN PROGRESS

---

#### **Standard 2: User Roles & Access Credentials**
**Objective**: เตรียมบัญชีผู้ใช้งานครบทั้ง 6 บทบาท

**User Accounts to Create**:
```
1. test.ceo@alisa.com (CEO)
   ├─ Full access all modules
   ├─ Can approve all
   └─ Credentials: ***test***

2. test.coo@alisa.com (COO)
   ├─ Full access all modules
   ├─ Can approve all
   └─ Credentials: ***test***

3. test.sales1@alisa.com (Sales - Faa)
   ├─ CRM: Edit own leads
   ├─ Construction: Read-only
   └─ Credentials: ***test***

4. test.sales2@alisa.com (Sales - Dearr)
   ├─ CRM: Edit own leads
   ├─ Construction: Read-only
   └─ Credentials: ***test***

5. test.engineer@alisa.com (Engineer - Pete)
   ├─ Construction: Full access
   ├─ CRM: Read-only
   └─ Credentials: ***test***

6. test.finance@alisa.com (Finance - New)
   ├─ Finance: Edit approvals
   ├─ Construction: Read-only
   └─ Credentials: ***test***
```

**Test Cases**:
- [ ] **2.1** All 6 test user accounts created successfully
- [ ] **2.2** Email confirmations sent (or skipped in staging)
- [ ] **2.3** Role assignments correct (verified in auth.users)
- [ ] **2.4** Credentials stored securely
- [ ] **2.5** Access tokens can be generated for each user

**Expected Results**:
```
✅ 6 test users created
✅ All roles assigned correctly
✅ Credentials functional
```

**Status**: 🔄 PENDING CREATION

---

#### **Standard 3: Cross-Device & Cross-Browser Compatibility**
**Objective**: ตรวจสอบการทำงานบนอุปกรณ์และเบราว์เซอร์หลากหลาย

**Devices & Browsers to Test**:
```
Desktop:
  ✓ Chrome 120+
  ✓ Firefox 121+
  ✓ Safari 17+
  ✓ Edge 120+

Tablet:
  ⏳ iPad (12.9")
  ⏳ iPad Pro
  ⏳ Android Tablet

Mobile:
  ⏳ iPhone SE (375px)
  ⏳ iPhone 14 Pro (390px)
  ⏳ Android (360px)
```

**Test Cases**:
- [ ] **3.1** Login form renders on all devices
- [ ] **3.2** Bottom navigation visible on mobile
- [ ] **3.3** Dashboard cards responsive
- [ ] **3.4** Forms input accessible on mobile keyboard
- [ ] **3.5** Images load and scale correctly

**Expected Results**:
```
✅ All devices: No layout breaks
✅ All browsers: No console errors
✅ Mobile: Touch-friendly UI
```

**Status**: 🔄 PENDING

---

#### **Standard 4: Data Integrity & Database Verification**
**Objective**: ตรวจสอบความถูกต้องของข้อมูลและเชื่อมโยง

**Test Cases**:
- [ ] **4.1** Production data preserved:
  - [ ] 31 houses intact
  - [ ] 134 CRM leads intact
  - [ ] Pete's 2 reports intact
- [ ] **4.2** Test data properly inserted:
  - [ ] Count = 260+ records
  - [ ] All marked `is_test = true`
- [ ] **4.3** Foreign key relationships intact
- [ ] **4.4** No orphaned records found
- [ ] **4.5** RLS policies enforce correctly

**Expected Results**:
```
✅ Production data: 100% intact
✅ Test data: 260+ records
✅ Referential integrity: OK
```

**Status**: 🔄 PENDING

---

### **SECTION B: CORE BUSINESS PROCESSES (4 Standards)**

#### **Standard 5: CRM Journey (Happy Path)**
**Objective**: ทดสอบการไหลของข้อมูล CRM แบบปกติ

**E2E Flow**:
```
Login as Sales → Create Lead → Assign Plot → Create Booking → Record Payment
```

**Test Cases**:
- [ ] **5.1** Login as test.sales1@alisa.com
  - [ ] Email: test.sales1@alisa.com
  - [ ] Password: ***test***
  - [ ] Expected: Dashboard loads
  
- [ ] **5.2** Navigate to CRM
  - [ ] Click "ขาย" in bottom nav
  - [ ] Expected: Lead list displays
  
- [ ] **5.3** Create new lead
  - [ ] Click "+ เพิ่มลีด"
  - [ ] Fill form:
    ```
    ชื่อลูกค้า: "TEST-Lead-001"
    เบอร์โทร: "0812345678"
    ที่มาจาก: "Website"
    อีเมล: "test.lead@test.com"
    สถานะ: "Interested"
    ```
  - [ ] Expected: Lead created, appears in list
  
- [ ] **5.4** Edit lead with new fields
  - [ ] Add visit_date: "2026-06-20"
  - [ ] Add visit_time: "14:30"
  - [ ] Add reported_by: "test.sales1@alisa.com"
  - [ ] Expected: Fields saved correctly
  
- [ ] **5.5** Assign to house plot
  - [ ] Select plot_number: "1" (AVA A01)
  - [ ] Expected: Lead linked to house
  
- [ ] **5.6** Convert to booking
  - [ ] Change status to "Booking"
  - [ ] Create contract
  - [ ] Expected: Lead now shows as booking
  
- [ ] **5.7** Record payment
  - [ ] Enter payment amount
  - [ ] Record receipt
  - [ ] Expected: Payment logged

**Database Assertions**:
```sql
-- Verify lead created
SELECT COUNT(*) FROM leads WHERE customer_name LIKE 'TEST-Lead%' AND is_test = true;
-- Expected: 1+

-- Verify all fields populated
SELECT plot_number, visit_date, visit_time, reported_by FROM leads 
WHERE customer_name = 'TEST-Lead-001' AND is_test = true;
-- Expected: (1, 2026-06-20, 14:30, test.sales1@alisa.com)
```

**Expected Results**:
```
✅ Lead created and saved
✅ All custom fields present
✅ Lead → House link working
✅ Status changes recorded
✅ Database entries clean
```

**Status**: 🔄 PENDING

---

#### **Standard 6: Construction Journey (Happy Path)**
**Objective**: ทดสอบการไหลของข้อมูลก่อสร้าง

**E2E Flow**:
```
Login as Engineer → Create Work Report → Submit for QC → Approve Installment
```

**Test Cases**:
- [ ] **6.1** Login as test.engineer@alisa.com
  
- [ ] **6.2** Navigate to Construction
  - [ ] Click "ก่อสร้าง" in bottom nav
  - [ ] Expected: House list shows 31 + test houses
  
- [ ] **6.3** Create daily work report
  - [ ] Select test house
  - [ ] Fill report:
    ```
    วันที่: Today
    ประเภทงาน: "งานตรวจสอบ"
    รายละเอียด: "TEST-Report-001"
    ความคืบหน้า: "50%"
    ปัญหา: "ไม่มี"
    ```
  - [ ] Expected: Report created
  
- [ ] **6.4** Upload photo
  - [ ] Attach test image
  - [ ] Expected: Photo compressed + stored
  
- [ ] **6.5** Report defect
  - [ ] Create defect on house
  - [ ] Fill details:
    ```
    ประเภท: "งานทั่วไป"
    รายละเอียด: "TEST-Defect-001"
    ระดับความรุนแรง: "high"
    ```
  - [ ] Expected: Defect logged
  
- [ ] **6.6** Approve installment
  - [ ] View installment stage
  - [ ] Click "ส่งตรวจสอบ"
  - [ ] As CEO, approve
  - [ ] Expected: Workflow progresses

**Database Assertions**:
```sql
-- Verify report created
SELECT COUNT(*) FROM work_reports WHERE work_detail LIKE 'TEST-Report%' AND is_test = true;
-- Expected: 1+

-- Verify defect created
SELECT COUNT(*) FROM qc_defects WHERE description LIKE 'TEST-Defect%' AND is_test = true;
-- Expected: 1+
```

**Expected Results**:
```
✅ Work report created
✅ Photo uploaded and compressed
✅ Defect tracked
✅ Installment approved
✅ All database entries logged
```

**Status**: 🔄 PENDING

---

#### **Standard 7: Finance Approval Journey (Happy Path)**
**Objective**: ทดสอบการไหลของการอนุมัติทางการเงิน

**E2E Flow**:
```
Sales Submit → Finance Review → CEO Approve → Record Payment
```

**Test Cases**:
- [ ] **7.1** Login as test.sales1@alisa.com
  - [ ] Navigate to CRM
  - [ ] Create lead (from Standard 5)
  - [ ] Assign to house plot
  
- [ ] **7.2** Submit for approval
  - [ ] Enter payment details
  - [ ] Click "ส่งเพื่ออนุมัติ"
  - [ ] Expected: Request appears in approval queue
  
- [ ] **7.3** Finance reviews
  - [ ] Login as test.finance@alisa.com
  - [ ] View approval queue
  - [ ] Verify details
  - [ ] Status: "In Review"
  
- [ ] **7.4** CEO approves
  - [ ] Login as test.ceo@alisa.com
  - [ ] View "อนุมัติ" queue
  - [ ] Click "อนุมัติ"
  - [ ] Expected: Status → "Approved"
  
- [ ] **7.5** Record payment
  - [ ] Mark as "จ่ายแล้ว"
  - [ ] Enter receipt #
  - [ ] Expected: Payment logged

**Database Assertions**:
```sql
-- Verify approval log
SELECT COUNT(*) FROM approval_logs WHERE action_taken = 'approved' 
AND created_at > NOW() - INTERVAL 1 HOUR AND is_test_flag = true;
-- Expected: 1+

-- Verify payment recorded
SELECT status FROM contractor_installments WHERE is_test = true ORDER BY created_at DESC LIMIT 1;
-- Expected: "paid"
```

**Expected Results**:
```
✅ Approval request created
✅ Finance can review
✅ CEO can approve
✅ Payment recorded
✅ Audit trail logged
```

**Status**: 🔄 PENDING

---

#### **Standard 8: Cross-Functional Journey (Alternative Path)**
**Objective**: ทดสอบการไหลข้ามสายงาน (CRM → Construction → Finance)

**E2E Flow**:
```
CRM creates booking → Construction tracks progress → Finance approves payment → Delivery
```

**Test Cases**:
- [ ] **8.1** CRM creates lead + booking (as per Standard 5)
  
- [ ] **8.2** Construction tracks on same house
  - [ ] Login as test.engineer@alisa.com
  - [ ] View house from CRM
  - [ ] Create work report on same house
  - [ ] Expected: Customer info visible
  
- [ ] **8.3** Construction submits for payment
  - [ ] Mark installment complete
  - [ ] Submit for approval
  - [ ] Expected: Appears in finance queue
  
- [ ] **8.4** Finance approves
  - [ ] Review with customer info
  - [ ] Approve payment
  - [ ] Expected: All details consistent
  
- [ ] **8.5** Verify data consistency
  - [ ] Same customer in CRM
  - [ ] Same house in Construction
  - [ ] Same amount in Finance
  - [ ] Expected: All sync properly

**Database Assertions**:
```sql
-- Verify same customer linked across modules
SELECT 
  l.customer_name as crm_customer,
  h.id as house_id,
  ci.amount as finance_amount
FROM leads l
JOIN houses h ON l.plot_number = h.plot_number
JOIN contractor_installments ci ON ci.house_id = h.id
WHERE l.is_test = true AND h.is_test = true
LIMIT 1;
```

**Expected Results**:
```
✅ Customer data consistent
✅ House linked correctly
✅ Payment amount matches
✅ No data duplication
✅ Status flow correct
```

**Status**: 🔄 PENDING

---

### **SECTION C: DATA INTEGRITY & INTEGRATION (3 Standards)**

#### **Standard 9: CRUD Operations & Data Consistency**
**Objective**: ตรวจสอบการสร้าง อ่าน อัปเดต ลบข้อมูล

**Test Cases - CREATE**:
- [ ] **9.1** Create CRM lead
  - [ ] Verify inserted into DB
  - [ ] All fields populated
  - [ ] Timestamp recorded
  
- [ ] **9.2** Create construction report
  - [ ] Image attachment stored
  - [ ] Photo compressed
  - [ ] URL signed correctly
  
- [ ] **9.3** Create approval request
  - [ ] Logged to approval_logs
  - [ ] SLA calculated
  - [ ] Notified correctly

**Test Cases - READ**:
- [ ] **9.4** Fetch all leads (134+ test leads)
  - [ ] Pagination works (50 per page)
  - [ ] Filters work (status, source, etc.)
  - [ ] Search works (name, phone)
  
- [ ] **9.5** Fetch houses (31+ test houses)
  - [ ] Progress calculated correctly
  - [ ] Customer linked shows
  - [ ] Status shows correct
  
- [ ] **9.6** Fetch work reports (30+ test reports)
  - [ ] Photos load with signed URLs
  - [ ] Newest first (ordering)
  - [ ] By engineer filter works

**Test Cases - UPDATE**:
- [ ] **9.7** Update lead status
  - [ ] DB updated
  - [ ] Related approvals created
  - [ ] Audit logged
  
- [ ] **9.8** Update house progress
  - [ ] Progress % updates
  - [ ] Status changes (if auto)
  - [ ] History recorded
  
- [ ] **9.9** Update approval status
  - [ ] Status flow: pending → approved → paid
  - [ ] Only allowed users can update
  - [ ] Timestamps updated

**Test Cases - DELETE**:
- [ ] **9.10** Delete test CRM lead
  - [ ] Related records cascade delete (or soft delete)
  - [ ] No orphaned data
  - [ ] Audit trail preserved
  
- [ ] **9.11** Delete test work report
  - [ ] Associated photos cleaned
  - [ ] No broken references
  - [ ] Soft delete: marked deleted_at
  
- [ ] **9.12** Attempt delete on production data
  - [ ] Should fail or warn
  - [ ] Protection enforced

**Database Assertions**:
```sql
-- Count test records
SELECT table_name, COUNT(*) as count FROM (
  SELECT 'leads' as table_name FROM leads WHERE is_test = true
  UNION ALL SELECT 'houses' FROM houses WHERE is_test = true
  UNION ALL SELECT 'work_reports' FROM work_reports WHERE is_test = true
) GROUP BY table_name;

-- Check for orphaned records
SELECT * FROM contractor_installments ci 
WHERE NOT EXISTS (SELECT 1 FROM houses h WHERE h.id = ci.house_id)
AND ci.is_test = true;
-- Expected: 0 rows
```

**Expected Results**:
```
✅ All CRUD operations work
✅ Data consistency maintained
✅ No orphaned records
✅ Audit trails preserved
✅ Cascade operations correct
```

**Status**: 🔄 PENDING

---

#### **Standard 10: API & Backend Integration**
**Objective**: ตรวจสอบ API endpoints และ backend logic

**Test Cases - API Endpoints**:
- [ ] **10.1** POST /api/crm/leads
  - [ ] Request: Valid lead data
  - [ ] Response: 201 Created + lead object
  - [ ] DB: Record inserted
  
- [ ] **10.2** GET /api/crm/leads
  - [ ] Query: ?status=Interested
  - [ ] Response: 200 OK + filtered list
  - [ ] Performance: <500ms
  
- [ ] **10.3** PATCH /api/crm/leads/:id
  - [ ] Update fields
  - [ ] Response: 200 OK + updated object
  - [ ] DB: Changes persisted
  
- [ ] **10.4** DELETE /api/crm/leads/:id
  - [ ] Response: 200 OK or 204 No Content
  - [ ] DB: Record deleted/marked
  
- [ ] **10.5** POST /api/construction/reports
  - [ ] Upload photo
  - [ ] Response: 201 Created
  - [ ] Storage: File stored + compressed
  
- [ ] **10.6** POST /api/approvals/submit
  - [ ] Create approval request
  - [ ] Response: 201 Created
  - [ ] Notifications: Sent to CEO/COO

**Test Cases - RLS Policies**:
- [ ] **10.7** Anonymous user cannot read construction_logs
  - [ ] Query without auth
  - [ ] Response: 401 Unauthorized
  
- [ ] **10.8** Sales user cannot read finance approvals
  - [ ] Login as sales
  - [ ] Query approvals
  - [ ] Response: 403 Forbidden
  
- [ ] **10.9** Engineer cannot approve payments
  - [ ] Query contractor_installments
  - [ ] Can read, not write to status
  - [ ] Response: 403 on update

**Test Cases - Edge Functions**:
- [ ] **10.10** Edge function: Calculate SLA
  - [ ] Input: defect severity
  - [ ] Output: due_date calculated
  - [ ] Verify: Correct formula
  
- [ ] **10.11** Edge function: Generate document number
  - [ ] Input: document type, timestamp
  - [ ] Output: Unique doc number
  - [ ] Format: Correct pattern

**Test Cases - Error Handling**:
- [ ] **10.12** Invalid data submitted
  - [ ] Request: Missing required fields
  - [ ] Response: 400 Bad Request + error message
  
- [ ] **10.13** Duplicate submission
  - [ ] Submit same lead twice quickly
  - [ ] Response: 409 Conflict (or deduplicated)
  
- [ ] **10.14** Database error
  - [ ] Simulate DB unavailable
  - [ ] Response: 503 Service Unavailable + fallback

**Test Cases - Real-time Sync**:
- [ ] **10.15** Approval notification sent
  - [ ] Create approval request
  - [ ] Check approval_logs table
  - [ ] Verify push notification triggered
  
- [ ] **10.16** Real-time data sync
  - [ ] User 1: Update lead status
  - [ ] User 2: Refresh page
  - [ ] Expected: Latest status shows immediately

**API Testing Tools**:
```bash
curl -X POST http://localhost:3000/api/crm/leads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"TEST","phone":"0812345678","is_test":true}'
```

**Expected Results**:
```
✅ All endpoints respond correctly
✅ RLS policies enforce access
✅ Edge functions execute properly
✅ Error handling graceful
✅ Real-time features work
```

**Status**: 🔄 PENDING

---

#### **Standard 11: Role-Based Access Control (RBAC)**
**Objective**: ตรวจสอบสิทธิ์ของแต่ละบทบาท

**Access Matrix**:
```
             | Dashboard | CRM | Construction | Finance | Settings | Admin
CEO/COO      | ✓ Full    | ✓   | ✓           | ✓       | ✓        | ✓
Sales        | ✓ Own     | ✓   | ✗           | ✗       | ✗        | ✗
Engineer     | ✓ Own     | ✗   | ✓           | ✗       | ✗        | ✗
Finance      | ✓ Own     | ✓   | ✗           | ✓       | ✗        | ✗
```

**Test Cases**:
- [ ] **11.1** CEO can access all modules
  - [ ] Login as test.ceo@alisa.com
  - [ ] Navigate to each tab
  - [ ] Expected: All accessible
  
- [ ] **11.2** Sales cannot access Construction
  - [ ] Login as test.sales1@alisa.com
  - [ ] Try to access Construction
  - [ ] Expected: 403 Forbidden or hidden
  
- [ ] **11.3** Engineer cannot approve Finance
  - [ ] Login as test.engineer@alisa.com
  - [ ] View approval queue
  - [ ] Try to approve
  - [ ] Expected: Cannot save
  
- [ ] **11.4** Sales can only see own leads
  - [ ] Login as test.sales1@alisa.com
  - [ ] View lead list
  - [ ] Expected: Only own leads + CEO's (shared)
  
- [ ] **11.5** CEO can see all leads
  - [ ] Login as test.ceo@alisa.com
  - [ ] View lead list
  - [ ] Expected: All 134+ leads visible
  
- [ ] **11.6** Finance can approve but not reject (if restricted)
  - [ ] Login as test.finance@alisa.com
  - [ ] Try to reject
  - [ ] Expected: Only CEO/COO can reject

**Database Assertions**:
```sql
-- Verify role in auth.users
SELECT email, raw_user_meta_data->>'role' FROM auth.users 
WHERE email LIKE 'test.%@alisa.com';

-- Verify RLS policy enforces
-- (Manual test: Query with each user's JWT)
```

**Expected Results**:
```
✅ CEO/COO access all
✅ Sales limited to own
✅ Engineer limited to construction
✅ Finance limited to approvals
✅ No privilege escalation
```

**Status**: 🔄 PENDING

---

### **SECTION D: PERFORMANCE, SECURITY & UX (3 Standards)**

#### **Standard 12: Performance Monitoring & Baselines**
**Objective**: วัดความเร็วและประสิทธิภาพ

**Metrics to Measure**:

**Page Load Times**:
- [ ] **12.1** Login page
  - [ ] First load: <1000ms
  - [ ] Repeat load: <500ms (cached)
  
- [ ] **12.2** Dashboard
  - [ ] First load: <2000ms
  - [ ] After auth: <1500ms
  
- [ ] **12.3** CRM list (134+ leads)
  - [ ] Initial load: <2000ms
  - [ ] With filters: <1000ms
  
- [ ] **12.4** Construction list (31+ houses)
  - [ ] Initial load: <1500ms
  - [ ] Select house: <1000ms

**API Response Times**:
- [ ] **12.5** GET /api/crm/leads
  - [ ] Response: <300ms
  - [ ] With 50 records
  
- [ ] **12.6** GET /api/construction/houses
  - [ ] Response: <300ms
  
- [ ] **12.7** POST /api/crm/leads (create)
  - [ ] Response: <500ms
  
- [ ] **12.8** POST /api/approvals/submit
  - [ ] Response: <500ms

**Database Query Times**:
- [ ] **12.9** Count all leads
  - [ ] Query: <100ms
  
- [ ] **12.10** Join leads + houses
  - [ ] Query: <300ms
  
- [ ] **12.11** Get approval queue
  - [ ] Query: <200ms

**Photo Compression**:
- [ ] **12.12** Upload photo (5MB original)
  - [ ] Compression: <3MB
  - [ ] Time: <2s
  
- [ ] **12.13** Load photo in list
  - [ ] Thumbnail: <200ms
  - [ ] Full: <500ms

**Testing Method**:
```javascript
// Browser DevTools - Performance
console.time('CRM-List');
  // ... navigate and load
console.timeEnd('CRM-List');

// Server logging
console.log(`API Response: ${Date.now() - startTime}ms`);
```

**Expected Results**:
```
✅ Page loads: <2s
✅ API response: <500ms
✅ DB queries: <1s
✅ No memory leaks
✅ No slow endpoints
```

**Baseline Targets**:
```
Login:         500ms  (target: <1s)
Dashboard:    1500ms  (target: <2s)
CRM List:     2000ms  (target: <2s)
Construction: 1500ms  (target: <2s)
API Calls:     300ms  (target: <500ms)
```

**Status**: 🔄 PENDING

---

#### **Standard 13: Security & Compliance Testing**
**Objective**: ตรวจสอบความปลอดภัยและ compliance

**Authentication Security**:
- [ ] **13.1** Passwords not logged
  - [ ] Check server logs
  - [ ] No plaintext passwords
  
- [ ] **13.2** JWT tokens expire correctly
  - [ ] Token issued with expiration
  - [ ] Expired token rejected (401)
  
- [ ] **13.3** HTTPS enforced (or localhost)
  - [ ] All requests over HTTPS
  - [ ] No mixed content
  
- [ ] **13.4** CORS configured properly
  - [ ] Only allowed origins
  - [ ] Credentials handled

**Authorization Security**:
- [ ] **13.5** No privilege escalation
  - [ ] Sales cannot become Admin
  - [ ] Request denied with 403
  
- [ ] **13.6** Role-based filtering
  - [ ] Leads filtered by user
  - [ ] Houses filtered by access
  
- [ ] **13.7** Session security
  - [ ] Logout clears session
  - [ ] Cannot reuse expired token

**Data Protection**:
- [ ] **13.8** SQL Injection prevention
  - [ ] Input: `"; DROP TABLE leads;--`
  - [ ] Result: Safe (parameterized query)
  
- [ ] **13.9** XSS prevention
  - [ ] Input: `<script>alert('xss')</script>`
  - [ ] Result: Escaped in HTML
  
- [ ] **13.10** PII masking
  - [ ] Phone number: masked for non-admin
  - [ ] Email: not exposed in logs
  
- [ ] **13.11** File upload validation
  - [ ] Only images allowed
  - [ ] File size limit enforced
  - [ ] Malicious files rejected

**Audit Trail & Compliance**:
- [ ] **13.12** All actions logged
  - [ ] approval_logs immutable
  - [ ] workflow_events captured
  - [ ] User + timestamp recorded
  
- [ ] **13.13** Data retention
  - [ ] Logs kept for 1 year
  - [ ] Backups available
  
- [ ] **13.14** No test data in logs
  - [ ] Production logs clean
  - [ ] Test data marked clearly

**Expected Results**:
```
✅ No SQL injections
✅ No XSS vulnerabilities
✅ PII protected
✅ Audit trail complete
✅ GDPR compliant
```

**Security Tools**:
```bash
# Check headers
curl -I http://localhost:3000/login | grep -i "content-type\|cache"

# Test SQL injection
curl "http://localhost:3000/api/crm/leads?name=test%27;DROP%20TABLE--"

# Check XSS
echo '<img src=x onerror="alert(1)">' > /tmp/xss.html
```

**Status**: 🔄 PENDING

---

#### **Standard 14: User Experience & Error Handling**
**Objective**: ตรวจสอบประสบการณ์ผู้ใช้งานและการแสดงข้อความ error

**Form Validation**:
- [ ] **14.1** Required fields marked
  - [ ] Asterisk (*) shown
  - [ ] Cannot submit without
  
- [ ] **14.2** Error messages shown
  - [ ] Clear Thai language
  - [ ] Specific to error type
  
- [ ] **14.3** Email validation
  - [ ] Input: "invalid-email"
  - [ ] Error: "กรุณากรอกอีเมลให้ถูกต้อง"
  
- [ ] **14.4** Phone number format
  - [ ] Input: "123"
  - [ ] Error: "เบอร์โทรต้องมีอย่างน้อย 10 หลัก"

**Success Feedback**:
- [ ] **14.5** Form submission success
  - [ ] Toast message: "บันทึกสำเร็จ"
  - [ ] Auto-dismiss after 3s
  
- [ ] **14.6** Action confirmation
  - [ ] Delete: Confirm dialog
  - [ ] Approve: Summary before confirm
  
- [ ] **14.7** Loading states
  - [ ] Button shows "กำลังบันทึก..."
  - [ ] Spinner visible
  - [ ] Cannot click twice

**Error Recovery**:
- [ ] **14.8** Network error
  - [ ] Message: "เกิดข้อผิดพลาดในการเชื่อมต่อ"
  - [ ] Retry button visible
  
- [ ] **14.9** Validation error
  - [ ] Highlight invalid field
  - [ ] Focus on first error
  
- [ ] **14.10** Server error
  - [ ] Message: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์"
  - [ ] Contact admin info

**UI Responsiveness**:
- [ ] **14.11** Mobile form layout
  - [ ] Labels above inputs
  - [ ] Buttons full width
  - [ ] Touch-friendly size (44px)
  
- [ ] **14.12** Accessibility
  - [ ] Tab navigation works
  - [ ] Labels linked to inputs
  - [ ] Color contrast WCAG AA
  
- [ ] **14.13** Dark mode (if applicable)
  - [ ] All elements visible
  - [ ] Color scheme consistent
  
- [ ] **14.14** Language & localization
  - [ ] Thai date format
  - [ ] Time format 24h
  - [ ] Currency format (฿)

**Expected Results**:
```
✅ All validation messages clear
✅ Error recovery possible
✅ Mobile-friendly UI
✅ Accessible to all users
✅ Professional appearance
```

**Status**: 🔄 PENDING

---

### **SECTION E: ADVANCED TESTING (2 New Standards)**

#### **Standard 15: Edge Cases & Exception Handling**
**Objective**: ทดสอบสถานการณ์พิเศษและกรณีขอบ

**Duplicate Prevention**:
- [ ] **15.1** Double-click submit
  - [ ] Create lead twice quickly
  - [ ] Expected: Only 1 record created
  
- [ ] **15.2** Multiple tabs open
  - [ ] Tab 1: Edit lead A
  - [ ] Tab 2: Edit same lead
  - [ ] Tab 1: Save
  - [ ] Tab 2: Save
  - [ ] Expected: Conflict handled

**Refresh & Navigation**:
- [ ] **15.3** Refresh mid-form
  - [ ] Form data cleared
  - [ ] Or saved temporarily
  
- [ ] **15.4** Back button after submit
  - [ ] Back doesn't resubmit
  - [ ] Shows confirmation if unsaved
  
- [ ] **15.5** Deep linking
  - [ ] URL: /crm/lead/123
  - [ ] Direct access works

**Boundary Conditions**:
- [ ] **15.6** Very long input
  - [ ] Name: 1000 characters
  - [ ] Expected: Truncated or error
  
- [ ] **15.7** Special characters
  - [ ] Input: "L'Admin ñoño"
  - [ ] Expected: Saved correctly (no SQL injection)
  
- [ ] **15.8** Unicode/Emoji
  - [ ] Input: "🏠 Test ไทย"
  - [ ] Expected: Displayed correctly
  
- [ ] **15.9** Null/empty values
  - [ ] Optional field: leave empty
  - [ ] Expected: No error, NULL in DB
  
- [ ] **15.10** Very large data set
  - [ ] Load 1000+ leads
  - [ ] Expected: Pagination works

**Network Issues**:
- [ ] **15.11** Slow network
  - [ ] Simulate 3G speed
  - [ ] Expected: Show loader, eventual success
  
- [ ] **15.12** Timeout during upload
  - [ ] Upload large file
  - [ ] Disconnect mid-upload
  - [ ] Expected: Error + retry option
  
- [ ] **15.13** Offline mode
  - [ ] Go offline
  - [ ] Try to access new route
  - [ ] Expected: Offline message

**Concurrent Operations**:
- [ ] **15.14** Two users edit same record
  - [ ] User A: Fetch lead
  - [ ] User B: Fetch same lead
  - [ ] User A: Update + save
  - [ ] User B: Update + save
  - [ ] Expected: Last-write-wins or conflict
  
- [ ] **15.15** Approval by multiple users
  - [ ] CEO starts approval
  - [ ] COO completes approval
  - [ ] Expected: No double-approval

**Expected Results**:
```
✅ Duplicates prevented
✅ Network issues handled
✅ Concurrent operations safe
✅ Edge cases graceful
✅ No data corruption
```

**Status**: 🔄 PENDING

---

#### **Standard 16: Automated Cleanup & Data Migration**
**Objective**: ทดสอบขั้นตอนการล้างข้อมูลและการย้ายข้อมูล

**Pre-Cleanup Verification**:
- [ ] **16.1** Count test data
  - [ ] Leads: Should be 50+ test
  - [ ] Houses: Should be 10+ test
  - [ ] Reports: Should be 30+ test
  
- [ ] **16.2** Backup test data
  - [ ] Export to CSV/JSON
  - [ ] Store for reference
  
- [ ] **16.3** Verify production data untouched
  - [ ] Leads: Still 134
  - [ ] Houses: Still 31
  - [ ] Pete reports: Still 2

**Cleanup Script Testing**:
- [ ] **16.4** Run cleanup script
  - [ ] DELETE all records WHERE is_test = true
  - [ ] Expected: 260+ records removed
  
- [ ] **16.5** Verify cleanup
  - [ ] Count leads: Should be 134 (only production)
  - [ ] Count houses: Should be 31
  - [ ] Query test data: Should return 0

**Data Integrity After Cleanup**:
- [ ] **16.6** No orphaned records
  - [ ] Foreign keys still valid
  - [ ] Referential integrity OK
  
- [ ] **16.7** Audit trail preserved
  - [ ] approval_logs still has history
  - [ ] workflow_events preserved
  
- [ ] **16.8** System functions normally
  - [ ] Login works
  - [ ] Dashboard loads
  - [ ] CRM accessible

**Cleanup Automation**:
```bash
# Cleanup script
#!/bin/bash
echo "🗑️ Cleanup test data..."

# Count before
echo "Before cleanup:"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \
  "SELECT COUNT(*) FROM leads WHERE is_test = true;"

# Cleanup
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \
  "DELETE FROM leads WHERE is_test = true;
   DELETE FROM houses WHERE is_test = true;
   DELETE FROM work_reports WHERE is_test = true;
   -- ... more deletes"

# Verify
echo "After cleanup:"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \
  "SELECT COUNT(*) FROM leads WHERE is_test = true;"

echo "✅ Cleanup complete!"
```

**Expected Results**:
```
✅ All test data removed
✅ Production data intact
✅ System operational
✅ No errors during cleanup
✅ Ready for go-live
```

**Status**: 🔄 PENDING

---

### **SECTION F: ADDITIONAL STANDARDS (Custom for AVIVA ONE)**

#### **Standard 17: Real-Time Notifications & Push**
**Objective**: ทดสอบระบบแจ้งเตือนแบบ real-time

**Test Cases**:
- [ ] **17.1** Push notification on approval
  - [ ] Submit approval request
  - [ ] CEO receives push (device/browser)
  - [ ] Notification clickable
  
- [ ] **17.2** Duplicate notification prevention
  - [ ] Submit approval
  - [ ] Refresh page
  - [ ] Should show only once
  
- [ ] **17.3** LINE notification (if enabled)
  - [ ] Approval submitted
  - [ ] CEO receives LINE message
  - [ ] Link in message works
  
- [ ] **17.4** Real-time data sync
  - [ ] User 1 updates lead
  - [ ] User 2 viewing same lead
  - [ ] User 2 sees update without refresh

**Expected Results**:
```
✅ Notifications delivered
✅ No duplicates
✅ Links work correctly
✅ Real-time sync works
```

**Status**: 🔄 PENDING

---

#### **Standard 18: Report Generation & Export**
**Objective**: ทดสอบการสร้างรายงานและ export

**Test Cases**:
- [ ] **18.1** Generate daily work report (PDF)
  - [ ] Select date range
  - [ ] Click export
  - [ ] PDF downloads correctly
  
- [ ] **18.2** Export CRM leads (Excel)
  - [ ] Filter: Status = Interested
  - [ ] Export as XLSX
  - [ ] File opens correctly
  
- [ ] **18.3** Print certificate of completion
  - [ ] Select installment
  - [ ] Click print
  - [ ] PDF looks professional
  
- [ ] **18.4** Generate approval audit trail
  - [ ] Show all approvals
  - [ ] Signatures/timestamps
  - [ ] Compliance format

**Expected Results**:
```
✅ Reports generate correctly
✅ Files export without errors
✅ Formatting looks professional
✅ Data accurate in exports
```

**Status**: 🔄 PENDING

---

## 🎯 TEST EXECUTION TIMELINE

```
Phase 1: Setup (18 มิ.ย.)
├─ Standard 1-2: Environment & Users
├─ Create test fixtures
└─ Status: 🔄 IN PROGRESS

Phase 2: Core Flows (19-20 มิ.ย.)
├─ Standard 5-8: E2E Journeys
├─ Test CRM, Construction, Finance
└─ Status: ⏳ PENDING

Phase 3: Data & Integration (21 มิ.ย.)
├─ Standard 9-11: CRUD, API, RBAC
└─ Status: ⏳ PENDING

Phase 4: Performance & Security (22 มิ.ย.)
├─ Standard 12-14: Performance, Security, UX
└─ Status: ⏳ PENDING

Phase 5: Advanced & Cleanup (23 มิ.ย.)
├─ Standard 15-18: Edge Cases, Reports
├─ Standard 16: Verify cleanup ready
└─ Status: ⏳ PENDING

Go-Live (25 มิ.ย.)
└─ Execute cleanup → Deploy production
```

---

## 📊 TEST MATRIX SUMMARY

| Standard # | Category | Name | Status | Priority |
|-----------|----------|------|--------|----------|
| 1 | Environment | Test Setup | 🔄 | ⭐⭐⭐ |
| 2 | Users | User Roles | 🔄 | ⭐⭐⭐ |
| 3 | Compatibility | Cross-Device | ⏳ | ⭐⭐ |
| 4 | Data | DB Verification | ⏳ | ⭐⭐⭐ |
| 5 | E2E | CRM Journey | ⏳ | ⭐⭐⭐ |
| 6 | E2E | Construction Journey | ⏳ | ⭐⭐⭐ |
| 7 | E2E | Finance Journey | ⏳ | ⭐⭐⭐ |
| 8 | E2E | Cross-Functional | ⏳ | ⭐⭐ |
| 9 | Data | CRUD Operations | ⏳ | ⭐⭐⭐ |
| 10 | Integration | API & Backend | ⏳ | ⭐⭐⭐ |
| 11 | Security | RBAC | ⏳ | ⭐⭐⭐ |
| 12 | Performance | Baselines | ⏳ | ⭐⭐ |
| 13 | Security | Security Testing | ⏳ | ⭐⭐⭐ |
| 14 | UX | Error Handling | ⏳ | ⭐⭐ |
| 15 | Advanced | Edge Cases | ⏳ | ⭐⭐ |
| 16 | Cleanup | Automation | ⏳ | ⭐⭐⭐ |
| 17 | Advanced | Notifications | ⏳ | ⭐⭐ |
| 18 | Advanced | Reports | ⏳ | ⭐ |

---

## 📝 NOTES

- **Test Data**: All marked with `is_test = true` for easy cleanup
- **Production Data**: Protected and verified before/after testing
- **Cleanup**: Can be automated with SQL scripts
- **Timeline**: 5 days before go-live (18-22 มิ.ย.)

---

**Document Version**: v1.0  
**Last Updated**: 18 มิ.ย. 2569, 21:45 น.  
**Next Update**: After Phase 1 completion

