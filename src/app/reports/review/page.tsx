"use client";
import { useState, useEffect } from "react";
import { Users, ClipboardList, CheckCircle, AlertTriangle, Clock, Eye, X, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  activity:    { label: "กิจกรรม",       color: "text-blue-400" },
  achievement: { label: "ผลสำเร็จ",      color: "text-green-400" },
  issue:       { label: "ปัญหา/อุปสรรค", color: "text-red-400" },
  plan:        { label: "แผนงานพรุ่งนี้",  color: "text-yellow-400" },
};

interface WReport {
  id: string;
  user_email: string;
  employee_name: string;
  department: string;
  report_date: string;
  status: string;
  summary: string;
  work_location?: string;
  submitted_at?: string;
  late_reason?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
}

interface WeekStat {
  date: string;
  submitted: number;
  late: number;
  total: number;
}

interface WItem {
  id: string;
  category: string;
  description: string;
  source: string;
}

const STATUS_COLOR: Record<string, string> = {
  submitted: "text-green-400",
  late:      "text-orange-400",
  draft:     "text-aviva-secondary",
};
const STATUS_LABEL: Record<string, string> = {
  submitted: "ส่งแล้ว",
  late:      "ส่งล่าช้า",
  draft:     "ยังไม่ส่ง",
};
const STATUS_BG: Record<string, string> = {
  submitted: "bg-green-500/10 border-green-500/20",
  late:      "bg-orange-500/10 border-orange-500/20",
  draft:     "bg-aviva-bg/50 border-aviva-gold/10",
};

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

