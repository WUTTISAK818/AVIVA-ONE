/**
 * Lead Status Fix - ตรวจสอบและแก้ไขสถานะลูกค้าที่ไม่สอดคล้องกับข้อมูลสัญญา/โอน
 *
 * ปัญหาที่แก้ไข:
 * - ลูกค้ามีสัญญาแล้ว (contract_signed_date) แต่สถานะยัง "New Lead" / "Site Visit"
 * - ลูกค้าโอนแล้ว (transfer_date) แต่สถานะยัง "Booking" / "Contract"
 * - ลูกค้าได้สินเชื่อแล้ว (loan_approved_date) แต่สถานะยัง "Booking"
 */

import { createClient } from '@supabase/supabase-js'
import type { LeadStatus } from './mock-data'

export interface LeadStatusCheck {
  id: string
  customer_name: string
  current_status: LeadStatus
  expected_status: LeadStatus | null
  has_contract: boolean
  has_loan_approval: boolean
  has_transfer: boolean
  issue_description: string
  action_taken?: string
}

/**
 * ตรวจสอบว่าสัญญาครอบคลุมสถานะใดในโครงการ
 *
 * กฎ:
 * - มี transfer_date → Status ต้องเป็น "Closed Deal"
 * - มี loan_approved_date + ไม่มี transfer_date → Status ต้องเป็น "Loan Approved" หรือสูงกว่า
 * - มี contract_signed_date + ไม่มี loan_approved_date → Status ต้องเป็น "Contract" หรือสูงกว่า
 * - ยังไม่มีเอกสารใด → Status ต้องเป็น "New Lead", "Contacted", หรือ "Site Visit"
 */
function determineExpectedStatus(
  contractDate: string | null,
  loanDate: string | null,
  transferDate: string | null,
): LeadStatus | null {
  if (transferDate) return 'Closed Deal'
  if (loanDate && !transferDate) return 'Loan Approved'
  if (contractDate && !loanDate) return 'Contract'
  return null
}

/**
 * ตรวจสอบลีดทั้งหมด แล้วคืนค่าลายการแก้ไขที่ต้องทำ
 */
export async function validateLeadStatuses(
  projectId: string,
  supabase: ReturnType<typeof createClient> | any
): Promise<LeadStatusCheck[]> {
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, customer_name, status, contract_signed_date, loan_approved_date, transfer_date')
    .eq('project_id', projectId) as any

  if (error) throw new Error(`Failed to fetch leads: ${error.message}`)

  const issues: LeadStatusCheck[] = []

  for (const lead of (leads ?? []) as Array<{
    id: string
    customer_name: string
    status: LeadStatus
    contract_signed_date: string | null
    loan_approved_date: string | null
    transfer_date: string | null
  }>) {
    const expectedStatus = determineExpectedStatus(
      lead.contract_signed_date,
      lead.loan_approved_date,
      lead.transfer_date
    )

    const hasIssue = expectedStatus && lead.status !== expectedStatus

    if (hasIssue) {
      issues.push({
        id: lead.id,
        customer_name: lead.customer_name,
        current_status: lead.status as LeadStatus,
        expected_status: expectedStatus,
        has_contract: !!lead.contract_signed_date,
        has_loan_approval: !!lead.loan_approved_date,
        has_transfer: !!lead.transfer_date,
        issue_description: `ลูกค้า ${lead.customer_name} มี${
          lead.transfer_date ? 'โอนแล้ว' : lead.loan_approved_date ? 'สินเชื่อแล้ว' : 'สัญญาแล้ว'
        } แต่สถานะคือ "${lead.status}" ควรเป็น "${expectedStatus}"`,
        action_taken: undefined,
      })
    }
  }

  return issues
}

/**
 * แก้ไขสถานะลูกค้าอัตโนมัติ
 *
 * เปลี่ยนแปลง:
 * 1. ถ้ามี transfer_date → status = "Closed Deal"
 * 2. ถ้ามี loan_approved_date เท่านั้น → status = "Loan Approved"
 * 3. ถ้ามี contract_signed_date เท่านั้น → status = "Contract"
 */
export async function autoFixLeadStatuses(
  projectId: string,
  supabase: ReturnType<typeof createClient> | any
): Promise<{ fixed: number; errors: string[] }> {
  const issues = await validateLeadStatuses(projectId, supabase as any)
  let fixed = 0
  const errors: string[] = []

  for (const issue of issues) {
    if (!issue.expected_status) continue

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: issue.expected_status })
        .eq('id', issue.id)

      if (error) {
        errors.push(`ไม่สามารถแก้ไข ${issue.customer_name}: ${error.message}`)
      } else {
        fixed++
        console.log(`✅ แก้ไข ${issue.customer_name}: ${issue.current_status} → ${issue.expected_status}`)
      }
    } catch (err: any) {
      errors.push(`ข้อผิดพลาด: ${err.message}`)
    }
  }

  return { fixed, errors }
}

/**
 * รายงานสรุปปัญหาที่พบ
 */
export function generateReport(issues: LeadStatusCheck[]): string {
  if (issues.length === 0) {
    return '✅ ไม่พบปัญหา - สถานะลูกค้าทั้งหมดถูกต้อง'
  }

  let report = `⚠️ พบปัญหา ${issues.length} รายการ:\n\n`

  for (const issue of issues) {
    report += `• ${issue.customer_name}\n`
    report += `  สถานะปัจจุบัน: ${issue.current_status}\n`
    report += `  สถานะที่ควรเป็น: ${issue.expected_status}\n`
    report += `  เหตุผล: ${issue.issue_description}\n\n`
  }

  return report
}
