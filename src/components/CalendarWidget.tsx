"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Users, Check, HardHat, DollarSign, UserCheck, BadgeCheck } from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import GlassCard from "./GlassCard";

interface CalEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  description: string | null;
  is_done: boolean;
}

interface SalesAct {
  id: string;
  activity_type: string;
  note: string | null;
  activity_date: string;
}

interface ConstReport {
  id: string;
  house_id: string;
  work_detail: string;
  progress: number;
  issue: string | null;
  created_at: string;
}

const EVENT_TYPES = [
  { value: "general",      label: "ทั่วไป",      dot: "bg-blue-400" },
  { value: "meeting",      label: "ประชุม",       dot: "bg-yellow-400" },
  { value: "management",   label: "บริหาร",       dot: "bg-yellow-400" },
  { value: "deadline",     label: "กำหนดส่ง",    dot: "bg-red-400" },
  { value: "site_visit",   label: "ตรวจพื้นที่", dot: "bg-green-400" },
  { value: "construction", label: "ก่อสร้าง",    dot: "bg-green-400" },
  { value: "sales",        label: "ฝ่ายขาย",     dot: "bg-orange-400" },
  { value: "finance",      label: "การเงิน",      dot: "bg-blue-300" },
  { value: "hr",           label: "บุคคล",        dot: "bg-purple-400" },
  { value: "approval",     label: "อนุมัติ",      dot: "bg-amber-400" },
];

const DOT: Record<string, string> = {
  general:      "bg-blue-400",
  meeting:      "bg-yellow-400",
  management:   "bg-yellow-400",
  deadline:     "bg-red-400",
  site_visit:   "bg-green-400",
  construction: "bg-green-400",
  sales:        "bg-orange-400",
  finance:      "bg-blue-300",
  hr:           "bg-purple-400",
  approval:     "bg-amber-400",
};

const LEGEND = [
  { color: "bg-green-400",  label: "ก่อสร้าง" },
  { color: "bg-orange-400", label: "ฝ่ายขาย" },
  { color: "bg-yellow-400", label: "ประชุม/บริหาร" },
  { color: "bg-blue-400",   label: "ทั่วไป" },
  { color: "bg-purple-400", label: "บุคคล" },
  { color: "bg-amber-400",  label: "อนุมัติ" },
  { color: "bg-red-400",    label: "กำหนดส่ง" },
];

const DAYS_TH   = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const today = new Date().toISOString().split("T")[0];

