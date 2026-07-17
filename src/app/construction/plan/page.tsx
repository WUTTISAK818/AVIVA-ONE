"use client";
// แผนงานก่อสร้างรายวัน (แผน vs จริง) — วิศวกรวางแผนล่วงหน้า · หน้างานอัปเดต %จริง · ผู้บริหารดูตามแผน/ล่าช้า
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, CalendarRange, TrendingUp, AlertTriangle, Check } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";

interface PlanRow {
  id: string; house_id: string; plan_date: string; seq: number;
  task_name: string; plan_percent: number | null; actual_percent: number | null;
  houses?: { house_number: string } | null;
}

const shortUnit = (n: string) => n.split("/")[0].trim();
const thDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });

export default function ConstructionPlanPage() {
  const user = useCurrentUser();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<string>("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const canEdit = !!user; // พนักงานก่อสร้าง/ผู้บริหารอัปเดต %จริงได้

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("construction_plans")
      .select("id, house_id, plan_date, seq, task_name, plan_percent, actual_percent, houses(house_number)")
      .order("plan_date").order("seq");
    const list = (data as unknown as PlanRow[]) ?? [];
    setRows(list);
    if (!unit && list.length) setUnit(list[0].house_id);
    setLoading(false);
  }, [unit]);

  useEffect(() => { load(); }, [load]);

  const units = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => { if (r.houses?.house_number) m.set(r.house_id, r.houses.house_number); });
    return Array.from(m.entries());
  }, [rows]);

  const unitRows = rows.filter(r => r.house_id === unit);
  const byDate = useMemo(() => {
    const m = new Map<string, PlanRow[]>();
    unitRows.forEach(r => { if (!m.has(r.plan_date)) m.set(r.plan_date, []); m.get(r.plan_date)!.push(r); });
    return Array.from(m.entries());
  }, [unitRows]);

  // สรุปตามแผน/ล่าช้า (นับเฉพาะงานที่มี %แผน และถึง/เลยวันแล้ว)
  const summary = useMemo(() => {
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    let onTrack = 0, behind = 0, pending = 0;
    unitRows.forEach(r => {
      if (r.plan_percent == null) return;
      if (r.plan_date > today) return;
      if (r.actual_percent == null) { pending++; return; }
      if (Number(r.actual_percent) >= Number(r.plan_percent)) onTrack++; else behind++;
    });
    return { onTrack, behind, pending };
  }, [unitRows]);

  const saveActual = async (r: PlanRow) => {
    const raw = draft[r.id];
    if (raw === undefined) return;
    const val = raw === "" ? null : Number(raw);
    await supabase.from("construction_plans").update({ actual_percent: val, updated_at: new Date().toISOString() }).eq("id", r.id);
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, actual_percent: val } : x));
    setDraft(prev => { const n = { ...prev }; delete n[r.id]; return n; });
  };

  const statusOf = (r: PlanRow) => {
    if (r.plan_percent == null) return { label: "งานหลัก", cls: "text-aviva-secondary" };
    if (r.actual_percent == null) return { label: "ยังไม่อัปเดต", cls: "text-aviva-secondary/60" };
    return Number(r.actual_percent) >= Number(r.plan_percent)
      ? { label: "ตามแผน", cls: "text-green-400" }
      : { label: "ล่าช้า", cls: "text-red-400" };
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-3">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/construction" className="text-aviva-secondary"><ChevronLeft size={20} /></Link>
          <CalendarRange size={18} className="text-aviva-gold" />
          <h1 className="text-lg font-bold text-aviva-text">แผนงานก่อสร้าง (แผน vs จริง)</h1>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {loading ? (
          <p className="text-sm text-aviva-secondary/70 text-center py-8">กำลังโหลด…</p>
        ) : units.length === 0 ? (
          <p className="text-sm text-aviva-secondary/70 text-center py-8">ยังไม่มีแผนงาน</p>
        ) : (
          <>
            <select value={unit} onChange={e => setUnit(e.target.value)}
              className="w-full bg-aviva-card border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text">
              {units.map(([id, name]) => <option key={id} value={id}>{shortUnit(name)}</option>)}
            </select>

            <div className="grid grid-cols-3 gap-2">
              <GlassCard className="p-3 text-center"><p className="text-xl font-bold text-green-400">{summary.onTrack}</p><p className="text-[10px] text-aviva-secondary">ตามแผน</p></GlassCard>
              <GlassCard className="p-3 text-center"><p className="text-xl font-bold text-red-400">{summary.behind}</p><p className="text-[10px] text-aviva-secondary">ล่าช้า</p></GlassCard>
              <GlassCard className="p-3 text-center"><p className="text-xl font-bold text-aviva-secondary">{summary.pending}</p><p className="text-[10px] text-aviva-secondary">ยังไม่อัปเดต</p></GlassCard>
            </div>
            {summary.behind > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
                <AlertTriangle size={13} /> มีงานล่าช้ากว่าแผน {summary.behind} รายการ — ควรเร่งรัด
              </div>
            )}

            {byDate.map(([date, tasks]) => (
              <GlassCard key={date} className="p-3">
                <p className="text-xs font-semibold text-aviva-gold mb-2 flex items-center gap-1.5"><TrendingUp size={12} /> {thDate(date)}</p>
                <div className="space-y-2">
                  {tasks.map(t => {
                    const st = statusOf(t);
                    return (
                      <div key={t.id} className="flex items-center gap-2 border-b border-aviva-gold/5 pb-2 last:border-0 last:pb-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aviva-text leading-tight">{t.task_name}</p>
                          <p className={`text-[10px] ${st.cls}`}>{st.label}{t.plan_percent != null ? ` · แผน ${t.plan_percent}%` : ""}</p>
                        </div>
                        {t.plan_percent != null && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <input inputMode="numeric" placeholder="—" disabled={!canEdit}
                              value={draft[t.id] ?? (t.actual_percent ?? "").toString()}
                              onChange={e => setDraft(prev => ({ ...prev, [t.id]: e.target.value }))}
                              onBlur={() => saveActual(t)}
                              className="w-14 text-right bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1 text-sm text-aviva-text" />
                            <span className="text-xs text-aviva-secondary">%จริง</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            ))}
            <p className="text-[10px] text-aviva-secondary/50 text-center flex items-center justify-center gap-1"><Check size={10} /> แก้ %จริง แล้วแตะที่ว่างเพื่อบันทึกอัตโนมัติ</p>
          </>
        )}
      </div>
    </div>
  );
}
