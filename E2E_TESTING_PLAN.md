# แผนทดสอบ End-to-End (E2E) สำหรับระบบอนุมัติและเวิร์กโฟลว์ AVIVA ONE
**เวอร์ชัน:** 1.0  
**วันที่สร้าง:** 17 มิถุนายน 2569  
**ประเทศ:** ประเทศไทย (เวลา UTC+7)

---

## 📋 สารบัญ
1. [สรุปการทดสอบ](#สรุปการทดสอบ)
2. [ภูมิหลังเทคนิค](#ภูมิหลังเทคนิค)
3. [เวิร์กโฟลว์ที่ทดสอบ](#เวิร์กโฟลว์ที่ทดสอบ)
4. [กรณีทดสอบแยกตามเวิร์กโฟลว์](#กรณีทดสอบแยกตามเวิร์กโฟลว์)
5. [ประเด็นสำคัญและจุดเสี่ยง](#ประเด็นสำคัญและจุดเสี่ยง)
6. [คำแนะนำ](#คำแนะนำ)

---

## สรุปการทดสอบ

### ชนิดเวิร์กโฟลว์ทั้งหมด: 8 ประเภท
| # | เวิร์กโฟลว์ | ฝ่าย | สถานะ | หมายเหตุ |
|---|-----------|------|------|---------|
| 1 | **Installment_Review** | ฝ่ายก่อสร้าง | ✓ ใช้งานแล้ว | ตรวจสอบงวดงาน ก่อนจ่าย |
| 2 | **Material_Purchase** | ฝ่ายก่อสร้าง | ✓ ใช้งานแล้ว | ขออนุมัติจัดซื้อวัสดุ |
| 3 | **Finance_Approval** | ฝ่ายการเงิน | ✓ ใช้งานแล้ว | ขออนุมัติรายจ่ายทั่วไป |
| 4 | **Leave_Request** | ฝ่ายบุคคล (HR) | ✓ ใช้งานแล้ว | ขออนุมัติการลา |
| 5 | **Document_Approval** | ฝ่ายออฟฟิศ | ✓ ใช้งานแล้ว | ขออนุมัติเอกสาร |
| 6 | **Booking_Deposit** | ฝ่ายขาย | ✓ ใช้งานแล้ว | อนุมัติเงินจองจากลูกค้า |
| 7 | **Contract_Approval** | ฝ่ายขาย | ✓ ใช้งานแล้ว | อนุมัติสัญญาซื้อขาย |
| 8 | **Purchase_Request** | ฝ่ายบริหาร | ✓ ใช้งานแล้ว | ขออนุมัติก่อนซื้อ (≥฿2,000) |

### ฝ่ายงานทั้งหมด: 7 ฝ่าย
- ✓ ฝ่ายก่อสร้าง (Construction)
- ✓ ฝ่ายขาย (Sales)
- ✓ ฝ่ายการเงิน (Finance)
- ✓ ฝ่ายบัญชี (Accounting)
- ✓ ฝ่ายบุคคล (HR)
- ✓ ฝ่ายหลังการขาย (After-sales)
- ✓ ฝ่ายการตลาด (Marketing)

### สรุปผลการทดสอบ
- **ทั้งหมด:** 8 เวิร์กโฟลว์
- **ข้อมูลสนับสนุน:** 
  - ตารางหลัก: `approval_logs`, `work_queue`, `workflow_events`
  - ตารางต้นทาง: `purchase_orders`, `purchase_requests`, `leave_requests`, `documents`, `contractor_installments`, `leads`, `warranty_claims`, `finance_transactions`

---

## ภูมิหลังเทคนิค

### สถาปัตยกรรมเวิร์กโฟลว์
```
[สร้างคำขอ] → [บันทึกลงตารางต้นทาง] → [สร้าง approval_logs] → [สร้าง work_queue] → [ส่งการแจ้งเตือน]
     ↓                                                                                   ↓
  ฟอร์มผู้ใช้                                                                    /inbox (manager)
     ↓                                                                                   ↓
 [ผู้บริหารดำเนินการ] → [อัปเดต approval_logs] → [ปิด work_queue] → [บันทึก workflow_events] → [แสดงผลในหน้า]
```

### ฐานข้อมูลหลัก
- **approval_logs:** บันทึกทั้งหมดสำหรับการขออนุมัติ (workflow_type, status, action_taken)
- **work_queue:** คิวงานแยกตามบทบาท (manager, finance, sales_ai, after_sales, etc.)
- **workflow_events:** timeline เหตุการณ์ (submitted, acknowledged, approved, rejected)

### ระดับการอนุมัติ (SLA Days)
```
Installment_Review: 2 วัน
Finance_Approval: 3 วัน
Material_Purchase: 2 วัน
Document_Approval: 3 วัน
Leave_Request: 1 วัน
Contract_Approval: 5 วัน
Booking_Deposit: 2 วัน
Purchase_Request: 2 วัน (ส่วนที่ ≥ ฿2,000)
```

### เกณฑ์อนุมัติสองชั้น (Approval Threshold)
```
Finance_Approval:   ≤ ฿499,999 = manager  |  ≥ ฿500,000 = admin
Material_Purchase:  ≤ ฿50,000  = manager  |  > ฿50,000 = admin
อื่น ๆ: ไม่มีเกณฑ์ (อนุมัติชั้นเดียว)
```

---

## เวิร์กโฟลว์ที่ทดสอบ

### ภาพรวมการไหลของงาน

#### 1️⃣ **Installment_Review** (ตรวจสอบงวดงาน)
**ฝ่าย:** ฝ่ายก่อสร้าง  
**ผู้เริ่มต้น:** ผู้ก่อสร้าง (Contractor) / ผู้จัดการก่อสร้าง  
**ผู้อนุมัติ:** ผู้บริหาร (admin) / ผู้จัดการโครงการ

**ขั้นตอนการไหลของข้อมูล:**
```
Contractor ยื่นงวดงาน → contractor_installments (status: pending)
                    ↓
            อนุมัติงวดงาน (ผ่านหน้า /construction)
                    ↓
            approval_logs (action_taken: Approved/Rejected)
                    ↓
            work_queue (status: done)
                    ↓
            workflow_events (eventType: approved/rejected)
                    ↓
            contractor_installments (status: approved) → จ่ายเงิน → (status: paid)
                    ↓
            jv_entries (บันทึกใจหนึ่งจ่าย: เดบิต WIP, เครดิต BANK)
```

#### 2️⃣ **Material_Purchase** (จัดซื้อวัสดุ)
**ฝ่าย:** ฝ่ายก่อสร้าง  
**ผู้เริ่มต้น:** เจ้าหน้าที่ก่อสร้าง  
**ผู้อนุมัติ:** ผู้บริหาร (อัตราขึ้นอยู่กับจำนวนเงิน)

**ขั้นตอนการไหลของข้อมูล:**
```
บันทึกใบขอซื้อ (purchase_orders)
       ↓
approval_logs (action_taken: Pending) [ถ้า ≥ ฿50,001]
       ↓
work_queue → /inbox (manager)
       ↓
ผู้อนุมัติกดปุ่ม [อนุมัติ] / [ปฏิเสธ]
       ↓
approval_logs (action_taken: Approved/Rejected)
       ↓
purchase_orders (status: approved/rejected)
       ↓
workflow_events (eventType: approved/rejected)
```

#### 3️⃣ **Finance_Approval** (อนุมัติรายจ่าย)
**ฝ่าย:** ฝ่ายการเงิน  
**ผู้เริ่มต้น:** เจ้าหน้าที่การเงิน  
**ผู้อนุมัติ:** ผู้บริหาร (อัตราขึ้นอยู่กับจำนวนเงิน)

**ขั้นตอนการไหลของข้อมูล:**
```
สร้างบันทึกรายจ่าย (finance_transactions / approvals)
       ↓
approval_logs (action_taken: Pending)
       ↓
work_queue → /inbox (finance role)
       ↓
ผู้อนุมัติทำการตรวจสอบและอนุมัติ
       ↓
approval_logs (action_taken: Approved)
       ↓
workflow_events (eventType: approved)
       ↓
สถานะบันทึกรายจ่ายเป็น 'approved'
```

#### 4️⃣ **Leave_Request** (ขออนุมัติการลา)
**ฝ่าย:** ฝ่ายบุคคล (HR)  
**ผู้เริ่มต้น:** พนักงาน / ผู้บริหาร (ยื่นแทนพนักงาน)  
**ผู้อนุมัติ:** ผู้จัดการ / ผู้บริหาร

**ขั้นตอนการไหลของข้อมูล:**
```
พนักงานยื่นใบลา (leave_requests)
       ↓
approval_logs (action_taken: Pending)
       ↓
work_queue → /inbox (manager/hr role)
       ↓
ผู้อนุมัติกดปุ่ม [อนุมัติ] / [ปฏิเสธ]
       ↓
approval_logs (action_taken: Approved/Rejected)
       ↓
leave_requests (status: approved/rejected)
       ↓
workflow_events (eventType: approved/rejected)
       ↓
แจ้งเตือนพนักงาน (notification + push)
```

#### 5️⃣ **Document_Approval** (อนุมัติเอกสาร)
**ฝ่าย:** ฝ่ายออฟฟิศ  
**ผู้เริ่มต้น:** เจ้าหน้าที่สำนักงาน  
**ผู้อนุมัติ:** ผู้จัดการ / ผู้บริหาร

**ขั้นตอนการไหลของข้อมูล:**
```
บันทึกเอกสาร (documents)
       ↓
approval_logs (action_taken: Pending)
       ↓
work_queue → /inbox
       ↓
ผู้อนุมัติตรวจสอบและอนุมัติ
       ↓
approval_logs (action_taken: Approved/Rejected)
       ↓
workflow_events (eventType: approved/rejected)
```

#### 6️⃣ **Booking_Deposit** (อนุมัติเงินจอง)
**ฝ่าย:** ฝ่ายขาย  
**ผู้เริ่มต้น:** พนักงานขาย  
**ผู้อนุมัติ:** ผู้บริหาร / ผู้บริหารขาย

**ขั้นตอนการไหลของข้อมูล:**
```
ลูกค้าจองหน่วย (leads → booking_date + plot_number)
       ↓
approvals_logs (action_taken: Pending)
       ↓
work_queue → /inbox
       ↓
ผู้อนุมัติยืนยันและอนุมัติเงินจอง
       ↓
approval_logs (action_taken: Approved)
       ↓
leads (status: Booking, booking_date, booking_by)
       ↓
workflow_events (eventType: approved)
       ↓
ปิดคิวงาน + ส่งแจ้งเตือน
```

#### 7️⃣ **Contract_Approval** (อนุมัติสัญญา)
**ฝ่าย:** ฝ่ายขาย  
**ผู้เริ่มต้น:** พนักงานขาย / ผู้จัดการสัญญา  
**ผู้อนุมัติ:** ผู้บริหาร / ผู้บริหารขาย

**ขั้นตอนการไหลของข้อมูล:**
```
ลูกค้าลงนามสัญญา (leads → contract_signed_date)
       ↓
approval_logs (action_taken: Pending)
       ↓
work_queue → /inbox
       ↓
ผู้อนุมัติตรวจสอบเอกสารสัญญา
       ↓
approval_logs (action_taken: Approved/Rejected)
       ↓
leads (status: Contract, contract_signed_date)
       ↓
workflow_events (eventType: approved/rejected)
       ↓
ปิดคิวงาน + ส่งแจ้งเตือน
```

#### 8️⃣ **Purchase_Request** (ขออนุมัติก่อนซื้อ)
**ฝ่าย:** ฝ่ายบริหาร (Cross-Department)  
**ผู้เริ่มต้น:** พนักงานทั่วไป (ผ่าน Viva AI หรือฟอร์ม)  
**ผู้อนุมัติ:** ผู้บริหาร (ถ้า ≥ ฿2,000 เท่านั้น)

**ขั้นตอนการไหลของข้อมูล:**
```
สร้างคำขอซื้อ (purchase_requests)
       ↓
ตรวจสอบว่า amount ≥ ฿2,000?
       ├─ ใช่ → approval_logs (action_taken: Pending)
       │       ↓
       │   work_queue → /inbox
       │       ↓
       │   ผู้อนุมัติกดปุ่ม [อนุมัติ] / [ปฏิเสธ]
       │       ↓
       └──► purchase_requests (status: approved/rejected)
           ↓
           workflow_events (eventType: approved/rejected)
       └─ ไม่ → purchase_requests (status: approved) เดี๋ยว! (ต่ำกว่าเกณฑ์)
           approver = "ระบบ (ต่ำกว่าเกณฑ์)"
```

---

## กรณีทดสอบแยกตามเวิร์กโฟลว์

---

### 🔷 TEST CASE 1: Installment_Review (ตรวจสอบงวดงาน)

#### 📊 Pre-conditions
- **ผู้ใช้ที่ต้องการ:**
  - Contractor (ผู้รับเหมา) — บทบาท: contractor
  - Project Manager — บทบาท: manager / admin
- **ข้อมูลสำหรับการตั้งค่า:**
  - บ้านอย่างน้อย 1 หลัง (houses table)
  - ผู้รับเหมา 1 คน (contractors table หรือ contractor_ack_name)
  - Installment template ที่กำหนดไว้ (ในระบบ INSTALLMENT_NAMES)

#### ✅ Test Steps & Expected Results

| # | ขั้นตอน | ตัวอักษร | คาดหวัง | Actual | Status |
|----|---------|---------|--------|--------|--------|
| 1 | เข้าหน้า `/construction` | ผู้บริหาร | แสดงตาราบ้าน + section "งวดงานรอตรวจสอบ" | [ ] | [ ] |
| 2 | ค้นหาบ้าน (search house) | ผู้บริหาร | แสดงรายการบ้านที่มีงวดงาน pending | [ ] | [ ] |
| 3 | กดบ้านเพื่อดูรายละเอียดงวดงาน | ผู้บริหาร | เปิด modal/sidebar แสดงรายละเอียด งวดงาน (ชื่อ, จำนวนเงิน, ผู้รับเหมา) | [ ] | [ ] |
| 4 | แสดงผลการตรวจสอบ (Inspection) | ผู้บริหาร | แสดงรายการ work items ที่ต้องตรวจสอบ + สถานะ (pass/fail/pending) | [ ] | [ ] |
| 5 | กดปุ่ม "อนุมัติงวดงาน" | ผู้บริหาร | แสดงโมดัลยืนยัน + ฟอร์มเพิ่มเติม (WHT, retention, notes) | [ ] | [ ] |
| 6 | กรอกอัตรา WHT (ค่าหัก ณ ที่จ่าย) | ผู้บริหาร | ข้อมูลถูกบันทึก เช่น wht_rate = 3% | [ ] | [ ] |
| 7 | กรอกอัตรา Retention (ประกันผลงาน) | ผู้บริหาร | ข้อมูลถูกบันทึก เช่น retention_rate = 5% | [ ] | [ ] |
| 8 | กดปุ่ม "ยืนยันอนุมัติ" | ผู้บริหาร | โมดัลปิด ↓ (ดูขั้นตอน 9) | [ ] | [ ] |
| 9 | **ตรวจสอบ DB: approval_logs** | Admin | `action_taken = "Approved"` + `workflow_type = "Installment_Review"` | [ ] | [ ] |
| 10 | **ตรวจสอบ DB: contractor_installments** | Admin | `status = "approved"` + `contractor_ack_name` filled | [ ] | [ ] |
| 11 | **ตรวจสอบ DB: work_queue** | Admin | `status = "done"` + `done_by = [username]` + `done_at` is set | [ ] | [ ] |
| 12 | **ตรวจสอบ DB: workflow_events** | Admin | `eventType = "approved"` + `stageTo = "approved"` + `actor_name` = user | [ ] | [ ] |
| 13 | ตรวจสอบการแจ้งเตือน | ผู้บริหาร | Push notification ถูกส่ง (check `/api/push/send`) | [ ] | [ ] |
| 14 | เข้าหน้า `/inbox` | ผู้บริหาร | งวดงานที่อนุมัติแล้วหายจาก work_queue | [ ] | [ ] |
| 15 | กดเลื่อนไป "งานที่จ่ายแล้ว" | ผู้บริหาร | อนุมัติให้จ่ายเงินได้ (ปุ่ม "บันทึกจ่าย" ใช้งานได้) | [ ] | [ ] |
| 16 | กดปุ่ม "บันทึกจ่าย" | ผู้บริหาร | แสดงโมดัลกรอกรายละเอียดการจ่าย (วิธี, หมายเลขอ้างอิง, วันที่) | [ ] | [ ] |
| 17 | กรอกวิธีการจ่าย (payment_method) | ผู้บริหาร | เลือก "โอนเงิน" / "เช็ค" ฯลฯ | [ ] | [ ] |
| 18 | กรอกหมายเลขอ้างอิง (reference) | ผู้บริหาร | บันทึกหมายเลขโอนเงิน/เช็ค | [ ] | [ ] |
| 19 | กดปุ่ม "ยืนยันจ่าย" | ผู้บริหาร | โมดัลปิด ↓ (ดูขั้นตอน 20) | [ ] | [ ] |
| 20 | **ตรวจสอบ DB: contractor_installments** | Admin | `status = "paid"` + `paid_by` = user + `paid_at` is set | [ ] | [ ] |
| 21 | **ตรวจสอบ DB: jv_entries** | Admin | บันทึก JV: เดบิต WIP, เครดิต BANK + WHT_PAYABLE (ถ้า WHT > 0) + RETENTION_PAYABLE (ถ้า retention > 0) | [ ] | [ ] |
| 22 | **ตรวจสอบ DB: jv_lines** | Admin | 3-4 รายการตามอัตรา WHT/retention | [ ] | [ ] |
| 23 | ตรวจสอบการแจ้งเตือนความสำเร็จ | ผู้บริหาร | แสดง Toast success + ข้อมูลการจ่าย | [ ] | [ ] |

#### 🔴 Error Scenarios (กรณีค้นหาข้อผิดพลาด)

| # | สถานการณ์ | ตรวจสอบ | คาดหวัง | Status |
|----|-----------|---------|--------|--------|
| E1 | กด "ปฏิเสธงวดงาน" แทนการอนุมัติ | approval_logs | `action_taken = "Rejected"` + `notes` contains reason | [ ] |
| E2 | ปิดโมดัลการอนุมัติก่อนบันทึก (Cancel) | contractor_installments | `status` ยังคงเป็น "pending" ไม่เปลี่ยนแปลง | [ ] |
| E3 | อนุมัติงวดงานสองครั้ง (double-click) | work_queue | `work_queue.status = "done"` **ครั้งเดียว** เท่านั้น ไม่ duplicate | [ ] |
| E4 | อนุมัติแล้วแต่จ่ายช้า (ตรวจสอบ interim state) | contractor_installments | `status = "approved"` ยาวนาน แล้ว `status = "paid"` หลังจ่าย ✓ | [ ] |

---

### 🔷 TEST CASE 2: Material_Purchase (จัดซื้อวัสดุ)

#### 📊 Pre-conditions
- **ผู้ใช้ที่ต้องการ:**
  - Requester (ผู้ขอ) — บทบาท: staff / engineer
  - Approver (ผู้อนุมัติ) — บทบาท: manager / admin
- **ข้อมูลสำหรับการตั้งค่า:**
  - เกณฑ์อนุมัติ: amount ≥ ฿50,001 ต้องขออนุมัติ

#### ✅ Test Steps & Expected Results

| # | ขั้นตอน | ตัวอักษร | คาดหวัง | Actual | Status |
|----|---------|---------|--------|--------|--------|
| 1 | เข้าหน้า `/construction` | ผู้ขอซื้อ | แสดง section "สั่งซื้อวัสดุ" + ปุ่ม "เพิ่มใบซื้อ" | [ ] | [ ] |
| 2 | กดปุ่ม "เพิ่มใบซื้อ" | ผู้ขอซื้อ | เปิด modal สร้างใบซื้อ | [ ] | [ ] |
| 3 | กรอก Supplier (ชื่อผู้จำหน่าย) | ผู้ขอซื้อ | บันทึกชื่อผู้จำหน่าย | [ ] | [ ] |
| 4 | เพิ่ม Line Items (รายการซื้อ) | ผู้ขอซื้อ | แสดงตาราเพิ่มรายการ: ชื่อ, จำนวน, หน่วย, ราคา/หน่วย | [ ] | [ ] |
| 5 | กรอกรายการที่ 1: ชื่อสินค้า | ผู้ขอซื้อ | บันทึกชื่อสินค้า เช่น "ปูนซีเมนต์" | [ ] | [ ] |
| 6 | กรอกจำนวน (qty) | ผู้ขอซื้อ | บันทึกจำนวน เช่น 100 | [ ] | [ ] |
| 7 | เลือกหน่วย (unit) | ผู้ขอซื้อ | เลือกหน่วย เช่น "ถุง" | [ ] | [ ] |
| 8 | กรอกราคา/หน่วย | ผู้ขอซื้อ | บันทึกราคา เช่น 150 (บาท) | [ ] | [ ] |
| 9 | กดปุ่ม "บันทึก" (Save) | ผู้ขอซื้อ | รวมทั้งหมด (qty * unit_price) = 15,000 ฿ | [ ] | [ ] |
| 10 | **ตรวจสอบ DB: purchase_orders** | Admin | `status = "pending"` + `total_amount = 15000` | [ ] | [ ] |
| 11 | **ตรวจสอบ DB: work_queue** | Admin | `workflow_type = "Material_Purchase"` + `status = "open"` + `assigned_role = "manager"` | [ ] | [ ] |
| 12 | **ตรวจสอบ DB: approval_logs** | Admin | `workflow_type = "Material_Purchase"` + `action_taken = "Pending"` + `amount = 15000` | [ ] | [ ] |
| 13 | เข้าหน้า `/inbox` (ผู้อนุมัติ) | ผู้อนุมัติ | แสดงงาน "จัดซื้อวัสดุ" ในรายการ work_queue | [ ] | [ ] |
| 14 | กดคลิกงาน Material_Purchase | ผู้อนุมัติ | เปลี่ยนหน้าไปที่ `/construction?focus=[id]` + ไฮไลต์รายการใบซื้อ | [ ] | [ ] |
| 15 | ตรวจสอบรายละเอียดใบซื้อ | ผู้อนุมัติ | แสดงทั้งหมด: ชื่อผู้จำหน่าย, ราคารวม, ผู้ขอ, หมายเหตุ | [ ] | [ ] |
| 16 | กดปุ่ม "อนุมัติ" | ผู้อนุมัติ | แสดง modal ยืนยันการอนุมัติ | [ ] | [ ] |
| 17 | กรอก/เพิ่มหมายเหตุ (optional) | ผู้อนุมัติ | บันทึกหมายเหตุ | [ ] | [ ] |
| 18 | กดปุ่ม "ยืนยันอนุมัติ" | ผู้อนุมัติ | โมดัลปิด ↓ (ดูขั้นตอน 19) | [ ] | [ ] |
| 19 | **ตรวจสอบ DB: purchase_orders** | Admin | `status = "approved"` + `approved_by = [username]` + `approved_at` is set | [ ] | [ ] |
| 20 | **ตรวจสอบ DB: approval_logs** | Admin | `action_taken = "Approved"` + `approver_email` = user email | [ ] | [ ] |
| 21 | **ตรวจสอบ DB: work_queue** | Admin | `status = "done"` + `done_by = [username]` | [ ] | [ ] |
| 22 | **ตรวจสอบ DB: workflow_events** | Admin | `eventType = "approved"` + `actor_name = [username]` | [ ] | [ ] |
| 23 | ตรวจสอบการแจ้งเตือน | ผู้ขอซื้อ | แจ้งเตือนว่าใบซื้อได้รับการอนุมัติแล้ว | [ ] | [ ] |
| 24 | เข้าหน้า `/inbox` (ผู้อนุมัติ) | ผู้อนุมัติ | งาน Material_Purchase หายจาก work_queue | [ ] | [ ] |

#### 🔴 Error Scenarios

| # | สถานการณ์ | ตรวจสอบ | คาดหวัง | Status |
|----|-----------|---------|--------|--------|
| E1 | สร้างใบซื้อ < ฿50,000 | purchase_orders + work_queue | `status = "pending"` แต่ **ไม่มี** work_queue entry (ต่ำกว่าเกณฑ์) | [ ] |
| E2 | กด "ปฏิเสธ" | approval_logs | `action_taken = "Rejected"` + purchase_orders.status = "rejected" | [ ] |
| E3 | ปิดโมดัลการอนุมัติ (Cancel) | purchase_orders | `status` ยังเป็น "pending" ไม่เปลี่ยน | [ ] |
| E4 | สร้างใบซื้อโดยไม่กรอก Supplier | Modal | แสดง validation error: "กรุณาระบุชื่อผู้จำหน่าย" | [ ] |

---

### 🔷 TEST CASE 3: Finance_Approval (อนุมัติรายจ่าย)

#### 📊 Pre-conditions
- **ผู้ใช้ที่ต้องการ:**
  - Finance Staff — บทบาท: staff / finance
  - Finance Manager — บทบาท: manager / admin
- **เกณฑ์ (SLA):** 3 วัน

#### ✅ Test Steps & Expected Results

| # | ขั้นตอน | ตัวอักษร | คาดหวัง | Actual | Status |
|----|---------|---------|--------|--------|--------|
| 1 | เข้าหน้า `/office?tab=finance` | เจ้าหน้าที่การเงิน | แสดง KPI (รายรับ, รายจ่าย, กำไร) + ตารางรายการ | [ ] | [ ] |
| 2 | กดแท็บ "Approvals" | เจ้าหน้าที่การเงิน | เปลี่ยนไปแสดงตารางคำขออนุมัติรายจ่าย | [ ] | [ ] |
| 3 | กดปุ่ม "เพิ่มคำขอ" / "ขออนุมัติรายจ่าย" | เจ้าหน้าที่การเงิน | เปิด modal สร้างคำขอ | [ ] | [ ] |
| 4 | กรอก Description | เจ้าหน้าที่การเงิน | บันทึกรายละเอียด เช่น "ค่าทดสอบคอนกรีต" | [ ] | [ ] |
| 5 | กรอก Amount | เจ้าหน้าที่การเงิน | บันทึกจำนวนเงิน เช่น 250,000 ฿ | [ ] | [ ] |
| 6 | กดปุ่ม "บันทึก" | เจ้าหน้าที่การเงิน | โมดัลปิด ↓ (ดูขั้นตอน 7) | [ ] | [ ] |
| 7 | **ตรวจสอบ DB: approvals** | Admin | `module = "finance"` + `status = "pending"` + `amount = 250000` | [ ] | [ ] |
| 8 | **ตรวจสอบ DB: approval_logs** | Admin | `workflow_type = "Finance_Approval"` + `action_taken = "Pending"` + `current_approver_role = "manager"` | [ ] | [ ] |
| 9 | **ตรวจสอบ DB: work_queue** | Admin | `workflow_type = "Finance_Approval"` + `assigned_role = "finance"` + `status = "open"` (ถ้า amount > 500,000) หรือ `"manager"` (ถ้า ≤ 500,000) | [ ] | [ ] |
| 10 | เข้าหน้า `/approvals` (ผู้อนุมัติ) | ผู้บริหาร | แสดงรายการคำขออนุมัติทั้งหมด | [ ] | [ ] |
| 11 | ตรวจหา Finance_Approval record | ผู้บริหาร | ค้นหา workflow_type = "Finance_Approval" + amount = 250,000 | [ ] | [ ] |
| 12 | กดคลิกเพื่อดูรายละเอียด | ผู้บริหาร | แสดง modal ApprovalVerifyModal: ชื่อผู้ขออนุมัติ, ส่วน, เรื่อง, จำนวนเงิน | [ ] | [ ] |
| 13 | กดปุ่ม "อนุมัติ" | ผู้บริหาร | แสดง modal ยืนยัน | [ ] | [ ] |
| 14 | กดปุ่ม "ยืนยันอนุมัติ" | ผู้บริหาร | โมดัลปิด ↓ (ดูขั้นตอน 15) | [ ] | [ ] |
| 15 | **ตรวจสอบ DB: approval_logs** | Admin | `action_taken = "Approved"` + `approver_email = [user email]` + `action_timestamp` is set | [ ] | [ ] |
| 16 | **ตรวจสอบ DB: approvals** | Admin | `status = "approved"` | [ ] | [ ] |
| 17 | **ตรวจสอบ DB: work_queue** | Admin | `status = "done"` + `done_by = [username]` | [ ] | [ ] |
| 18 | **ตรวจสอบ DB: workflow_events** | Admin | `eventType = "approved"` + `actor_name = [username]` + `amount = 250000` | [ ] | [ ] |

#### 🔴 Error Scenarios

| # | สถานการณ์ | ตรวจสอบ | คาดหวัง | Status |
|----|-----------|---------|--------|--------|
| E1 | สร้างคำขอ amount ≥ ฿500,000 | approval_logs | `current_approver_role = "admin"` (ต้องอนุมัติชั้นสอง) | [ ] |
| E2 | กด "ปฏิเสธ" | approval_logs | `action_taken = "Rejected"` + approvals.status = "rejected" | [ ] |
| E3 | กรอก Amount = 0 หรือติดลบ | Modal | validation error: "กรุณาระบุจำนวนเงินที่ถูกต้อง" | [ ] |
| E4 | ปิดโมดัลการอนุมัติ (Cancel) | approvals | `status` ยังเป็น "pending" ไม่เปลี่ยน | [ ] |

---

### 🔷 TEST CASE 4: Leave_Request (ขออนุมัติการลา)

#### 📊 Pre-conditions
- **ผู้ใช้ที่ต้องการ:**
  - Employee (พนักงาน) — บทบาท: staff
  - HR Manager — บทบาท: manager / hr
  - Approver (Approving Manager) — บทบาท: manager / admin
- **เกณฑ์ (SLA):** 1 วัน
- **โควต้าวันลา:**
  - ลาป่วย: 30 วัน/ปี
  - ลากิจ: 3 วัน/ปี
  - ลาพักร้อน: 6 วัน/ปี

#### ✅ Test Steps & Expected Results

| # | ขั้นตอน | ตัวอักษร | คาดหวัง | Actual | Status |
|----|---------|---------|--------|--------|--------|
| 1 | เข้าหน้า `/office?tab=hr` | พนักงาน | แสดง section "ลาและวันหยุด" + ปุ่ม "ยื่นใบลาใหม่" | [ ] | [ ] |
| 2 | กดปุ่ม "ยื่นใบลาใหม่" | พนักงาน | เปิด modal สร้างใบลา | [ ] | [ ] |
| 3 | กรอกชื่อพนักงาน (auto-fill) | พนักงาน | บันทึกชื่อจากโปรไฟล์ผู้ใช้ | [ ] | [ ] |
| 4 | เลือกประเภทการลา | พนักงาน | เลือก "ลาป่วย" / "ลากิจ" / "ลาพักร้อน" / "ลาครอบครัว" / "ลาอื่นๆ" | [ ] | [ ] |
| 5 | กรอกวันที่เริ่ม (date_from) | พนักงาน | บันทึกวันเริ่มลา เช่น 2569-06-20 | [ ] | [ ] |
| 6 | กรอกวันที่สิ้นสุด (date_to) | พนักงาน | บันทึกวันสิ้นสุดลา เช่น 2569-06-22 | [ ] | [ ] |
| 7 | ระบบคำนวณจำนวนวัน | พนักงาน | แสดง "รวม 3 วัน" | [ ] | [ ] |
| 8 | กรอกเหตุผล (reason) | พนักงาน | บันทึกเหตุผลการลา เช่น "เป็น" | [ ] | [ ] |
| 9 | กดปุ่ม "ยื่นขอลา" | พนักงาน | โมดัลปิด ↓ (ดูขั้นตอน 10) | [ ] | [ ] |
| 10 | **ตรวจสอบ DB: leave_requests** | Admin | `employee_name = [name]` + `leave_type = "ลาป่วย"` + `date_from = "2569-06-20"` + `date_to = "2569-06-22"` + `days_count = 3` + `status = "pending"` | [ ] | [ ] |
| 11 | **ตรวจสอบ DB: approval_logs** | Admin | `workflow_type = "Leave_Request"` + `action_taken = "Pending"` + `source_record_id = [leave_id]` | [ ] | [ ] |
| 12 | **ตรวจสอบ DB: work_queue** | Admin | `workflow_type = "Leave_Request"` + `assigned_role = "manager"` + `status = "open"` | [ ] | [ ] |
| 13 | ตรวจสอบการแจ้งเตือน | ผู้บริหาร | แจ้งเตือนว่ามีใบลาใหม่รอตรวจสอบ | [ ] | [ ] |
| 14 | เข้าหน้า `/inbox` (ผู้อนุมัติ) | ผู้อนุมัติ | แสดงงาน Leave_Request ในรายการ | [ ] | [ ] |
| 15 | กดคลิกงาน Leave_Request | ผู้อนุมัติ | เปลี่ยนหน้าไปที่ `/office?tab=hr&focus=[id]` + ไฮไลต์ใบลา | [ ] | [ ] |
| 16 | ตรวจสอบรายละเอียดใบลา | ผู้อนุมัติ | แสดง: ชื่อพนักงาน, ประเภท, วันที่, จำนวนวัน, เหตุผล | [ ] | [ ] |
| 17 | กดปุ่ม "อนุมัติ" | ผู้อนุมัติ | แสดง modal ยืนยัน | [ ] | [ ] |
| 18 | กดปุ่ม "ยืนยันอนุมัติ" | ผู้อนุมัติ | โมดัลปิด ↓ (ดูขั้นตอน 19) | [ ] | [ ] |
| 19 | **ตรวจสอบ DB: leave_requests** | Admin | `status = "approved"` | [ ] | [ ] |
| 20 | **ตรวจสอบ DB: approval_logs** | Admin | `action_taken = "Approved"` + `approver_email = [user email]` | [ ] | [ ] |
| 21 | **ตรวจสอบ DB: work_queue** | Admin | `status = "done"` + `done_by = [username]` | [ ] | [ ] |
| 22 | **ตรวจสอบ DB: workflow_events** | Admin | `eventType = "approved"` + `actor_name = [username]` | [ ] | [ ] |
| 23 | ตรวจสอบการแจ้งเตือนสำเร็จ | พนักงาน | แจ้งเตือนว่าใบลาได้รับการอนุมัติแล้ว | [ ] | [ ] |

#### 🔴 Error Scenarios

| # | สถานการณ์ | ตรวจสอบ | คาดหวัง | Status |
|----|-----------|---------|--------|--------|
| E1 | ยื่นใบลาช่วงเดียวกัน (overlap) | Modal | Validation error: "มีคำขอลาในช่วงนี้แล้ว..." | [ ] |
| E2 | กรอก date_from > date_to | Modal | Validation error: "วันเริ่มต้นต้องก่อนวันสิ้นสุด" | [ ] |
| E3 | กด "ปฏิเสธ" | approval_logs | `action_taken = "Rejected"` + leave_requests.status = "rejected" | [ ] |
| E4 | ปิดโมดัลการอนุมัติ (Cancel) | leave_requests | `status` ยังเป็น "pending" ไม่เปลี่ยน | [ ] |
| E5 | ยื่นลาเกิน quota | leave_requests | ⚠️ ระบบบันทึกได้ แต่อาจมี warning (ปัจจุบันไม่ block) | [ ] |

---

### 🔷 TEST CASE 5: Document_Approval (อนุมัติเอกสาร)

#### 📊 Pre-conditions
- **ผู้ใช้ที่ต้องการ:**
  - Office Staff — บทบาท: staff
  - Document Manager — บทบาท: manager / admin
- **เกณฑ์ (SLA):** 3 วัน

#### ✅ Test Steps & Expected Results

| # | ขั้นตอน | ตัวอักษร | คาดหวัง | Actual | Status |
|----|---------|---------|--------|--------|--------|
| 1 | เข้าหน้า `/office?tab=documents` | เจ้าหน้าที่สำนักงาน | แสดง section "เอกสาร" + ตารางเอกสารที่รออนุมัติ | [ ] | [ ] |
| 2 | กดปุ่ม "เพิ่มเอกสารใหม่" | เจ้าหน้าที่สำนักงาน | เปิด modal สร้างเอกสาร | [ ] | [ ] |
| 3 | กรอกชื่อเอกสาร (title) | เจ้าหน้าที่สำนักงาน | บันทึกชื่อ เช่น "ใบอนุญาต" | [ ] | [ ] |
| 4 | กรอกประเภทเอกสาร (type) | เจ้าหน้าที่สำนักงาน | เลือก "สัญญา" / "ใบอนุญาต" / "ใบรับรอง" / "อื่นๆ" | [ ] | [ ] |
| 5 | อัพโหลดไฟล์เอกสาร (attachment) | เจ้าหน้าที่สำนักงาน | เลือกไฟล์ PDF/Word/Image | [ ] | [ ] |
| 6 | กรอกรายละเอียด (description) | เจ้าหน้าที่สำนักงาน | บันทึกรายละเอียด | [ ] | [ ] |
| 7 | กดปุ่ม "ส่งอนุมัติ" | เจ้าหน้าที่สำนักงาน | โมดัลปิด ↓ (ดูขั้นตอน 8) | [ ] | [ ] |
| 8 | **ตรวจสอบ DB: documents** | Admin | `status = "pending"` + `uploaded_by = [user]` + ไฟล์ถูกบันทึกใน storage | [ ] | [ ] |
| 9 | **ตรวจสอบ DB: approval_logs** | Admin | `workflow_type = "Document_Approval"` + `action_taken = "Pending"` | [ ] | [ ] |
| 10 | **ตรวจสอบ DB: work_queue** | Admin | `workflow_type = "Document_Approval"` + `assigned_role = "manager"` + `status = "open"` | [ ] | [ ] |
| 11 | เข้าหน้า `/approvals` (ผู้อนุมัติ) | ผู้บริหาร | แสดงรายการคำขออนุมัติทั้งหมด | [ ] | [ ] |
| 12 | ค้นหา Document_Approval record | ผู้บริหาร | แสดงเอกสารรอตรวจสอบ | [ ] | [ ] |
| 13 | กดคลิกเพื่อดูรายละเอียด | ผู้บริหาร | แสดง modal: ชื่อเอกสาร, ประเภท, ไฟล์ preview | [ ] | [ ] |
| 14 | ตรวจสอบไฟล์เอกสาร | ผู้บริหาร | สามารถดู preview ของไฟล์ได้ | [ ] | [ ] |
| 15 | กดปุ่ม "อนุมัติ" | ผู้บริหาร | แสดง modal ยืนยัน | [ ] | [ ] |
| 16 | กดปุ่ม "ยืนยันอนุมัติ" | ผู้บริหาร | โมดัลปิด ↓ (ดูขั้นตอน 17) | [ ] | [ ] |
| 17 | **ตรวจสอบ DB: documents** | Admin | `status = "approved"` | [ ] | [ ] |
| 18 | **ตรวจสอบ DB: approval_logs** | Admin | `action_taken = "Approved"` | [ ] | [ ] |
| 19 | **ตรวจสอบ DB: work_queue** | Admin | `status = "done"` + `done_by = [username]` | [ ] | [ ] |
| 20 | **ตรวจสอบ DB: workflow_events** | Admin | `eventType = "approved"` | [ ] | [ ] |

#### 🔴 Error Scenarios

| # | สถานการณ์ | ตรวจสอบ | คาดหวัง | Status |
|----|-----------|---------|--------|--------|
| E1 | กด "ปฏิเสธ" | approval_logs | `action_taken = "Rejected"` + documents.status = "rejected" | [ ] |
| E2 | อัพโหลดไฟล์ขนาดใหญ่ > 50MB | Modal | แสดง error: "ไฟล์ใหญ่เกินไป" | [ ] |
| E3 | อัพโหลดไฟล์ประเภทที่ไม่รองรับ | Modal | แสดง error: "ประเภทไฟล์ไม่รองรับ" | [ ] |

---

### 🔷 TEST CASE 6: Booking_Deposit (อนุมัติเงินจอง)

#### 📊 Pre-conditions
- **ผู้ใช้ที่ต้องการ:**
  - Sales Staff — บทบาท: staff / sales
  - Sales Manager — บทบาท: manager / admin
- **เกณฑ์ (SLA):** 2 วัน

#### ✅ Test Steps & Expected Results

| # | ขั้นตอน | ตัวอักษร | คาดหวัง | Actual | Status |
|----|---------|---------|--------|--------|--------|
| 1 | เข้าหน้า `/crm` | พนักงานขาย | แสดงตาราลีด + section "ลีดรอจองหน่วย" | [ ] | [ ] |
| 2 | เลือกลีดที่ต้องการจองหน่วย | พนักงานขาย | โหลดรายละเอียดลีด | [ ] | [ ] |
| 3 | กดปุ่ม "บันทึกการจอง" / "Record Booking" | พนักงานขาย | เปิด modal สำหรับบันทึกข้อมูลการจอง | [ ] | [ ] |
| 4 | เลือกหน่วยที่จอง (plot_number) | พนักงานขาย | เลือกจากรายการหน่วยว่าง | [ ] | [ ] |
| 5 | กรอกจำนวนเงินจอง (booking_amount) | พนักงานขาย | บันทึกจำนวนเงิน เช่น 100,000 ฿ | [ ] | [ ] |
| 6 | กรอกวันที่จอง (booking_date) | พนักงานขาย | บันทึกวันที่ปัจจุบัน | [ ] | [ ] |
| 7 | กดปุ่ม "บันทึก" | พนักงานขาย | โมดัลปิด ↓ (ดูขั้นตอน 8) | [ ] | [ ] |
| 8 | **ตรวจสอบ DB: leads** | Admin | `status = "Booking"` + `booking_date` is set + `plot_number` is set + `booking_by = [user]` | [ ] | [ ] |
| 9 | **ตรวจสอบ DB: approval_logs** | Admin | `workflow_type = "Booking_Deposit"` + `action_taken = "Pending"` + `amount = 100000` | [ ] | [ ] |
| 10 | **ตรวจสอบ DB: work_queue** | Admin | `workflow_type = "Booking_Deposit"` + `assigned_role = "manager"` + `status = "open"` | [ ] | [ ] |
| 11 | เข้าหน้า `/inbox` (ผู้อนุมัติ) | ผู้บริหาร | แสดงงาน Booking_Deposit ในรายการ | [ ] | [ ] |
| 12 | กดคลิกงาน Booking_Deposit | ผู้บริหาร | เปลี่ยนหน้าไปที่ `/crm?lead=[id]` + ไฮไลต์ลีด | [ ] | [ ] |
| 13 | ตรวจสอบรายละเอียดการจอง | ผู้บริหาร | แสดง: ชื่อลูกค้า, หน่วย, จำนวนเงิน, วันที่ | [ ] | [ ] |
| 14 | กดปุ่ม "อนุมัติเงินจอง" | ผู้บริหาร | แสดง modal ยืนยัน | [ ] | [ ] |
| 15 | กดปุ่ม "ยืนยันอนุมัติ" | ผู้บริหาร | โมดัลปิด ↓ (ดูขั้นตอน 16) | [ ] | [ ] |
| 16 | **ตรวจสอบ DB: leads** | Admin | `status` ยังเป็น "Booking" (ไม่เปลี่ยน) + approval_logs.action_taken = "Approved" | [ ] | [ ] |
| 17 | **ตรวจสอบ DB: approval_logs** | Admin | `action_taken = "Approved"` | [ ] | [ ] |
| 18 | **ตรวจสอบ DB: work_queue** | Admin | `status = "done"` | [ ] | [ ] |
| 19 | **ตรวจสอบ DB: workflow_events** | Admin | `eventType = "approved"` + `amount = 100000` | [ ] | [ ] |
| 20 | ตรวจสอบการแจ้งเตือน | พนักงานขาย | แจ้งเตือนว่าการจองได้รับการอนุมัติแล้ว | [ ] | [ ] |

#### 🔴 Error Scenarios

| # | สถานการณ์ | ตรวจสอบ | คาดหวัง | Status |
|----|-----------|---------|--------|--------|
| E1 | จองหน่วยที่ว่างแล้ว (ซ้ำ) | Modal | Validation error: "หน่วยนี้ว่างไม่พอ" | [ ] |
| E2 | กด "ปฏิเสธ" | approval_logs | `action_taken = "Rejected"` + leads.status = ยังเป็น "Site Visit" ไม่เปลี่ยน | [ ] |
| E3 | ปิดโมดัลการอนุมัติ (Cancel) | leads | `booking_date` ยังคงได้รับบันทึก แต่ approval_logs.action_taken ยังคง "Pending" | [ ] |

---

### 🔷 TEST CASE 7: Contract_Approval (อนุมัติสัญญา)

#### 📊 Pre-conditions
- **ผู้ใช้ที่ต้องการ:**
  - Sales Staff — บทบาท: staff / sales
  - Sales Manager / Contract Manager — บทบาท: manager / admin
- **เกณฑ์ (SLA):** 5 วัน

#### ✅ Test Steps & Expected Results

| # | ขั้นตอน | ตัวอักษร | คาดหวัง | Actual | Status |
|----|---------|---------|--------|--------|--------|
| 1 | เข้าหน้า `/crm` | พนักงานขาย | แสดงตาราลีด + section "ลีดรอลงนามสัญญา" | [ ] | [ ] |
| 2 | เลือกลีดที่ลูกค้าลงนามสัญญาแล้ว | พนักงานขาย | โหลดรายละเอียดลีด | [ ] | [ ] |
| 3 | กดปุ่ม "บันทึกลงนามสัญญา" / "Record Contract Signing" | พนักงานขาย | เปิด modal สำหรับบันทึกข้อมูลสัญญา | [ ] | [ ] |
| 4 | กรอกวันที่ลงนาม (contract_signed_date) | พนักงานขาย | บันทึกวันที่ลงนาม | [ ] | [ ] |
| 5 | กรอกราคาสัญญา (contract_price) | พนักงานขาย | บันทึกราคาที่ตกลงกัน เช่น 2,500,000 ฿ | [ ] | [ ] |
| 6 | อัพโหลดไฟล์สัญญา (optional) | พนักงานขาย | เลือกไฟล์สัญญา PDF | [ ] | [ ] |
| 7 | กดปุ่ม "บันทึก" | พนักงานขาย | โมดัลปิด ↓ (ดูขั้นตอน 8) | [ ] | [ ] |
| 8 | **ตรวจสอบ DB: leads** | Admin | `status = "Contract"` + `contract_signed_date` is set + `contract_price = 2500000` | [ ] | [ ] |
| 9 | **ตรวจสอบ DB: approval_logs** | Admin | `workflow_type = "Contract_Approval"` + `action_taken = "Pending"` + `amount = 2500000` | [ ] | [ ] |
| 10 | **ตรวจสอบ DB: work_queue** | Admin | `workflow_type = "Contract_Approval"` + `assigned_role = "manager"` + `status = "open"` | [ ] | [ ] |
| 11 | เข้าหน้า `/inbox` (ผู้อนุมัติ) | ผู้บริหาร | แสดงงาน Contract_Approval ในรายการ | [ ] | [ ] |
| 12 | กดคลิกงาน Contract_Approval | ผู้บริหาร | เปลี่ยนหน้าไปที่ `/crm?lead=[id]` + ไฮไลต์ลีด | [ ] | [ ] |
| 13 | ตรวจสอบรายละเอียดสัญญา | ผู้บริหาร | แสดง: ชื่อลูกค้า, วันลงนาม, ราคาสัญญา, preview ไฟล์สัญญา | [ ] | [ ] |
| 14 | กดปุ่ม "อนุมัติสัญญา" | ผู้บริหาร | แสดง modal ยืนยัน | [ ] | [ ] |
| 15 | กดปุ่ม "ยืนยันอนุมัติ" | ผู้บริหาร | โมดัลปิด ↓ (ดูขั้นตอน 16) | [ ] | [ ] |
| 16 | **ตรวจสอบ DB: leads** | Admin | `status = "Contract"` (ไม่เปลี่ยนระหว่างการอนุมัติ) + approval_logs.action_taken = "Approved" | [ ] | [ ] |
| 17 | **ตรวจสอบ DB: approval_logs** | Admin | `action_taken = "Approved"` | [ ] | [ ] |
| 18 | **ตรวจสอบ DB: work_queue** | Admin | `status = "done"` | [ ] | [ ] |
| 19 | **ตรวจสอบ DB: workflow_events** | Admin | `eventType = "approved"` + `amount = 2500000` | [ ] | [ ] |
| 20 | ตรวจสอบการแจ้งเตือน | พนักงานขาย | แจ้งเตือนว่าสัญญาได้รับการอนุมัติแล้ว | [ ] | [ ] |

#### 🔴 Error Scenarios

| # | สถานการณ์ | ตรวจสอบ | คาดหวัง | Status |
|----|-----------|---------|--------|--------|
| E1 | กด "ปฏิเสธ" | approval_logs | `action_taken = "Rejected"` + leads.status = ยังคง "Booking" ไม่เปลี่ยน | [ ] |
| E2 | ลงนามสัญญาสองครั้ง (double-click) | leads | `contract_signed_date` **ครั้งเดียว** เท่านั้น ไม่ duplicate | [ ] |
| E3 | กรอก contract_price = 0 | Modal | Validation error: "กรุณาระบุราคาสัญญา" | [ ] |

---

### 🔷 TEST CASE 8: Purchase_Request (ขออนุมัติก่อนซื้อ)

#### 📊 Pre-conditions
- **ผู้ใช้ที่ต้องการ:**
  - Employee (พนักงาน) — บทบาท: staff
  - Finance Manager / Approver — บทบาท: manager / admin
- **เกณฑ์ (SLA):** 2 วัน
- **เกณฑ์อนุมัติ:** ≥ ฿2,000 ต้องขออนุมัติ

#### ✅ Test Steps & Expected Results

| # | ขั้นตอน | ตัวอักษร | คาดหวัง | Actual | Status |
|----|---------|---------|--------|--------|--------|
| **Scenario A: PR ≥ ฿2,000 (ต้องขออนุมัติ)** | | | | |
| 1A | เข้าหน้า `/office?tab=finance` | พนักงาน | แสดง section "คำขอซื้อ" + ปุ่ม "เพิ่มคำขอซื้อ" | [ ] | [ ] |
| 2A | กดปุ่ม "เพิ่มคำขอซื้อ" | พนักงาน | เปิด modal สร้างคำขอซื้อ | [ ] | [ ] |
| 3A | เลือกหมวดหมู่ (category) | พนักงาน | เลือก เช่น "ไอที/คอมพิวเตอร์" | [ ] | [ ] |
| 4A | กรอกรายการที่ต้องการซื้อ (item) | พนักงาน | บันทึกชื่อสินค้า เช่น "แล็ปท็อป" | [ ] | [ ] |
| 5A | กรอกจำนวนเงิน (amount) | พนักงาน | บันทึกราคา = 3,500 ฿ (≥ 2,000) | [ ] | [ ] |
| 6A | กรอกเหตุผล (reason) | พนักงาน | บันทึกเหตุผล เช่น "ทำงานท่องเที่ยว" | [ ] | [ ] |
| 7A | กรอก URL ใบเสนอราคา (quote URL) | พนักงาน | บันทึก URL (optional) | [ ] | [ ] |
| 8A | กดปุ่ม "ยื่นขอซื้อ" | พนักงาน | โมดัลปิด ↓ (ดูขั้นตอน 9A) | [ ] | [ ] |
| 9A | **ตรวจสอบ DB: purchase_requests** | Admin | `status = "pending"` + `pr_number` = auto-generated + `needs_approval = true` | [ ] | [ ] |
| 10A | **ตรวจสอบ DB: approval_logs** (ถ้ามี) | Admin | `workflow_type = "Purchase_Request"` + `action_taken = "Pending"` | [ ] | [ ] |
| 11A | **ตรวจสอบ DB: work_queue** | Admin | `workflow_type = "Purchase_Request"` + `assigned_role = "manager"` + `status = "open"` | [ ] | [ ] |
| 12A | เข้าหน้า `/inbox` (ผู้อนุมัติ) | ผู้บริหาร | แสดงงาน Purchase_Request ในรายการ | [ ] | [ ] |
| 13A | กดคลิกงาน Purchase_Request | ผู้บริหาร | เปลี่ยนหน้าไปที่ `/office?tab=finance&focus=[id]` | [ ] | [ ] |
| 14A | ตรวจสอบรายละเอียด PR | ผู้บริหาร | แสดง: หมวดหมู่, รายการ, จำนวนเงิน, เหตุผล, URL | [ ] | [ ] |
| 15A | กดปุ่ม "อนุมัติ" | ผู้บริหาร | แสดง modal ยืนยัน | [ ] | [ ] |
| 16A | กดปุ่ม "ยืนยันอนุมัติ" | ผู้บริหาร | โมดัลปิด ↓ (ดูขั้นตอน 17A) | [ ] | [ ] |
| 17A | **ตรวจสอบ DB: purchase_requests** | Admin | `status = "approved"` + `approver = [username]` + `approved_at` is set | [ ] | [ ] |
| 18A | **ตรวจสอบ DB: work_queue** | Admin | `status = "done"` + `done_by = [username]` | [ ] | [ ] |
| 19A | **ตรวจสอบ DB: workflow_events** | Admin | `eventType = "approved"` (ถ้าบันทึก) | [ ] | [ ] |
| | | | | |
| **Scenario B: PR < ฿2,000 (ต่ำกว่าเกณฑ์ — อนุมัติอัตโนมัติ)** | | | | |
| 1B | เปิด modal สร้างคำขอซื้อ | พนักงาน | เปิด modal สร้าง | [ ] | [ ] |
| 2B | กรอกรายละเอียด PR | พนักงาน | หมวดหมู่, รายการ, จำนวนเงิน = 1,500 ฿ (< 2,000) | [ ] | [ ] |
| 3B | กดปุ่ม "ยื่นขอซื้อ" | พนักงาน | โมดัลปิด + แสดง "อนุมัติแล้ว (ต่ำกว่าเกณฑ์)" | [ ] | [ ] |
| 4B | **ตรวจสอบ DB: purchase_requests** | Admin | `status = "approved"` + `needs_approval = false` + `approver = "ระบบ (ต่ำกว่าเกณฑ์)"` + `approved_at` is set | [ ] | [ ] |
| 5B | **ตรวจสอบ DB: work_queue** | Admin | **ไม่มี** entry สำหรับ PR นี้ (ต่ำกว่าเกณฑ์) | [ ] | [ ] |
| 6B | **ตรวจสอบ DB: approval_logs** | Admin | **ไม่มี** entry สำหรับ PR นี้ (ต่ำกว่าเกณฑ์) | [ ] | [ ] |

#### 🔴 Error Scenarios

| # | สถานการณ์ | ตรวจสอบ | คาดหวัง | Status |
|----|-----------|---------|--------|--------|
| E1 | กด "ปฏิเสธ" (PR ≥ 2,000) | purchase_requests | `status = "rejected"` + approver_notes contain reason | [ ] |
| E2 | สร้างคำขอโดยไม่กรอก item | Modal | Validation error: "กรุณาระบุรายการที่จะซื้อ" | [ ] |
| E3 | สร้างคำขอ amount = 0 หรือติดลบ | Modal | Validation error: "กรุณาระบุราคาประมาณที่ถูกต้อง" | [ ] |

---

## ประเด็นสำคัญและจุดเสี่ยง

### 🚨 ประเด็นวิกฤต

#### 1. **State Clearing บน Modal** (ความเสี่ยงสูง)
- **ปัญหา:** เมื่อปิด modal หลังอนุมัติ หาก state form ไม่ clear ให้ถูกต้อง จะโหลดข้อมูลเก่าขึ้นมาอีก
- **ตรวจสอบ:**
  - ปิด modal → เปิดใหม่ → ข้อมูลควร **ว่างเปล่า** ไม่ใช่โหลดข้อมูลเก่า
  - ตำแหน่งที่มี risk: `/construction/page.tsx` (modal installment), `/office/page.tsx` (modal finance)
- **สำคัญ:** ✅ **CRITICAL**

#### 2. **Double-click Approval (Duplicate Records)** (ความเสี่ยงสูง)
- **ปัญหา:** ถ้าผู้ใช้กด "อนุมัติ" สองครั้งเร็ว ๆ อาจสร้าง 2 workflow_events / approve 2 ครั้ง
- **ตรวจสอบ:**
  - work_queue: `status = "done"` **ครั้งเดียว** เท่านั้น
  - approval_logs: `action_taken = "Approved"` **ครั้งเดียว**
  - workflow_events: `eventType = "approved"` **ครั้งเดียว**
- **สำคัญ:** ✅ **CRITICAL**

#### 3. **Work Queue Not Closed** (Orphan Records) (ความเสี่ยงสูง)
- **ปัญหา:** หากระหว่างการอนุมัติ `closeWorkQueue()` ล้มเหลว work_queue จะค้างในสถานะ "open" ตลอดไป
- **ตรวจสอบ:**
  - ทุกการอนุมัติที่สำเร็จต้องมี work_queue.status = "done" ที่ตรงกัน
  - ตรวจเช็ค orphan records: `SELECT * FROM work_queue WHERE status = 'open' AND created_at < NOW() - INTERVAL '7 days'`
- **สำคัญ:** ✅ **CRITICAL**

#### 4. **Notification Not Sent** (Users Don't Know) (ความเสี่ยงกลาง)
- **ปัญหา:** หาก `notifyPush()` หรือ `createNotification()` ล้มเหลว users จะไม่รู้ว่ามีงานรอ
- **ตรวจสอบ:**
  - ตรวจสอบ notifications table
  - ตรวจสอบ push_subscriptions
  - Push notifications test (check browser console)
- **สำคัญ:** ✅ **HIGH**

#### 5. **Approval Status Not Cascading** (ความเสี่ยงกลาง)
- **ปัญหา:** ทั้ง approval_logs อนุมัติแล้ว แต่ตารางต้นทาง (contractor_installments, purchase_orders, etc.) ยังคง "pending"
- **ตรวจสอบ:**
  - approval_logs.action_taken = "Approved" **→** source table.status = "approved"
  - **ทั้ง 8 workflow ต้องบ่งชี้สถานะที่ source table ด้วย**
- **สำคัญ:** ✅ **HIGH**

#### 6. **SLA Calculation Error** (ความเสี่ยงต่ำ)
- **ปัญหา:** `calcSlaDueAt()` ใช้ `new Date()` ซึ่งเป็นเวลาเบราว์เซอร์ ไม่ใช่ server time
- **ตรวจสอบ:**
  - work_queue.sla_due_at ต้อง **±1-2 วัน** จาก expected date
  - ถ้าเกิน 3 วัน = อาจเป็น timezone issue
- **สำคัญ:** ⚠️ **MEDIUM**

---

### ⚠️ ข้อกังวลอื่น ๆ

| ประเด็น | คำอธิบาย | ระดับ |
|-------|---------|------|
| **Form Field Validation** | เมื่อเพิ่ม field ใหม่ ต้องอัปเดต `setForm({...})` ทั้งหมด | HIGH |
| **Database RLS Policy** | ต้องตรวจว่า RLS policy ของแต่ละ table ถูกต้อง (ให้ approver อ่านได้) | HIGH |
| **Notification Content** | notification message ต้องเป็นภาษาไทยและมีข้อมูลครบถ้วน | MEDIUM |
| **Audit Trail Completeness** | workflow_events ต้องมี actor_name, actor_role, amount ครบถ้วน | MEDIUM |
| **Error Handling** | ไม่มี error handling ในบาง endpoints (API routes) | MEDIUM |
| **Concurrent Approval** | ถ้า 2 ผู้อนุมัติอนุมัติ 1 request พร้อม ๆ กัน | LOW |

---

## คำแนะนำ

### ✅ Recommended Checklist Before Deployment

- [ ] **Code Review:**
  - [ ] ตรวจสอบทั้ง 8 workflow ว่ามี `closeWorkQueue()` ในการอนุมัติแต่ละครั้ง
  - [ ] ตรวจสอบว่า form state clear หลังบันทึกข้อมูล
  - [ ] ตรวจสอบว่า source table update status ตรงกับ approval_logs

- [ ] **Database Check:**
  - [ ] Run: `SELECT workflow_type, COUNT(*) FROM workflow_events GROUP BY workflow_type;` — ต้องเห็นข้อมูล 8 types
  - [ ] Run: `SELECT * FROM work_queue WHERE status = 'open' LIMIT 5;` — ต้องเห็นงานที่รออนุมัติ
  - [ ] Check RLS policies ของ work_queue ว่าให้ managers อ่านได้

- [ ] **Manual E2E Test (Per Workflow):**
  - [ ] ทำการทดสอบแต่ละ workflow ตามขั้นตอนด้านบน
  - [ ] เพิ่ม QA time +1-2 ชั่วโมง ต่อ workflow ที่ซับซ้อน

- [ ] **Notification Test:**
  - [ ] ทดสอบ push notification จริง (ต้องมี service worker)
  - [ ] ทดสอบ email notification (ถ้ามี)
  - [ ] ตรวจสอบ notifications table ว่าบันทึกข้อมูลครบถ้วน

- [ ] **Performance Check:**
  - [ ] Approvals page load time < 2 วินาที
  - [ ] Inbox page load time < 2 วินาที
  - [ ] Modal open/close ไม่มี jank

- [ ] **Browser Compatibility:**
  - [ ] Test บน Chrome, Safari, Firefox
  - [ ] Test บน iOS Safari, Android Chrome
  - [ ] Test ด้วยความเร็วเน็ต 4G ช้า

---

### 📱 Mobile-Specific Tests (Important!)

| Test | Expected | Check |
|------|----------|-------|
| เปิด modal approval บน mobile | Modal ขนาดเล็ก แต่ปุ่มยังกดได้ | [ ] |
| Scroll ใน modal | ข้อมูลสามารถเลื่อนได้ ปุ่ม sticky ด้านล่าง | [ ] |
| Touch double-tap approve | Approve **ครั้งเดียว** เท่านั้น (debounce) | [ ] |
| Back button ใน Safari | ไม่ขึ้น "Save Changes?" | [ ] |

---

### 🔍 Debugging Commands (For QA)

```javascript
// Console commands to debug:

// 1. Check last workflow_events
await supabase.from('workflow_events')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10);

// 2. Check open work_queue
await supabase.from('work_queue')
  .select('*')
  .eq('status', 'open')
  .order('created_at', { ascending: false });

// 3. Check approval_logs for a specific workflow
await supabase.from('approval_logs')
  .select('*')
  .eq('workflow_type', 'Installment_Review')
  .order('created_at', { ascending: false })
  .limit(5);

// 4. Check if contractor_installment updated after approval
await supabase.from('contractor_installments')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1);
```

---

### 📊 Test Result Template (For Each Workflow)

```
TEST CASE: [Workflow Name]
Date: YYYY-MM-DD
Tester: [Name]
Browser/Device: [e.g., Chrome 126 / iPhone 15]

RESULTS:
✅ Step 1-5: PASS / FAIL / BLOCKED
✅ Step 6-10: PASS / FAIL / BLOCKED
✅ Step 11-15: PASS / FAIL / BLOCKED
...

ISSUES FOUND:
- [Issue 1]: [Description] — Severity: [CRITICAL/HIGH/MEDIUM/LOW]
- [Issue 2]: [Description] — Severity: [CRITICAL/HIGH/MEDIUM/LOW]

NOTES:
[Any additional observations]
```

---

## สรุปผลโดยรวม

**ทั้ง 8 เวิร์กโฟลว์** ในระบบ AVIVA ONE มีสถาปัตยกรรมที่มั่นคง:
- ✅ ใช้ตารางกลาง (approval_logs, work_queue, workflow_events)
- ✅ มีระบบสัญญาณแจ้งเตือน (notifications, push)
- ✅ มีการติดตามตาม SLA (sla_due_at)

**อย่างไรก็ตาม** จำเป็นต้องทดสอบ:
1. State management (form clearing)
2. Double-click protection
3. Work queue closing
4. Notification delivery
5. Status cascading

**ระยะเวลาทดสอบ:** 8-12 ชั่วโมง (depending on test depth)

**ผู้ทดสอบที่แนะนำ:** 2-3 คนพร้อม ๆ กัน (parallelize by workflow type)

---

**เอกสารนี้ควรปรับปรุง** หลังจากทดสอบแต่ละ workflow และบันทึก actual results ลงใน checklist ด้านบน

---

## 🛠️ ตำแหน่ง Critical Code จากการวิเคราะห์

### สำคัญสุด: ตรวจสอบฟังก์ชันเหล่านี้ทีละหนึ่ง

#### 1. **closeWorkQueue() — MUST COMPLETE**
**ไฟล์:** `src/lib/workflow-events.ts:78-95`
```typescript
export async function closeWorkQueue(
  sourceRecordId: string,
  assignedRole?: string,
  doneBy?: string | null
): Promise<void>
```
**ตรวจสอบ:**
- [ ] เรียก `UPDATE work_queue SET status = "done"` ทุกครั้งที่อนุมัติ
- [ ] `done_by` ต้องบันทึก username ของผู้อนุมัติ
- [ ] ถ้า error → จะปล่อยให้ work_queue ค้างใน "open" ตลอดไป ⚠️ **CRITICAL**

#### 2. **resolveApprovalQueue() — MUST UPDATE SOURCE TABLE**
**ไฟล์:** `src/lib/workflow-events.ts:138-159`
```typescript
export async function resolveApprovalQueue(opts: {
  approved: boolean;
  conditionNote?: string | null;
  ...
}): Promise<void>
```
**ตรวจสอบ:**
- [ ] เรียก `logWorkflowEvent()` กับ `eventType: "approved"` หรือ `"rejected"`
- [ ] อัปเดต source table `status` ให้ตรงกับ `approved` boolean
  - ถ้า `approved: true` → status = "approved"
  - ถ้า `approved: false` → status = "rejected"

#### 3. **handleApprove() ใน approvals/page.tsx — MUST CLEAR FORM**
**ไฟล์:** `src/app/approvals/page.tsx` (ค้นหา "const handleApprove")
**ตรวจสอบ:**
- [ ] หลังอนุมัติสำเร็จ → ต้อง `setForm({...})` เป็นค่า empty
- [ ] Modal ปิด ด้วย `setExpandedRow(null)` หรือ `setShowModal(false)`
- [ ] ถ้าไม่ clear form → จะโหลดข้อมูล old request ขึ้นมาอีก ⚠️ **CRITICAL**

#### 4. **notifyPush() — BEST-EFFORT ONLY**
**ไฟล์:** `src/lib/workflow-events.ts:233-250`
```typescript
export async function notifyPush(
  department: string,
  title: string,
  body: string,
  url?: string,
  tag?: string
): Promise<void>
```
**ตรวจสอบ:**
- [ ] แม้ push notification ล้มเหลว → workflow ยังต้อง **สำเร็จ** (best-effort ไม่ throw error)
- [ ] ตรวจสอบ notifications table ว่ามี record หรือไม่
- [ ] ตรวจสอบ browser push subscriptions (check service worker)

#### 5. **Constructor_Installments Lifecycle**
**ตารางสำคัญ:** `contractor_installments`

**Status Flow:**
```
pending → in_review → approved → paid
    ↘                                    ↗
     → rejected ← (ได้รับปฏิเสธ)
```

**ตรวจสอบ transition ทั้งหมด:**
- [ ] pending → approved: เมื่ออนุมัติงวดงาน
- [ ] approved → paid: เมื่อคลิก "บันทึกจ่าย"
- [ ] pending/approved → rejected: เมื่อปฏิเสธ

**CRITICAL FIELDS ต้องบันทึก:**
- [ ] `contractor_ack_name` (ชื่อผู้รับเหมา)
- [ ] `wht_rate` (อัตรา WHT)
- [ ] `retention_rate` (อัตรา Retention)
- [ ] `paid_by` (ชื่อผู้จ่ายเงิน)
- [ ] `paid_at` (วันที่จ่าย)

---

### ตำแหน่ง Risk: Form State Management

| ไฟล์ | บรรทัด | ฟังก์ชัน | ปัญหา |
|-----|-------|--------|-------|
| construction/page.tsx | ~500-600 | openEditInstallment | setForm ต้องมี field ครบ |
| office/page.tsx | ~300-400 | openEditLeave | setForm ต้องมี date_from, date_to, reason |
| office/page.tsx | ~600-700 | openEditPurchaseOrder | setForm ต้องมี items[] |
| crm/page.tsx | ~200-300 | openEditLead | setForm ต้องมี plot_number, booking_date |

**ปัญหาร่วม:** เมื่อเพิ่ม field ใหม่ใน interface → ต้องเพิ่มใน:
1. Empty form object
2. setForm({...}) ในการเปิด edit
3. setForm({...}) ในการรีเซ็ตหลังบันทึก

---

### ตำแหน่ง Risk: Double-Click Protection

**ไฟล์ที่ต้องเพิ่ม debounce:**
- [ ] `src/app/approvals/page.tsx` — handleApprove() / handleReject()
- [ ] `src/app/construction/page.tsx` — handleApproveInstallment()
- [ ] `src/app/office/page.tsx` — handleApproveLeave()
- [ ] `src/app/crm/page.tsx` — handleApproveBooking() / handleApproveContract()

**Pattern ที่ต้องเหมือนกัน:**
```typescript
const [saving, setSaving] = useState(false);

const handleApprove = async () => {
  if (saving) return; // Guard: prevent double-click
  setSaving(true);
  try {
    await approvalLogic();
    // ... success
  } finally {
    setSaving(false);
  }
};
```

---

### ตำแหน่ง Risk: Approval Matrix

**ไฟล์:** `src/lib/approval-matrix.ts`

**ตรวจสอบเกณฑ์ถูกต้อง:**
- [ ] Finance_Approval: ≤ ฿499,999 = manager, ≥ ฿500,000 = admin
- [ ] Material_Purchase: ≤ ฿50,000 = manager, > ฿50,000 = admin
- [ ] Purchase_Request: < ฿2,000 = auto-approve, ≥ ฿2,000 = needs approval
- [ ] อื่น ๆ: ไม่มีเกณฑ์ (manager เท่านั้น)

**ตรวจสอบ SLA:**
- [ ] Installment_Review: 2 วัน
- [ ] Finance_Approval: 3 วัน
- [ ] Material_Purchase: 2 วัน
- [ ] Leave_Request: 1 วัน ← **SHORTEST SLA**
- [ ] Document_Approval: 3 วัน
- [ ] Contract_Approval: 5 วัน ← **LONGEST SLA**
- [ ] Booking_Deposit: 2 วัน
- [ ] Purchase_Request: 2 วัน

---

### SQL Queries สำหรับ Sanity Check (Post-Deployment)

```sql
-- 1. ตรวจสอบว่าทั้ง 8 workflow มี event ใน workflow_events
SELECT workflow_type, COUNT(*) as event_count, 
       MIN(created_at) as first_event, MAX(created_at) as latest_event
FROM workflow_events
GROUP BY workflow_type
ORDER BY event_count DESC;

-- 2. ตรวจสอบ orphan work_queue (งานที่ไม่มี approval_logs)
SELECT wq.* FROM work_queue wq
LEFT JOIN approval_logs al ON wq.source_record_id = al.source_record_id
WHERE wq.status = 'open' AND al.approval_id IS NULL
LIMIT 10;

-- 3. ตรวจสอบว่าการอนุมัติจริง ๆ
SELECT workflow_type, action_taken, COUNT(*) as count
FROM approval_logs
GROUP BY workflow_type, action_taken
ORDER BY workflow_type;

-- 4. ตรวจสอบ SLA violations (เกินกำหนด)
SELECT id, workflow_type, sla_due_at, 
       (NOW() - sla_due_at) as days_overdue
FROM work_queue
WHERE status = 'open' AND sla_due_at < NOW()
ORDER BY sla_due_at ASC;

-- 5. ตรวจสอบว่า source table status sync กับ approval_logs
SELECT al.workflow_type, al.action_taken, COUNT(*) 
FROM approval_logs al
WHERE al.action_taken = 'Approved'
  AND NOT EXISTS (
    SELECT 1 FROM contractor_installments ci 
    WHERE ci.id = al.source_record_id 
      AND ci.status IN ('approved', 'paid')
  )
GROUP BY al.workflow_type, al.action_taken;
```

---

## 🔥 Hot Paths (อนุมัติเร็วสำหรับทดสอบ)

### ที่ 1: Installment_Review (ก่อสร้าง)
**ใช้เวลา:** 10-15 นาที  
**ลำดับขั้นตอน:**
1. เข้า `/construction`
2. กดบ้าน → กดงวด "pending"
3. กรอก WHT + Retention
4. กด "อนุมัติ"
5. ตรวจ DB: contractor_installments.status = "approved"

### ที่ 2: Leave_Request (HR)
**ใช้เวลา:** 5-8 นาที  
**ลำดับขั้นตอน:**
1. เข้า `/office?tab=hr`
2. กด "ยื่นใบลา"
3. กรอก: ชื่อ, ประเภท, วันที่
4. กด "ยื่นขอลา"
5. เข้า `/inbox` → กด Approve
6. ตรวจ DB: leave_requests.status = "approved"

### ที่ 3: Purchase_Request (Finance)
**ใช้เวลา:** 5-8 นาที  
**ลำดับขั้นตอน:**
1. เข้า `/office?tab=finance`
2. กด "เพิ่มคำขอซื้อ"
3. กรอก: หมวด, รายการ, จำนวน ≥ ฿2,000
4. เข้า `/inbox` → กด Approve
5. ตรวจ DB: purchase_requests.status = "approved"

---

*End of E2E Testing Plan v1.0*  
*ปรับปรุงเมื่อ: 17 มิถุนายน 2569 (UTC+7)*

