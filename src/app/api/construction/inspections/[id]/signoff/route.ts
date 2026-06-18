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

    // TODO: Implement based on action (inspect, approve, owner-sign)
    // For now, skeleton response

    return NextResponse.json({
      message: `[${action}] action placeholder - implement per phase`,
      installmentId,
      ok: true,
    })
  } catch (err) {
    console.error('[POST /api/construction/inspections/[id]/signoff]', err)
    return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
  }
}
