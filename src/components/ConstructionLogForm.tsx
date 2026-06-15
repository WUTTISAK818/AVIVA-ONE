'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Send, ImagePlus, X, Loader2, CheckCircle2 } from 'lucide-react'

interface ProjectOpt {
  id: string
  project_name: string | null
}

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

export default function ConstructionLogForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [logDate, setLogDate] = useState(todayISO())
  const [progress, setProgress] = useState(50)
  const [notes, setNotes] = useState('')
  const [draftReport, setDraftReport] = useState('')
  const [photoInput, setPhotoInput] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  const [busy, setBusy] = useState<null | 'draft' | 'submit'>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<null | 'draft' | 'submit'>(null)

  function addPhoto() {
    const url = photoInput.trim()
    if (!url) return
    setPhotos(prev => (prev.includes(url) ? prev : [...prev, url]))
    setPhotoInput('')
  }

  async function save(action: 'draft' | 'submit') {
    if (!projectId || !logDate) {
      setError('กรุณาเลือกโครงการและวันที่')
      return
    }
    setBusy(action)
    setError(null)
    setDone(null)
    try {
      const res = await fetch('/api/construction-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          log_date: logDate,
          progress_percent: progress,
          notes,
          draft_report: draftReport,
          photo_urls: photos,
          action,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.hint || j.error || `HTTP ${res.status}`)
      }
      setDone(action)
      // reset the body fields, keep project/date for fast repeat entry
      setNotes('')
      setDraftReport('')
      setPhotos([])
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  const label = 'block text-xs font-medium text-slate-400 mb-1.5'
  const field =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500/60 transition-colors'

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-5 max-w-2xl">
      {done && (
        <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-sm rounded-lg px-3 py-2.5">
          <CheckCircle2 size={15} />
          {done === 'submit' ? 'ส่งขออนุมัติเรียบร้อยแล้ว' : 'บันทึกฉบับร่างเรียบร้อยแล้ว'}
        </div>
      )}

      {/* Project + date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>โครงการ</label>
          <select className={field} value={projectId} onChange={e => setProjectId(e.target.value)}>
            {projects.length === 0 && <option value="">— ไม่มีโครงการ —</option>}
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_name ?? p.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>วันที่</label>
          <input type="date" className={field} value={logDate} onChange={e => setLogDate(e.target.value)} />
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={label + ' mb-0'}>ความคืบหน้า</label>
          <span className="text-sm font-mono font-bold text-blue-400">{progress}%</span>
        </div>
        <input
          type="range" min={0} max={100} step={5} value={progress}
          onChange={e => setProgress(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden mt-1">
          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={label}>บันทึกหน้างาน (notes)</label>
        <textarea
          className={field + ' resize-y min-h-[90px]'}
          placeholder="งานที่ทำวันนี้ ปัญหาอุปสรรค วัสดุ จำนวนแรงงาน ฯลฯ"
          value={notes} onChange={e => setNotes(e.target.value)}
        />
      </div>

      {/* Draft report */}
      <div>
        <label className={label}>ร่างรายงานสำหรับขออนุมัติ <span className="text-slate-600">(ไม่บังคับ)</span></label>
        <textarea
          className={field + ' resize-y min-h-[70px]'}
          placeholder="สรุปสำหรับผู้อนุมัติ — สิ่งที่ต้องการการตัดสินใจหรือยืนยัน"
          value={draftReport} onChange={e => setDraftReport(e.target.value)}
        />
      </div>

      {/* Photos */}
      <div>
        <label className={label}>รูปหน้างาน <span className="text-slate-600">(วาง URL รูป)</span></label>
        <div className="flex gap-2">
          <input
            className={field}
            placeholder="https://…/photo.jpg"
            value={photoInput}
            onChange={e => setPhotoInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPhoto() } }}
          />
          <button
            type="button" onClick={addPhoto}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <ImagePlus size={14} /> เพิ่ม
          </button>
        </div>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {photos.map(url => (
              <span key={url} className="inline-flex items-center gap-1.5 text-xs bg-slate-800 border border-slate-700 rounded-full pl-2.5 pr-1 py-1 text-slate-300 max-w-[220px]">
                <span className="truncate">{url}</span>
                <button type="button" onClick={() => setPhotos(p => p.filter(u => u !== url))} className="text-slate-500 hover:text-red-400">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-[10px] text-slate-600 mt-1">
          * ยังไม่ได้ตั้งค่า Storage bucket — แนบเป็นลิงก์รูปไปก่อน (อัปโหลดไฟล์จริงเพิ่มได้ภายหลัง)
        </p>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-lg px-3 py-2">{error}</div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => save('draft')} disabled={busy !== null}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-colors"
        >
          {busy === 'draft' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          บันทึกฉบับร่าง
        </button>
        <button
          onClick={() => save('submit')} disabled={busy !== null}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
        >
          {busy === 'submit' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          ส่งขออนุมัติ
        </button>
      </div>
    </div>
  )
}
