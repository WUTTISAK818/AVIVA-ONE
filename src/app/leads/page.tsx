import { getSupabase } from '@/lib/supabase'
import { fmt, STATUS_LEAD, normalizeLeadStatus } from '@/lib/types'
import { Target, Phone, DollarSign } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PIPELINE_ORDER = ['new', 'contacted', 'qualified', 'converted', 'unqualified'] as const
const SOURCE_COLORS: Record<string, string> = {
  Facebook: 'bg-blue-900/40 text-blue-300',
  LINE:     'bg-emerald-900/40 text-emerald-300',
  'Walk-in':'bg-amber-900/40 text-amber-300',
  Referral: 'bg-purple-900/40 text-purple-300',
  Website:  'bg-slate-700 text-slate-300',
}

export default async function LeadsPage() {
  const sb = getSupabase()

  const [{ data: leads }, { data: projects }, { data: users }] = await Promise.all([
    sb.from('leads').select('*').order('created_at', { ascending: false }),
    sb.from('projects').select('id, project_name'),
    sb.from('users').select('id, full_name'),
  ])

  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p.project_name]))
  const userMap    = Object.fromEntries((users ?? []).map(u => [u.id, u.full_name]))

  // Source breakdown
  const sources = (leads ?? []).reduce<Record<string, number>>((acc, l) => {
    const s = l.source ?? 'อื่นๆ'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  const total = leads?.length ?? 1

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">ลีด & Pipeline การขาย</h1>
          <p className="text-sm text-slate-500 mt-0.5">ติดตามสถานะลูกค้าเป้าหมายทั้งหมด</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2">
          <Target size={15} className="text-amber-400" />
          <span className="text-sm font-bold text-white">{total}</span>
          <span className="text-xs text-slate-500">ลีดทั้งหมด</span>
        </div>
      </div>

      {/* Source breakdown */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">แหล่งที่มาลีด</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(sources).map(([src, cnt]) => (
            <div key={src} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${SOURCE_COLORS[src] ?? 'bg-slate-700 text-slate-300'}`}>
              {src} <span className="font-bold">{cnt}</span>
              <span className="opacity-60">({Math.round((cnt / total) * 100)}%)</span>
            </div>
          ))}
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
          {Object.entries(sources).map(([src, cnt]) => (
            <div key={src} className={`h-full ${SOURCE_COLORS[src]?.split(' ')[0] ?? 'bg-slate-700'} opacity-80`} style={{ width: `${(cnt / total) * 100}%` }} />
          ))}
        </div>
      </div>

      {/* Kanban Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {PIPELINE_ORDER.map(status => {
          const cfg = STATUS_LEAD[status]
          const statusLeads = (leads ?? []).filter(l => normalizeLeadStatus(l.status) === status)
          const budgetSum = statusLeads.reduce((s, l) => s + (l.budget ?? 0), 0)
          return (
            <div key={status} className="flex flex-col">
              <div className={`flex items-center justify-between mb-2 px-1`}>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-slate-600 font-mono">{statusLeads.length}</span>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {statusLeads.map(lead => (
                  <div key={lead.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition-colors">
                    <p className="text-xs font-semibold text-slate-200 mb-1">{lead.customer_name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                      <Phone size={9} />{lead.phone}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-2">
                      <DollarSign size={9} />
                      <span className="font-mono text-slate-400">{fmt(lead.budget ?? 0)}</span>
                    </div>
                    {lead.source && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_COLORS[lead.source] ?? 'bg-slate-700 text-slate-300'}`}>
                        {lead.source}
                      </span>
                    )}
                    {lead.project_id && (
                      <p className="text-[9px] text-slate-600 mt-1.5 truncate">{projectMap[lead.project_id]}</p>
                    )}
                    {lead.notes && (
                      <p className="text-[9px] text-slate-600 mt-1 italic line-clamp-2">{lead.notes}</p>
                    )}
                    {lead.assigned_to && (
                      <p className="text-[9px] text-slate-700 mt-1">{userMap[lead.assigned_to]}</p>
                    )}
                  </div>
                ))}
                {statusLeads.length === 0 && (
                  <div className="border-2 border-dashed border-slate-800 rounded-xl h-16 flex items-center justify-center">
                    <span className="text-[10px] text-slate-700">ว่าง</span>
                  </div>
                )}
                {statusLeads.length > 0 && (
                  <div className="mt-1 px-1">
                    <p className="text-[10px] text-slate-600">รวม {fmt(budgetSum)}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
