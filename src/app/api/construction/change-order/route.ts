import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface CreateChangeOrderRequest {
  house_id: string
  description: string
  reason: string
  price_impact: number
  timeline_impact: number
  requested_by: string
  requested_by_role: string
}

interface UpdateChangeOrderRequest {
  change_order_id: string
  status: 'approved' | 'rejected' | 'pending'
  approval_notes?: string
  approved_by?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      house_id,
      description,
      reason,
      price_impact,
      timeline_impact,
      requested_by,
      requested_by_role
    } = body as CreateChangeOrderRequest

    if (!house_id || !description || !requested_by) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const sb = getSupabase()

    // Generate CO number: CO-YYYY-XXXXX
    const year = new Date().getFullYear()
    const yearStr = String(year).slice(-2)
    const result = await sb
      .from('spec_change_orders')
      .select('id', { count: 'exact' })
      .eq('created_at::date', new Date().toISOString().split('T')[0])

    const countToday = (result.count ?? 0) + 1
    const coNumber = `CO-${yearStr}-${String(countToday).padStart(5, '0')}`

    // Create change order
    const { data: changeOrder, error: coError } = await sb
      .from('spec_change_orders')
      .insert({
        house_id,
        co_number: coNumber,
        description,
        reason,
        price_impact,
        timeline_impact,
        requested_by,
        requested_by_role,
        status: 'pending',
        requested_at: new Date().toISOString()
      })
      .select()
      .single()

    if (coError) throw coError

    // Create audit log
    await sb
      .from('spec_audit_log')
      .insert({
        house_id,
        action: 'change_requested',
        changed_by: requested_by,
        change_description: `Change Order ${coNumber}: ${description}`,
        action_at: new Date().toISOString()
      })

    // Create notification for managers/directors to review
    const { data: house } = await sb
      .from('houses')
      .select('house_number, project_id')
      .eq('id', house_id)
      .single()

    if (house) {
      await sb
        .from('notification_log')
        .insert({
          recipient_type: 'project_manager',
          event_type: 'change_order_requested',
          project_id: house.project_id,
          house_id,
          subject: `Change Order ${coNumber} — ${house.house_number}`,
          message: `${description}\nราคาเพิ่มเติม: ฿${price_impact.toLocaleString()}\nเพิ่มเวลา: ${timeline_impact} วัน`,
          channel: 'in_app',
          status: 'pending'
        })
    }

    return NextResponse.json({
      ok: true,
      message: `Change Order ${coNumber} created successfully`,
      changeOrder
    }, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/construction/change-order]', error)
    return NextResponse.json(
      { error: 'Failed to create change order', details: error.message },
      { status: 400 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      change_order_id,
      status,
      approval_notes,
      approved_by
    } = body as UpdateChangeOrderRequest

    if (!change_order_id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const sb = getSupabase()

    // Update change order status
    const { data: changeOrder, error: updateError } = await sb
      .from('spec_change_orders')
      .update({
        status,
        approval_notes,
        approved_by,
        approved_at: status !== 'pending' ? new Date().toISOString() : null
      })
      .eq('id', change_order_id)
      .select()
      .single()

    if (updateError) throw updateError

    // Create audit log
    const { data: co } = await sb
      .from('spec_change_orders')
      .select('house_id, description')
      .eq('id', change_order_id)
      .single()

    if (co) {
      await sb
        .from('spec_audit_log')
        .insert({
          house_id: co.house_id,
          action: `change_${status}`,
          changed_by: approved_by || 'system',
          change_description: `${co.description} — ${approval_notes || ''}`,
          action_at: new Date().toISOString()
        })
    }

    return NextResponse.json({
      ok: true,
      message: `Change Order ${status} successfully`,
      changeOrder
    })
  } catch (error: any) {
    console.error('[PATCH /api/construction/change-order]', error)
    return NextResponse.json(
      { error: 'Failed to update change order', details: error.message },
      { status: 400 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const house_id = url.searchParams.get('house_id')

    if (!house_id) {
      return NextResponse.json(
        { error: 'Missing house_id parameter' },
        { status: 400 }
      )
    }

    const sb = getSupabase()

    const { data: changeOrders, error } = await sb
      .from('spec_change_orders')
      .select('*')
      .eq('house_id', house_id)
      .order('requested_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      ok: true,
      changeOrders: changeOrders || []
    })
  } catch (error: any) {
    console.error('[GET /api/construction/change-order]', error)
    return NextResponse.json(
      { error: 'Failed to fetch change orders', details: error.message },
      { status: 400 }
    )
  }
}
