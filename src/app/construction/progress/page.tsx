'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import SectionHeader from '@/components/SectionHeader'
import GlassCard from '@/components/GlassCard'
import Toast from '@/components/Toast'
import ConstructionGridView from '@/components/ConstructionGridView'

const PROJECT_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

interface HouseRow {
  id: string
  house_number: string
  plot_number: number | null
  house_model: string | null
  land_size: number | null
  progress: number | null
  construction_status: string | null
  delayed_days: number | null
}

interface ProgressUnit {
  id: string
  house_number: string
  display_name: string
  plot_number: number | null
  land_size: number | null
  progress: number
  construction_status: string
  current_stage: string
  delayed_days: number
  open_defects: number
}

const stageColors: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  not_started: { bg: 'bg-gray-800/30', text: 'text-gray-400', icon: '⚪', label: 'ยังไม่เริ่ม' },
  foundation: { bg: 'bg-blue-900/20', text: 'text-blue-400', icon: '🏗️', label: 'ฐานราก' },
  frame: { bg: 'bg-purple-900/20', text: 'text-purple-400', icon: '🏢', label: 'โครงสร้าง' },
  roof: { bg: 'bg-orange-900/20', text: 'text-orange-400', icon: '🏠', label: 'หลังคา' },
  finishing: { bg: 'bg-yellow-900/20', text: 'text-yellow-400', icon: '✨', label: 'เก็บงาน' },
  handover: { bg: 'bg-green-900/20', text: 'text-green-400', icon: '🎉', label: 'ส่งมอบ' },
}

// derive ขั้นงานก่อสร้างจาก progress + construction_status จริง
function deriveStage(h: HouseRow): string {
  const pct = h.progress ?? 0
  if (h.construction_status === 'not_started' || pct === 0) return 'not_started'
  if (h.construction_status === 'completed' || pct >= 100) return 'handover'
  if (pct >= 75) return 'finishing'
  if (pct >= 50) return 'roof'
  if (pct >= 25) return 'frame'
  return 'foundation'
}

function displayName(h: HouseRow): string {
  return `${(h.house_model ?? 'A').charAt(0)}${h.plot_number ?? 0}`
}

export default function ConstructionProgressPage() {
  const [units, setUnits] = useState<ProgressUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'grid'>('card')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadProgress()
    const subscription = supabase
      .channel('construction_progress_houses')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'houses' },
        () => loadProgress()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadProgress = async () => {
    try {
      const [housesRes, defectsRes] = await Promise.all([
        supabase
          .from('houses')
          .select('id, house_number, plot_number, house_model, land_size, progress, construction_status, delayed_days')
          .eq('project_id', PROJECT_ID)
          .order('plot_number'),
        supabase
          .from('defects')
          .select('house_id, status')
          .in('status', ['Open', 'In Progress']),
      ])

      if (housesRes.error) throw housesRes.error

      const defectCount = new Map<string, number>()
      for (const d of (defectsRes.data ?? []) as { house_id: string }[]) {
        defectCount.set(d.house_id, (defectCount.get(d.house_id) ?? 0) + 1)
      }

      const mapped: ProgressUnit[] = ((housesRes.data ?? []) as HouseRow[]).map(h => ({
        id: h.id,
        house_number: h.house_number,
        display_name: displayName(h),
        plot_number: h.plot_number,
        land_size: h.land_size,
        progress: h.progress ?? 0,
        construction_status: h.construction_status ?? 'not_started',
        current_stage: deriveStage(h),
        delayed_days: h.delayed_days ?? 0,
        open_defects: defectCount.get(h.id) ?? 0,
      }))

      setUnits(mapped)
    } catch (err) {
      setToast({ message: `โหลดข้อมูลไม่สำเร็จ: ${err}`, type: 'error' })
    }
    setLoading(false)
  }

  const filteredUnits = filter
    ? units.filter(u => u.current_stage === filter)
    : units

  const stats = {
    total: units.length,
    completed: units.filter(u => u.current_stage === 'handover').length,
    inProgress: units.filter(u => u.current_stage !== 'handover' && u.current_stage !== 'not_started').length,
    avgProgress: units.length > 0
      ? Math.round(units.reduce((sum, u) => sum + u.progress, 0) / units.length)
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
        subtitle="ความคืบหน้าการก่อสร้างรายแปลง — ขั้นงาน, % คืบหน้า, Defect, ความล่าช้า (ข้อมูลจริงจาก houses)"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-1">ทั้งหมด</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{stats.completed}</p>
          <p className="text-xs text-gray-400 mt-1">เสร็จแล้ว</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{stats.inProgress}</p>
          <p className="text-xs text-gray-400 mt-1">กำลังก่อสร้าง</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">{stats.avgProgress}%</p>
          <p className="text-xs text-gray-400 mt-1">คืบหน้าเฉลี่ย</p>
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
          ทุกขั้นงาน
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
            {colors.icon} {colors.label}
          </button>
        ))}
      </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <ConstructionGridView
          units={units.map(u => ({
            id: u.id,
            house_number: u.display_name,
            progress: u.progress,
            status: u.current_stage === 'handover' ? 'complete' : (u.progress > 0 ? 'under_construction' : 'not_started'),
            current_stage: u.current_stage,
            open_defects: u.open_defects
          }))}
        />
      )}

      {/* Card View */}
      {viewMode === 'card' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUnits.map(unit => {
          const stageColor = stageColors[unit.current_stage] || stageColors.not_started
          return (
            <GlassCard key={unit.id} className={`p-6 border-l-4 ${stageColor.bg}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xl font-bold text-white">{unit.display_name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{unit.house_number}</p>
                  <p className={`text-sm font-semibold mt-1 ${stageColor.text}`}>
                    {stageColor.icon} {stageColor.label}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {unit.delayed_days > 0 && (
                    <span className="bg-red-900/30 text-red-400 text-xs font-bold px-2 py-1 rounded">
                      🔴 ล่าช้า {unit.delayed_days} วัน
                    </span>
                  )}
                  {unit.open_defects > 0 && (
                    <span className="bg-orange-900/30 text-orange-400 text-xs font-bold px-2 py-1 rounded">
                      ⚠️ Defect {unit.open_defects}
                    </span>
                  )}
                </div>
              </div>

              {/* Overall Progress */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-400">ความคืบหน้า</span>
                  <span className="text-sm font-bold text-white">{unit.progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${stageColor.text.replace('text-', 'bg-')}`}
                    style={{ width: `${unit.progress}%` }}
                  />
                </div>
              </div>

              {/* Info */}
              <div className="text-xs text-gray-400 pt-3 border-t border-gray-700 flex justify-between">
                <span>ที่ดิน {unit.land_size ?? '—'} ตร.วา</span>
                <span>
                  {unit.construction_status === 'completed' ? 'เสร็จสมบูรณ์'
                    : unit.construction_status === 'in_progress' ? 'กำลังก่อสร้าง'
                    : 'ยังไม่เริ่ม'}
                </span>
              </div>
            </GlassCard>
          )
        })}
      </div>
      )}

      {viewMode === 'card' && filteredUnits.length === 0 && (
        <GlassCard className="p-12 text-center">
          <p className="text-gray-400">ไม่พบยูนิตในขั้นงานที่เลือก</p>
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
