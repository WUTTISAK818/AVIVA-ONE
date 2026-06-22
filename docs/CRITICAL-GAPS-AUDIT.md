/**
 * AVIVA ONE — Critical Gaps Audit & Fix Plan
 * 4 ประเด็นเร่งด่วนที่ต้องแก้ไขเพื่อให้ Construction Workflow ทำงานสมบูรณ์
 * 
 * สร้าง: 19 มิ.ย. 2569
 * สถานะ: Planning & Prioritization
 */

// ═════════════════════════════════════════════════════════════════════════════════
// 1️⃣ SPECIFICATION LOCK — ล็อกสเปกหลังวิศวกรเริ่มงาน
// ═════════════════════════════════════════════════════════════════════════════════

/**
 * ปัญหา:
 * - เซลส์และลูกค้าสามารถแก้ไขสเปกบ้าน (เช่น วัสดุ, สี, Layout) ได้ตลอดเวลา
 * - วิศวกรได้รับสเปกตัวเดิม แต่เซลส์เปลี่ยนไปแล้ว
 * - ฝ่ายบัญชีคำนวณเงินจากสเปกเดิม แต่บ้านจริงอาจเปลี่ยนแปลง
 * 
 * วิธีแก้:
 * - เมื่อวิศวกรกด "Start Construction" → ล็อก spec ในระบบ
 * - ปิดปุ่ม "Edit Spec" ของเซลส์/ลูกค้า
 * - หากต้องเปลี่ยนแปลง → ต้องขอ Change Order (CO) ที่ต้องอนุมัติ
 * - บันทึก Audit Log ของทุกการเปลี่ยนแปลง
 * 
 * Files ที่ต้องแก้:
 * - src/app/sales/page.tsx (ปิดปุ่ม Edit Spec เมื่อ status = 'construction')
 * - src/lib/sales-finalize.ts (เพิ่มเติม Lock Specification logic)
 * - DB: houses table → เพิ่มคอลัมน์ spec_locked_at, spec_locked_by
 * - DB: ตาราง spec_changes (Change Order history)
 * 
 * Status: ❌ NOT STARTED
 */

// ═════════════════════════════════════════════════════════════════════════════════
// 2️⃣ FINANCE AUTO-SYNC — เชื่อมอนุมัติงวด → จ่ายเงิน
// ═════════════════════════════════════════════════════════════════════════════════

/**
 * ปัญหา:
 * - วิศวกรกด "Approve Milestone" แต่ฝ่ายบัญชีไม่เห็น
 * - บัญชีต้องรันเมนูแยกเพื่อ sync ข้อมูล
 * - หากไม่ sync ข้อมูลจะผิดเพี้ยน
 * - ไม่มี Audit Trail ของการเบิกจ่าย
 * 
 * วิธีแก้:
 * - Real-time Sync: เมื่อวิศวกรกด "Approve" → ส่ง webhook ไปยัง Finance API
 * - Auto-Calculate: ระบบคำนวณค่าปรับ (penalty), tax, retention อัตโนมัติ
 * - Payment Voucher Drafting: สร้าง draft voucher ให้ผู้บริหารตรวจ
 * - Digital Signature: ผู้บริหารลงนาม (e-sign) ก่อนส่งธนาคาร
 * 
 * Logic ที่ต้อง:
 * 1. วิศวกรอนุมัติงวด X → status: 'approved'
 * 2. Trigger: onConstructionMilestoneApproved()
 *    - Query เสมญญา (contract) ของ contractor
 *    - ดึง contractual_payment_per_milestone
 *    - รับจำนวน days_late = today - due_date
 * 3. Calculate:
 *    - base_amount = contractual_payment_per_milestone
 *    - penalty = days_late > 0 ? (days_late * daily_penalty_rate) : 0
 *    - gross_amount = base_amount - penalty
 *    - tax_3percent = gross_amount * 0.03
 *    - retention = gross_amount * retention_rate (default 5%)
 *    - net_amount = gross_amount - tax_3percent - retention
 * 4. Create Payment Voucher (FIN-XXXX)
 * 5. Notify Finance & Approver
 * 
 * Files ที่ต้องแก้:
 * - src/app/api/construction/inspections/[id]/signoff/route.ts (เพิ่มเติม trigger)
 * - src/app/api/finance/payment-voucher/create/route.ts (สร้าง logic)
 * - src/app/finance/page.tsx (UI สำหรับ draft voucher + sign)
 * - DB: payment_vouchers table (บันทึกรายละเอียด)
 * - DB: contractor_contracts table (สำหรับสเปก contract)
 * 
 * Status: ⚠️ PARTIAL (ยังไม่มี auto-calculate, digital signature)
 */

// ═════════════════════════════════════════════════════════════════════════════════
// 3️⃣ SLA VISUAL ALERT — เตือนความล่าช้า (15+ วัน)
// ═════════════════════════════════════════════════════════════════════════════════

