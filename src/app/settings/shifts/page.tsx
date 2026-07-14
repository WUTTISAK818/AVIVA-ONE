'use client';
// เวลาทำงาน & วันหยุดบริษัท — ผู้บริหารกำหนดเอง (ใช้คำนวณมาสาย + วันทำงานในระบบเงินเดือน)
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Clock, CalendarOff, Plus, Trash2, Save, Check } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/user-context';
import { loadWorkSchedule, saveWorkSchedule, loadHolidays, DEFAULT_SCHEDULE, type WorkSchedule } from '@/lib/work-schedule';

const PROJECT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const DOW = [['อา', 0], ['จ', 1], ['อ', 2], ['พ', 3], ['พฤ', 4], ['ศ', 5], ['ส', 6]] as const;
const thDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function WorkScheduleSettingsPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [sched, setSched] = useState<WorkSchedule>(DEFAULT_SCHEDULE);
  const [holidays, setHolidays] = useState<{ id?: string; holiday_date: string; name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  const reloadHolidays = useCallback(async () => {
    const { data } = await supabase.from('company_holidays').select('id, holiday_date, name').order('holiday_date');
    setHolidays((data as { id: string; holiday_date: string; name: string | null }[]) ?? []);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!user.isManager) { router.replace('/dashboard'); return; }
    (async () => {
      setSched(await loadWorkSchedule());
      await reloadHolidays();
      setLoading(false);
    })();
  }, [user, router, reloadHolidays]);

  const save = async () => {
    await saveWorkSchedule(sched);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleOff = (d: number) => setSched(s => ({
    ...s,
    weekly_off_days: s.weekly_off_days.includes(d) ? s.weekly_off_days.filter(x => x !== d) : [...s.weekly_off_days, d].sort(),
  }));

  const addHoliday = async () => {
    if (!newDate) return;
    await supabase.from('company_holidays').upsert({ project_id: PROJECT_ID, holiday_date: newDate, name: newName.trim() || null }, { onConflict: 'project_id,holiday_date' });
    setNewDate(''); setNewName('');
    reloadHolidays();
  };
  const delHoliday = async (id?: string) => { if (!id) return; await supabase.from('company_holidays').delete().eq('id', id); reloadHolidays(); };

  if (loading) return <div className="min-h-screen bg-aviva-bg flex items-center justify-center text-aviva-secondary text-sm">กำลังโหลด…</div>;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/settings" className="text-aviva-secondary"><ChevronLeft size={20} /></Link>
          <Clock size={18} className="text-aviva-gold" />
          <h1 className="text-lg font-bold text-aviva-text">เวลาทำงาน & วันหยุด</h1>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {/* เวลาทำงาน */}
        <GlassCard className="p-4 space-y-3">
          <p className="text-sm font-semibold text-aviva-gold">เวลาทำงานมาตรฐาน</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">เวลาเข้างาน</label>
              <input type="time" value={sched.work_start} onChange={e => setSched({ ...sched, work_start: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text" />
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">เวลาเลิกงาน</label>
              <input type="time" value={sched.work_end} onChange={e => setSched({ ...sched, work_end: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text" />
            </div>
          </div>
          <div>
            <label className="text-xs text-aviva-secondary mb-1 block">ผ่อนผันก่อนนับสาย (นาที)</label>
            <input type="number" inputMode="numeric" value={sched.grace_minutes} onChange={e => setSched({ ...sched, grace_minutes: Number(e.target.value) })}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text" />
          </div>
        </GlassCard>

        {/* วันหยุดประจำสัปดาห์ */}
        <GlassCard className="p-4 space-y-2">
          <p className="text-sm font-semibold text-aviva-gold">วันหยุดประจำสัปดาห์</p>
          <div className="flex gap-1.5">
            {DOW.map(([label, d]) => (
              <button key={d} onClick={() => toggleOff(d)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${sched.weekly_off_days.includes(d) ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-aviva-bg text-aviva-secondary border-aviva-gold/15'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-aviva-secondary/60">แดง = วันหยุด (ไม่นับเป็นวันทำงาน/ไม่หักขาดงาน)</p>
        </GlassCard>

        {/* การหักเงิน + ประกันสังคม */}
        <GlassCard className="p-4 space-y-3">
          <p className="text-sm font-semibold text-aviva-gold">การหักเงิน</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">หักมาสาย (บาท/ครั้ง)</label>
              <input type="number" inputMode="numeric" value={sched.late_deduction_per_day} onChange={e => setSched({ ...sched, late_deduction_per_day: Number(e.target.value) })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text" />
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">หักขาดงาน (บาท/วัน)</label>
              <input type="number" inputMode="numeric" value={sched.absent_deduction_per_day} onChange={e => setSched({ ...sched, absent_deduction_per_day: Number(e.target.value) })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text" />
            </div>
          </div>
          <p className="text-[10px] text-aviva-secondary/60">หักขาดงาน = 0 → ระบบใช้ (เงินเดือน ÷ วันทำงานในเดือน) อัตโนมัติ</p>
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input type="checkbox" checked={sched.sso_enabled} onChange={e => setSched({ ...sched, sso_enabled: e.target.checked })} className="w-4 h-4 accent-aviva-gold" />
            <span className="text-xs text-aviva-secondary">หักประกันสังคม 5% (เพดาน 750 บาท/เดือน)</span>
          </label>
        </GlassCard>

        <button onClick={save} className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm">
          {saved ? <><Check size={16} /> บันทึกแล้ว</> : <><Save size={16} /> บันทึกเวลาทำงาน</>}
        </button>

        {/* วันหยุดบริษัท (เพิ่ม/สลับได้) */}
        <GlassCard className="p-4 space-y-3">
          <p className="text-sm font-semibold text-aviva-gold flex items-center gap-1.5"><CalendarOff size={14} /> วันหยุดบริษัท (เพิ่ม/เปลี่ยน/สลับได้)</p>
          <div className="flex gap-2">
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text" />
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="ชื่อวันหยุด (ถ้ามี)"
              className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text placeholder:text-aviva-secondary/40" />
            <button onClick={addHoliday} className="px-3 bg-aviva-gold/20 text-aviva-gold rounded-lg border border-aviva-gold/30"><Plus size={16} /></button>
          </div>
          {holidays.length === 0 ? (
            <p className="text-xs text-aviva-secondary/60 text-center py-2">ยังไม่มีวันหยุดบริษัท</p>
          ) : (
            <div className="space-y-1.5">
              {holidays.map(h => (
                <div key={h.id} className="flex items-center justify-between bg-aviva-bg/50 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-aviva-text">{thDate(h.holiday_date)}</p>
                    {h.name && <p className="text-[11px] text-aviva-secondary">{h.name}</p>}
                  </div>
                  <button onClick={() => delHoliday(h.id)} className="text-red-400/80 p-1"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
