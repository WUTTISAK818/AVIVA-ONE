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

    const project_id = searchParams.get('project_id')

    let query = db.from('vw_construction_progress').select('*')

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
    const user = await verifyAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = serverDb(req.headers.get('Authorization')?.slice(7) || '')
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

    const { data, error } = await db
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