/**
 * ปัญหา:
 * - Dashboard ไม่แสดงว่าแปลงไหนล่าช้า
 * - ผู้บริหารไม่รู้ว่าต้องกระตุก contractor
 * - ไม่มี escalation logic (เตือนแดง 15 วัน, เตือนน้ำเงิน 30 วัน ฯลฯ)
 * 
 * วิธีแก้:
 * - Grid View & Dashboard: แสดง "Days Late" badge
 *   - สีเขียว: 0 วัน (ตรงเวลา)
 *   - สีเหลือง: 1-14 วัน (เริ่มล่าช้า)
 *   - สีแดง: 15+ วัน (ล่าช้าเกิน SLA)
 * 
 * - Escalation Logic:
 *   Day 1-7: ไม่มีการแจ้ง (กรุณารอ)
 *   Day 8-14: 🟡 Yellow Alert → ส่ง LINE/Email ให้ Project Manager
 *   Day 15-30: 🔴 Red Alert → ส่ง LINE/Email ให้ Project Manager + Director
 *   Day 31+: 🔴🔴 Critical → ส่ง LINE/Email ให้ CEO + freeze payment
 * 
 * - Calculation: days_late = TODAY - (approved_date + contractual_days)
 *   WHERE current_stage != 'handover'
 * 
 * Files ที่ต้องแก้:
 * - src/components/ConstructionGridView.tsx (เพิ่มเติม Days Late indicator)
 * - src/app/dashboard/page.tsx (แสดง SLA violations)
 * - src/app/api/cron/sla-reminder.ts (chron job ส่งเตือน)
 * - DB: construction_unit_progress → เพิ่มคอลัมน์ expected_completion_date, days_late
 * - DB: alert_history table (บันทึก escalation history)
 * 
 * Status: ❌ NOT STARTED
 */

// ═════════════════════════════════════════════════════════════════════════════════
// 4️⃣ CONTRACTOR NOTIFICATION — แจ้ง contractor ทันที
// ═════════════════════════════════════════════════════════════════════════════════

/**
 * ปัญหา:
 * - วิศวกรกด "Reject Milestone" แต่ contractor ไม่รู้ (รอ LINE เอง)
 * - Contractor ไม่รู้ว่างวดไหนเบิกได้แล้ว
 * - ไม่มี Notification Log
 * 
 * วิธีแก้:
 * - Real-time Push Notification:
 *   1. "Milestone Approved" → ส่ง LINE/Push + email
 *   2. "Milestone Rejected" → ส่ง LINE + detail comment
 *   3. "Payment Submitted" → ส่ง LINE (เงินสูง ≥ 100K)
 *   4. "Payment Approved" → ส่ง LINE (โอนเงินได้แล้ว)
 * 
 * - Timeline Event:
 *   contractor_id = ABC
 *   event_type = 'milestone_approved'
 *   milestone_id = M001
 *   amount = 250000 บาท
 *   message = "งวดที่ 2 (ฐานราก) ได้รับอนุมัติแล้ว คาดว่าจะได้เงินภายใน 3 วัน"
 * 
 * - Notification Template:
 *   ✅ Approved: "✅ โปรเจกต์ {ProjectName} {UnitID}\n ✔️ งวดที่ {stage} อนุมัติแล้ว\n 💰 จำนวน {amount} บาท\n 📅 คาดจ่ายเงิน {estimated_payout_date}"
 * 
 *   ❌ Rejected: "❌ โปรเจกต์ {ProjectName} {UnitID}\n ✘ งวดที่ {stage} ไม่ผ่าน\n 📝 เหตุผล: {reason}\n 👨‍💼 ติดต่อ {engineer_name} เพื่อแก้ไข"
 * 
 * Files ที่ต้องแก้:
 * - src/app/api/notify/contractor/route.ts (central notification hub)
 * - src/app/api/construction/inspections/[id]/signoff/route.ts (trigger notify)
 * - src/app/api/line/webhook.ts (LINE messaging)
 * - DB: notification_log table (track ทุกการแจ้ง)
 * - DB: contractor_contact table (เก็บ LINE ID, email, phone)
 * 
 * Status: ⚠️ PARTIAL (มี LINE webhook แต่ยังไม่เชื่อมกับ construction flow)
 */

// ═════════════════════════════════════════════════════════════════════════════════
// SUMMARY: ลำดับความสำคัญ (Priority)
// ═════════════════════════════════════════════════════════════════════════════════

/**
 * P1 (วันที่ 1-2): FINANCE AUTO-SYNC ⚠️ 
 *   → ความสำคัญสูงสุด เพราะไม่มี cash flow
 *   → ต้องเชื่อมอนุมัติ → จ่ายเงิน ให้ตรงกัน
 *   → มีส่วนแก้ไขแล้ว แต่ยังไม่ complete
 * 
 * P2 (วันที่ 2-3): CONTRACTOR NOTIFICATION ⚠️ 
 *   → ส่วนการแจ้งเตือนสำคัญมากสำหรับ contractor
 *   → มี LINE webhook แต่ยังไม่ต่อสายกับ construction flow
 *   → ต้องเพิ่ม trigger เมื่อ milestone approve/reject
 * 
 * P3 (วันที่ 3-4): SLA VISUAL ALERT ❌ 
 *   → สำคัญสำหรับ executive visibility
 *   → ต้องสร้าง escalation logic + icon/badge
 * 
 * P4 (วันที่ 4-5): SPECIFICATION LOCK ❌ 
 *   → สำคัญแต่ไม่เร่งด่วนเท่า อื่น ๆ (โดยทั่วไป spec ไม่เปลี่ยนบ่อย)
 *   → ต้องสร้าง Change Order flow เต็มตัว
 */

export const criticalGapsPlan = {
  'specification-lock': {
    status: 'NOT_STARTED',
    priority: 4,
    effort: 'High (3-4 days)',
    impact: 'Critical for data accuracy'
  },
  'finance-auto-sync': {
    status: 'PARTIAL',
    priority: 1,
    effort: 'Medium (2-3 days)',
    impact: 'Critical for cash flow'
  },
  'sla-visual-alert': {
    status: 'NOT_STARTED',
    priority: 3,
    effort: 'Medium (2 days)',
    impact: 'Important for executive dashboard'
  },
  'contractor-notification': {
    status: 'PARTIAL',
    priority: 2,
    effort: 'Medium (2 days)',
    impact: 'Important for contractor satisfaction'
  }
}
