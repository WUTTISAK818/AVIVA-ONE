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
