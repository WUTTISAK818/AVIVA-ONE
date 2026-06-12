import { getSupabase } from '@/lib/supabase'
import { fmt } from '@/lib/types'
import { DollarSign, TrendingUp, TrendingDown, Wallet, Building2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function FinancePage() {
  const sb = getSupabase()

  const [{ data: transactionsRaw }, { data: projects }, { data: users }] = await Promise.all([
    sb.from('finance_transactions').select('*').order('created_at', { ascending: false }),
    sb.from('projects').select('id, project_name'),
    sb.from('users').select('id, full_name'),
  ])

  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p.project_name]))
  const userMap    = Object.fromEntries((users    ?? []).map(u => [u.id, u.full_name]))

  const transactions = (transactionsRaw ?? []).map(t => ({
    ...t,
    _project: projectMap[t.project_id ?? ''] ?? null,
    _user:    userMap[t.created_by   ?? ''] ?? null,
  }))

  const income  = (transactions ?? []).filter(t => t.transaction_type === 'income').reduce((s, t)  => s + (t.amount ?? 0), 0)
  const expense = (transactions ?? []).filter(t => t.transaction_type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0)
  const profit  = income - expense
  const margin  = income > 0 ? Math.round((profit / income) * 100) : 0

  // Per-project breakdown
  const projectBreakdown = (projects ?? []).map(p => {
    const pIncome  = (transactions ?? []).filter(t => t.project_id === p.id && t.transaction_type === 'income').reduce((s, t) => s + (t.amount ?? 0), 0)
    const pExpense = (transactions ?? []).filter(t => t.project_id === p.id && t.transaction_type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0)
    return { ...p, income: pIncome, expense: pExpense, profit: pIncome - pExpense }
  }).filter(p => p.income > 0 || p.expense > 0)

  const maxIncome = Math.max(...projectBreakdown.map(p => p.income), 1)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">การเงิน</h1>
        <p className="text-sm text-slate-500 mt-0.5">รายรับ รายจ่าย และกำไรสุทธิทุกโครงการ</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'รายรับรวม',     value: fmt(income),   icon: TrendingUp,   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-800/30' },
          { label: 'รายจ่ายรวม',    value: fmt(expense),  icon: TrendingDown, color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-800/30' },
          { label: 'กำไรสุทธิ',     value: fmt(profit),   icon: Wallet,       color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-800/30' },
          { label: 'Net Margin',    value: `${margin}%`,  icon: DollarSign,   color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-800/30' },
        ].map(s => (
          <div key={s.label} className={`bg-slate-900 rounded-2xl border ${s.border} p-5`}>
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon size={17} className={s.color} />
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Income vs Expense visual */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
        <p className="text-sm font-semibold text-slate-200 mb-4">สัดส่วนรายรับ / รายจ่าย / กำไร</p>
        <div className="flex items-end gap-3 h-24">
          {[
            { label: 'รายรับ', value: income, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
            { label: 'รายจ่าย', value: expense, color: 'bg-red-500', textColor: 'text-red-400' },
            { label: 'กำไรสุทธิ', value: profit, color: 'bg-blue-500', textColor: 'text-blue-400' },
          ].map(item => {
            const heightPct = income > 0 ? Math.round((item.value / income) * 100) : 0
            return (
              <div key={item.label} className="flex flex-col items-center gap-1 flex-1">
                <span className={`text-xs font-bold font-mono ${item.textColor}`}>{fmt(item.value)}</span>
                <div className="w-full flex items-end justify-center">
                  <div
                    className={`w-full max-w-[60px] ${item.color} rounded-t-lg opacity-80`}
                    style={{ height: `${Math.max(heightPct * 0.7, 4)}px` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{item.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-project breakdown */}
      {projectBreakdown.length > 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-indigo-400" />
            <p className="text-sm font-semibold text-slate-200">รายได้แยกตามโครงการ</p>
          </div>
          <div className="space-y-4">
            {projectBreakdown.map(p => (
              <div key={p.id}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-sm text-slate-300 font-medium">{p.project_name}</span>
                  <span className="text-xs text-emerald-400 font-mono font-bold">{fmt(p.profit)} กำไร</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    style={{ width: `${Math.round((p.income / maxIncome) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-slate-600">
                  <span>รายรับ {fmt(p.income)}</span>
                  <span>รายจ่าย {fmt(p.expense)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <DollarSign size={15} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-200">รายการธุรกรรมทั้งหมด</span>
          <span className="ml-auto text-xs text-slate-500">{transactions?.length ?? 0} รายการ</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">ประเภท</th>
                <th className="text-left px-4 py-3 font-medium">รายละเอียด</th>
                <th className="text-left px-4 py-3 font-medium">โครงการ</th>
                <th className="text-right px-4 py-3 font-medium">จำนวนเงิน</th>
                <th className="text-left px-4 py-3 font-medium">วันที่</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(transactions ?? []).map(t => {
                const isIncome = t.transaction_type === 'income'
                const projectName = (t as any)._project
                const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'
                return (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full w-fit ${isIncome ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
                        {isIncome ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {isIncome ? 'รายรับ' : 'รายจ่าย'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 max-w-[220px]">
                      <p className="truncate">{t.description}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 max-w-[140px]">
                      <p className="truncate">{projectName ?? '—'}</p>
                    </td>
                    <td className={`px-4 py-3.5 text-right font-mono text-sm font-bold ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isIncome ? '+' : '-'}{fmt(t.amount ?? 0)}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{dateStr}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Footer totals */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-6 text-xs">
          <span className="text-slate-500">รายรับรวม: <span className="text-emerald-400 font-mono font-bold">{fmt(income)}</span></span>
          <span className="text-slate-500">รายจ่ายรวม: <span className="text-red-400 font-mono font-bold">{fmt(expense)}</span></span>
          <span className="text-slate-500">กำไรสุทธิ: <span className="text-blue-400 font-mono font-bold">{fmt(profit)}</span></span>
        </div>
      </div>
    </div>
  )
}
