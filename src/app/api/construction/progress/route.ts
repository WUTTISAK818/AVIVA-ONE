import { getSupabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('vw_construction_progress')
      .select('*')
      .order('updated_at', { ascending: false })

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

    const { house_id, current_stage, stage_percentage, overall_percentage, updated_by } = body

    if (!house_id) {
      return NextResponse.json({ error: 'Missing house_id', ok: false }, { status: 400 })
    }

    const progressData = {
      house_id,
      current_stage: current_stage || 'foundation',
      stage_percentage: stage_percentage || 0,
      overall_percentage: overall_percentage || 0,
      updated_by: updated_by || null,
      updated_at: new Date().toISOString(),
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
