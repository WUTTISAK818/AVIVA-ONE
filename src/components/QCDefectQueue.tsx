'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, AlertTriangle, Clock, CheckCircle2, Flame, ChevronRight, Loader2,
} from 'lucide-react'
import {
  STATUS_QC, SEVERITY, severityCfg, slaInfo, QC_NEXT_STATUS,
} from '@/lib/types'

export interface DefectRow {
  id: string
  defect_type: string | null
  defect_detail: string | null
  status: string | null
  severity: string | null
  sla_days: number | null
  due_date: string | null
  priority: number | null
  created_at: string | null
  houseNum: string
  projectName: string
}

const STATUS_NEXT_LABEL: Record<string, string> = {
  open: 'เริ่มแก้ไข',
  in_progress: 'ทำเสร็จแล้ว',
  resolved: 'เปิดใหม่',
}

function SlaBadge({ dueDate, status }: { dueDate: string | null; status: string | null }) {
  const sla = slaInfo(dueDate, status)
  if (!sla) return <span className="text-xs text-slate-600">—</span>
  if (sla.resolved) return <span className="text-xs text-emerald-500">เสร็จแล้ว</span>
  if (sla.overdue)
    return (
      <span className="text-xs font-semibold text-red-400 inline-flex items-center gap-1">
        <Flame size={11} /> เลย {Math.abs(sla.daysLeft)} วัน
      </span>
    )
  if (sla.dueToday) return <span className="text-xs font-semibold text-orange-400">ครบกำหนดวันนี้</span>
  return (
    <span className={`text-xs font-medium ${sla.dueSoon ? 'text-amber-400' : 'text-slate-400'}`}>
      เหลือ {sla.daysLeft} วัน
    </span>
  )
}

