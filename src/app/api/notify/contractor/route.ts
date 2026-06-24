/**
 * POST /api/notify/contractor
 *
 * Central hub สำหรับส่งแจ้งเตือน contractor ผ่าน LINE/Email/In-app
 * 🔄 Updated: Writes to `notifications` table (unified notification system)
 */

import { createClient } from '@supabase/supabase-js'
import { buildNotificationMessage } from '@/lib/contractor-notification'

export const dynamic = 'force-dynamic'

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env not configured')
  return createClient(url, key)
}

export async function POST(request: Request) {
  try {
    const supabase = getServiceClient()
    const body = await request.json()
    const { recipientId, eventType, projectId, houseId, channel = 'in_app', metadata = {}, toDept = null } = body

    if (!recipientId || !eventType) {
      return Response.json({ error: 'Missing recipientId or eventType' }, { status: 400 })
    }

    const messages = buildNotificationMessage(eventType, metadata)

    // Determine notification type from eventType
    const typeMapping: Record<string, string> = {
      'milestone_approved': 'approval',
      'milestone_rejected': 'approval',
      'payment_approved': 'approval',
      'sla_alert': 'info',
      'spec_changed': 'workflow_update',
      'change_order': 'workflow_update',
      'contractor_scorecard': 'info'
    }
    const notificationType = typeMapping[eventType] || 'info'

    // Save to unified notifications table
    const { data: notif, error: notifError } = await supabase
      .from('notifications')
      .insert({
        type: notificationType,
        title: messages.subject,
        message: messages.message,
        from_dept: 'บริหารโครงการ',
        to_dept: toDept || 'ผู้รับเหมา',
        project_id: projectId || PROJECT_ID,
        is_read: false,
        record_id: houseId || null,
        link: null
      })
      .select()
      .single()

    if (notifError) throw notifError
    const logEntry = notif

    // Get contractor contact info
    const { data: contact } = await supabase
      .from('contractor_contacts')
      .select('*')
      .eq('contractor_id', recipientId)
      .single()

    let notificationSent = true
    let sendError: any = null

    // Send via channel
    if (channel === 'line' && contact?.line_user_id) {
      try {
        const lineResponse = await fetch('https://api.line.biz/v2.1/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            to: contact.line_user_id,
            messages: [{ type: 'text', text: messages.lineMessage }]
          })
        })
        if (!lineResponse.ok) {
          notificationSent = false
          sendError = new Error(`LINE API error: ${lineResponse.statusText}`)
        }
      } catch (error) {
        notificationSent = false
        sendError = error
      }
    }

    // Update notification if send failed (mark as read to hide from UI)
    if (!notificationSent) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', logEntry.id)
    }

    return Response.json({
      success: notificationSent,
      logId: logEntry.id,
      message: notificationSent ? `Notification sent via ${channel}` : `Failed: ${sendError?.message}`
    }, { status: notificationSent ? 200 : 207 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
