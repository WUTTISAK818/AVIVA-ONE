'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import SectionHeader from '@/components/SectionHeader'
import GlassCard from '@/components/GlassCard'
import Toast from '@/components/Toast'
import ConstructionGridView from '@/components/ConstructionGridView'

interface ProgressUnit {
  id: string
  house_number: string
  project_id: string
  current_stage: string
  stage_percentage: number
  overall_percentage: number
  completed_stages: number
  total_stages: number
  open_defects: number
}

const stageColors: Record<string, { bg: string; text: string; icon: string }> = {
  foundation: { bg: 'bg-blue-900/20', text: 'text-blue-400', icon: '🏗️' },
  frame: { bg: 'bg-purple-900/20', text: 'text-purple-400', icon: '🏢' },
  roof: { bg: 'bg-orange-900/20', text: 'text-orange-400', icon: '🏠' },
  finishing: { bg: 'bg-yellow-900/20', text: 'text-yellow-400', icon: '✨' },
  handover: { bg: 'bg-green-900/20', text: 'text-green-400', icon: '🎉' },
}

export default function ConstructionProgressPage() {
  const [units, setUnits] = useState<ProgressUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'grid'>('card')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<ProgressUnit | null>(null)

  useEffect(() => {
    loadProgress()
    const subscription = supabase
      .channel('construction_progress')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'construction_unit_progress' },
        () => loadProgress()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadProgress = async () => {
    try {
      const { data, error } = await supabase
        .from('vw_construction_progress')
        .select('*')
        .order('overall_percentage', { ascending: false })

      if (error) throw error
      setUnits(data || [])
    } catch (err) {
      setToast({ message: `Error loading progress: ${err}`, type: 'error' })
    }
    setLoading(false)
  }

  const filteredUnits = filter
    ? units.filter(u => u.current_stage === filter)
    : units

  const stats = {
    total: units.length,
    completed: units.filter(u => u.current_stage === 'handover').length,
    inProgress: units.filter(u => u.current_stage !== 'handover').length,
    avgProgress: units.length > 0
      ? Math.round(units.reduce((sum, u) => sum + u.overall_percentage, 0) / units.length)
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
    <div className="min-h-screen bg-gray-950 px-4 py-8 max-w-6xl mx-auto">
      <SectionHeader
        title="🏗️ Construction Progress Tracking"
        subtitle="Real-time unit progress monitoring — stages, completion %, defects"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-1">Total Units</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{stats.completed}</p>
          <p className="text-xs text-gray-400 mt-1">Completed</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{stats.inProgress}</p>
          <p className="text-xs text-gray-400 mt-1">In Progress</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">{stats.avgProgress}%</p>
          <p className="text-xs text-gray-400 mt-1">Avg Progress</p>
        </GlassCard>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode('card')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            viewMode === 'card'
              ? 'bg-aviva-gold text-aviva-bg'
              : 'bg-gray-800/50 text-gray-400 hover:text-white'
          }`}
        >
          📋 Card View
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            viewMode === 'grid'
              ? 'bg-aviva-gold text-aviva-bg'
              : 'bg-gray-800/50 text-gray-400 hover:text-white'
          }`}
        >
          🔲 Grid View
        </button>
      </div>

      {/* Stage Filter (only show for card view) */}
      {viewMode === 'card' && (
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter(null)}
          className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${
            filter === null
              ? 'bg-aviva-gold/20 text-aviva-gold border border-aviva-gold'
              : 'bg-gray-800/50 text-gray-400 hover:text-white'
          }`}
        >
          All Stages
        </button>
        {Object.entries(stageColors).map(([stage, colors]) => (
          <button
            key={stage}
            onClick={() => setFilter(stage)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${
              filter === stage
                ? `${colors.bg} ${colors.text} border border-current`
                : 'bg-gray-800/50 text-gray-400 hover:text-white'
            }`}
          >
            {colors.icon} {stage.charAt(0).toUpperCase() + stage.slice(1)}
          </button>
        ))}
      </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <ConstructionGridView
          units={units.map(u => ({
            id: u.id,
            house_number: u.house_number,
            progress: u.overall_percentage,
            status: u.current_stage === 'handover' ? 'complete' : (u.overall_percentage > 0 ? 'under_construction' : 'not_started'),
            current_stage: u.current_stage,
            open_defects: u.open_defects
          }))}
          onUnitClick={(unit) => {
            const fullUnit = units.find(u => u.house_number === unit.house_number)
            if (fullUnit) setSelectedUnit(fullUnit)
          }}
        />
      )}

      {/* Card View */}
      {viewMode === 'card' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUnits.map(unit => {
          const stageColor = stageColors[unit.current_stage] || stageColors.foundation
          return (
            <GlassCard key={unit.id} className={`p-6 border-l-4 ${stageColor.bg}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xl font-bold text-white">{unit.house_number}</p>
                  <p className={`text-sm font-semibold mt-1 ${stageColor.text}`}>
                    {stageColor.icon} {unit.current_stage.toUpperCase()}
                  </p>
                </div>
                {unit.open_defects > 0 && (
                  <span className="bg-red-900/30 text-red-400 text-xs font-bold px-2 py-1 rounded">
                    ⚠️ {unit.open_defects}
                  </span>
                )}
              </div>

              {/* Stage Progress */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-400">Stage Progress</span>
                  <span className="text-sm font-bold text-white">{unit.stage_percentage}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${stageColor.text.replace('text-', 'bg-')}`}
                    style={{ width: `${unit.stage_percentage}%` }}
                  />
                </div>
              </div>

              {/* Overall Progress */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-400">Overall Progress</span>
                  <span className="text-sm font-bold text-white">{unit.overall_percentage}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-aviva-gold"
                    style={{ width: `${unit.overall_percentage}%` }}
                  />
                </div>
              </div>

              {/* Completion Info */}
              <div className="text-xs text-gray-400 pt-3 border-t border-gray-700">
                <p>
                  {unit.completed_stages} of {unit.total_stages} stages completed
                </p>
              </div>
            </GlassCard>
          )
        })}
      </div>
      )}

      {viewMode === 'card' && filteredUnits.length === 0 && (
        <GlassCard className="p-12 text-center">
          <p className="text-gray-400">No units found for selected stage</p>
        </GlassCard>
      )}

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
