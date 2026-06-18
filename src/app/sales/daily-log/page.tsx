'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCurrentUser } from '@/lib/user-context'
import { Save, Send, ArrowLeft } from 'lucide-react'
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

export default function SalesDailyLogPage() {
  const user = useCurrentUser()
  const [form, setForm] = useState<Omit<DailyLog, 'id'>>(emptyLog)
  const [history, setHistory] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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
      setToast({ message: `Error loading logs: ${err}`, type: 'error' })
    }
    setLoading(false)
  }

  const handleSave = async (action: 'draft' | 'submit') => {
    if (!user?.id) return

    if (form.activities_calls === 0 && form.activities_visits === 0 && form.activities_meetings === 0) {
      setToast({ message: 'Please log at least one activity', type: 'error' })
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
        message: action === 'submit' ? 'Activity log submitted ✓' : 'Draft saved ✓',
        type: 'success',
      })

      if (action === 'submit') {
        setForm({ ...form, status: 'submitted' })
      }

      await loadLogs()
    } catch (err) {
      setToast({ message: `Error saving: ${err}`, type: 'error' })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 max-w-4xl mx-auto">
      <SectionHeader
        title="📋 บันทึกกิจกรรมขายรายวัน"
        subtitle="Log your daily activities: calls, visits, meetings, and customer feedback"
      />

      {/* Main Form Card */}
      <GlassCard className="mb-6">
        <div className="space-y-6">
          {/* Date Picker */}
          <div>
            <label className="text-sm font-semibold text-gray-300">วันที่ (Date)</label>
            <input
              type="date"
              value={form.log_date}
              onChange={e => setForm({ ...form, log_date: e.target.value })}
              disabled={form.status === 'submitted'}
              className="w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white disabled:opacity-50"
            />
          </div>

          {/* Activity Counters */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-300">📞 โทรศัพท์</label>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => setForm({ ...form, activities_calls: Math.max(0, form.activities_calls - 1) })}
                  disabled={form.status === 'submitted'}
                  className="bg-red-900/30 hover:bg-red-900/50 disabled:opacity-50 px-3 py-2 rounded text-red-400"
                >
                  −
                </button>
                <input
                  type="number"
                  value={form.activities_calls}
                  onChange={e => setForm({ ...form, activities_calls: Math.max(0, parseInt(e.target.value) || 0) })}
                  disabled={form.status === 'submitted'}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-center disabled:opacity-50"
                />
                <button
                  onClick={() => setForm({ ...form, activities_calls: form.activities_calls + 1 })}
                  disabled={form.status === 'submitted'}
                  className="bg-green-900/30 hover:bg-green-900/50 disabled:opacity-50 px-3 py-2 rounded text-green-400"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-300">🏢 เยี่ยมชม</label>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => setForm({ ...form, activities_visits: Math.max(0, form.activities_visits - 1) })}
                  disabled={form.status === 'submitted'}
                  className="bg-red-900/30 hover:bg-red-900/50 disabled:opacity-50 px-3 py-2 rounded text-red-400"
                >
                  −
                </button>
                <input
                  type="number"
                  value={form.activities_visits}
                  onChange={e => setForm({ ...form, activities_visits: Math.max(0, parseInt(e.target.value) || 0) })}
                  disabled={form.status === 'submitted'}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-center disabled:opacity-50"
                />
                <button
                  onClick={() => setForm({ ...form, activities_visits: form.activities_visits + 1 })}
                  disabled={form.status === 'submitted'}
                  className="bg-green-900/30 hover:bg-green-900/50 disabled:opacity-50 px-3 py-2 rounded text-green-400"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-300">🤝 ประชุม</label>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => setForm({ ...form, activities_meetings: Math.max(0, form.activities_meetings - 1) })}
                  disabled={form.status === 'submitted'}
                  className="bg-red-900/30 hover:bg-red-900/50 disabled:opacity-50 px-3 py-2 rounded text-red-400"
                >
                  −
                </button>
                <input
                  type="number"
                  value={form.activities_meetings}
                  onChange={e => setForm({ ...form, activities_meetings: Math.max(0, parseInt(e.target.value) || 0) })}
                  disabled={form.status === 'submitted'}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-center disabled:opacity-50"
                />
                <button
                  onClick={() => setForm({ ...form, activities_meetings: form.activities_meetings + 1 })}
                  disabled={form.status === 'submitted'}
                  className="bg-green-900/30 hover:bg-green-900/50 disabled:opacity-50 px-3 py-2 rounded text-green-400"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Customer Feedback */}
          <div>
            <label className="text-sm font-semibold text-gray-300">💬 ข้อคิดเห็นลูกค้า</label>
            <textarea
              value={form.customer_feedback}
              onChange={e => setForm({ ...form, customer_feedback: e.target.value })}
              disabled={form.status === 'submitted'}
              placeholder="Key feedback from calls/visits..."
              rows={3}
              className="w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder:text-gray-600 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Internal Notes */}
          <div>
            <label className="text-sm font-semibold text-gray-300">📝 หมายเหตุ (Internal)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              disabled={form.status === 'submitted'}
              placeholder="Internal observations, follow-up actions..."
              rows={3}
              className="w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder:text-gray-600 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Status Badge */}
          {form.status === 'submitted' && (
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 text-green-300 text-sm">
              ✓ Log submitted on {form.submitted_at ? new Date(form.submitted_at).toLocaleString('th-TH') : '—'}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleSave('draft')}
              disabled={saving || form.status === 'submitted'}
              className="flex-1 bg-blue-900/30 hover:bg-blue-900/50 disabled:opacity-50 text-blue-400 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <Save size={18} /> Save as Draft
            </button>
            <button
              onClick={() => handleSave('submit')}
              disabled={saving || form.status === 'submitted'}
              className="flex-1 bg-green-900/30 hover:bg-green-900/50 disabled:opacity-50 text-green-400 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <Send size={18} /> Submit
            </button>
          </div>
        </div>
      </GlassCard>

      {/* History */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">📋 Recent Logs (Last 7 Days)</h2>
        <div className="space-y-3">
          {history.slice(0, 7).map(log => (
            <GlassCard key={log.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-white">{log.log_date}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    📞 {log.activities_calls} · 🏢 {log.activities_visits} · 🤝 {log.activities_meetings}
                  </p>
                  {log.customer_feedback && (
                    <p className="text-sm text-gray-300 mt-2">💬 {log.customer_feedback}</p>
                  )}
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    log.status === 'submitted'
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-blue-900/30 text-blue-400'
                  }`}
                >
                  {log.status === 'submitted' ? '✓ Submitted' : 'Draft'}
                </span>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

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
