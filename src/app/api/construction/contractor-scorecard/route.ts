import { getSupabase } from '@/lib/supabase'
import { serverDb } from '@/lib/server-db'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  return error || !user ? null : user
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = serverDb(req.headers.get('Authorization')?.slice(7) || '')
    const { searchParams } = new URL(req.url)

    const period_id = searchParams.get('period_id')
    const project_id = searchParams.get('project_id')

    let query = db.from('contractor_scorecard').select('*')

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
    const user = await verifyAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = serverDb(req.headers.get('Authorization')?.slice(7) || '')
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

    const { data, error } = await db
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
