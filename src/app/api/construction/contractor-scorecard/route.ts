import { getSupabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase()
    const { searchParams } = new URL(req.url)

    const period_id = searchParams.get('period_id')
    const project_id = searchParams.get('project_id')

    let query = sb.from('contractor_scorecard').select('*')

    if (period_id) query = query.eq('period_id', period_id)
    if (project_id) query = query.eq('project_id', project_id)

    const { data, error } = await query.order('composite_score', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data, ok: true })
  } catch (err) {
    console.error('[GET /api/construction/contractor-scorecard]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase()
    const body = await req.json()

    const {
      contractor_name,
      period_id,
      project_id,
      quality_score,
      defect_count,
      timeliness_score,
      approval_rate,
      composite_score,
      performance_tier,
    } = body

    if (!contractor_name || !period_id || !project_id) {
      return NextResponse.json({ error: 'Missing required fields', ok: false }, { status: 400 })
    }

    const scoreData = {
      contractor_name,
      period_id,
      project_id,
      quality_score: quality_score || 0,
      defect_count: defect_count || 0,
      timeliness_score: timeliness_score || 0,
      approval_rate: approval_rate || 0,
      composite_score: composite_score || 0,
      performance_tier: performance_tier || 'C',
    }

    const { data, error } = await sb
      .from('contractor_scorecard')
      .upsert([scoreData], { onConflict: 'contractor_name,period_id,project_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data, ok: true })
  } catch (err) {
    console.error('[POST /api/construction/contractor-scorecard]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}
