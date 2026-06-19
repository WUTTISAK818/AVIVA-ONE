import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface LockSpecRequest {
  house_id: string
  locked_by: string
}

interface UnlockSpecRequest {
  house_id: string
  unlocked_by: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { house_id, locked_by } = body as LockSpecRequest

    if (!house_id || !locked_by) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const sb = getSupabase()

    // Lock specification
    const { data, error } = await sb
      .from('houses')
      .update({
        spec_locked_at: new Date().toISOString(),
        spec_locked_by: locked_by
      })
      .eq('id', house_id)
      .select()
      .single()

    if (error) throw error

    // Create audit log
    await sb
      .from('spec_audit_log')
      .insert({
        house_id,
        action: 'locked',
        changed_by: locked_by,
        change_description: 'Specifications locked when construction started',
        action_at: new Date().toISOString()
      })

    return NextResponse.json({
      ok: true,
      message: 'Specifications locked successfully',
      data
    })
  } catch (error: any) {
    console.error('[POST /api/construction/spec-lock]', error)
    return NextResponse.json(
      { error: 'Failed to lock specifications', details: error.message },
      { status: 400 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const house_id = url.searchParams.get('house_id')
    const unlocked_by = url.searchParams.get('unlocked_by')

    if (!house_id || !unlocked_by) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const sb = getSupabase()

    // Unlock specification
    const { data, error } = await sb
      .from('houses')
      .update({
        spec_locked_at: null,
        spec_locked_by: null
      })
      .eq('id', house_id)
      .select()
      .single()

    if (error) throw error

    // Create audit log
    await sb
      .from('spec_audit_log')
      .insert({
        house_id,
        action: 'unlocked',
        changed_by: unlocked_by,
        change_description: 'Specifications unlocked',
        action_at: new Date().toISOString()
      })

    return NextResponse.json({
      ok: true,
      message: 'Specifications unlocked successfully',
      data
    })
  } catch (error: any) {
    console.error('[DELETE /api/construction/spec-lock]', error)
    return NextResponse.json(
      { error: 'Failed to unlock specifications', details: error.message },
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

    // Get spec lock status and audit history
    const [{ data: house }, { data: history }] = await Promise.all([
      sb
        .from('houses')
        .select('id, house_number, spec_locked_at, spec_locked_by')
        .eq('id', house_id)
        .single(),
      sb
        .from('spec_audit_log')
        .select('*')
        .eq('house_id', house_id)
        .order('action_at', { ascending: false })
    ])

    return NextResponse.json({
      ok: true,
      house,
      history: history || []
    })
  } catch (error: any) {
    console.error('[GET /api/construction/spec-lock]', error)
    return NextResponse.json(
      { error: 'Failed to fetch spec lock status', details: error.message },
      { status: 400 }
    )
  }
}
