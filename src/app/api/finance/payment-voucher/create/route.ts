/**
 * POST /api/finance/payment-voucher/create
 *
 * ทำให้เมื่อวิศวกรอนุมัติ milestone จะสร้าง Payment Voucher อัตโนมัติ
 * ระบบจะคำนวณ penalty, tax, retention และส่ง draft voucher ให้ผู้บริหารตรวจเพื่อลงนาม
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { calculatePayment, calculateDaysLate } from '@/lib/finance-calculation'
import { verifyAuth } from '@/lib/api-auth'
import { MANAGER_ROLES } from '@/lib/roles'

export const dynamic = 'force-dynamic'

interface CreatePaymentVoucherRequest {
  projectId: string
  houseId: string
  constructionProgressId: string
  contractorId: string
  stageName: string
  contractPaymentPerMilestone: number
  contractDueDate: string
  approvedDate: string
  dailyPenaltyRate: number
  retentionRate: number
  createdBy: string
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env not configured')
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    // Verify authorization - only finance managers and admins can create vouchers
    const { user, error: authError } = await verifyAuth(request as NextRequest, ['admin', 'ceo', 'coo', 'finance_manager', 'manager']);
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || "Unauthorized - Finance role required" },
        { status: 401 }
      );
    }

    const supabase = getServiceClient()
    const body: CreatePaymentVoucherRequest = await request.json()

    // Validate input
    if (!body.projectId || !body.houseId || !body.contractorId) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate days late
    const contractDueDate = new Date(body.contractDueDate)
    const approvedDate = new Date(body.approvedDate)
    const daysLate = calculateDaysLate(contractDueDate, approvedDate)

    // Calculate payment breakdown
    const paymentCalc = calculatePayment(
      body.contractPaymentPerMilestone,
      daysLate,
      body.dailyPenaltyRate,
      body.retentionRate
    )

    // Generate Payment Voucher Number
    // Format: FIN-2569-XXXXX (FIN-YYYY-NNNNN)
    const year = new Date().getFullYear() + 543 // Buddhist year
    const result = await supabase
      .from('payment_vouchers')
      .select('id', { count: 'exact' })
      .eq('created_at', new Date().toISOString().split('T')[0])

    const countToday = result.count || 0
    const voucherNumber = `FIN-${year}-${String(countToday + 1).padStart(5, '0')}`

    // Create Payment Voucher
    const { data: voucher, error: voucherError } = await supabase
      .from('payment_vouchers')
      .insert({
        project_id: body.projectId,
        house_id: body.houseId,
        contractor_id: body.contractorId,
        construction_progress_id: body.constructionProgressId,

        stage_name: body.stageName,
        base_amount: paymentCalc.baseAmount,
        days_late: paymentCalc.daysLate,
        daily_penalty_rate: paymentCalc.dailyPenaltyRate,
        penalty_amount: paymentCalc.penaltyAmount,

        gross_amount: paymentCalc.grossAmount,
        tax_3percent: paymentCalc.tax3Percent,
        retention_rate: paymentCalc.retentionRate,
        retention_amount: paymentCalc.retentionAmount,

        net_amount: paymentCalc.netAmount,
        status: 'draft',
        submitted_by: body.createdBy,
        submitted_at: new Date(),

        voucher_number: voucherNumber
      })
      .select()
      .single()

    if (voucherError) throw voucherError

    // Update construction_unit_progress with last_milestone_approved_at
    const { error: updateError } = await supabase
      .from('construction_unit_progress')
      .update({
        last_milestone_approved_at: approvedDate,
        days_late: daysLate
      })
      .eq('id', body.constructionProgressId)

    if (updateError) throw updateError

    // Create notification for Finance Manager to review - unified notifications table
    const PROJECT_ID = body.projectId
    await supabase
      .from('notifications')
      .insert({
        type: 'approval',
        title: `Payment Voucher ${voucherNumber} Ready for Review`,
        message: `📝 ${body.stageName} payment voucher (${voucherNumber}) has been created\n💰 Net Amount: ฿${paymentCalc.netAmount.toLocaleString()}\n⏰ Ready to submit for approval`,
        from_dept: 'ก่อสร้าง',
        to_dept: 'การเงิน',
        project_id: PROJECT_ID,
        record_id: voucher.id,
        is_read: false,
        link: `/office?tab=finance`
      })

    return Response.json(
      {
        success: true,
        voucher,
        calculation: paymentCalc,
        message: `Payment Voucher ${voucherNumber} created successfully`
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating payment voucher:', error)
    return Response.json(
      {
        error: 'Failed to create payment voucher',
        details: error.message
      },
      { status: 500 }
    )
  }
}
