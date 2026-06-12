import { getSupabaseAdmin } from '@/lib/supabase'
import { dbErrorResponse } from '@/lib/api'

const DEFAULT_AUTHOR = 'พีท (ผู้จัดการก่อสร้าง)'

// PATCH /api/construction-logs/:id  — move through the approval workflow
//   action: 'submit'  draft → submitted
//           'approve' submitted → approved
//           'reopen'  any → draft
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

  const action = String(body.action ?? '')
  let patch: Record<string, unknown>
  switch (action) {
    case 'submit':
      patch = {
        submit_status: 'submitted',
        submitted_by: String(body.submitted_by ?? DEFAULT_AUTHOR),
        submitted_at: new Date().toISOString(),
      }
      break
    case 'approve':
      patch = { submit_status: 'approved' }
      break
    case 'reopen':
      patch = { submit_status: 'draft', submitted_by: null, submitted_at: null }
      break
    default:
      return Response.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
  }

  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('construction_logs')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return dbErrorResponse(error)

  return Response.json({ data })
}
