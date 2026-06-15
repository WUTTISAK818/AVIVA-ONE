import { getSupabase } from '@/lib/supabase'
import { fmt } from '@/lib/types'
import { Building2, Home, CheckCircle2, Clock, Circle, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  sold:               { label: 'ขายแล้ว',      icon: CheckCircle2, color: 'text-emerald-400' },
  under_construction: { label: 'กำลังสร้าง',   icon: Clock,        color: 'text-amber-400'  },
  reserved:           { label: 'จอง',           icon: Circle,       color: 'text-blue-400'   },
  available:          { label: 'ว่าง',          icon: Home,         color: 'text-slate-400'  },
}

export default async function ProjectsPage() {
  const sb = getSupabase()

  const [{ data: projects }, { data: houses }, { data: finance }] = await Promise.all([
    sb.from('projects').select('*'),
    sb.from('houses').select('*'),
    sb.from('finance_transactions').select('*'),
  ])

  const projectColors = [
    { border: 'border-blue-500/30', badge: 'bg-blue-500/10 text-blue-400', bar: 'from-blue-500 to-indigo-500' },
    { border: 'border-emerald-500/30', badge: 'bg-emerald-500/10 text-emerald-400', bar: 'from-emerald-500 to-teal-500' },
    { border: 'border-amber-500/30', badge: 'bg-amber-500/10 text-amber-400', bar: 'from-amber-500 to-orange-500' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">โครงการทั้งหมด</h1>
        <p className="text-sm text-slate-500 mt-0.5">ภาพรวมสถานะและผลประกอบการรายโครงการ</p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'โครงการ', value: String(projects?.length ?? 0), icon: Building2, color: 'text-blue-400' },
          { label: 'ยูนิตทั้งหมด', value: String((projects ?? []).reduce((s, p) => s + (p.total_units ?? 0), 0)), icon: Home, color: 'text-slate-300' },
          { label: 'ขายแล้ว', value: String((houses ?? []).filter(h => h.status === 'sold').length), icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'รายรับรวม', value: fmt((finance ?? []).filter(f => f.transaction_type === 'income').reduce((s, f) => s + (f.amount ?? 0), 0)), icon: TrendingUp, color: 'text-amber-400' },
        ].map(item => (
          <div key={item.label} className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center gap-3">
            <item.icon size={18} className={item.color} />
            <div>
              <p className="text-lg font-bold text-white font-mono">{item.value}</p>
              <p className="text-xs text-slate-500">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {(projects ?? []).map((p, i) => {
          const col = projectColors[i % projectColors.length]
          const projectHouses = (houses ?? []).filter(h => h.project_id === p.id)
          const sold = projectHouses.filter(h => h.status === 'sold').length
          const underCon = projectHouses.filter(h => h.status === 'under_construction').length
          const reserved = projectHouses.filter(h => h.status === 'reserved').length
          const available = projectHouses.filter(h => h.status === 'available').length
          const total = p.total_units ?? 1
          const soldPct = Math.round(((p.sold_units ?? 0) / total) * 100)
          const rev = (finance ?? []).filter(f => f.project_id === p.id && f.transaction_type === 'income').reduce((s, f) => s + (f.amount ?? 0), 0)

          return (
            <div key={p.id} className={`bg-slate-900 rounded-2xl border ${col.border} p-5 space-y-4`}>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${col.badge}`}>
                    PROJECT {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-base font-bold text-white mt-2 leading-tight">{p.project_name}</h3>
                </div>
                <Building2 size={20} className="text-slate-600 shrink-0 mt-1" />
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">ความคืบหน้าการขาย</span>
                  <span className="font-mono text-slate-300">{p.sold_units ?? 0}/{total}</span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${col.bar} rounded-full`} style={{ width: `${soldPct}%` }} />
                </div>
                <p className="text-right text-xs text-slate-500 mt-1">{soldPct}% จำหน่ายแล้ว</p>
              </div>

              {/* Unit breakdown */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'ขายแล้ว', count: sold, color: 'bg-emerald-900/40 text-emerald-400' },
                  { label: 'กำลังสร้าง', count: underCon, color: 'bg-amber-900/40 text-amber-400' },
                  { label: 'จองแล้ว', count: reserved, color: 'bg-blue-900/40 text-blue-400' },
                  { label: 'ว่าง', count: available, color: 'bg-slate-800 text-slate-400' },
                ].map(s => (
                  <div key={s.label} className={`${s.color} rounded-lg px-3 py-2`}>
                    <p className="text-lg font-bold font-mono">{s.count}</p>
                    <p className="text-[10px]">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Revenue */}
              <div className="border-t border-slate-800 pt-3 flex justify-between items-center">
                <span className="text-xs text-slate-500">รายรับสะสม</span>
                <span className="text-sm font-bold text-white font-mono">{rev > 0 ? fmt(rev) : '—'}</span>
              </div>

              {/* House list */}
              {projectHouses.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">ยูนิตล่าสุด</p>
                  <div className="flex flex-wrap gap-1.5">
                    {projectHouses.slice(0, 8).map(h => {
                      const cfg = statusConfig[h.status ?? 'available']
                      return (
                        <span key={h.id} className={`text-[10px] px-2 py-0.5 rounded bg-slate-800 ${cfg?.color ?? 'text-slate-400'} font-mono`}>
                          {h.house_number}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
