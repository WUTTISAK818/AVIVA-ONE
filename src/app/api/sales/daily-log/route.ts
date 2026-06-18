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
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = sb.from('sales_daily_logs').select('*')

    if (staff_id) query = query.eq('staff_id', staff_id)
    if (from) query = query.gte('log_date', from)
    if (to) query = query.lte('log_date', to)

    const { data, error } = await query
      .order('log_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({ data, ok: true })
  } catch (err) {
    console.error('[GET /api/sales/daily-log]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase()
    const body = await req.json()

    const {
      staff_id,
      staff_name,
      log_date,
      activities_calls,
      activities_visits,
      activities_meetings,
      customer_feedback,
      notes,
      status,
    } = body

    if (!staff_id || !log_date) {
      return NextResponse.json({ error: 'Missing staff_id or log_date', ok: false }, { status: 400 })
    }

    if (activities_calls === undefined || activities_visits === undefined || activities_meetings === undefined) {
      return NextResponse.json({ error: 'Missing activity counts', ok: false }, { status: 400 })
    }

    if (activities_calls === 0 && activities_visits === 0 && activities_meetings === 0) {
      return NextResponse.json(
        { error: 'Please log at least one activity', ok: false },
        { status: 400 }
      )
    }

    const logData = {
      staff_id,
      staff_name: staff_name || 'Staff',
      log_date,
      activities_calls,
      activities_visits,
      activities_meetings,
      customer_feedback: customer_feedback || '',
      notes: notes || '',
      status: status || 'draft',
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    }

    const { data, error } = await sb
      .from('sales_daily_logs')
      .upsert([logData], { onConflict: 'staff_id,log_date' })
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

    const { staff_id, log_date, ...updates } = body

    if (!staff_id || !log_date) {
      return NextResponse.json({ error: 'Missing staff_id or log_date', ok: false }, { status: 400 })
    }

    const { data: existingLog, error: fetchErr } = await sb
      .from('sales_daily_logs')
      .select('*')
      .eq('staff_id', staff_id)
      .eq('log_date', log_date)
      .single()

    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr

    if (existingLog?.status === 'submitted') {
      return NextResponse.json(
        { error: 'Cannot update submitted logs', ok: false },
        { status: 400 }
      )
    }

    const { data, error } = await sb
      .from('sales_daily_logs')
      .update(updates)
      .eq('staff_id', staff_id)
      .eq('log_date', log_date)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data, ok: true })
  } catch (err) {
    console.error('[PATCH /api/sales/daily-log]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}
