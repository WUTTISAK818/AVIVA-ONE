import { getSupabaseAdmin } from '@/lib/supabase'
import { dbErrorResponse } from '@/lib/api'

const DEFAULT_AUTHOR = 'พีท (ผู้จัดการก่อสร้าง)'

// POST /api/construction-logs  — create a log as draft or submit-for-approval
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const projectId = String(body.project_id ?? '').trim()
  const logDate = String(body.log_date ?? '').trim()
  if (!projectId || !logDate) {
    return Response.json({ error: 'project_id และ log_date จำเป็นต้องระบุ' }, { status: 400 })
  }

  const submit = body.action === 'submit'
  const photoUrls = Array.isArray(body.photo_urls)
    ? (body.photo_urls as unknown[]).map(String).filter(Boolean)
    : []

  const row = {
    project_id: projectId,
    log_date: logDate,
    progress_percent:
      body.progress_percent === null || body.progress_percent === undefined
        ? null
        : Number(body.progress_percent),
    notes: body.notes ? String(body.notes) : null,
    draft_report: body.draft_report ? String(body.draft_report) : null,
    photo_urls: photoUrls.length ? photoUrls : null,
    submit_status: submit ? 'submitted' : 'draft',
    submitted_by: submit ? String(body.submitted_by ?? DEFAULT_AUTHOR) : null,
    submitted_at: submit ? new Date().toISOString() : null,
  }

  const sb = getSupabaseAdmin()
  const { data, error } = await sb.from('construction_logs').insert(row).select('*').single()

  if (error) return dbErrorResponse(error)

  return Response.json({ data }, { status: 201 })
}
