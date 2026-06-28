import { getSupabase } from '@/lib/supabase'
import { fmt, STATUS_CUSTOMER } from '@/lib/types'
import {
  Users, Phone, Mail, Building2, Banknote,
  UserPlus, Handshake, FileSignature, CheckCircle2,
  MessageCircle, UserCheck, Crown,
} from 'lucide-react'
import GlassCard from '@/components/GlassCard'

export const dynamic = 'force-dynamic'

/* ── Stage-specific styling ── */
const STAGE_CONFIG: Record<string, {
  icon: typeof Users
  gradient: string
  accent: string
  border: string
  bg: string
  dot: string
  avatarFrom: string
  avatarTo: string
}> = {
  prospect: {
    icon: UserPlus,
    gradient: 'from-slate-400 to-slate-500',
    accent: 'text-slate-400',
    border: 'border-slate-500/20',
    bg: 'bg-slate-500/10',
    dot: 'bg-slate-400',
    avatarFrom: 'from-slate-600',
    avatarTo: 'to-slate-500',
  },
  interested: {
    icon: MessageCircle,
    gradient: 'from-blue-400 to-blue-500',
    accent: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/10',
    dot: 'bg-blue-400',
    avatarFrom: 'from-blue-600',
    avatarTo: 'to-blue-400',
  },
  negotiating: {
    icon: Handshake,
    gradient: 'from-amber-400 to-amber-500',
    accent: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/10',
    dot: 'bg-amber-400',
    avatarFrom: 'from-amber-600',
    avatarTo: 'to-amber-400',
  },
  signed: {
    icon: FileSignature,
    gradient: 'from-emerald-400 to-emerald-500',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/10',
    dot: 'bg-emerald-400',
    avatarFrom: 'from-emerald-600',
    avatarTo: 'to-emerald-400',
  },
  transferred: {
    icon: CheckCircle2,
    gradient: 'from-purple-400 to-purple-500',
    accent: 'text-purple-400',
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/10',
    dot: 'bg-purple-400',
    avatarFrom: 'from-purple-600',
    avatarTo: 'to-purple-400',
  },
}

const DEFAULT_STAGE = STAGE_CONFIG.prospect

