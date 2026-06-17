"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Users, Check, HardHat, DollarSign, UserCheck, BadgeCheck } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
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

interface ApprovalEvt {
  id: string;
  workflow_type: string;
  source_doc_index: string | null;
  date: string;
}

interface LeadEvt {
  id: string;
  customer_name: string;
  date: string;
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
  { color: "bg-aviva-gold", label: "ส่งมอบ" },
  { color: "bg-red-400",    label: "กำหนดส่ง" },
];

// Map an event_type / source to the responsible department for role-scoped visibility.
// Types not listed here (general, meeting, management, deadline) are shared → everyone sees them.
const EVENT_DEPT: Record<string, string> = {
  sales:        "ฝ่ายขาย",
  construction: "ฝ่ายก่อสร้าง",
  site_visit:   "ฝ่ายก่อสร้าง",
  finance:      "ฝ่ายการเงิน",
  hr:           "ฝ่ายบุคคล",
  approval:     "ฝ่ายอนุมัติ",
};

const WF_LABEL: Record<string, string> = {
  Booking_Deposit:         "เงินจอง",
  Contract_Approval:       "อนุมัติสัญญา",
  Material_Purchase:       "จัดซื้อวัสดุ",
  Document_Approval:       "อนุมัติเอกสาร",
  Finance_Approval:        "อนุมัติรายจ่าย",
  Leave_Request:           "อนุมัติการลา",
  Construction_Installment: "งวดงานก่อสร้าง",
  Installment_Approval:    "อนุมัติงวดงาน",
};

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
  const [approvals,    setApprovals]    = useState<ApprovalEvt[]>([]);
  const [leadFollows,  setLeadFollows]  = useState<LeadEvt[]>([]);
  const [leadDeliveries, setLeadDeliveries] = useState<LeadEvt[]>([]);
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
      supabase.from("approval_logs").select("id,workflow_type,source_doc_index,sla_due_at")
        .not("sla_due_at", "is", null)
        .gte("sla_due_at", start + "T00:00:00").lte("sla_due_at", end + "T23:59:59"),
      supabase.from("leads").select("id,customer_name,next_follow_up_date")
        .not("next_follow_up_date", "is", null)
        .gte("next_follow_up_date", start).lte("next_follow_up_date", end),
      supabase.from("leads").select("id,customer_name,delivery_date")
        .not("delivery_date", "is", null)
        .gte("delivery_date", start).lte("delivery_date", end),
    ]).then(([evtRes, actRes, conRes, apprRes, followRes, deliverRes]) => {
      setEvents((evtRes.data as CalEvent[]) ?? []);
      const acts = ((actRes.data ?? []) as { id: string; activity_type: string; note: string | null; activity_date: string }[])
        .map(a => ({ ...a, activity_date: a.activity_date.split("T")[0] }));
      setSalesActs(acts);
      const reports = ((conRes.data ?? []) as ConstReport[])
        .map(r => ({ ...r, created_at: r.created_at.split("T")[0] }));
      setConstReports(reports);
      setApprovals(((apprRes.data ?? []) as { id: string; workflow_type: string; source_doc_index: string | null; sla_due_at: string }[])
        .map(a => ({ id: a.id, workflow_type: a.workflow_type, source_doc_index: a.source_doc_index, date: a.sla_due_at.split("T")[0] })));
      setLeadFollows(((followRes.data ?? []) as { id: string; customer_name: string; next_follow_up_date: string }[])
        .map(l => ({ id: l.id, customer_name: l.customer_name, date: l.next_follow_up_date.split("T")[0] })));
      setLeadDeliveries(((deliverRes.data ?? []) as { id: string; customer_name: string; delivery_date: string }[])
        .map(l => ({ id: l.id, customer_name: l.customer_name, date: l.delivery_date.split("T")[0] })));
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

  // Role-scoped visibility: managers/executives see every department's activity;
  // regular staff see only their own department (+ shared general/meeting events).
  const isMgr  = user?.isManager ?? false;
  const myDept = user?.department ?? "";
  const seeDept = (dept: string) => isMgr || myDept === dept;

  const visEvents       = events.filter(e => { const d = EVENT_DEPT[e.event_type]; return !d || seeDept(d); });
  const visSalesActs    = seeDept("ฝ่ายขาย")      ? salesActs      : [];
  const visConstReports = seeDept("ฝ่ายก่อสร้าง") ? constReports   : [];
  const visApprovals    = seeDept("ฝ่ายอนุมัติ")  ? approvals      : [];
  const visFollows      = seeDept("ฝ่ายขาย")      ? leadFollows    : [];
  const visDeliveries   = seeDept("ฝ่ายขาย")      ? leadDeliveries : [];

  const dayEvents       = (d: number) => visEvents.filter(e => e.event_date === ds(d));
  const daySalesActs    = (d: number) => visSalesActs.filter(a => a.activity_date === ds(d));
  const dayConstReports = (d: number) => visConstReports.filter(r => r.created_at === ds(d));
  const dayApprovals    = (d: number) => visApprovals.filter(a => a.date === ds(d));
  const dayFollows      = (d: number) => visFollows.filter(l => l.date === ds(d));
  const dayDeliveries   = (d: number) => visDeliveries.filter(l => l.date === ds(d));

  const selectedEvents       = selected ? visEvents.filter(e => e.event_date === selected) : [];
  const selectedSalesActs    = selected ? visSalesActs.filter(a => a.activity_date === selected) : [];
  const selectedConstReports = selected ? visConstReports.filter(r => r.created_at === selected) : [];
  const selectedApprovals    = selected ? visApprovals.filter(a => a.date === selected) : [];
  const selectedFollows      = selected ? visFollows.filter(l => l.date === selected) : [];
  const selectedDeliveries   = selected ? visDeliveries.filter(l => l.date === selected) : [];

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
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-aviva-text">
              {MONTHS_TH[month]} {year + 543}
            </h3>
            {(year !== now.getFullYear() || month !== now.getMonth()) && (
              <button
                onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
                className="text-[9px] bg-aviva-gold/20 text-aviva-gold border border-aviva-gold/30 px-2 py-0.5 rounded-full font-bold hover:bg-aviva-gold/30 transition-colors"
              >
                วันนี้
              </button>
            )}
          </div>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-aviva-gold/10 transition-colors">
            <ChevronRight size={16} className="text-aviva-secondary" />
          </button>
        </div>
        <Link href="/activity"
          className="flex items-center justify-center gap-1.5 mb-3 py-1.5 rounded-lg bg-aviva-gold/10 border border-aviva-gold/20 text-aviva-gold text-[11px] font-semibold">
          <ClipboardList size={12} /> สรุปงานประจำวัน — บันทึก/ดูว่าใครทำอะไร
        </Link>
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
            const appr     = dayApprovals(d);
            const fol      = dayFollows(d);
            const del      = dayDeliveries(d);
            const isToday  = dateStr === today;
            const isSel    = dateStr === selected;
            const allDots  = [
              ...evts.slice(0, 2).map(e => DOT[e.event_type] ?? "bg-blue-400"),
              ...(acts.length > 0 ? ["bg-orange-400"] : []),
              ...(cons.length > 0 ? ["bg-green-400"] : []),
              ...(appr.length > 0 ? ["bg-amber-400"] : []),
              ...(fol.length  > 0 ? ["bg-orange-300"] : []),
              ...(del.length  > 0 ? ["bg-aviva-gold"] : []),
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
            {selectedEvents.length === 0 && selectedSalesActs.length === 0 && selectedConstReports.length === 0
              && selectedApprovals.length === 0 && selectedFollows.length === 0 && selectedDeliveries.length === 0 ? (
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
                {selectedApprovals.length > 0 && (
                  <div className="bg-amber-500/10 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <BadgeCheck size={11} className="text-amber-400" />
                      <p className="text-xs text-amber-400 font-semibold">งานรออนุมัติ — ครบกำหนด ({selectedApprovals.length})</p>
                    </div>
                    {selectedApprovals.map(a => (
                      <p key={a.id} className="text-[10px] text-aviva-secondary ml-4">
                        · {WF_LABEL[a.workflow_type] ?? a.workflow_type}{a.source_doc_index ? ` — ${a.source_doc_index.split("|")[0].trim()}` : ""}
                      </p>
                    ))}
                  </div>
                )}
                {selectedFollows.length > 0 && (
                  <div className="bg-orange-500/10 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <UserCheck size={11} className="text-orange-300" />
                      <p className="text-xs text-orange-300 font-semibold">นัดติดตามลูกค้า ({selectedFollows.length})</p>
                    </div>
                    {selectedFollows.map(l => (
                      <p key={l.id} className="text-[10px] text-aviva-secondary ml-4">· {l.customer_name}</p>
                    ))}
                  </div>
                )}
                {selectedDeliveries.length > 0 && (
                  <div className="bg-aviva-gold/10 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <BadgeCheck size={11} className="text-aviva-gold" />
                      <p className="text-xs text-aviva-gold font-semibold">นัดส่งมอบบ้าน ({selectedDeliveries.length})</p>
                    </div>
                    {selectedDeliveries.map(l => (
                      <p key={l.id} className="text-[10px] text-aviva-secondary ml-4">· {l.customer_name}</p>
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
