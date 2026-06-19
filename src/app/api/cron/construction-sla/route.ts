import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateSLAStatus } from '@/lib/sla-calculation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROJECT_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  if (header === `Bearer ${secret}`) return true
  return req.nextUrl.searchParams.get('secret') === secret
}

interface ConstructionUnit {
  id: string
  house_id: string
  house_number: string
  current_stage: string
  stage_start_date: string | null
  expected_completion_date: string | null
  last_milestone_approved_at: string | null
  days_late: number | null
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = admin()
  const now = new Date()

  try {
    // Get all in-progress construction units
    const { data: units, error: unitsErr } = await db
      .from('construction_unit_progress')
      .select(`
        id,
        house_id,
        house_number,
        current_stage,
        stage_start_date,
        expected_completion_date,
        last_milestone_approved_at
      `)
      .eq('project_id', PROJECT_ID)
      .neq('current_stage', 'handover')
      .neq('current_stage', 'complete')

    if (unitsErr) throw unitsErr

    let processed = 0
    let alertsSent = 0
    const results: string[] = []

    for (const unit of (units ?? []) as ConstructionUnit[]) {
      // Use expected_completion_date or estimate from stage_start_date + 30 days
      const expectedDate = unit.expected_completion_date
        ? new Date(unit.expected_completion_date)
        : unit.stage_start_date
          ? new Date(new Date(unit.stage_start_date).getTime() + 30 * 24 * 60 * 60 * 1000)
          : new Date()

      const slaStatus = calculateSLAStatus(expectedDate, unit.stage_start_date ? new Date(unit.stage_start_date) : now)

      // Update construction_unit_progress with calculated days_late
      const { error: updateErr } = await db
        .from('construction_unit_progress')
        .update({
          days_late: slaStatus.daysLate
        })
        .eq('id', unit.id)

      if (updateErr) {
        console.error(`Failed to update days_late for unit ${unit.house_number}:`, updateErr)
        continue
      }

      processed++

      // Send alerts if needed
      if (slaStatus.shouldNotify) {
        try {
          // Create SLA alert history record
          const { error: historyErr } = await db
            .from('sla_alert_history')
            .insert({
              project_id: PROJECT_ID,
              house_id: unit.house_id,
              alert_level: slaStatus.alertLevel,
              days_late: slaStatus.daysLate,
              message: slaStatus.message,
              notified_roles: slaStatus.notifyRoles,
              alert_sent_at: now.toISOString()
            })

          if (historyErr) {
            console.error(`Failed to create alert history for ${unit.house_number}:`, historyErr)
          } else {
            alertsSent++
            results.push(`${unit.house_number}:${slaStatus.alertLevel}:${slaStatus.daysLate}d`)
          }

          // Create notifications for each role
          for (const role of slaStatus.notifyRoles) {
            await db
              .from('notification_log')
              .insert({
                recipient_type: role,
                event_type: `sla_alert_${slaStatus.alertLevel}`,
                project_id: PROJECT_ID,
                house_id: unit.house_id,
                subject: `${slaStatus.icon} SLA Alert: ${unit.house_number} ${slaStatus.message}`,
                message: `Unit ${unit.house_number} is ${slaStatus.daysLate} days late at stage: ${unit.current_stage}`,
                channel: 'in_app',
                status: 'pending'
              })
          }
        } catch (alertErr) {
          console.error(`Failed to send alerts for unit ${unit.house_number}:`, alertErr)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      alertsSent,
      items: results
    })
  } catch (error: any) {
    console.error('Construction SLA cron error:', error)
    return NextResponse.json(
      { error: 'Cron execution failed', details: error.message },
      { status: 500 }
    )
  }
}
