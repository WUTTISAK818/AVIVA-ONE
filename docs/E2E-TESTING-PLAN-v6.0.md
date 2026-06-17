# AVIVA ONE — End-to-End Testing Plan v6.0
**สถานะ:** กำลังทำการทดสอบ  
**วันที่:** 2026-06-17  
**ผู้ดำเนินการ:** Claude Code / E2E Agent  

---

## 📋 Test Scope

### Workflow Types ที่ต้องทดสอบ
1. **Material_Purchase** (ฝ่ายก่อสร้าง) — ขอจัดซื้อ
2. **Installment_Review** (ฝ่ายก่อสร้าง) — ตรวจสอบงวดงาน
3. **Finance_Approval** (ฝ่ายการเงิน) — ขอเบิกจ่าย
4. **Document_Approval** (ทั่วไป) — อนุมัติเอกสาร
5. **Leave_Request** (ฝ่ายบุคคล) — ขอลา
6. **Warranty_Claim** (ฝ่ายหลังการขาย) — เคลมประกัน
7. **Lead_Followup** (ฝ่ายขาย) — ติดตามลูกค้า
8. **Booking_Deposit** (ฝ่ายขาย) — เงินจอง
9. **Contract_Approval** (ฝ่ายขาย) — ปิดการขาย

### Departments ที่ทดสอบ
- [ ] ฝ่ายก่อสร้าง (Construction)
- [ ] ฝ่ายขาย (Sales/CRM)
- [ ] ฝ่ายการเงิน (Finance)
- [ ] ฝ่ายบัญชี (Accounting)
- [ ] ฝ่ายบุคคล (HR)
- [ ] ฝ่ายหลังการขาย (After-sales)
- [ ] ฝ่ายการตลาด (Marketing)

---

## ✅ Test Execution Checklist

### Phase 1: Basic Flow (Create → Submit → Approve → Complete)

#### Test 1.1: Material Purchase Workflow
**Department:** ฝ่ายก่อสร้าง (Construction)  
**Workflow Type:** Material_Purchase  

**Pre-conditions:**
- [ ] ผู้ใช้ที่เป็น ก่อสร้าง/manager logged in
- [ ] มี PO template พร้อม
- [ ] Manager account พร้อม approve

**Test Steps:**

| # | Step | Expected Result | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | เข้า Construction → สร้าง PO ใหม่ | Form เปิด, ว่างเปล่า | ☐ PASS ☐ FAIL | |
| 2 | กรอก PO details (supplier, items, amount) | Form accept ข้อมูล | ☐ PASS ☐ FAIL | |
| 3 | กดปุ่ม "ส่งขออนุมัติ" | Modal confirm เปิด | ☐ PASS ☐ FAIL | Modal ทำงาน? |
| 4 | ยืนยันการส่ง | PO บันทึกลงฐานข้อมูล | ☐ PASS ☐ FAIL | Check DB: purchase_orders |
| 5 | ตรวจ approval_logs | Record ถูกสร้าง status=Pending | ☐ PASS ☐ FAIL | Check status + assigned role |
| 6 | ตรวจ work_queue | Task ปรากฏให้ manager | ☐ PASS ☐ FAIL | Check inbox badge count |
| 7 | ตรวจ notification | Alert ส่งไปให้ manager | ☐ PASS ☐ FAIL | Check notifications table |
| 8 | Login as Manager | เข้า /approvals | ☐ PASS ☐ FAIL | |
| 9 | เห็น PO ใน list | รายการ Material_Purchase อยู่ | ☐ PASS ☐ FAIL | Status = Pending? |
| 10 | กด "ตรวจสอบ & อนุมัติ" | Modal เปิด + แสดง details | ☐ PASS ☐ FAIL | Modal checklist ว่างเปล่าหรือไม่? |
| 11 | ติ๊ก checklist items | Checkbox updated | ☐ PASS ☐ FAIL | state.checked updated? |
| 12 | กดปุ่ม "อนุมัติ" | Modal ปิด + list refresh | ☐ PASS ☐ FAIL | **CRITICAL: Modal must close** |
| 13 | ตรวจ approval_logs | Status = Approved | ☐ PASS ☐ FAIL | approver_email filled? |
| 14 | ตรวจ work_queue | Task closed (status != open) | ☐ PASS ☐ FAIL | |
| 15 | ตรวจ notification | Approve notification sent | ☐ PASS ☐ FAIL | To: ฝ่ายก่อสร้าง |

**Issues Found:** (จะอัปเดตหลัง run)
- 
---

