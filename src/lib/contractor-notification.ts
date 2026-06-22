/**
 * Contractor Notification Service
 *
 * ส่งแจ้งเตือน contractor ผ่าน LINE, Email, In-app เมื่อ:
 * - Milestone approve/reject
 * - Payment submitted/approved
 * - SLA alert (ล่าช้า)
 * - Specification change order
 */

export interface NotificationPayload {
  recipientType: 'contractor' | 'engineer' | 'project_manager' | 'director' | 'ceo'
  recipientId: string
  eventType: string
  projectId: string
  houseId: string
  subject: string
  message: string
  channel: 'line' | 'email' | 'sms' | 'in_app'
  metadata?: Record<string, any>
}

/**
 * สร้าง message สำหรับแต่ละ event type
 */
export function buildNotificationMessage(eventType: string, data: any): {
  subject: string
  message: string
  lineMessage: string
} {
  switch (eventType) {
    case 'milestone_approved':
      return {
        subject: `✅ ✔️ งวดที่ ${data.stageName} - เบิกได้แล้ว`,
        message: `🏗️ โปรเจกต์: ${data.projectName}\n🏠 แปลง: ${data.houseNumber}\n✔️ สถานะ: งวดที่ ${data.stageName} ได้รับอนุมัติแล้ว\n💰 จำนวนเงิน: ฿${data.amount.toLocaleString()}\n📅 คาดจ่ายเงิน: ${data.estimatedPayoutDate}\n⏱️ ได้รับอนุมัติเมื่อ: ${new Date().toLocaleString('th-TH')}`,
        lineMessage: `✅ โปรเจกต์ ${data.projectName} (${data.houseNumber})\n✔️ งวดที่ ${data.stageName} ได้รับอนุมัติแล้ว\n💰 ฿${data.amount.toLocaleString()}\n📅 คาดจ่ายเงิน: ${data.estimatedPayoutDate}`
      }

    case 'milestone_rejected':
      return {
        subject: `❌ งวดที่ ${data.stageName} - ไม่ผ่าน กรุณาแก้ไข`,
        message: `🏗️ โปรเจกต์: ${data.projectName}\n🏠 แปลง: ${data.houseNumber}\n❌ สถานะ: งวดที่ ${data.stageName} ไม่ผ่าน\n📝 เหตุผล: ${data.reason}\n👨‍💼 ติดต่อ: ${data.engineerName} (${data.engineerPhone})\n⏱️ ความเห็นเมื่อ: ${new Date().toLocaleString('th-TH')}`,
        lineMessage: `❌ โปรเจกต์ ${data.projectName} (${data.houseNumber})\n❌ งวดที่ ${data.stageName} ไม่ผ่าน\n📝 เหตุผล: ${data.reason}\n👉 ติดต่อ ${data.engineerName}`
      }

    case 'payment_submitted':
      return {
        subject: `📤 ใบเสร็จเบิกเงิน ${data.voucherNumber} ส่งให้ผู้บริหารแล้ว`,
        message: `💼 ใบเสร็จ: ${data.voucherNumber}\n🏠 แปลง: ${data.houseNumber}\n📤 สถานะ: ส่งให้ผู้บริหารเพื่ออนุมัติแล้ว\n💰 จำนวนเงิน: ฿${data.netAmount.toLocaleString()}\n📅 คาดได้เงิน: ${data.estimatedPayoutDate}\n⏱️ ส่งเมื่อ: ${new Date().toLocaleString('th-TH')}`,
        lineMessage: `📤 ใบเสร็จ ${data.voucherNumber} ถูกส่งอนุมัติแล้ว\n💰 ฿${data.netAmount.toLocaleString()}\n📅 คาดได้เงิน: ${data.estimatedPayoutDate}`
      }

    case 'payment_approved':
      return {
        subject: `✅ 💰 ใบเสร็จเบิกเงิน ${data.voucherNumber} อนุมัติแล้ว!`,
        message: `✅ ใบเสร็จ: ${data.voucherNumber}\n💰 จำนวนเงิน: ฿${data.netAmount.toLocaleString()}\n✔️ สถานะ: ได้รับอนุมัติแล้ว\n🏦 คาดการณ์: โอนเงินให้คุณในวันถัดไป (>${data.estimatedPayoutDate})\n🎉 ขอบคุณที่ประคับประคองงานปลูกสร้างของเรา!`,
        lineMessage: `✅ ใบเสร็จ ${data.voucherNumber} อนุมัติแล้ว!\n💰 ฿${data.netAmount.toLocaleString()}\n🏦 คาดการณ์โอนเงิน: ${data.estimatedPayoutDate}`
      }

    case 'sla_alert_warning':
      return {
        subject: `⚠️ โปรเจกต์ ${data.houseNumber} ล่าช้าแล้ว ${data.daysLate} วัน`,
        message: `⚠️ โปรเจกต์: ${data.projectName}\n🏠 แปลง: ${data.houseNumber}\n📅 ล่าช้าแล้ว: ${data.daysLate} วัน\n📋 ขั้นตอนปัจจุบัน: ${data.currentStage}\n💬 กรุณาติดต่อทีมงานเพื่อปรับปรุง`,
        lineMessage: `⚠️ ${data.projectName} (${data.houseNumber}) ล่าช้า ${data.daysLate} วัน\n📋 ขั้นตอน: ${data.currentStage}`
      }

    case 'sla_alert_critical':
      return {
        subject: `🔴 ฉุกเฉินเพื่อ! ${data.houseNumber} ล่าช้า ${data.daysLate} วัน`,
        message: `🔴 ฉุกเฉิน: ${data.projectName}\n🏠 แปลง: ${data.houseNumber}\n📅 ล่าช้าแล้ว: ${data.daysLate} วัน\n📋 ขั้นตอนปัจจุบัน: ${data.currentStage}\n⛔ หยุดการจ่ายเงินชั่วคราว จนกว่าจะมีความคืบหน้า\n☎️ ติดต่อผู้บริหารโครงการโดยทันที`,
        lineMessage: `🔴 CRITICAL! ${data.projectName} ล่าช้า ${data.daysLate} วัน\n⛔ เงินจ่ายหยุด\n☎️ ติดต่อผู้บริหารด่วน`
      }

    case 'spec_change_order_request':
      return {
        subject: `📝 Change Order ${data.coNumber} - ขอเปลี่ยนแปลงสเปก`,
        message: `📝 Change Order: ${data.coNumber}\n🏠 แปลง: ${data.houseNumber}\n📝 เปลี่ยนแปลง: ${data.description}\n💰 ผลกระทบต่อราคา: ${data.priceImpact >= 0 ? '+' : ''}฿${data.priceImpact.toLocaleString()}\n⏰ ผลกระทบต่อเวลา: ${data.timelineImpact} วัน\n📌 รอการอนุมัติจากผู้บริหาร`,
        lineMessage: `📝 Change Order ${data.coNumber}\n📝 ${data.description}\n💰 ฿${data.priceImpact >= 0 ? '+' : ''}${data.priceImpact.toLocaleString()}\n⏰ +${data.timelineImpact} วัน`
      }

    default:
      return {
        subject: data.subject || 'Notification',
        message: data.message || '',
        lineMessage: data.message || ''
      }
  }
}

/**
 * ตัวอย่างการใช้:
 *
 * const notification = buildNotificationMessage('milestone_approved', {
 *   projectName: 'AVIVA Private',
 *   houseNumber: 'A01',
 *   stageName: 'Foundation',
 *   amount: 250000,
 *   estimatedPayoutDate: '2024-06-20'
 * })
 *
 * console.log(notification.lineMessage)
 * // ✅ โปรเจกต์ AVIVA Private (A01)
 * // ✔️ งวดที่ Foundation ได้รับอนุมัติแล้ว
 * // 💰 ฿250,000
 * // 📅 คาดจ่ายเงิน: 2024-06-20
 */
