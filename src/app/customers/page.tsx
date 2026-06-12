import { getSupabase } from '@/lib/supabase'
import { fmt, STATUS_CUSTOMER } from '@/lib/types'
import { Users, Phone, Mail, Building2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const sb = getSupabase()

  const [{ data: customers }, { data: users }, { data: projects }] = await Promise.all([
    sb.from('customers').select('*').order('created_at', { ascending: false }),
    sb.from('users').select('id, full_name'),
    sb.from('projects').select('id, project_name'),
  ])

  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u.full_name]))
  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p.project_name]))

  const statusCounts = Object.keys(STATUS_CUSTOMER).map(s => ({
    key: s,
    ...STATUS_CUSTOMER[s],
    count: (customers ?? []).filter(c => c.status === s).length,
  }))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">CRM ลูกค้า</h1>
        <p className="text-sm text-slate-500 mt-0.5">รายชื่อลูกค้าและสถานะการซื้อ</p>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {statusCounts.map(s => (
          <div key={s.key} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${s.color}`}>
            <span className="w-4 h-4 bg-current/20 rounded-full flex items-center justify-center font-bold text-[10px]">{s.count}</span>
            {s.label}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <Users size={15} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-200">ลูกค้าทั้งหมด</span>
          <span className="ml-auto text-xs text-slate-500">{customers?.length ?? 0} ราย</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">ชื่อลูกค้า</th>
                <th className="text-left px-4 py-3 font-medium">ติดต่อ</th>
                <th className="text-left px-4 py-3 font-medium">งบประมาณ</th>
                <th className="text-left px-4 py-3 font-medium">สถานะ</th>
                <th className="text-left px-4 py-3 font-medium">โครงการสนใจ</th>
                <th className="text-left px-4 py-3 font-medium">เจ้าหน้าที่</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(customers ?? []).map(c => {
                const cfg = STATUS_CUSTOMER[c.status ?? 'prospect']
                const projectName = c.project_interest ? projectMap[c.project_interest] : null
                const salesName = c.assigned_sales ? userMap[c.assigned_sales] : null
                return (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                          {(c.full_name ?? '?').charAt(0)}
                        </div>
                        <span className="font-medium text-slate-200">{c.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-xs"><Phone size={11} />{c.phone}</div>
                        <div className="flex items-center gap-1 text-xs"><Mail size={11} />{c.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-sm text-slate-200">{fmt(c.budget ?? 0)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg?.color ?? 'bg-slate-700 text-slate-300'}`}>
                        {cfg?.label ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {projectName && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Building2 size={11} className="text-indigo-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{projectName}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{salesName ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
