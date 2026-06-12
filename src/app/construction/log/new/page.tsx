import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import ConstructionLogForm from '@/components/ConstructionLogForm'

export const dynamic = 'force-dynamic'

export default async function NewConstructionLogPage() {
  const sb = getSupabase()
  const { data: projects } = await sb
    .from('projects')
    .select('id, project_name')
    .order('project_name')

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <Link href="/construction" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
        <ChevronLeft size={14} /> กลับหน้าก่อสร้าง
      </Link>
      <div>
        <h1 className="text-xl font-bold text-white">บันทึกหน้างานใหม่</h1>
        <p className="text-sm text-slate-500 mt-0.5">บันทึกความคืบหน้ารายวัน · บันทึกร่างหรือส่งขออนุมัติ</p>
      </div>

      <ConstructionLogForm projects={projects ?? []} />
    </div>
  )
}
