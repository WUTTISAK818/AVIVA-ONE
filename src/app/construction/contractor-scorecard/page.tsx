'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronDown, TrendingUp, AlertCircle, Award } from 'lucide-react'
import SectionHeader from '@/components/SectionHeader'
import GlassCard from '@/components/GlassCard'
import Toast from '@/components/Toast'

interface ContractorScore {
  contractor_name: string
  period_id: string
  project_id: string
  quality_score: number
  defect_count: number
  timeliness_score: number
  approval_rate: number
  composite_score: number
  performance_tier: 'A' | 'B' | 'C' | 'D'
  updated_at?: string
}

interface Period {
  id: string
  period_start: string
  period_end: string
  project_id: string
}

const tierColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  A: { bg: 'bg-green-900/20', text: 'text-green-400', border: 'border-green-700', icon: '⭐' },
  B: { bg: 'bg-blue-900/20', text: 'text-blue-400', border: 'border-blue-700', icon: '👍' },
  C: { bg: 'bg-yellow-900/20', text: 'text-yellow-400', border: 'border-yellow-700', icon: '⚠️' },
  D: { bg: 'bg-red-900/20', text: 'text-red-400', border: 'border-red-700', icon: '❌' },
}

export default function ContractorScorecardPage() {
  const [scores, setScores] = useState<ContractorScore[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedContractor, setExpandedContractor] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadPeriodsAndScores()
    const subscription = supabase
      .channel('contractor_scorecard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contractor_scorecard' },
        () => loadScores()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadPeriodsAndScores = async () => {
    try {
      const { data: periodData, error: periodErr } = await supabase
        .from('contractor_scorecard_period')
        .select('*')
        .order('period_start', { ascending: false })
        .limit(10)

      if (periodErr) throw periodErr

      if (periodData && periodData.length > 0) {
        setPeriods(periodData)
        setSelectedPeriod(periodData[0].id)
        await loadScores(periodData[0].id)
      } else {
        setLoading(false)
      }
    } catch (err) {
      setToast({ message: `Error loading periods: ${err}`, type: 'error' })
      setLoading(false)
    }
  }

  const loadScores = async (periodId?: string) => {
    try {
      const queryPeriodId = periodId || selectedPeriod
      let query = supabase.from('contractor_scorecard').select('*')

      if (queryPeriodId) {
        query = query.eq('period_id', queryPeriodId)
      }

      const { data, error } = await query.order('composite_score', { ascending: false })

      if (error) throw error
      setScores(data || [])
    } catch (err) {
      setToast({ message: `Error loading scores: ${err}`, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handlePeriodChange = async (periodId: string) => {
    setSelectedPeriod(periodId)
    setLoading(true)
    await loadScores(periodId)
  }

  const stats = {
    tierA: scores.filter(s => s.performance_tier === 'A').length,
    tierB: scores.filter(s => s.performance_tier === 'B').length,
    tierC: scores.filter(s => s.performance_tier === 'C').length,
    tierD: scores.filter(s => s.performance_tier === 'D').length,
    avgQuality: scores.length > 0
      ? (scores.reduce((sum, s) => sum + s.quality_score, 0) / scores.length).toFixed(1)
      : 0,
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 max-w-7xl mx-auto">
      <SectionHeader
        title="🏆 Contractor Performance Scorecard"
        subtitle="Track contractor quality, timeliness, and approval rates across project phases"
      />

      {/* Period Filter */}
      <div className="mb-8">
        <label className="text-sm font-semibold text-gray-300 mb-3 block">Select Period</label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {periods.map(period => (
            <button
              key={period.id}
              onClick={() => handlePeriodChange(period.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${
                selectedPeriod === period.id
                  ? 'bg-aviva-gold/20 text-aviva-gold border border-aviva-gold'
                  : 'bg-gray-800/50 text-gray-400 hover:text-white'
              }`}
            >
              {new Date(period.period_start).toLocaleDateString('th-TH')} - {new Date(period.period_end).toLocaleDateString('th-TH')}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{stats.tierA}</p>
          <p className="text-xs text-gray-400 mt-1">Tier A</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{stats.tierB}</p>
          <p className="text-xs text-gray-400 mt-1">Tier B</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">{stats.tierC}</p>
          <p className="text-xs text-gray-400 mt-1">Tier C</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-red-400">{stats.tierD}</p>
          <p className="text-xs text-gray-400 mt-1">Tier D</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-white">{stats.avgQuality}</p>
          <p className="text-xs text-gray-400 mt-1">Avg Quality</p>
        </GlassCard>
      </div>

      {/* Scorecard Table */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300">Contractor</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300">Quality</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300">Defects</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300">Timeliness</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300">Approval %</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300">Composite</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300">Tier</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {scores.map(score => {
                const tierColor = tierColors[score.performance_tier]
                return (
                  <tr
                    key={`${score.contractor_name}-${score.period_id}`}
                    className="border-b border-gray-800 hover:bg-gray-900/50 transition"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{score.contractor_name}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${Math.min(score.quality_score, 100)}%` }}
                          />
                        </div>
                        <span className="text-white font-medium w-8">{score.quality_score.toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={score.defect_count > 5 ? 'text-red-400' : 'text-green-400'}>
                        {score.defect_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-purple-500"
                            style={{ width: `${Math.min(score.timeliness_score, 100)}%` }}
                          />
                        </div>
                        <span className="text-white font-medium w-8">{score.timeliness_score.toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-white font-medium">{score.approval_rate.toFixed(1)}%</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-lg text-white">{score.composite_score.toFixed(1)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold ${tierColor.bg} ${tierColor.text}`}
                      >
                        {tierColor.icon} {score.performance_tier}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() =>
                          setExpandedContractor(
                            expandedContractor === score.contractor_name ? null : score.contractor_name
                          )
                        }
                        className="text-gray-400 hover:text-white transition"
                      >
                        <ChevronDown
                          size={18}
                          className={`transition ${expandedContractor === score.contractor_name ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Expanded Detail View */}
        {expandedContractor && (
          <div className="bg-gray-900 border-t border-gray-700 p-6">
            <div className="max-w-2xl">
              {scores
                .filter(s => s.contractor_name === expandedContractor)
                .map(score => {
                  const tierColor = tierColors[score.performance_tier]
                  return (
                    <div key={`detail-${score.contractor_name}`} className="space-y-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-white mb-2">{score.contractor_name}</h3>
                          <div className="flex gap-4">
                            <div>
                              <p className="text-xs text-gray-400">Performance Tier</p>
                              <p className={`text-lg font-bold ${tierColor.text}`}>{score.performance_tier}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Composite Score</p>
                              <p className="text-lg font-bold text-white">{score.composite_score.toFixed(1)}/100</p>
                            </div>
                          </div>
                        </div>
                        <Award className={`${tierColor.text}`} size={32} />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Quality Score</p>
                          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                            <div
                              className="h-2 rounded-full bg-blue-500"
                              style={{ width: `${Math.min(score.quality_score, 100)}%` }}
                            />
                          </div>
                          <p className="text-sm font-bold text-white">{score.quality_score.toFixed(1)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Timeliness Score</p>
                          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                            <div
                              className="h-2 rounded-full bg-purple-500"
                              style={{ width: `${Math.min(score.timeliness_score, 100)}%` }}
                            />
                          </div>
                          <p className="text-sm font-bold text-white">{score.timeliness_score.toFixed(1)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Approval Rate</p>
                          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                            <div
                              className="h-2 rounded-full bg-green-500"
                              style={{ width: `${Math.min(score.approval_rate, 100)}%` }}
                            />
                          </div>
                          <p className="text-sm font-bold text-white">{score.approval_rate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Open Defects</p>
                          <div className="bg-gray-700 rounded px-2 py-1 h-2 mb-2">
                            <div className="text-xs text-gray-400 text-center">
                              {score.defect_count}
                            </div>
                          </div>
                          <p className={`text-sm font-bold ${score.defect_count > 5 ? 'text-red-400' : 'text-green-400'}`}>
                            {score.defect_count} open
                          </p>
                        </div>
                      </div>

                      <div className="bg-gray-800/50 rounded-lg p-4 flex items-start gap-3">
                        <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-1" />
                        <div>
                          <p className="text-xs font-semibold text-gray-300 mb-1">Performance Recommendation</p>
                          <p className="text-sm text-gray-400">
                            {score.performance_tier === 'A'
                              ? 'Excellent performance. Consider for premium projects.'
                              : score.performance_tier === 'B'
                              ? 'Good performance. Monitor for continuous improvement.'
                              : score.performance_tier === 'C'
                              ? 'Needs improvement. Recommend additional supervision.'
                              : 'Poor performance. Consider performance improvement plan.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </GlassCard>

      {scores.length === 0 && (
        <GlassCard className="p-12 text-center">
          <p className="text-gray-400">No scorecard data available for selected period</p>
        </GlassCard>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
