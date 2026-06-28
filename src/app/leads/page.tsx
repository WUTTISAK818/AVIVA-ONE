import { getSupabase } from '@/lib/supabase'
import { fmt, STATUS_LEAD, normalizeLeadStatus } from '@/lib/types'
import {
  Target, Phone, Banknote, Users, UserPlus,
  UserCheck, Trophy, XCircle, TrendingUp,
  Building2, StickyNote, User,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const PIPELINE_ORDER = ['new', 'contacted', 'qualified', 'converted', 'unqualified'] as const

const SOURCE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Facebook:  { bg: 'bg-blue-500/15',    text: 'text-blue-400',    bar: 'bg-blue-500' },
  LINE:      { bg: 'bg-emerald-500/15', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  'Walk-in': { bg: 'bg-amber-500/15',   text: 'text-amber-400',   bar: 'bg-amber-500' },
  Referral:  { bg: 'bg-purple-500/15',  text: 'text-purple-400',  bar: 'bg-purple-500' },
  Website:   { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    bar: 'bg-cyan-500' },
}
const DEFAULT_SOURCE_COLOR = { bg: 'bg-slate-500/15', text: 'text-slate-400', bar: 'bg-slate-500' }

/* Stage-specific accent colors for pipeline headers and decorations */
const STAGE_ACCENT: Record<string, { border: string; bg: string; icon: string; dot: string }> = {
  new:         { border: 'border-slate-500/30',   bg: 'bg-slate-500/10',   icon: 'text-slate-400',   dot: 'bg-slate-400' },
  contacted:   { border: 'border-blue-500/30',    bg: 'bg-blue-500/10',    icon: 'text-blue-400',    dot: 'bg-blue-400' },
  qualified:   { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', icon: 'text-emerald-400', dot: 'bg-emerald-400' },
  converted:   { border: 'border-purple-500/30',  bg: 'bg-purple-500/10',  icon: 'text-purple-400',  dot: 'bg-purple-400' },
  unqualified: { border: 'border-red-500/30',     bg: 'bg-red-500/10',     icon: 'text-red-400',     dot: 'bg-red-400' },
}

const STAGE_ICONS: Record<string, typeof Target> = {
  new:         UserPlus,
  contacted:   Phone,
  qualified:   UserCheck,
  converted:   Trophy,
  unqualified: XCircle,
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

  /* ── Metrics ── */
  const allLeads = leads ?? []
  const total = allLeads.length
  const countNew       = allLeads.filter(l => normalizeLeadStatus(l.status) === 'new').length
  const countFollowing = allLeads.filter(l => ['contacted', 'qualified'].includes(normalizeLeadStatus(l.status))).length
  const countClosed    = allLeads.filter(l => normalizeLeadStatus(l.status) === 'converted').length

  /* ── Source breakdown ── */
  const sources = allLeads.reduce<Record<string, number>>((acc, l) => {
    const s = l.source ?? 'อื่นๆ'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  const safeTotal = total || 1

  /* ── KPI cards config ── */
  const kpis = [
    { label: 'ลีดทั้งหมด',   value: total,          color: 'text-aviva-gold',  icon: Users,       accent: 'bg-aviva-gold/10 border-aviva-gold/20' },
    { label: 'ลีดใหม่',       value: countNew,       color: 'text-blue-400',    icon: UserPlus,    accent: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'กำลังติดตาม',   value: countFollowing, color: 'text-amber-400',   icon: TrendingUp,  accent: 'bg-amber-500/10 border-amber-500/20' },
    { label: 'ปิดการขาย',     value: countClosed,    color: 'text-emerald-400', icon: Trophy,      accent: 'bg-emerald-500/10 border-emerald-500/20' },
  ]

  return (
    <div className="min-h-screen bg-aviva-bg pb-28 px-4 pt-12">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aviva-gold/15 border border-aviva-gold/25 flex items-center justify-center">
              <Target size={20} className="text-aviva-gold" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-aviva-text">Pipeline การขาย</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">ติดตามลูกค้าเป้าหมาย</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-aviva-gold/80 bg-aviva-gold/10 px-3 py-1 rounded-full border border-aviva-gold/20">
            {total} ลีด
          </span>
        </div>

        {/* ── KPI Summary Row ── */}
        <div className="grid grid-cols-4 gap-2">
          {kpis.map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className={`rounded-2xl border p-3 text-center ${k.accent}`}>
                <Icon size={16} className={`${k.color} mx-auto mb-1.5`} />
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-[11px] text-aviva-secondary leading-tight mt-0.5">{k.label}</p>
              </div>
            )
          })}
        </div>

        {/* ── Source Breakdown ── */}
        <div className="bg-aviva-card/80 rounded-2xl border border-aviva-gold/10 p-4 backdrop-blur-sm">
          <p className="text-xs font-semibold text-aviva-secondary uppercase tracking-wider mb-3">แหล่งที่มาลีด</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(sources)
              .sort(([, a], [, b]) => b - a)
              .map(([src, cnt]) => {
                const sc = SOURCE_COLORS[src] ?? DEFAULT_SOURCE_COLOR
                const pct = Math.round((cnt / safeTotal) * 100)
                return (
                  <div key={src} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${sc.bg} ${sc.text} border-current/20`}>
                    <span className={`w-2 h-2 rounded-full ${sc.bar}`} />
                    <span className="text-xs font-semibold">{src}</span>
                    <span className="text-sm font-bold">{cnt}</span>
                    <span className="text-xs opacity-60">{pct}%</span>
                  </div>
                )
              })}
          </div>

          {/* Segmented progress bar */}
          <div className="h-2.5 bg-aviva-bg rounded-full overflow-hidden flex">
            {Object.entries(sources)
              .sort(([, a], [, b]) => b - a)
              .map(([src, cnt], i, arr) => {
                const sc = SOURCE_COLORS[src] ?? DEFAULT_SOURCE_COLOR
                const w = (cnt / safeTotal) * 100
                return (
                  <div
                    key={src}
                    className={`h-full ${sc.bar} ${i === 0 ? 'rounded-l-full' : ''} ${i === arr.length - 1 ? 'rounded-r-full' : ''}`}
                    style={{ width: `${w}%`, marginRight: i < arr.length - 1 ? '2px' : '0' }}
                  />
                )
              })}
          </div>
        </div>

        {/* ── Pipeline Stages (vertical on mobile) ── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-aviva-secondary uppercase tracking-wider">ขั้นตอน Pipeline</p>

          {PIPELINE_ORDER.map(status => {
            const cfg = STATUS_LEAD[status]
            const accent = STAGE_ACCENT[status]
            const StageIcon = STAGE_ICONS[status]
            const statusLeads = allLeads.filter(l => normalizeLeadStatus(l.status) === status)
            const budgetSum = statusLeads.reduce((s, l) => s + (l.budget ?? 0), 0)

            return (
              <div key={status} className={`bg-aviva-card/60 rounded-2xl border ${accent.border} overflow-hidden backdrop-blur-sm`}>
                {/* Stage header */}
                <div className={`flex items-center justify-between px-4 py-3 ${accent.bg} border-b ${accent.border}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg ${accent.bg} border ${accent.border} flex items-center justify-center`}>
                      <StageIcon size={16} className={accent.icon} />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-aviva-text">{cfg.label}</span>
                      {statusLeads.length > 0 && budgetSum > 0 && (
                        <p className="text-[11px] text-aviva-secondary mt-0.5">
                          รวมงบ {fmt(budgetSum)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
                    {statusLeads.length}
                  </span>
                </div>

                {/* Lead cards */}
                <div className="p-3">
                  {statusLeads.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-6 opacity-40">
                      <StageIcon size={24} className="text-aviva-secondary mb-2" />
                      <p className="text-xs text-aviva-secondary">ยังไม่มีลีดในขั้นนี้</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {statusLeads.map(lead => {
                        const sc = SOURCE_COLORS[lead.source] ?? DEFAULT_SOURCE_COLOR
                        return (
                          <div
                            key={lead.id}
                            className="bg-aviva-bg/60 rounded-xl border border-aviva-gold/8 p-3.5 hover:border-aviva-gold/20 transition-all"
                          >
                            {/* Name + source */}
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-sm font-bold text-aviva-text leading-snug">{lead.customer_name}</p>
                              {lead.source && (
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} shrink-0 ml-2`}>
                                  {lead.source}
                                </span>
                              )}
                            </div>

                            {/* Phone */}
                            {lead.phone && (
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Phone size={13} className="text-aviva-secondary shrink-0" />
                                <span className="text-xs text-aviva-secondary">{lead.phone}</span>
                              </div>
                            )}

                            {/* Budget */}
                            {(lead.budget ?? 0) > 0 && (
                              <div className="flex items-center gap-1.5 mb-2">
                                <Banknote size={13} className="text-aviva-gold shrink-0" />
                                <span className="text-xs font-semibold text-aviva-gold">{fmt(lead.budget ?? 0)}</span>
                              </div>
                            )}

                            {/* Project */}
                            {lead.project_id && projectMap[lead.project_id] && (
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Building2 size={12} className="text-aviva-secondary/60 shrink-0" />
                                <span className="text-[11px] text-aviva-secondary/80 truncate">{projectMap[lead.project_id]}</span>
                              </div>
                            )}

                            {/* Notes */}
                            {lead.notes && (
                              <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-aviva-gold/5">
                                <StickyNote size={12} className="text-aviva-secondary/40 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-aviva-secondary/60 italic line-clamp-2 leading-relaxed">{lead.notes}</p>
                              </div>
                            )}

                            {/* Assigned user */}
                            {lead.assigned_to && userMap[lead.assigned_to] && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <User size={11} className="text-aviva-secondary/40 shrink-0" />
                                <span className="text-[11px] text-aviva-secondary/50">{userMap[lead.assigned_to]}</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
