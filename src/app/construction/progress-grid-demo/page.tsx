'use client'

import { useState } from 'react'
import SectionHeader from '@/components/SectionHeader'
import ConstructionGridView from '@/components/ConstructionGridView'
import GlassCard from '@/components/GlassCard'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

// ข้อมูล Demo ตามที่ Pom ให้มา
const demoUnits: Array<{
  id: string
  house_number: string
  progress: number
  status: 'complete' | 'under_construction' | 'not_started'
  current_stage?: string | null
  open_defects?: number
}> = [
  // เสร็จ 100% (13 หลัง)
  { id: '1', house_number: 'A01', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '2', house_number: 'A02', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '3', house_number: 'A03', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '4', house_number: 'A04', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '5', house_number: 'A05', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '6', house_number: 'A06', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '7', house_number: 'A08', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '8', house_number: 'V13', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '9', house_number: 'V14', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '10', house_number: 'V15', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '11', house_number: 'V16', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '12', house_number: 'V30', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },
  { id: '13', house_number: 'V31', progress: 100, status: 'complete', current_stage: 'handover', open_defects: 0 },

  // กำลังทำ 85% (1 หลัง)
  { id: '14', house_number: 'A07', progress: 85, status: 'under_construction', current_stage: 'finishing', open_defects: 2 },

  // ยังไม่เริ่ม 0% (17 หลัง)
  { id: '15', house_number: 'A09', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '16', house_number: 'A10', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '17', house_number: 'A11', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '18', house_number: 'A12', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '19', house_number: 'A18', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '20', house_number: 'V17', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '21', house_number: 'V18', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '22', house_number: 'V19', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '23', house_number: 'V20', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '24', house_number: 'V21', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '25', house_number: 'V22', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '26', house_number: 'V23', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '27', house_number: 'V24', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '28', house_number: 'V25', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '29', house_number: 'V26', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '30', house_number: 'V27', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
  { id: '31', house_number: 'V28', progress: 0, status: 'not_started', current_stage: null, open_defects: 0 },
]

interface SelectedUnit {
  id: string
  house_number: string
  progress: number
  status: 'complete' | 'under_construction' | 'not_started'
  current_stage?: string | null
  open_defects?: number
}

export default function ConstructionProgressGridDemo() {
  const [selectedUnit, setSelectedUnit] = useState<SelectedUnit | null>(null)

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/construction/progress" className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700">
          <ChevronLeft size={18} className="text-aviva-gold" />
        </Link>
        <h1 className="text-2xl font-bold text-aviva-gold">🏗️ ผังการก่อสร้าง (Grid View)</h1>
        <span className="text-xs bg-aviva-gold/20 text-aviva-gold px-2 py-1 rounded">DEMO</span>
      </div>

      {/* Grid View Component */}
      <ConstructionGridView
        units={demoUnits}
        onUnitClick={(unit) => setSelectedUnit(unit)}
      />

      {/* Detail Panel */}
      {selectedUnit && (
        <GlassCard className="mt-8 p-6 max-w-2xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xl font-bold text-aviva-gold">{selectedUnit.house_number}</p>
              <p className="text-sm text-gray-400 mt-1">
                สถานะ: <span className="text-white font-medium">{selectedUnit.status}</span>
              </p>
            </div>
            <button
              onClick={() => setSelectedUnit(null)}
              className="text-gray-400 hover:text-white text-xl font-bold"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-400">ความคืบหน้า</p>
              <p className="text-2xl font-bold text-aviva-gold mt-1">{selectedUnit.progress}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">ขั้นตอน</p>
              <p className="text-lg font-medium text-white mt-1">
                {selectedUnit.current_stage || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Defects ที่เปิด</p>
              <p className={`text-lg font-bold mt-1 ${selectedUnit.open_defects && selectedUnit.open_defects > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {selectedUnit.open_defects || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">ผู้รับเหมา</p>
              <p className="text-lg font-medium text-white mt-1">-</p>
            </div>
          </div>

          <div className="bg-gray-800/30 rounded-lg p-3 text-xs text-gray-400">
            <p>💡 ในเวอร์ชันจริง จะแสดง:</p>
            <ul className="mt-2 space-y-1 ml-3">
              <li>✓ วันที่คาดส่งมอบ (Handover Date)</li>
              <li>✓ วันที่เริ่มจริง (Actual Start)</li>
              <li>✓ ความล่าช้า (Days Late)</li>
              <li>✓ ผู้รับเหมา (Contractor)</li>
              <li>✓ Payment Status (เบิกได้แล้ว/รอการอนุมัติ)</li>
            </ul>
          </div>
        </GlassCard>
      )}

      {/* Info Box */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <p className="text-sm font-bold text-aviva-gold mb-2">✨ ข้อดี Grid View</p>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>✓ เห็นภาพรวม 31 หลังพร้อมกัน</li>
            <li>✓ ตรวจสอบสถานะเร็ว ๆ</li>
            <li>✓ คลิกเพื่อดูรายละเอียด</li>
            <li>✓ ใช้พื้นที่หน้าจออย่างมีประสิทธิ</li>
          </ul>
        </GlassCard>

        <GlassCard className="p-4">
          <p className="text-sm font-bold text-aviva-gold mb-2">📊 Comparison</p>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>Card View: รายละเอียดครบ | แต่ scroll นาน</li>
            <li>Grid View: ภาพรวมชัด | ลึกลงได้เมื่อต้อง</li>
            <li>💡 เสนอ: ใช้ Tabs เลือกได้ทั้ง 2 แบบ</li>
          </ul>
        </GlassCard>
      </div>
    </div>
  )
}