#### Test 1.2: Installment Review Workflow
**Department:** ฝ่ายก่อสร้าง (Construction)  
**Workflow Type:** Installment_Review  

| # | Step | Expected Result | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | เข้า Construction → ตั้งงวดงาน | Form เปิด | ☐ PASS ☐ FAIL | |
| 2 | กรอก installment details | Accept input | ☐ PASS ☐ FAIL | |
| 3 | กดปุ่ม "ส่งรายงาน" | ส่งคำขอสำเร็จ | ☐ PASS ☐ FAIL | |
| 4 | ตรวจ contractor_installments | Record created + status=in_review | ☐ PASS ☐ FAIL | |
| 5 | ตรวจ approval_logs | Entry ถูกสร้าง | ☐ PASS ☐ FAIL | workflow_type=Installment_Review |
| 6 | ตรวจ work_queue | Task อยู่ assigned_role=manager | ☐ PASS ☐ FAIL | |
| 7 | Manager: เข้า /approvals | เห็นงวดงาน | ☐ PASS ☐ FAIL | |
| 8 | ตรวจสอบ & อนุมัติ | Modal แสดง checklist | ☐ PASS ☐ FAIL | |
| 9 | ติ๊ก + อนุมัติ | Status = Approved | ☐ PASS ☐ FAIL | |
| 10 | ตรวจ contractor_installments | Status = approved | ☐ PASS ☐ FAIL | |
| 11 | ตรวจ JV entries | JV auto-posted (Dr CASH/Cr AP)? | ☐ PASS ☐ FAIL | Check jv_entries + jv_lines |

**Issues Found:**
- 

---

#### Test 1.3: Finance Approval Workflow
**Department:** ฝ่ายการเงิน (Finance)  
**Workflow Type:** Finance_Approval  

| # | Step | Expected Result | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | สร้าง Finance request | Form accept | ☐ PASS ☐ FAIL | |
| 2 | ส่งขออนุมัติ | approval_logs + work_queue ถูกสร้าง | ☐ PASS ☐ FAIL | |
| 3 | Manager: ตรวจสอบ & อนุมัติ | Modal close + list refresh | ☐ PASS ☐ FAIL | |
| 4 | ตรวจ status cascade | approvals.status updated | ☐ PASS ☐ FAIL | |
| 5 | ตรวจ notification | Sent to Finance dept | ☐ PASS ☐ FAIL | |

**Issues Found:**
- 

---

#### Test 1.4: Document Approval Workflow
**Department:** ทั่วไป  
**Workflow Type:** Document_Approval  

| # | Step | Expected Result | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | Upload document | File ขึ้นระบบ | ☐ PASS ☐ FAIL | |
| 2 | ส่งอนุมัติ | work_queue created | ☐ PASS ☐ FAIL | |
| 3 | Manager: approve | documents.status = approved | ☐ PASS ☐ FAIL | |

**Issues Found:**
- 

---

#### Test 1.5: Leave Request Workflow
**Department:** ฝ่ายบุคคล (HR) / ฝ่ายจัดการ  
**Workflow Type:** Leave_Request  

| # | Step | Expected Result | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | ยื่นขอลา | leave_requests created | ☐ PASS ☐ FAIL | |
| 2 | ตรวจ work_queue | Task อยู่ for manager/HR | ☐ PASS ☐ FAIL | |
| 3 | Manager: approve | leave_requests.status = approved | ☐ PASS ☐ FAIL | |

**Issues Found:**
- 

---

#### Test 1.6: Warranty Claim Workflow
**Department:** ฝ่ายหลังการขาย (After-sales)  
**Workflow Type:** Warranty_Claim  

| # | Step | Expected Result | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | ยื่นเคลม | warranty_claims created | ☐ PASS ☐ FAIL | |
| 2 | ตรวจ work_queue | Task for manager | ☐ PASS ☐ FAIL | |
| 3 | Manager: approve | status = approved/resolved | ☐ PASS ☐ FAIL | |

**Issues Found:**
- 

---

#### Test 1.7: Lead Followup Workflow
**Department:** ฝ่ายขาย (Sales)  
**Workflow Type:** Lead_Followup  

| # | Step | Expected Result | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | สร้าง Lead ใน CRM | leads table entry | ☐ PASS ☐ FAIL | |
| 2 | ตรวจ work_queue | Lead_Followup task ถูกสร้าง | ☐ PASS ☐ FAIL | assigned_role = sales_ai |
| 3 | Salesperson: เข้า /inbox | เห็น Lead_Followup | ☐ PASS ☐ FAIL | Inbox badge +1 |
| 4 | กดงาน → ไปยัง /crm?lead=<id> | Scroll + highlight lead card | ☐ PASS ☐ FAIL | **useFocusHighlight ทำงาน?** |
| 5 | ติดตาม/update lead | leads.status updated | ☐ PASS ☐ FAIL | |
| 6 | ตรวจ work_queue | Task closed | ☐ PASS ☐ FAIL | |