export default function CalendarWidget() {
  const user = useCurrentUser();
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events,      setEvents]      = useState<CalEvent[]>([]);
  const [salesActs,   setSalesActs]   = useState<SalesAct[]>([]);
  const [constReports, setConstReports] = useState<ConstReport[]>([]);
  const [selected,     setSelected]     = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form,   setForm]   = useState({ title: "", event_type: "general", description: "" });
  const [saving, setSaving] = useState(false);

  const fetchEvents = () => {
    const mm    = String(month + 1).padStart(2, "0");
    const start = `${year}-${mm}-01`;
    const end   = `${year}-${mm}-31`;
    Promise.all([
      supabase.from("events").select("*").gte("event_date", start).lte("event_date", end),
      supabase.from("sales_activities").select("id,activity_type,note,activity_date")
        .gte("activity_date", start + "T00:00:00").lte("activity_date", end + "T23:59:59"),
      supabase.from("construction_reports").select("id,house_id,work_detail,progress,issue,created_at")
        .gte("created_at", start + "T00:00:00").lte("created_at", end + "T23:59:59"),
    ]).then(([evtRes, actRes, conRes]) => {
      setEvents((evtRes.data as CalEvent[]) ?? []);
      const acts = ((actRes.data ?? []) as { id: string; activity_type: string; note: string | null; activity_date: string }[])
        .map(a => ({ ...a, activity_date: a.activity_date.split("T")[0] }));
      setSalesActs(acts);
      const reports = ((conRes.data ?? []) as ConstReport[])
        .map(r => ({ ...r, created_at: r.created_at.split("T")[0] }));
      setConstReports(reports);
    });
  };

  useEffect(() => { fetchEvents(); }, [year, month]);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const ds = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const dayEvents      = (d: number) => events.filter(e => e.event_date === ds(d));
  const daySalesActs   = (d: number) => salesActs.filter(a => a.activity_date === ds(d));
  const dayConstReports = (d: number) => constReports.filter(r => r.created_at === ds(d));

  const selectedEvents       = selected ? events.filter(e => e.event_date === selected) : [];
  const selectedSalesActs    = selected ? salesActs.filter(a => a.activity_date === selected) : [];
  const selectedConstReports = selected ? constReports.filter(r => r.created_at === selected) : [];

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0);  setYear(y => y + 1); } else setMonth(m => m + 1); };

  const toggleEventDone = async (event: CalEvent) => {
    const newDone = !event.is_done;
    await supabase.from("events").update({ is_done: newDone }).eq("id", event.id);
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, is_done: newDone } : e));
  };

  const handleAdd = async () => {
    if (!form.title || !selected) return;
    setSaving(true);
    await supabase.from("events").insert({
      title: form.title,
      event_date: selected,
      event_type: form.event_type,
      description: form.description || null,
    });
    setSaving(false);
    setShowAddModal(false);
    setForm({ title: "", event_type: "general", description: "" });
    fetchEvents();
  };

  return (
    <>
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-aviva-gold/10 transition-colors">
            <ChevronLeft size={16} className="text-aviva-secondary" />
          </button>
          <h3 className="text-sm font-semibold text-aviva-text">
            {MONTHS_TH[month]} {year + 543}
          </h3>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-aviva-gold/10 transition-colors">
            <ChevronRight size={16} className="text-aviva-secondary" />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DAYS_TH.map(d => (
            <div key={d} className="text-center text-xs font-medium text-aviva-secondary/60 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr  = ds(d);
            const evts     = dayEvents(d);
            const acts     = daySalesActs(d);
            const cons     = dayConstReports(d);
            const isToday  = dateStr === today;
            const isSel    = dateStr === selected;
            const allDots  = [
              ...evts.slice(0, 2).map(e => DOT[e.event_type] ?? "bg-blue-400"),
              ...(acts.length > 0 ? ["bg-orange-400"] : []),
              ...(cons.length > 0 ? ["bg-green-400"] : []),
            ].slice(0, 3);
            return (
              <button key={i}
                onClick={() => setSelected(isSel ? null : dateStr)}
                className={`flex flex-col items-center py-1.5 rounded-lg transition-all ${
                  isSel   ? "bg-aviva-gold/20 border border-aviva-gold/40" :
                  isToday ? "border border-aviva-gold/30" : ""
                }`}
              >
                <span className={`text-sm font-medium ${isToday ? "text-aviva-gold" : "text-aviva-text"}`}>{d}</span>
                {allDots.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {allDots.map((c, idx) => (
                      <span key={idx} className={`w-1.5 h-1.5 rounded-full ${c}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-aviva-gold/10">
          {LEGEND.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
              <span className="text-[9px] text-aviva-secondary/70">{label}</span>
            </div>
          ))}
        </div>
        {selected && (
          <div className="mt-3 border-t border-aviva-gold/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-aviva-text">
                {new Date(selected + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
              </p>
              {(user?.isAdmin || user?.isManager) && (
                <button onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1 text-[11px] text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg">
                  <Plus size={10} /> เพิ่ม
                </button>
              )}
            </div>
            {selectedEvents.length === 0 && selectedSalesActs.length === 0 && selectedConstReports.length === 0 ? (
              <p className="text-xs text-aviva-secondary/60">ไม่มีกิจกรรม</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map(e => {
                  const et = EVENT_TYPES.find(t => t.value === e.event_type);
                  return (
                    <div key={e.id} className="flex items-start gap-2">
                      <button onClick={() => toggleEventDone(e)} className="mt-0.5 flex-shrink-0">
                        <div className={clsx("w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                          e.is_done ? "bg-aviva-gold border-aviva-gold" : "border-aviva-secondary/40 hover:border-aviva-gold/50"
                        )}>
                          {e.is_done && <Check size={9} className="text-aviva-bg" />}
                        </div>
                      </button>
                      <div className={clsx("flex-1", e.is_done && "opacity-50")}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT[e.event_type] ?? "bg-blue-400"}`} />
                          <p className={clsx("text-xs text-aviva-text font-medium", e.is_done && "line-through")}>{e.title}</p>
                        </div>
                        {e.description && <p className="text-[10px] text-aviva-secondary ml-3">{e.description}</p>}
                        <p className="text-[10px] text-aviva-secondary/50 ml-3">{et?.label ?? e.event_type}</p>
                      </div>
                    </div>
                  );
                })}
                {selectedSalesActs.length > 0 && (
                  <div className="bg-orange-500/10 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users size={11} className="text-orange-400" />
                      <p className="text-xs text-orange-400 font-semibold">ฝ่ายขาย ({selectedSalesActs.length} กิจกรรม)</p>
                    </div>
                    {selectedSalesActs.map(a => (
                      <p key={a.id} className="text-[10px] text-aviva-secondary ml-4">
                        · {a.activity_type}{a.note ? ` — ${a.note.slice(0, 50)}${a.note.length > 50 ? "…" : ""}` : ""}
                      </p>
                    ))}
                  </div>
                )}
                {selectedConstReports.length > 0 && (
                  <div className="bg-green-500/10 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <HardHat size={11} className="text-green-400" />
                      <p className="text-xs text-green-400 font-semibold">ก่อสร้าง ({selectedConstReports.length} รายงาน)</p>
                    </div>
                    {selectedConstReports.map(r => (
                      <p key={r.id} className="text-[10px] text-aviva-secondary ml-4">
                        · {r.work_detail.slice(0, 60)}{r.work_detail.length > 60 ? "…" : ""} ({r.progress}%)
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </GlassCard>
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-aviva-text">เพิ่มกิจกรรม</h2>
              <button onClick={() => setShowAddModal(false)}><X size={18} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อกิจกรรม *</label>
                <input type="text" value={form.title}
                  onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="เช่น ประชุมทีมขาย"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ประเภท</label>
                <select value={form.event_type}
                  onChange={(e) => setForm(p => ({ ...p, event_type: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด</label>
                <textarea value={form.description}
                  onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="รายละเอียดเพิ่มเติม..." rows={2}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
            </div>
            <button onClick={handleAdd} disabled={saving || !form.title}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกกิจกรรม"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
