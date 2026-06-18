import { getSupabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase()
    const { searchParams } = new URL(req.url)

    const staff_id = searchParams.get('staff_id')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = sb.from('sales_daily_logs').select('*')

    if (staff_id) query = query.eq('staff_id', staff_id)
    if (from) query = query.gte('log_date', from)
    if (to) query = query.lte('log_date', to)

    const { data, error, count } = await query
      .order('log_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({ data, count, ok: true })
  } catch (err) {
    console.error('[GET /api/sales/daily-log]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase()
    const body = await req.json()

    const { staff_id, log_date, activities_calls, activities_visits, activities_meetings, customer_feedback, notes, action } = body

    if (!staff_id || !log_date) {
      return NextResponse.json({ error: 'Missing required fields', ok: false }, { status: 400 })
    }

    const logData = {
      staff_id,
      log_date,
      activities_calls: activities_calls || 0,
      activities_visits: activities_visits || 0,
      activities_meetings: activities_meetings || 0,
      customer_feedback: customer_feedback || '',
      notes: notes || '',
      status: action === 'submit' ? 'submitted' : 'draft',
      submitted_at: action === 'submit' ? new Date().toISOString() : null,
    }

    const { data, error } = await sb
      .from('sales_daily_logs')
      .insert([logData])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data, ok: true })
  } catch (err) {
    console.error('[POST /api/sales/daily-log]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sb = getSupabase()
    const body = await req.json()

    const { id, activities_calls, activities_visits, activities_meetings, customer_feedback, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing log id', ok: false }, { status: 400 })
    }

    const { data, error } = await sb
      .from('sales_daily_logs')
      .update({
        activities_calls: activities_calls ?? 0,
        activities_visits: activities_visits ?? 0,
        activities_meetings: activities_meetings ?? 0,
        customer_feedback: customer_feedback ?? '',
        notes: notes ?? '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'draft')
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data, ok: true })
  } catch (err) {
    console.error('[PATCH /api/sales/daily-log]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}