export default async function CustomersPage() {
  const sb = getSupabase()

  const [{ data: customers }, { data: users }, { data: projects }] = await Promise.all([
    sb.from('customers').select('*').order('created_at', { ascending: false }),
    sb.from('users').select('id, full_name'),
    sb.from('projects').select('id, project_name'),
  ])

  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u.full_name]))
  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p.project_name]))

  const allCustomers = customers ?? []
  const total = allCustomers.length

  /* ── KPI per status ── */
  const statusCounts = Object.entries(STATUS_CUSTOMER).map(([key, cfg]) => {
    const stage = STAGE_CONFIG[key] ?? DEFAULT_STAGE
    const Icon = stage.icon
    const count = allCustomers.filter(c => c.status === key).length
    return { key, label: cfg.label, color: cfg.color, count, Icon, stage }
  })

  /* ── Budget totals ── */
  const totalBudget = allCustomers.reduce((s, c) => s + (c.budget ?? 0), 0)

  return (
    <div className="min-h-screen bg-aviva-bg pb-28 px-4 pt-12">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aviva-gold/15 border border-aviva-gold/25 flex items-center justify-center">
              <Crown size={20} className="text-aviva-gold" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-aviva-text">CRM ลูกค้า</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">จัดการข้อมูลและสถานะลูกค้า</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-aviva-gold/80 bg-aviva-gold/10 px-3 py-1 rounded-full border border-aviva-gold/20">
            {total} ราย
          </span>
        </div>

        {/* ── KPI Summary Row ── */}
        <div className="grid grid-cols-5 gap-2">
          {statusCounts.map(s => {
            const Icon = s.Icon
            return (
              <div key={s.key} className={`rounded-2xl border p-3 text-center ${s.stage.bg} ${s.stage.border}`}>
                <Icon size={16} className={`${s.stage.accent} mx-auto mb-1.5`} />
                <p className={`text-xl font-bold ${s.stage.accent}`}>{s.count}</p>
                <p className="text-[10px] text-aviva-secondary leading-tight mt-0.5">{s.label}</p>
              </div>
            )
          })}
        </div>

        {/* ── Total Budget Bar ── */}
        {totalBudget > 0 && (
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-aviva-gold/10 border border-aviva-gold/20 flex items-center justify-center">
                  <Banknote size={16} className="text-aviva-gold" />
                </div>
                <div>
                  <p className="text-xs text-aviva-secondary">งบประมาณรวม</p>
                  <p className="text-base font-bold text-aviva-gold">{fmt(totalBudget)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-aviva-secondary">
                <UserCheck size={13} className="text-aviva-secondary" />
                <span>เฉลี่ย {fmt(Math.round(totalBudget / (total || 1)))} / ราย</span>
              </div>
            </div>
          </GlassCard>
        )}

        {/* ── Customer Cards / Empty State ── */}
        {total === 0 ? (
          /* ── Empty State ── */
          <GlassCard className="py-16 px-6">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-aviva-gold/10 border border-aviva-gold/20 flex items-center justify-center mb-4">
                <Users size={28} className="text-aviva-gold/60" />
              </div>
              <p className="text-base font-semibold text-aviva-text mb-1.5">ยังไม่มีข้อมูลลูกค้า</p>
              <p className="text-xs text-aviva-secondary max-w-[260px] leading-relaxed">
                ข้อมูลลูกค้าจะแสดงที่นี่เมื่อมีการเพิ่มจาก CRM
              </p>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-5">
            {/* ── Section Header ── */}
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-aviva-secondary uppercase tracking-wider">รายชื่อลูกค้า</p>
              <div className="flex-1 h-px bg-aviva-gold/10" />
            </div>

            {/* ── Customer Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allCustomers.map(c => {
                const status = c.status ?? 'prospect'
                const cfg = STATUS_CUSTOMER[status]
                const stage = STAGE_CONFIG[status] ?? DEFAULT_STAGE
                const projectName = c.project_interest ? projectMap[c.project_interest] : null
                const salesName = c.assigned_sales ? userMap[c.assigned_sales] : null
                const initial = (c.full_name ?? '?').charAt(0)

                return (
                  <GlassCard key={c.id} className="p-4">
                    {/* Top row: Avatar + Name + Status */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${stage.avatarFrom} ${stage.avatarTo} flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-lg`}>
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-aviva-text truncate">{c.full_name}</p>
                        <span className={`inline-block mt-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium ${cfg?.color ?? 'bg-slate-700 text-slate-300'}`}>
                          {cfg?.label ?? status}
                        </span>
                      </div>
                      {(c.budget ?? 0) > 0 && (
                        <div className="text-right shrink-0">
                          <p className="text-xs text-aviva-secondary">งบประมาณ</p>
                          <p className="text-sm font-bold text-aviva-gold">{fmt(c.budget ?? 0)}</p>
                        </div>
                      )}
                    </div>

                    {/* Contact Info */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-aviva-secondary">
                          <Phone size={12} className="text-aviva-secondary shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-xs text-aviva-secondary">
                          <Mail size={12} className="text-aviva-secondary shrink-0" />
                          <span className="truncate max-w-[180px]">{c.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom: Project + Sales */}
                    {(projectName || salesName) && (
                      <div className="flex items-center gap-3 pt-2.5 border-t border-aviva-gold/10">
                        {projectName && (
                          <div className="flex items-center gap-1.5 text-xs text-aviva-secondary flex-1 min-w-0">
                            <Building2 size={12} className="text-blue-400 shrink-0" />
                            <span className="truncate">{projectName}</span>
                          </div>
                        )}
                        {salesName && (
                          <div className="flex items-center gap-1.5 text-xs text-aviva-secondary shrink-0">
                            <Users size={12} className="text-aviva-gold shrink-0" />
                            <span>{salesName}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </GlassCard>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