**Issues Found:**
- 

---

#### Test 1.8: Booking Deposit Workflow
**Department:** ฝ่ายขาย (Sales)  
**Workflow Type:** Booking_Deposit  

| # | Step | Expected Result | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | บันทึกเงินจอง | finance_transactions + JV | ☐ PASS ☐ FAIL | status = booking_deposit |
| 2 | ตรวจ work_queue | work_queue entry created | ☐ PASS ☐ FAIL | |
| 3 | Manager: approve | JV posted | ☐ PASS ☐ FAIL | Dr BANK / Cr CUSTOMER_ADVANCE |

**Issues Found:**
- 

---

#### Test 1.9: Contract Approval (Close Sale) Workflow
**Department:** ฝ่ายขาย (Sales)  
**Workflow Type:** Contract_Approval  

| # | Step | Expected Result | Status | Notes |
|---|------|-----------------|--------|-------|
| 1 | ส่งคำขอปิดการขาย | approval_logs created | ☐ PASS ☐ FAIL | |
| 2 | ตรวจ work_queue | Task for manager | ☐ PASS ☐ FAIL | |
| 3 | Manager: approve | leads.status = Closed Deal | ☐ PASS ☐ FAIL | finalizeSale() triggered |
| 4 | ตรวจ finance_transactions | Receipt ลง GL | ☐ PASS ☐ FAIL | JV auto-posted |
| 5 | ตรวจ houses table | sold_units updated | ☐ PASS ☐ FAIL | status = sold |

**Issues Found:**
- 

---

### Phase 2: Edge Cases & Error Scenarios

#### Test 2.1: Modal State Reset
- [ ] เปิด Modal → ส่ง approve → Modal ปิด ✓
- [ ] เปิด Modal ใหม่ (รายการต่างกัน) → Checklist reset? 
- [ ] Reject → textarea ว่าง?
- [ ] Comment state persist? (should NOT)

#### Test 2.2: Notifications
- [ ] Alert ส่งให้ผู้ที่เกี่ยวข้อง? (role-based)
- [ ] ทุกแผนก ได้ notification?
- [ ] Multiple approvers: ชั้นที่ 2 ได้ alert?

#### Test 2.3: Data Cascade
- [ ] การเปลี่ยน approval_log status → ทำให้ source table update?
  - [ ] purchase_orders.status
  - [ ] contractor_installments.status
  - [ ] leave_requests.status
  - [ ] leads.status
  - [ ] warranty_claims.status
- [ ] JV auto-post? (Installment/Booking)
- [ ] work_queue close automatically?

#### Test 2.4: Inbox Deep-Linking
- [ ] Material_Purchase → /construction?focus=<id>
- [ ] Lead → /crm?lead=<id> (**fixed v6.0**)
- [ ] ทุก link focus highlight ทำงาน?

#### Test 2.5: Rejection Flow
- [ ] Manager ปฏิเสธ + comment
- [ ] rejection_comment saved?
- [ ] Status back to Pending?
- [ ] ส่ง notification กลับ?

---

### Phase 3: Cross-Department Integration

#### Test 3.1: Construction → Finance Flow
- [ ] Installment approve → Finance ได้ alert?
- [ ] Finance ยืนยันจ่ายเงิน → work_queue ปิด?

#### Test 3.2: Sales → Accounting Flow
- [ ] Close Deal → Accounting ได้ receipt?
- [ ] ลงรายได้ลง GL? (REVENUE account)

#### Test 3.3: Multi-Approver Workflow
- [ ] Approve Level 1 → ส่งต่อ Level 2?
- [ ] Level 2 ได้ alert?
- [ ] Final approval → ปิด work_queue?

---

## 📊 Test Summary (Will be updated after agent runs)

**Total Test Cases:** TBD  
**Passed:** TBD  
**Failed:** TBD  
**Critical Issues:** TBD  
**Warnings:** TBD  

---

## 🔴 Critical Issues Log

(Will populate after testing)

| Issue # | Workflow | Severity | Description | Status |
|---------|----------|----------|-------------|--------|
| | | | | |

---

## 📝 Recommendations

(Will populate based on findings)

- 
- 
- 

---

**Test Plan Version:** 1.0  
**Status:** In Progress 🔄  
**Last Updated:** 2026-06-17 14:00 UTC+7
