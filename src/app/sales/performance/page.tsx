'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCurrentUser } from '@/lib/user-context'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import SectionHeader from '@/components/SectionHeader'
import GlassCard from '@/components/GlassCard'
import Toast from '@/components/Toast'
import { Calendar } from 'lucide-react'

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
      // Get daily logs for chart
      const daysBack = period === 'today' ? 0 : period === 'week' ? 7 : period === 'month' ? 30 : 90

      const { data: logs, error: logsErr } = await supabase
        .from('sales_daily_logs')
        .select('log_date, activities_calls, activities_visits, activities_meetings')
        .eq('staff_id', user.id)
        .gte('log_date', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('log_date')

      if (logsErr) throw logsErr

      // Aggregate chart data
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

      // Calculate totals
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
      setToast({ message: `Error loading performance: ${err}`, type: 'error' })
    }

    setLoading(false)
  }

  const pieData = data
    ? [
        { name: 'New', value: data.new_leads, color: '#3b82f6' },
        { name: 'Booked', value: data.booked_leads, color: '#8b5cf6' },
        { name: 'Closed', value: data.closed_leads, color: '#10b981' },
      ]
    : []

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 max-w-6xl mx-auto">
      <SectionHeader
        title="📊 Sales Performance Dashboard"
        subtitle="Real-time metrics: activity, conversion rate, cycle time"
      />

      {/* Period Filter */}
      <div className="flex gap-2 mb-8">
        {(['today', 'week', 'month', 'quarter'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
              period === p
                ? 'bg-aviva-gold/20 text-aviva-gold border border-aviva-gold'
                : 'bg-gray-800/50 text-gray-400 hover:text-white'
            }`}
          >
            <Calendar size={16} />
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{data.total_calls}</p>
          <p className="text-xs text-gray-400 mt-2">📞 Calls</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-purple-400">{data.total_visits}</p>
          <p className="text-xs text-gray-400 mt-2">🏢 Visits</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">{data.total_meetings}</p>
          <p className="text-xs text-gray-400 mt-2">🤝 Meetings</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{data.booking_rate.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-2">Booking Rate</p>
        </GlassCard>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Line Chart */}
        <GlassCard className="p-6">
          <h3 className="text-sm font-bold text-white mb-4">Activity Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="date" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #444' }} />
              <Legend />
              <Line type="monotone" dataKey="calls" stroke="#3b82f6" />
              <Line type="monotone" dataKey="visits" stroke="#8b5cf6" />
              <Line type="monotone" dataKey="meetings" stroke="#f59e0b" />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Pie Chart */}
        <GlassCard className="p-6 flex flex-col items-center justify-center">
          <h3 className="text-sm font-bold text-white mb-4 w-full">Lead Status</h3>
          {data.total_leads > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">No lead data available</p>
          )}
        </GlassCard>
      </div>

      {/* Summary Stats */}
      <GlassCard className="p-6">
        <h3 className="text-sm font-bold text-white mb-4">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Total Leads</p>
            <p className="text-xl font-bold text-white mt-1">{data.total_leads}</p>
          </div>
          <div>
            <p className="text-gray-400">New Leads</p>
            <p className="text-xl font-bold text-blue-400 mt-1">{data.new_leads}</p>
          </div>
          <div>
            <p className="text-gray-400">Booked</p>
            <p className="text-xl font-bold text-purple-400 mt-1">{data.booked_leads}</p>
          </div>
          <div>
            <p className="text-gray-400">Closed Deals</p>
            <p className="text-xl font-bold text-green-400 mt-1">{data.closed_leads}</p>
          </div>
        </div>
      </GlassCard>

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
