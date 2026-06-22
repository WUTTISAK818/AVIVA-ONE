/**
 * Finance Calculation Utilities — Auto-calculate penalty, tax, retention
 *
 * ใช้เมื่อ contractor milestone ได้รับการอนุมัติ
 */

export interface PaymentCalculation {
  baseAmount: number
  daysLate: number
  dailyPenaltyRate: number
  penaltyAmount: number

  grossAmount: number
  tax3Percent: number
  retentionRate: number
  retentionAmount: number

  netAmount: number
}

/**
 * คำนวณเงินจ่าย (Payment Voucher)
 *
 * @param baseAmount - จำนวนเงินตามสัญญา (contractual amount)
 * @param daysLate - จำนวนวันที่ล่าช้า (TODAY - due_date)
 * @param dailyPenaltyRate - อัตราค่าปรับรายวัน (บาท/วัน)
 * @param retentionRate - อัตรา Retention (%), default 5%
 * @returns PaymentCalculation object
 */
export function calculatePayment(
  baseAmount: number,
  daysLate: number,
  dailyPenaltyRate: number,
  retentionRate: number = 5
): PaymentCalculation {
  // คำนวณค่าปรับ (Penalty)
  const penaltyAmount = daysLate > 0 ? daysLate * dailyPenaltyRate : 0

  // Gross Amount = Base - Penalty
  const grossAmount = baseAmount - penaltyAmount

  // ภาษี 3% ณ ที่จ่าย
  const tax3Percent = grossAmount * 0.03

  // Retention (ค่ำประกันผลงาน)
  const retentionAmount = grossAmount * (retentionRate / 100)

  // Net Amount = Gross - Tax - Retention
  const netAmount = grossAmount - tax3Percent - retentionAmount

  return {
    baseAmount,
    daysLate,
    dailyPenaltyRate,
    penaltyAmount: Math.round(penaltyAmount * 100) / 100,
    grossAmount: Math.round(grossAmount * 100) / 100,
    tax3Percent: Math.round(tax3Percent * 100) / 100,
    retentionRate,
    retentionAmount: Math.round(retentionAmount * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100
  }
}

/**
 * คำนวณ Days Late
 *
 * @param contractDueDate - วันครบกำหนดตามสัญญา
 * @param approvedDate - วันที่วิศวกรอนุมัติจริง
 * @returns จำนวนวันที่ล่าช้า (0 if on time)
 */
export function calculateDaysLate(
  contractDueDate: Date,
  approvedDate: Date
): number {
  const timeDiff = approvedDate.getTime() - contractDueDate.getTime()
  const daysLate = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)))
  return daysLate
}

/**
 * ตัวอย่างการใช้งาน:
 *
 * const calculation = calculatePayment(
 *   baseAmount: 100000,      // เงินตามสัญญา 100K
 *   daysLate: 5,             // ล่าช้า 5 วัน
 *   dailyPenaltyRate: 1000,  // ค่าปรับ 1K/วัน
 *   retentionRate: 5         // ค่ำประกัน 5%
 * )
 *
 * ผลลัพธ์:
 * {
 *   baseAmount: 100000,
 *   penaltyAmount: 5000,                // 5 วัน × 1K = 5K
 *   grossAmount: 95000,                 // 100K - 5K
 *   tax3Percent: 2850,                  // 95K × 3%
 *   retentionAmount: 4750,              // 95K × 5%
 *   netAmount: 87400                    // 95K - 2850 - 4750
 * }
 */
