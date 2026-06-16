import { getSupabaseAdmin } from '@/lib/supabase'
import { dbErrorResponse } from '@/lib/api'

const ALLOWED_STATUS = ['open', 'in_progress', 'resolved']
const ALLOWED_SEVERITY = ['low', 'medium', 'high', 'critical']

// PATCH /api/qc-defects/:id  — update status / severity / escalation flag
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (body.status !== undefined) {
    const status = String(body.status)
    if (!ALLOWED_STATUS.includes(status)) {
      return Response.json({ error: `status ไม่ถูกต้อง: ${status}` }, { status: 400 })
    }
    patch.status = status
  }

  if (body.severity !== undefined) {
    const severity = String(body.severity)
    if (!ALLOWED_SEVERITY.includes(severity)) {
      return Response.json({ error: `severity ไม่ถูกต้อง: ${severity}` }, { status: 400 })
    }
    patch.severity = severity
  }

  if (body.escalated !== undefined) {
    patch.escalated = Boolean(body.escalated)
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'ไม่มีฟิลด์ให้อัปเดต' }, { status: 400 })
  }

  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('qc_defects')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return dbErrorResponse(error)

  return Response.json({ data })
}
