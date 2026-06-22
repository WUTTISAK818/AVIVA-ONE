'use client'

interface HouseUnit {
  id: string
  house_number: string
  progress: number
  status: 'complete' | 'under_construction' | 'not_started'
  current_stage?: string | null
  open_defects?: number
}

interface ConstructionGridViewProps {
  units: HouseUnit[]
  onUnitClick?: (unit: HouseUnit) => void
}

const statusConfig = {
  complete: {
    bg: 'bg-green-900/30',
    border: 'border-green-500',
    text: 'text-green-400',
    label: 'เสร็จ'
  },
  under_construction: {
    bg: 'bg-yellow-900/30',
    border: 'border-yellow-500',
    text: 'text-yellow-400',
    label: 'กำลังทำ'
  },
  not_started: {
    bg: 'bg-gray-800/30',
    border: 'border-gray-600',
    text: 'text-gray-400',
    label: 'ยังไม่เริ่ม'
  }
}

export default function ConstructionGridView({ units, onUnitClick }: ConstructionGridViewProps) {
  return (
    <div className="w-full">
      {/* สถิติด้านบน */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{units.filter(u => u.status === 'complete').length}</p>
          <p className="text-xs text-gray-400 mt-1">เสร็จแล้ว</p>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{units.filter(u => u.status === 'under_construction').length}</p>
          <p className="text-xs text-gray-400 mt-1">กำลังทำ</p>
        </div>
        <div className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-400">{units.filter(u => u.status === 'not_started').length}</p>
          <p className="text-xs text-gray-400 mt-1">ยังไม่เริ่ม</p>
        </div>
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">
            {Math.round(units.reduce((sum, u) => sum + (u.progress || 0), 0) / units.length)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">เฉลี่ยก้าวหน้า</p>
        </div>
      </div>

      {/* Grid 31 หลัง */}
      <div className="bg-gray-900/40 border border-aviva-gold/20 rounded-lg p-4">
        <div className="grid grid-cols-5 gap-2">
          {units.map((unit) => {
            const config = statusConfig[unit.status]
            const progressBarWidth = `${unit.progress || 0}%`

            return (
              <button
                key={unit.id}
                onClick={() => onUnitClick?.(unit)}
                className={`p-3 rounded-lg border-2 transition-all hover:scale-105 active:scale-95 ${config.bg} ${config.border} cursor-pointer`}
              >
                {/* เลขห้อง */}
                <div className={`text-sm font-bold ${config.text} text-center mb-1`}>
                  {unit.house_number}
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-800 rounded-full h-1.5 mb-1 overflow-hidden">
                  <div
                    className={`h-full transition-all ${config.text.replace('text-', 'bg-')}`}
                    style={{ width: progressBarWidth }}
                  />
                </div>

                {/* Percentage */}
                <div className="text-[10px] text-gray-400 text-center mb-0.5">
                  {unit.progress || 0}%
                </div>

                {/* Status Badge */}
                <div className={`text-[9px] ${config.text} text-center font-medium`}>
                  {config.label}
                </div>

                {/* Defects Indicator */}
                {unit.open_defects && unit.open_defects > 0 && (
                  <div className="text-[8px] text-red-400 text-center mt-0.5">
                    ⚠️ {unit.open_defects}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* คำอธิบาย */}
      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <p>💚 <span className="text-green-400">เขียว</span> = เสร็จ 100% · 💛 <span className="text-yellow-400">เหลือง</span> = กำลังทำ · ⭕ <span className="text-gray-400">เทา</span> = ยังไม่เริ่ม</p>
        <p>⚠️ = Defects ที่ยังเปิดอยู่ · คลิกเพื่อดูรายละเอียด</p>
      </div>
    </div>
  )
}
