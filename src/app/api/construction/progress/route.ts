import { getSupabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase()
    const { searchParams } = new URL(req.url)

    const project_id = searchParams.get('project_id')

    let query = sb.from('vw_construction_progress').select('*')

    if (project_id) query = query.eq('project_id', project_id)

    const { data, error } = await query.order('overall_percentage', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data, ok: true })
  } catch (err) {
    console.error('[GET /api/construction/progress]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase()
    const body = await req.json()

    const {
      house_id,
      current_stage,
      stage_percentage,
      overall_percentage,
    } = body

    if (!house_id) {
      return NextResponse.json({ error: 'Missing house_id', ok: false }, { status: 400 })
    }

    const progressData = {
      house_id,
      current_stage: current_stage || 'foundation',
      stage_percentage: stage_percentage || 0,
      overall_percentage: overall_percentage || 0,
    }

    const { data, error } = await sb
      .from('construction_unit_progress')
      .upsert([progressData], { onConflict: 'house_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data, ok: true })
  } catch (err) {
    console.error('[POST /api/construction/progress]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}
