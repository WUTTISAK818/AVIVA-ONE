'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCurrentUser } from '@/lib/user-context'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import SectionHeader from '@/components/SectionHeader'
import GlassCard from '@/components/GlassCard'
import Toast from '@/components/Toast'
import {
  Phone, MapPin, Users, TrendingUp, BarChart3, PieChart as PieChartIcon,
  Calendar, Target, UserPlus, CheckCircle2, Handshake, FileBarChart, Inbox,
} from 'lucide-react'

type Period = 'today' | 'week' | 'month' | 'quarter'

interface PerformanceData {
  staff_id: string
  staff_name: string
  total_calls: number
  total_visits: number
  total_meetings: number
  total_leads: number
  new_leads: number
  booked_leads: number
  closed_leads: number
  booking_rate: number
  avg_cycle_days?: number
}

interface ChartData {
  date: string
  calls: number
  visits: number
  meetings: number
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'วันนี้',
  week: 'สัปดาห์',
  month: 'เดือน',
  quarter: 'ไตรมาส',
}

const CHART_COLORS = {
  gold: '#D4AF37',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  green: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
}

export default function SalesPerformancePage() {
  const user = useCurrentUser()
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<PerformanceData | null>(null)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadPerformance()
  }, [period, user?.id])

  const loadPerformance = async () => {
    if (!user?.id) return
    setLoading(true)

    try {
      const daysBack = period === 'today' ? 0 : period === 'week' ? 7 : period === 'month' ? 30 : 90

      const { data: logs, error: logsErr } = await supabase
        .from('sales_daily_logs')
        .select('log_date, activities_calls, activities_visits, activities_meetings')
        .eq('staff_id', user.id)
        .gte('log_date', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('log_date')

      if (logsErr) throw logsErr

      const chartMap = new Map<string, ChartData>()
      logs?.forEach(log => {
        const existing = chartMap.get(log.log_date) || { date: log.log_date, calls: 0, visits: 0, meetings: 0 }
        chartMap.set(log.log_date, {
          ...existing,
          calls: existing.calls + (log.activities_calls || 0),
          visits: existing.visits + (log.activities_visits || 0),
          meetings: existing.meetings + (log.activities_meetings || 0),
        })
      })
      setChartData(Array.from(chartMap.values()))

      const totals = {
        staff_id: user.id,
        staff_name: user.full_name || 'Staff',
        total_calls: logs?.reduce((sum, l) => sum + (l.activities_calls || 0), 0) || 0,
        total_visits: logs?.reduce((sum, l) => sum + (l.activities_visits || 0), 0) || 0,
        total_meetings: logs?.reduce((sum, l) => sum + (l.activities_meetings || 0), 0) || 0,
        total_leads: 0,
        new_leads: 0,
        booked_leads: 0,
        closed_leads: 0,
        booking_rate: 0,
      }

      setData(totals)
    } catch (err) {
      setToast({ message: `เกิดข้อผิดพลาดในการโหลดข้อมูล: ${err}`, type: 'error' })
    }

    setLoading(false)
  }

  const pieData = data
    ? [
        { name: 'ลีดใหม่', value: data.new_leads, color: CHART_COLORS.blue },
        { name: 'จองแล้ว', value: data.booked_leads, color: CHART_COLORS.purple },
        { name: 'ปิดการขาย', value: data.closed_leads, color: CHART_COLORS.green },
      ]
    : []

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getDate()}/${d.getMonth() + 1}`
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-aviva-gold/30 border-t-aviva-gold animate-spin" />
          <p className="text-aviva-secondary text-sm animate-pulse">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  const kpiCards = [
    {
      icon: Phone,
      value: data.total_calls,
      label: 'โทรศัพท์',
      gradient: 'from-blue-500/15 to-blue-600/5',
      iconBg: 'bg-blue-500/10 border-blue-500/30',
      iconColor: 'text-blue-400',
      valueColor: 'text-blue-400',
      accent: 'border-b-blue-500/40',
    },
    {
      icon: MapPin,
      value: data.total_visits,
      label: 'เยี่ยมชม',
      gradient: 'from-purple-500/15 to-purple-600/5',
      iconBg: 'bg-purple-500/10 border-purple-500/30',
      iconColor: 'text-purple-400',
      valueColor: 'text-purple-400',
      accent: 'border-b-purple-500/40',
    },
    {
      icon: Handshake,
      value: data.total_meetings,
      label: 'ประชุม',
      gradient: 'from-aviva-gold/15 to-aviva-gold/5',
      iconBg: 'bg-aviva-gold/10 border-aviva-gold/30',
      iconColor: 'text-aviva-gold',
      valueColor: 'text-aviva-gold',
      accent: 'border-b-aviva-gold/40',
    },
    {
      icon: Target,
      value: `${data.booking_rate.toFixed(1)}%`,
      label: 'อัตราจอง',
      gradient: 'from-green-500/15 to-green-600/5',
      iconBg: 'bg-green-500/10 border-green-500/30',
      iconColor: 'text-green-400',
      valueColor: 'text-green-400',
      accent: 'border-b-green-500/40',
    },
  ]

  const summaryItems = [
    {
      icon: Users,
      label: 'ลีดทั้งหมด',
      value: data.total_leads,
      color: 'text-aviva-text',
      bg: 'bg-aviva-gold/5',
      iconColor: 'text-aviva-gold',
    },
    {
      icon: UserPlus,
      label: 'ลีดใหม่',
      value: data.new_leads,
      color: 'text-blue-400',
      bg: 'bg-blue-500/5',
      iconColor: 'text-blue-400',
    },
    {
      icon: CheckCircle2,
      label: 'จองแล้ว',
      value: data.booked_leads,
      color: 'text-purple-400',
      bg: 'bg-purple-500/5',
      iconColor: 'text-purple-400',
    },
    {
      icon: TrendingUp,
      label: 'ปิดการขาย',
      value: data.closed_leads,
      color: 'text-green-400',
      bg: 'bg-green-500/5',
      iconColor: 'text-green-400',
    },
  ]

  const totalActivities = data.total_calls + data.total_visits + data.total_meetings

  return (
    <div className="min-h-screen bg-aviva-bg pb-28 px-4 pt-12">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div>
          <SectionHeader
            title="ผลงานฝ่ายขาย"
            subtitle="สรุปกิจกรรมและผลการขาย"
          />
        </div>

        {/* Period Filters */}
        <div className="flex gap-2">
          {(['today', 'week', 'month', 'quarter'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                period === p
                  ? 'bg-aviva-gold/20 text-aviva-gold border border-aviva-gold/40 shadow-sm shadow-aviva-gold/10'
                  : 'bg-aviva-card/80 text-aviva-secondary border border-aviva-gold/10 active:scale-[0.97]'
              }`}
            >
              <Calendar size={13} />
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              className={`relative rounded-2xl border border-aviva-gold/10 backdrop-blur-sm bg-gradient-to-br ${kpi.gradient} p-4 overflow-hidden border-b-2 ${kpi.accent}`}
            >
              {/* Icon */}
              <div className={`w-8 h-8 rounded-xl ${kpi.iconBg} border flex items-center justify-center mb-3`}>
                <kpi.icon size={15} className={kpi.iconColor} />
              </div>
              {/* Value */}
              <p className={`text-2xl font-bold ${kpi.valueColor} tracking-tight`}>
                {kpi.value}
              </p>
              {/* Label */}
              <p className="text-[11px] text-aviva-secondary mt-1 font-medium">
                {kpi.label}
              </p>
            </div>
          ))}
        </div>

        {/* Activity Overview Badge */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-aviva-gold/5 border border-aviva-gold/15">
            <BarChart3 size={13} className="text-aviva-gold" />
            <span className="text-[11px] text-aviva-secondary font-medium">
              กิจกรรมทั้งหมด {PERIOD_LABELS[period]}: <span className="text-aviva-gold font-bold">{totalActivities}</span> ครั้ง
            </span>
          </div>
        </div>

        {/* Activity Trend Chart */}
        <div>
          <SectionHeader title="แนวโน้มกิจกรรม" />
          <GlassCard className="p-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a3a33" />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    tick={{ fontSize: 10 }}
                    tickFormatter={formatDate}
                  />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#17332D',
                      border: '1px solid rgba(212, 175, 55, 0.2)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#fff',
                    }}
                    labelFormatter={(label) => formatDate(String(label))}
                    formatter={(value, name) => {
                      const nameMap: Record<string, string> = {
                        calls: 'โทรศัพท์',
                        visits: 'เยี่ยมชม',
                        meetings: 'ประชุม',
                      }
                      return [value, nameMap[String(name)] || name]
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const nameMap: Record<string, string> = {
                        calls: 'โทรศัพท์',
                        visits: 'เยี่ยมชม',
                        meetings: 'ประชุม',
                      }
                      return <span className="text-[11px] text-aviva-secondary">{nameMap[value] || value}</span>
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="calls"
                    stroke={CHART_COLORS.blue}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_COLORS.blue }}
                    activeDot={{ r: 5, stroke: CHART_COLORS.blue, strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="visits"
                    stroke={CHART_COLORS.purple}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_COLORS.purple }}
                    activeDot={{ r: 5, stroke: CHART_COLORS.purple, strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="meetings"
                    stroke={CHART_COLORS.gold}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_COLORS.gold }}
                    activeDot={{ r: 5, stroke: CHART_COLORS.gold, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-aviva-gold/5 border border-aviva-gold/15 flex items-center justify-center">
                  <BarChart3 size={20} className="text-aviva-gold/40" />
                </div>
                <p className="text-xs text-aviva-secondary/60">ยังไม่มีข้อมูลกิจกรรม</p>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Lead Status Pie Chart */}
        <div>
          <SectionHeader title="สถานะลีด" />
          <GlassCard className="p-4">
            {data.total_leads > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={{ stroke: '#6b7280', strokeWidth: 1 }}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#17332D',
                        border: '1px solid rgba(212, 175, 55, 0.2)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#fff',
                      }}
                      formatter={(value, name) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Pie Legend */}
                <div className="flex items-center gap-4 mt-2">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-[11px] text-aviva-secondary">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-aviva-gold/5 border border-aviva-gold/15 flex items-center justify-center">
                  <Inbox size={24} className="text-aviva-gold/40" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-aviva-secondary/70 font-medium">ยังไม่มีข้อมูลลีด</p>
                  <p className="text-[11px] text-aviva-secondary/40 mt-1">ข้อมูลจะแสดงเมื่อมีลีดในระบบ</p>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Summary Section */}
        <div>
          <SectionHeader title="สรุปผลการขาย" />
          <GlassCard className="p-4">
            <div className="grid grid-cols-2 gap-3">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-xl ${item.bg} border border-aviva-gold/5 p-3 flex items-start gap-3`}
                >
                  <div className="w-8 h-8 rounded-lg bg-aviva-card/80 border border-aviva-gold/10 flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon size={14} className={item.iconColor} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xl font-bold ${item.color} tracking-tight leading-tight`}>
                      {item.value}
                    </p>
                    <p className="text-[11px] text-aviva-secondary/70 mt-0.5 font-medium">
                      {item.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Report Footer */}
        <div className="flex items-center justify-center pt-2 pb-4">
          <div className="flex items-center gap-1.5 text-aviva-secondary/30">
            <FileBarChart size={12} />
            <span className="text-[10px]">AVIVA ONE - ผลงานฝ่ายขาย</span>
          </div>
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
