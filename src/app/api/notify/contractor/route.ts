/**
 * POST /api/notify/contractor
 *
 * Central hub สำหรับส่งแจ้งเตือน contractor ผ่าน LINE/Email/In-app
 */

import { createClient } from '@supabase/supabase-js'
import { buildNotificationMessage } from '@/lib/contractor-notification'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, serviceRoleKey)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { recipientId, eventType, projectId, houseId, channel = 'in_app', metadata = {} } = body

    if (!recipientId || !eventType) {
      return Response.json({ error: 'Missing recipientId or eventType' }, { status: 400 })
    }

    const messages = buildNotificationMessage(eventType, metadata)

    // Save to notification_log
    const { data: logEntry, error: logError } = await supabase
      .from('notification_log')
      .insert({
        recipient_id: recipientId,
        event_type: eventType,
        project_id: projectId,
        house_id: houseId,
        subject: messages.subject,
        message: messages.message,
        channel,
        status: 'pending',
        created_at: new Date()
      })
      .select()
      .single()

    if (logError) throw logError

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

    // Update log status
    await supabase
      .from('notification_log')
      .update({
        status: notificationSent ? 'sent' : 'failed',
        sent_at: notificationSent ? new Date() : null,
        error_message: sendError?.message || null
      })
      .eq('id', logEntry.id)

    return Response.json({
      success: notificationSent,
      logId: logEntry.id,
      message: notificationSent ? `Notification sent via ${channel}` : `Failed: ${sendError?.message}`
    }, { status: notificationSent ? 200 : 207 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
