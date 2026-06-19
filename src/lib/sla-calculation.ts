/**
 * src/lib/sla-calculation.ts
 *
 * SLA Alert Logic — คำนวณวันล่าช้าและ escalation level
 */

export type SLAAlertLevel = 'on_time' | 'yellow' | 'red' | 'critical'

export interface SLAStatus {
  daysLate: number
  alertLevel: SLAAlertLevel
  shouldNotify: boolean
  notifyRoles: string[]
  message: string
  color: string
  icon: string
}

/**
 * คำนวณสถานะ SLA
 * @param expectedCompletionDate - วันที่ควรเสร็จตามสัญญา
 * @param currentStageStartDate - วันที่เริ่มขั้นตอนปัจจุบัน
 * @returns SLAStatus object
 */
export function calculateSLAStatus(
  expectedCompletionDate: Date,
  currentStageStartDate: Date
): SLAStatus {
  const today = new Date()
  const timeDiff = today.getTime() - expectedCompletionDate.getTime()
  const daysLate = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)))

  let alertLevel: SLAAlertLevel = 'on_time'
  let shouldNotify = false
  let notifyRoles: string[] = []
  let message = ''
  let color = ''
  let icon = ''

  if (daysLate === 0) {
    // On time
    alertLevel = 'on_time'
    color = 'bg-green-900/20'
    icon = '✅'
    message = 'On schedule'
  } else if (daysLate >= 1 && daysLate <= 7) {
    // Grace period (1-7 days) - no alert yet
    alertLevel = 'on_time'
    color = 'bg-blue-900/20'
    icon = '⏱️'
    message = `${daysLate} day(s) late`
  } else if (daysLate >= 8 && daysLate <= 14) {
    // Yellow alert (8-14 days)
    alertLevel = 'yellow'
    shouldNotify = true
    notifyRoles = ['project_manager', 'director']
    color = 'bg-yellow-900/30'
    icon = '🟡'
    message = `⚠️ ${daysLate} days late (SLA warning)`
  } else if (daysLate >= 15 && daysLate <= 30) {
    // Red alert (15-30 days)
    alertLevel = 'red'
    shouldNotify = true
    notifyRoles = ['project_manager', 'director', 'ceo']
    color = 'bg-orange-900/30'
    icon = '🔴'
    message = `🔴 ${daysLate} days late (CRITICAL)`
  } else {
    // Critical (31+ days)
    alertLevel = 'critical'
    shouldNotify = true
    notifyRoles = ['director', 'ceo', 'finance_manager']
    color = 'bg-red-900/40'
    icon = '🚨'
    message = `🚨 ${daysLate} days OVERDUE (Payment FROZEN)`
  }

  return {
    daysLate,
    alertLevel,
    shouldNotify,
    notifyRoles,
    message,
    color,
    icon
  }
}

/**
 * ตัวอย่างการใช้:
 *
 * const status = calculateSLAStatus(
 *   new Date('2024-06-15'),  // expected date
 *   new Date('2024-06-01')   // start date
 * )
 *
 * if (status.alertLevel === 'yellow') {
 *   console.log('⚠️ Send alert to:', status.notifyRoles)
 * }
 */