export default function ReportsReviewPage() {
  const user = useCurrentUser();
  const today = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(today);
  const [reports, setReports]           = useState<WReport[]>([]);
  const [selected, setSelected]         = useState<WReport | null>(null);
  const [selItems, setSelItems]         = useState<WItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [weekStats, setWeekStats]       = useState<WeekStat[]>([]);

  const canAccess = user?.isManager || user?.isAdmin;

  useEffect(() => {
    if (!canAccess) return;
    setLoading(true);
    supabase
      .from("work_reports")
      .select("*")
      .eq("report_date", selectedDate)
      .eq("report_type", "daily")
      .order("department")
      .order("employee_name")
      .then(({ data }) => {
        setReports((data ?? []) as WReport[]);
        setLoading(false);
      });
  }, [canAccess, selectedDate]);

  useEffect(() => {
    if (!canAccess) return;
    const sevenDaysAgo = addDays(today, -6);
    supabase
      .from("work_reports")
      .select("report_date, status")
      .gte("report_date", sevenDaysAgo)
      .lte("report_date", today)
      .eq("report_type", "daily")
      .then(({ data }) => {
        const byDate: Record<string, { submitted: number; late: number; total: number }> = {};
        (data ?? []).forEach((r: { report_date: string; status: string }) => {
          if (!byDate[r.report_date]) byDate[r.report_date] = { submitted: 0, late: 0, total: 0 };
          byDate[r.report_date].total++;
          if (r.status === "submitted") byDate[r.report_date].submitted++;
          if (r.status === "late") { byDate[r.report_date].submitted++; byDate[r.report_date].late++; }
        });
        const result: WeekStat[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = addDays(today, -i);
          result.push({ date: d, ...(byDate[d] ?? { submitted: 0, late: 0, total: 0 }) });
        }
        setWeekStats(result);
      });
  }, [canAccess]);

  async function openReport(r: WReport) {
    setSelected(r);
    const { data } = await supabase
      .from("work_report_items")
      .select("*")
      .eq("report_id", r.id)
      .order("created_at");
    setSelItems((data ?? []) as WItem[]);
  }

  async function acknowledge() {
    if (!selected || !user) return;
    setAcknowledging(true);
    const { data } = await supabase
      .from("work_reports")
      .update({ acknowledged_by: user.full_name ?? user.email, acknowledged_at: new Date().toISOString() })
      .eq("id", selected.id)
      .select()
      .single();
    if (data) {
      setSelected(data as WReport);
      setReports(prev => prev.map(r => r.id === selected.id ? data as WReport : r));
    }
    setAcknowledging(false);
  }

  const submitted = reports.filter(r => r.status === "submitted" || r.status === "late");
  const late      = reports.filter(r => r.status === "late");
  const draft     = reports.filter(r => r.status === "draft");

  const displayDate = new Date(selectedDate).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center px-4">
        <GlassCard className="p-6 text-center">
          <p className="text-aviva-secondary text-sm">เฉพาะผู้จัดการและผู้ดูแลระบบ</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-aviva-gold" />
            <h1 className="text-lg font-bold text-aviva-text">รายงานทีมงาน</h1>
          </div>
          <a href="/reports/audit" className="flex items-center gap-1.5 text-xs font-semibold text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/30 px-3 py-1.5 rounded-xl">
            <Eye size={12} /> Audit Trail
          </a>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-4">

        {weekStats.length > 0 && (
          <GlassCard className="p-3">
            <p className="text-[10px] text-aviva-secondary/70 uppercase tracking-wider mb-2">ภาพรวม 7 วันย้อนหลัง</p>
            <div className="grid grid-cols-7 gap-1">
              {weekStats.map(ws => {
                const isSelected = ws.date === selectedDate;
                const dayLabel = new Date(ws.date).toLocaleDateString("th-TH", { weekday: "short" }).slice(0, 2);
                const dayNum   = new Date(ws.date).getDate();
                const allGood  = ws.total > 0 && ws.submitted === ws.total && ws.late === 0;
                const hasLate  = ws.late > 0;
                const hasMiss  = ws.total > 0 && ws.submitted < ws.total;
                const noData   = ws.total === 0;
                const dotColor = noData ? "bg-aviva-secondary/20" : allGood ? "bg-green-500" : hasLate ? "bg-orange-400" : hasMiss ? "bg-red-400" : "bg-green-500";
                return (
                  <button key={ws.date} onClick={() => setSelectedDate(ws.date)}
                    className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all ${isSelected ? "bg-aviva-gold/15 border border-aviva-gold" : "border border-transparent hover:bg-aviva-bg/50"}`}>
                    <span className={`text-[9px] font-semibold ${isSelected ? "text-aviva-gold" : "text-aviva-secondary/60"}`}>{dayLabel}</span>
                    <span className={`text-xs font-bold ${isSelected ? "text-aviva-gold" : "text-aviva-text"}`}>{dayNum}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    {ws.total > 0 && (
                      <span className={`text-[8px] font-semibold ${isSelected ? "text-aviva-gold/70" : "text-aviva-secondary/50"}`}>
                        {ws.submitted}/{ws.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-aviva-gold/10">
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /><span className="text-[9px] text-aviva-secondary/50">ส่งครบ</span></div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" /><span className="text-[9px] text-aviva-secondary/50">มีล่าช้า</span></div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /><span className="text-[9px] text-aviva-secondary/50">ยังไม่ส่ง</span></div>
            </div>
          </GlassCard>
        )}

        <GlassCard className="p-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-2 rounded-xl hover:bg-aviva-gold/10 text-aviva-secondary">
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 text-center">
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-aviva-text text-center focus:outline-none" />
              <p className="text-[10px] text-aviva-secondary/60">{displayDate}</p>
            </div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} disabled={selectedDate >= today}
              className="p-2 rounded-xl hover:bg-aviva-gold/10 text-aviva-secondary disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        </GlassCard>

        <div className="grid grid-cols-3 gap-2">
          <GlassCard className="p-3 text-center">
            <CheckCircle size={15} className="text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-400">{submitted.length}</p>
            <p className="text-[10px] text-aviva-secondary">ส่งแล้ว</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <Clock size={15} className="text-aviva-secondary mx-auto mb-1" />
            <p className="text-xl font-bold text-aviva-text">{draft.length}</p>
            <p className="text-[10px] text-aviva-secondary">ยังไม่ส่ง</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <AlertTriangle size={15} className="text-orange-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-orange-400">{late.length}</p>
            <p className="text-[10px] text-aviva-secondary">ส่งล่าช้า</p>
          </GlassCard>
        </div>

        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card animate-pulse" />)
        ) : reports.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <ClipboardList size={24} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-sm text-aviva-secondary">ยังไม่มีรายงานในวันที่เลือก</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {reports.map(r => (
              <button key={r.id} onClick={() => openReport(r)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border hover:border-aviva-gold/30 transition-all active:scale-[0.98] text-left ${STATUS_BG[r.status] ?? "bg-aviva-card border-aviva-gold/10"}`}>
                <div className="w-9 h-9 rounded-full bg-aviva-gold/10 border border-aviva-gold/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-aviva-gold">{(r.employee_name ?? "?").charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-aviva-text truncate">{r.employee_name}</p>
                  <p className="text-[10px] text-aviva-secondary">{r.department}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={`text-xs font-bold ${STATUS_COLOR[r.status] ?? "text-aviva-secondary"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </p>
                  {r.submitted_at && (
                    <p className="text-[10px] text-aviva-secondary/60">
                      {new Date(r.submitted_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                    </p>
                  )}
                </div>
                <Eye size={14} className="text-aviva-secondary/30 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-aviva-text">{selected.employee_name}</h2>
                <p className="text-xs text-aviva-secondary">
                  {selected.department} · {new Date(selected.report_date).toLocaleDateString("th-TH")}
                  {" · "}<span className={`font-bold ${STATUS_COLOR[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
                </p>
              </div>
              <button onClick={() => setSelected(null)}>
                <X size={20} className="text-aviva-secondary" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {selected.work_location && (
                <div className="flex items-center gap-2 bg-aviva-gold/5 rounded-xl px-3 py-2 border border-aviva-gold/15">
                  <MapPin size={12} className="text-aviva-gold flex-shrink-0" />
                  <p className="text-xs text-aviva-text">{selected.work_location}</p>
                </div>
              )}
              {selected.summary && (
                <div className="bg-aviva-bg/50 rounded-xl p-3">
                  <p className="text-[10px] text-aviva-secondary mb-1 uppercase tracking-wider">สรุปภาพรวม</p>
                  <p className="text-sm text-aviva-text">{selected.summary}</p>
                </div>
              )}
              {selected.late_reason && (
                <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
                  <p className="text-[10px] text-orange-400 font-bold mb-1 uppercase tracking-wider">เหตุผลที่ส่งล่าช้า</p>
                  <p className="text-xs text-aviva-text">{selected.late_reason}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-aviva-secondary uppercase tracking-wider mb-2">{selItems.length} รายการกิจกรรม</p>
                <div className="space-y-1.5">
                  {selItems.length === 0 && (
                    <p className="text-xs text-aviva-secondary/50 text-center py-4">ยังไม่มีรายการกิจกรรม</p>
                  )}
                  {selItems.map((item, i) => {
                    const cat = CATEGORY_LABELS[item.category] ?? CATEGORY_LABELS.activity;
                    return (
                      <div key={i} className="flex items-start gap-2 bg-aviva-bg/50 rounded-xl px-3 py-2.5">
                        <span className={`text-[10px] font-bold mt-0.5 flex-shrink-0 ${cat.color}`}>[{cat.label}]</span>
                        <p className="text-xs text-aviva-text leading-relaxed">{item.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              {selected.acknowledged_by && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                  <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                  <p className="text-xs text-green-400">รับทราบโดย {selected.acknowledged_by}</p>
                </div>
              )}
            </div>

            {!selected.acknowledged_by && (
              <div className="mt-4 pt-4 border-t border-aviva-gold/10">
                <button onClick={acknowledge} disabled={acknowledging}
                  className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                  {acknowledging ? "กำลังบันทึก..." : "รับทราบรายงานนี้"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}