export default function QCDefectQueue({ defects }: { defects: DefectRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<DefectRow[]>(defects)
  const [syncedFrom, setSyncedFrom] = useState(defects)
  const [sevFilter, setSevFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Re-sync local rows when fresh server data arrives (after router.refresh).
  // Adjusting state during render is the React-recommended way to reset state
  // on a prop change — no effect, no cascading render.
  if (syncedFrom !== defects) {
    setSyncedFrom(defects)
    setRows(defects)
  }

  const open = rows.filter(d => d.status === 'open').length
  const inProgress = rows.filter(d => d.status === 'in_progress').length
  const resolved = rows.filter(d => d.status === 'resolved').length
  const critical = rows.filter(d => d.severity === 'critical' && d.status !== 'resolved').length
  const overdue = rows.filter(d => slaInfo(d.due_date, d.status)?.overdue).length

  const filtered = useMemo(() => {
    return rows
      .filter(d => sevFilter === 'all' || (d.severity ?? 'medium') === sevFilter)
      .filter(d => statusFilter === 'all' || (d.status ?? 'open') === statusFilter)
      .sort((a, b) => {
        // overdue first, then severity, then due date
        const ao = slaInfo(a.due_date, a.status)?.overdue ? 1 : 0
        const bo = slaInfo(b.due_date, b.status)?.overdue ? 1 : 0
        if (ao !== bo) return bo - ao
        const as = severityCfg(a.severity).rank
        const bs = severityCfg(b.severity).rank
        if (as !== bs) return bs - as
        return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
      })
  }, [rows, sevFilter, statusFilter])

  async function cycleStatus(d: DefectRow) {
    const next = QC_NEXT_STATUS[d.status ?? 'open'] ?? 'open'
    setBusyId(d.id)
    setError(null)
    // optimistic
    setRows(prev => prev.map(r => (r.id === d.id ? { ...r, status: next } : r)))
    try {
      const res = await fetch(`/api/qc-defects/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.hint || j.error || `HTTP ${res.status}`)
      }
      startTransition(() => router.refresh())
    } catch (e) {
      // rollback
      setRows(prev => prev.map(r => (r.id === d.id ? { ...r, status: d.status } : r)))
      setError(e instanceof Error ? e.message : 'อัปเดตไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  const stats = [
    { label: 'ทั้งหมด',     value: rows.length, icon: ShieldCheck,   color: 'text-slate-300',   bg: 'bg-slate-700/40' },
    { label: 'รอดำเนินการ', value: open,        icon: AlertTriangle, color: 'text-red-400',     bg: 'bg-red-500/10' },
    { label: 'กำลังแก้ไข',  value: inProgress,  icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10' },
    { label: 'แก้ไขแล้ว',   value: resolved,    icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.bg}`}>
              <s.icon size={16} className={s.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-mono">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Escalation banner */}
      {(overdue > 0 || critical > 0) && (
        <div className="flex flex-wrap items-center gap-3 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3">
          <Flame size={16} className="text-red-400 shrink-0" />
          <span className="text-sm text-red-300">
            {overdue > 0 && <b className="font-semibold">{overdue} รายการเลยกำหนด SLA</b>}
            {overdue > 0 && critical > 0 && ' · '}
            {critical > 0 && <b className="font-semibold">{critical} รายการระดับวิกฤตที่ยังไม่ปิด</b>}
            {' '}— ต้องเร่งดำเนินการ
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">ความรุนแรง:</span>
        <FilterPill active={sevFilter === 'all'} onClick={() => setSevFilter('all')}>ทั้งหมด</FilterPill>
        {(['critical', 'high', 'medium', 'low'] as const).map(s => (
          <FilterPill key={s} active={sevFilter === s} onClick={() => setSevFilter(s)}>
            <span className={`w-2 h-2 rounded-full ${SEVERITY[s].dot} inline-block mr-1.5`} />
            {SEVERITY[s].label}
          </FilterPill>
        ))}
        <span className="text-xs text-slate-500 ml-3">สถานะ:</span>
        <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>ทั้งหมด</FilterPill>
        {(['open', 'in_progress', 'resolved'] as const).map(s => (
          <FilterPill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {STATUS_QC[s].label}
          </FilterPill>
        ))}
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <ShieldCheck size={15} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-200">คิวงานแก้ไข</span>
          <span className="ml-auto text-xs text-slate-500">{filtered.length} รายการ</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">บ้าน / โครงการ</th>
                <th className="text-left px-4 py-3 font-medium">ความรุนแรง</th>
                <th className="text-left px-4 py-3 font-medium">รายละเอียด</th>
                <th className="text-left px-4 py-3 font-medium">SLA</th>
                <th className="text-left px-4 py-3 font-medium">สถานะ</th>
                <th className="text-right px-5 py-3 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(d => {
                const sev = severityCfg(d.severity)
                const st = STATUS_QC[d.status ?? 'open']
                const sla = slaInfo(d.due_date, d.status)
                const isOverdue = sla?.overdue
                return (
                  <tr
                    key={d.id}
                    className={`transition-colors ${isOverdue ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-slate-800/30'}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-6 rounded-full ${sev.dot} shrink-0`} />
                        <div>
                          <p className="font-mono text-sm font-semibold text-slate-200">{d.houseNum}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[150px]">{d.projectName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sev.color}`}>{sev.label}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 max-w-[220px]">
                      <p className="text-slate-300">{d.defect_type}</p>
                      <p className="truncate text-slate-500">{d.defect_detail}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <SlaBadge dueDate={d.due_date} status={d.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st?.color ?? 'bg-slate-700 text-slate-300'}`}>
                        {st?.label ?? d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => cycleStatus(d)}
                        disabled={busyId === d.id}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-colors"
                      >
                        {busyId === d.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <ChevronRight size={12} className="text-blue-400" />}
                        {STATUS_NEXT_LABEL[d.status ?? 'open']}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-600 text-sm">
                    ไม่มีรายการตามตัวกรอง
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FilterPill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors inline-flex items-center ${
        active
          ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}
