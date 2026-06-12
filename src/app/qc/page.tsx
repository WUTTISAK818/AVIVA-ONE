import { getSupabase } from '@/lib/supabase'
import QCDefectQueue, { type DefectRow } from '@/components/QCDefectQueue'

export const dynamic = 'force-dynamic'

export default async function QCPage() {
  const sb = getSupabase()

  // Fetch separately and join in code (FK cache may lag after migration)
  const [{ data: defectsRaw }, { data: houses }, { data: projects }] = await Promise.all([
    sb.from('qc_defects').select('*').order('created_at', { ascending: false }),
    sb.from('houses').select('id, house_number, project_id'),
    sb.from('projects').select('id, project_name'),
  ])

  const houseMap = Object.fromEntries((houses ?? []).map(h => [h.id, h]))
  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p.project_name]))

  const defects: DefectRow[] = (defectsRaw ?? []).map(d => {
    const house = houseMap[d.house_id ?? '']
    return {
      id: d.id,
      defect_type: d.defect_type ?? null,
      defect_detail: d.defect_detail ?? null,
      status: d.status ?? 'open',
      // new columns degrade gracefully if the migration hasn't run yet
      severity: d.severity ?? 'medium',
      sla_days: d.sla_days ?? null,
      due_date: d.due_date ?? null,
      priority: d.priority ?? null,
      created_at: d.created_at ?? null,
      houseNum: house?.house_number ?? '—',
      projectName: projectMap[house?.project_id ?? ''] ?? '—',
    }
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">ตรวจสอบคุณภาพ (QC)</h1>
        <p className="text-sm text-slate-500 mt-0.5">คิวงานแก้ไขข้อบกพร่อง · จัดลำดับตามความรุนแรงและ SLA</p>
      </div>

      <QCDefectQueue defects={defects} />
    </div>
  )
}
