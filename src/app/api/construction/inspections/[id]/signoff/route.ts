import { getSupabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sb = getSupabase()
    const { id: installmentId } = await params

    // Check readiness (gate conditions)
    const { data: readiness, error: readinessErr } = await sb
      .from('vw_inspection_readiness')
      .select('*')
      .eq('installment_id', installmentId)
      .single()

    if (readinessErr && readinessErr.code !== 'PGRST116') throw readinessErr

    // Get signoff history
    const { data: signoffs, error: signoffErr } = await sb
      .from('inspection_signoffs')
      .select('*')
      .eq('installment_id', installmentId)
      .order('created_at', { ascending: false })

    if (signoffErr) throw signoffErr

    return NextResponse.json({
      readiness: readiness || null,
      signoffs: signoffs || [],
      ok: true,
    })
  } catch (err) {
    console.error('[GET /api/construction/inspections/[id]/signoff]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sb = getSupabase()
    const body = await req.json()
    const { id: installmentId } = await params

    const {
      house_id,
      action,
      photo_url_before,
      photo_url_after,
      inspected_by,
      approval_notes,
      owner_signed_by,
      next_stage,
    } = body

    if (!house_id) {
      return NextResponse.json({ error: 'Missing house_id', ok: false }, { status: 400 })
    }

    if (!action) {
      return NextResponse.json({ error: 'Missing action', ok: false }, { status: 400 })
    }

    let signoffData: any = {
      installment_id: installmentId,
      house_id,
    }

    if (action === 'inspect') {
      if (!inspected_by) {
        return NextResponse.json({ error: 'Missing inspected_by', ok: false }, { status: 400 })
      }
      signoffData = {
        ...signoffData,
        inspected_by,
        inspected_at: new Date().toISOString(),
        photo_url_before: photo_url_before || null,
        photo_url_after: photo_url_after || null,
        all_items_passed: body.all_items_passed || false,
      }
    } else if (action === 'approve') {
      if (!body.approved_by) {
        return NextResponse.json({ error: 'Missing approved_by', ok: false }, { status: 400 })
      }
      if (!approval_notes) {
        return NextResponse.json({ error: 'Missing approval_notes', ok: false }, { status: 400 })
      }
      signoffData = {
        ...signoffData,
        approved_by: body.approved_by,
        approved_at: new Date().toISOString(),
        approval_notes,
      }
    } else if (action === 'reject') {
      if (!body.rejected_reason) {
        return NextResponse.json({ error: 'Missing rejected_reason', ok: false }, { status: 400 })
      }
      signoffData = {
        ...signoffData,
        rejected_by: body.rejected_by,
        rejected_at: new Date().toISOString(),
        rejected_reason: body.rejected_reason
      }
    } else if (action === 'owner-sign') {
      if (!owner_signed_by) {
        return NextResponse.json({ error: 'Missing owner_signed_by', ok: false }, { status: 400 })
      }
      signoffData = {
        ...signoffData,
        owner_signed_by,
        owner_signed_at: new Date().toISOString(),
        next_stage: next_stage || null,
      }
    }

    const { data, error } = await sb
      .from('inspection_signoffs')
      .upsert([signoffData], {
        onConflict: 'installment_id,house_id',
      })
      .select()
      .single()

    if (error) throw error

    // 🔴 P1: FINANCE AUTO-SYNC — Create Payment Voucher automatically
    if (action === 'approve') {
      try {
        // Get construction progress details for payment voucher
        const { data: constructionData, error: constructionErr } = await sb
          .from('construction_unit_progress')
          .select('*')
          .eq('house_id', house_id)
          .single()

        if (!constructionErr && constructionData) {
          // Get contractor contract details
          const { data: house, error: houseErr } = await sb
            .from('houses')
            .select('project_id, contractor_id')
            .eq('id', house_id)
            .single()

          if (!houseErr && house) {
            const { data: contract, error: contractErr } = await sb
              .from('contractor_contracts')
              .select('*')
              .eq('contractor_id', house.contractor_id)
              .eq('project_id', house.project_id)
              .single()

            if (!contractErr && contract) {
              // Calculate expected completion date
              const today = new Date()
              const expectedCompletionDate = new Date(
                today.getTime() + contract.contractual_days_per_stage * 24 * 60 * 60 * 1000
              )

              // Call payment voucher creation API
              const paymentResponse = await fetch(
                `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/finance/payment-voucher/create`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
                  },
                  body: JSON.stringify({
                    projectId: house.project_id,
                    houseId: house_id,
                    constructionProgressId: constructionData.id,
                    contractorId: house.contractor_id,
                    stageName: constructionData.current_stage,
                    contractPaymentPerMilestone: contract.payment_per_milestone,
                    contractDueDate: expectedCompletionDate.toISOString(),
                    approvedDate: new Date().toISOString(),
                    dailyPenaltyRate: contract.daily_penalty_rate,
                    retentionRate: contract.retention_rate,
                    createdBy: body.approved_by
                  })
                }
              )

              if (paymentResponse.ok) {
                const voucherResult = await paymentResponse.json()
                console.log('✅ Payment Voucher created:', voucherResult.voucher?.id)
              } else {
                console.error('⚠️ Failed to create payment voucher:', await paymentResponse.text())
              }
            }
          }
        }
      } catch (paymentError) {
        console.error('⚠️ Payment voucher creation error (non-critical):', paymentError)
        // Don't throw - let signoff complete even if voucher fails
      }
    }

    // 🔴 P2: CONTRACTOR NOTIFICATION — Send alerts
    if ((action === 'approve' || action === 'reject') && house_id) {
      try {
        const { data: house } = await sb.from('houses').select('contractor_id, house_number').eq('id', house_id).single()
        const { data: progress } = await sb.from('construction_unit_progress').select('current_stage').eq('house_id', house_id).single()

        if (house && progress) {
          const eventType = action === 'approve' ? 'milestone_approved' : 'milestone_rejected'
          const notifyData = {
            recipientId: house.contractor_id,
            eventType,
            projectId: body.project_id,
            houseId: house_id,
            channel: 'line',
            metadata: {
              projectName: 'AVIVA Private',
              houseNumber: house.house_number,
              stageName: progress.current_stage,
              ...(action === 'reject' && { reason: body.rejected_reason, engineerName: body.rejected_by })
            }
          }

          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notify/contractor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notifyData)
          })
        }
      } catch (notifyError) {
        console.error('⚠️ Notification send error (non-critical):', notifyError)
      }
    }

    return NextResponse.json({
      data,
      message: `${action} signoff recorded successfully`,
      ok: true,
    })
  } catch (err) {
    console.error('[POST /api/construction/inspections/[id]/signoff]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}
