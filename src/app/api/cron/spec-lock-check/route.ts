import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROJECT_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env not configured')
  return createClient(url, key)
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  if (header === `Bearer ${secret}`) return true
  return req.nextUrl.searchParams.get('secret') === secret
}

interface House {
  id: string
  house_number: string
  status: string
  spec_locked_at: string | null
  spec_locked_by: string | null
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = admin()
  const now = new Date()

  try {
    // Find all houses with construction_status = 'active' that haven't been locked yet
    const { data: houses, error: housesErr } = await db
      .from('houses')
      .select('id, house_number, status, spec_locked_at, spec_locked_by')
      .eq('project_id', PROJECT_ID)
      .eq('construction_status', 'active')
      .is('spec_locked_at', null)

    if (housesErr) throw housesErr

    let locked = 0
    const results: string[] = []

    for (const house of (houses ?? []) as House[]) {
      try {
        // Lock specifications
        const { error: lockErr } = await db
          .from('houses')
          .update({
            spec_locked_at: now.toISOString(),
            spec_locked_by: 'system'
          })
          .eq('id', house.id)

        if (lockErr) {
          console.error(`Failed to lock spec for ${house.house_number}:`, lockErr)
          continue
        }

        // Create audit log
        const { error: auditErr } = await db
          .from('spec_audit_log')
          .insert({
            house_id: house.id,
            action: 'auto_locked',
            changed_by: 'system',
            change_description: 'Automatically locked when construction started',
            action_at: now.toISOString()
          })

        if (auditErr) {
          console.error(`Failed to create audit log for ${house.house_number}:`, auditErr)
        } else {
          locked++
          results.push(`${house.house_number}:locked`)
        }
      } catch (err) {
        console.error(`Error processing house ${house.house_number}:`, err)
      }
    }

    return NextResponse.json({
      ok: true,
      locked,
      items: results
    })
  } catch (error: any) {
    console.error('Spec lock check cron error:', error)
    return NextResponse.json(
      { error: 'Cron execution failed', details: error.message },
      { status: 500 }
    )
  }
}
