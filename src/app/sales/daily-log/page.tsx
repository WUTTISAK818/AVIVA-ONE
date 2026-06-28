'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCurrentUser } from '@/lib/user-context'
import { Save, Send, Phone, Building2, Handshake, MessageSquare, StickyNote, CalendarDays, Clock, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import Toast from '@/components/Toast'
import SectionHeader from '@/components/SectionHeader'

interface DailyLog {
  id: string
  log_date: string
  activities_calls: number
  activities_visits: number
  activities_meetings: number
  customer_feedback: string
  notes: string
  status: 'draft' | 'submitted'
  submitted_at?: string
}

const emptyLog: Omit<DailyLog, 'id'> = {
  log_date: new Date().toISOString().split('T')[0],
  activities_calls: 0,
  activities_visits: 0,
  activities_meetings: 0,
  customer_feedback: '',
  notes: '',
  status: 'draft',
}

/* ---------- Activity counter config ---------- */
const activityTypes = [
  {
    key: 'activities_calls' as const,
    label: 'โทรศัพท์',
    icon: Phone,
    gradient: 'from-blue-500/20 to-blue-600/10',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    accent: 'border-blue-500/20',
  },
  {
    key: 'activities_visits' as const,
    label: 'เยี่ยมชมโครงการ',
    icon: Building2,
    gradient: 'from-emerald-500/20 to-emerald-600/10',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    accent: 'border-emerald-500/20',
  },
  {
    key: 'activities_meetings' as const,
    label: 'นัดประชุม',
    icon: Handshake,
    gradient: 'from-amber-500/20 to-amber-600/10',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    accent: 'border-amber-500/20',
  },
] as const

/* ---------- Thai date helpers ---------- */
const thaiMonths = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate()
  const month = thaiMonths[d.getMonth()]
  const year = d.getFullYear() + 543
  const weekday = thaiDays[d.getDay()]
  return `วัน${weekday}ที่ ${day} ${month} ${year}`
}

function formatThaiDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`
}

/* ========== Main Component ========== */
export default function SalesDailyLogPage() {
  const user = useCurrentUser()
  const [form, setForm] = useState<Omit<DailyLog, 'id'>>(emptyLog)
  const [history, setHistory] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showHistory, setShowHistory] = useState(true)

  useEffect(() => {
    loadLogs()
  }, [user?.id])

  const loadLogs = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sales_daily_logs')
        .select('*')
        .eq('staff_id', user.id)
        .order('log_date', { ascending: false })
        .limit(30)

      if (error) throw error

      setHistory(data || [])

      // Load today's log if exists
      const today = new Date().toISOString().split('T')[0]
      const todayLog = (data || []).find(l => l.log_date === today)
      if (todayLog) {
        setForm({
          log_date: todayLog.log_date,
          activities_calls: todayLog.activities_calls,
          activities_visits: todayLog.activities_visits,
          activities_meetings: todayLog.activities_meetings,
          customer_feedback: todayLog.customer_feedback,
          notes: todayLog.notes,
          status: todayLog.status,
        })
      } else {
        setForm(emptyLog)
      }
    } catch (err) {
      setToast({ message: `เกิดข้อผิดพลาด: ${err}`, type: 'error' })
    }
    setLoading(false)
  }

  const handleSave = async (action: 'draft' | 'submit') => {
    if (!user?.id) return

    if (form.activities_calls === 0 && form.activities_visits === 0 && form.activities_meetings === 0) {
      setToast({ message: 'กรุณาบันทึกกิจกรรมอย่างน้อย 1 รายการ', type: 'error' })
      return
    }

    setSaving(true)
    try {
      const logData = {
        staff_id: user.id,
        staff_name: user.full_name,
        log_date: form.log_date,
        activities_calls: form.activities_calls,
        activities_visits: form.activities_visits,
        activities_meetings: form.activities_meetings,
        customer_feedback: form.customer_feedback,
        notes: form.notes,
        status: action === 'submit' ? 'submitted' : 'draft',
        submitted_at: action === 'submit' ? new Date().toISOString() : null,
      }

      const { error } = await supabase
        .from('sales_daily_logs')
        .upsert(
          [logData],
          {
            onConflict: 'staff_id,log_date',
          }
        )

      if (error) throw error

      setToast({
        message: action === 'submit' ? 'ส่งบันทึกกิจกรรมแล้ว' : 'บันทึกฉบับร่างแล้ว',
        type: 'success',
      })

      if (action === 'submit') {
        setForm({ ...form, status: 'submitted' })
      }

      await loadLogs()
    } catch (err) {
      setToast({ message: `เกิดข้อผิดพลาด: ${err}`, type: 'error' })
    }
    setSaving(false)
  }

  const totalActivities = form.activities_calls + form.activities_visits + form.activities_meetings
  const isSubmitted = form.status === 'submitted'

  /* ---------- Loading state ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" />
          <p className="text-aviva-secondary text-sm">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-aviva-bg pb-28 px-4 pt-12">
      <div className="max-w-lg mx-auto">

        {/* ── Page Header ── */}
        <SectionHeader
          title="บันทึกกิจกรรมขายรายวัน"
          subtitle="บันทึกกิจกรรมประจำวัน: โทร, เยี่ยมชม, ประชุม"
        />

        {/* ── Date Selector ── */}
        <GlassCard className="p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aviva-gold/15 flex items-center justify-center flex-shrink-0">
              <CalendarDays size={20} className="text-aviva-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-aviva-secondary mb-1">วันที่</p>
              <input
                type="date"
                value={form.log_date}
                onChange={e => setForm({ ...form, log_date: e.target.value })}
                disabled={isSubmitted}
                className="w-full bg-transparent text-aviva-text text-sm font-medium disabled:opacity-50 focus:outline-none"
              />
              <p className="text-xs text-aviva-secondary mt-0.5">
                {formatThaiDate(form.log_date)}
              </p>
            </div>
            {isSubmitted && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 rounded-full flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                ส่งแล้ว
              </span>
            )}
          </div>
        </GlassCard>

        {/* ── Activity Counters ── */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-aviva-text">กิจกรรมวันนี้</h3>
            {totalActivities > 0 && (
              <span className="text-xs text-aviva-gold font-medium bg-aviva-gold/10 px-2.5 py-0.5 rounded-full">
                รวม {totalActivities} รายการ
              </span>
            )}
          </div>

          <div className="space-y-3">
            {activityTypes.map(({ key, label, icon: Icon, gradient, iconBg, iconColor, accent }) => (
              <GlassCard key={key} className={`p-4 border ${accent}`}>
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${gradient} pointer-events-none`} />
                <div className="relative flex items-center gap-3">
                  {/* Icon + Label */}
                  <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={20} className={iconColor} />
                  </div>
                  <span className="text-sm font-medium text-aviva-text flex-1 min-w-0">{label}</span>

                  {/* Counter controls */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setForm({ ...form, [key]: Math.max(0, form[key] - 1) })}
                      disabled={isSubmitted || form[key] === 0}
                      className="w-9 h-9 rounded-xl bg-aviva-card border border-aviva-gold/10 flex items-center justify-center text-aviva-secondary hover:text-aviva-text hover:border-aviva-gold/30 disabled:opacity-30 transition-all active:scale-95"
                      aria-label={`ลด${label}`}
                    >
                      <span className="text-lg leading-none font-medium">-</span>
                    </button>

                    <div className="w-12 text-center">
                      <span className="text-xl font-bold text-aviva-text tabular-nums">
                        {form[key]}
                      </span>
                    </div>

                    <button
                      onClick={() => setForm({ ...form, [key]: form[key] + 1 })}
                      disabled={isSubmitted}
                      className="w-9 h-9 rounded-xl bg-aviva-gold/15 border border-aviva-gold/25 flex items-center justify-center text-aviva-gold hover:bg-aviva-gold/25 hover:border-aviva-gold/40 disabled:opacity-30 transition-all active:scale-95"
                      aria-label={`เพิ่ม${label}`}
                    >
                      <span className="text-lg leading-none font-medium">+</span>
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* ── Customer Feedback ── */}
        <GlassCard className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
              <MessageSquare size={16} className="text-purple-400" />
            </div>
            <label className="text-sm font-semibold text-aviva-text">ข้อคิดเห็นลูกค้า</label>
          </div>
          <textarea
            value={form.customer_feedback}
            onChange={e => setForm({ ...form, customer_feedback: e.target.value })}
            disabled={isSubmitted}
            placeholder="สรุปข้อเสนอแนะจากลูกค้า..."
            rows={3}
            className="w-full bg-aviva-bg/50 border border-aviva-gold/10 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/50 disabled:opacity-50 resize-none focus:outline-none focus:border-aviva-gold/30 transition-colors"
          />
        </GlassCard>

        {/* ── Internal Notes ── */}
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center flex-shrink-0">
              <StickyNote size={16} className="text-sky-400" />
            </div>
            <label className="text-sm font-semibold text-aviva-text">บันทึกภายใน</label>
          </div>
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            disabled={isSubmitted}
            placeholder="บันทึกภายใน, สิ่งที่ต้องติดตาม..."
            rows={3}
            className="w-full bg-aviva-bg/50 border border-aviva-gold/10 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/50 disabled:opacity-50 resize-none focus:outline-none focus:border-aviva-gold/30 transition-colors"
          />
        </GlassCard>

        {/* ── Submitted Banner ── */}
        {isSubmitted && (
          <GlassCard className="p-4 mb-6 border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <Clock size={20} className="text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-emerald-400">ส่งรายงานแล้ว</p>
                <p className="text-xs text-aviva-secondary mt-0.5">
                  {form.submitted_at
                    ? new Date(form.submitted_at).toLocaleString('th-TH', {
                        dateStyle: 'long',
                        timeStyle: 'short',
                      })
                    : '-'}
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* ── Action Buttons ── */}
        {!isSubmitted && (
          <div className="flex gap-3 mb-8">
            <button
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-aviva-card border border-aviva-gold/15 text-aviva-text py-3.5 rounded-2xl font-medium text-sm hover:border-aviva-gold/30 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              <Save size={16} className="text-aviva-secondary" />
              บันทึกฉบับร่าง
            </button>
            <button
              onClick={() => handleSave('submit')}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg py-3.5 rounded-2xl font-bold text-sm hover:brightness-110 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-aviva-gold/20"
            >
              <Send size={16} />
              ส่งรายงาน
            </button>
          </div>
        )}

        {/* ── History Section ── */}
        <div className="mb-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h3 className="text-sm font-semibold text-aviva-text flex items-center gap-2">
              <FileText size={16} className="text-aviva-gold" />
              บันทึกย้อนหลัง (7 วัน)
            </h3>
            {showHistory
              ? <ChevronUp size={16} className="text-aviva-secondary" />
              : <ChevronDown size={16} className="text-aviva-secondary" />
            }
          </button>

          {showHistory && (
            <div className="space-y-2.5">
              {history.length === 0 ? (
                /* ── Empty state ── */
                <GlassCard className="p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-aviva-gold/10 flex items-center justify-center mb-3">
                      <FileText size={24} className="text-aviva-gold/50" />
                    </div>
                    <p className="text-sm text-aviva-secondary">ยังไม่มีบันทึกย้อนหลัง</p>
                    <p className="text-xs text-aviva-secondary/60 mt-1">เริ่มบันทึกกิจกรรมวันนี้เลย</p>
                  </div>
                </GlassCard>
              ) : (
                history.slice(0, 7).map(log => {
                  const logTotal = log.activities_calls + log.activities_visits + log.activities_meetings
                  return (
                    <GlassCard key={log.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {/* Date */}
                          <p className="text-sm font-semibold text-aviva-text">
                            {formatThaiDateShort(log.log_date)}
                          </p>

                          {/* Activity summary row */}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-xs text-aviva-secondary">
                              <Phone size={12} className="text-blue-400" />
                              {log.activities_calls}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-aviva-secondary">
                              <Building2 size={12} className="text-emerald-400" />
                              {log.activities_visits}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-aviva-secondary">
                              <Handshake size={12} className="text-amber-400" />
                              {log.activities_meetings}
                            </span>
                            <span className="text-xs text-aviva-secondary/60 ml-auto">
                              รวม {logTotal}
                            </span>
                          </div>

                          {/* Feedback preview */}
                          {log.customer_feedback && (
                            <p className="text-xs text-aviva-secondary mt-2 line-clamp-2 leading-relaxed">
                              {log.customer_feedback}
                            </p>
                          )}
                        </div>

                        {/* Status badge */}
                        <span
                          className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                            log.status === 'submitted'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : 'bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20'
                          }`}
                        >
                          {log.status === 'submitted' ? 'ส่งแล้ว' : 'ฉบับร่าง'}
                        </span>
                      </div>
                    </GlassCard>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
