"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Star, Phone, Plus, X, Pencil, MessageCircle, PhoneCall, TrendingUp, Download } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import AIInsightPanel from "@/components/AIInsightPanel";
import PeriodFilter, { type Period } from "@/components/PeriodFilter";
import { supabase } from "@/lib/supabase";
import { pipelineStages, type LeadStatus } from "@/lib/mock-data";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface Lead {
  id: string;
  customer_name: string;
  phone: string;
  budget: number;
  status: LeadStatus;
  source: string;
  ai_score: number;
  notes: string;
  created_at_default: string;
  assigned_to?: string | null;
}

const sourceColor: Record<string, string> = {
  Facebook: "bg-blue-500/20 text-blue-400",
  TikTok: "bg-pink-500/20 text-pink-400",
  Google: "bg-green-500/20 text-green-400",
  Referral: "bg-purple-500/20 text-purple-400",
};

const SOURCES = ["Facebook", "TikTok", "Google", "Referral", "Walk-in", "อื่นๆ"];
const CALL_STATUSES = ["โทรติด-สนใจ", "โทรติด-ไม่สนใจ", "โทรไม่ติด", "นัดหมายแล้ว", "ส่ง LINE แล้ว"];

function scoreColor(score: number) {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function formatBudget(n: number) {
  return `฿${(n / 1_000_000).toFixed(1)}M`;
}

function getChatLink(lead: Lead): string {
  if (lead.source === "TikTok") return `tiktok://user?username=${encodeURIComponent(lead.customer_name)}`;
  if (lead.source === "Instagram") return `instagram://user?username=${encodeURIComponent(lead.customer_name)}`;
  return `https://line.me/R/oaMessage/@`;
}

const emptyForm = {
  customer_name: "",
  phone: "",
  budget: "",
  source: "Facebook",
  status: "New Lead" as LeadStatus,
  notes: "",
};

const emptyCrmLog = { channel: "Phone", callStatus: "", note: "" };

type MainTab = "pipeline" | "team";

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("pipeline");
  const [activeStage, setActiveStage] = useState<LeadStatus>("New Lead");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [dateStart, setDateStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [leadsLimit, setLeadsLimit] = useState(50);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [crmLogLead, setCrmLogLead] = useState<Lead | null>(null);
  const [crmLogForm, setCrmLogForm] = useState(emptyCrmLog);
  const [savingLog, setSavingLog] = useState(false);

  const fetchLeads = (start: string, end: string, limit = 50) => {
    setLoading(true);
    let q = supabase.from("leads").select("*").eq("project_id", PROJECT_ID);
    if (start) q = q.gte("created_at_default", start);
    if (end) q = q.lte("created_at_default", end + "T23:59:59");
    q.order("created_at_default", { ascending: false }).limit(limit)
      .then(({ data }) => { setLeads((data as Lead[]) ?? []); setLoading(false); });
  };

  useEffect(() => {
    setLeadsLimit(50);
    fetchLeads(dateStart, dateEnd, 50);
  }, [dateStart, dateEnd]);

  const handlePeriodChange = (p: Period, start: string, end: string) => {
    setPeriod(p);
    setDateStart(start);
    setDateEnd(end);
  };

  const stageCounts = useMemo(() => Object.fromEntries(
    pipelineStages.map((s) => [s, leads.filter((l) => l.status === s).length])
  ) as Record<LeadStatus, number>, [leads]);

  const filtered = useMemo(() => leads.filter(
    (l) => l.status === activeStage && (search === "" || l.customer_name.includes(search))
  ), [leads, activeStage, search]);

  const teamStats = useMemo(() => {
    const groups = new Map<string, Lead[]>();
    leads.forEach((lead) => {
      const key = lead.assigned_to || lead.source || "ไม่ระบุ";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(lead);
    });
    return Array.from(groups.entries())
      .map(([name, ml]) => ({
        name,
        total: ml.length,
        siteVisit: ml.filter((l) => l.status === "Site Visit").length,
        booking: ml.filter((l) => l.status === "Booking").length,
        closed: ml.filter((l) => l.status === "Closed Deal").length,
        revenue: ml.filter((l) => l.status === "Closed Deal").reduce((s, l) => s + Number(l.budget), 0),
        closeRate: ml.length > 0 ? Math.round((ml.filter((l) => l.status === "Closed Deal").length / ml.length) * 100) : 0,
      }))
      .sort((a, b) => b.closed - a.closed);
  }, [leads]);

  const closedCount = stageCounts["Closed Deal"] ?? 0;
  const closeRate = leads.length > 0 ? Math.round((closedCount / leads.length) * 100) : 0;

  const openEdit = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLead(lead);
    setForm({ customer_name: lead.customer_name, phone: lead.phone, budget: String(lead.budget), source: lead.source, status: lead.status, notes: lead.notes ?? "" });
    setShowModal(true);
  };

  const openCall = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    setCrmLogLead(lead);
    setCrmLogForm({ channel: "Phone", callStatus: "", note: "" });
  };

  const openChat = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    const channel = ["TikTok", "Instagram"].includes(lead.source) ? lead.source : "LINE";
    setCrmLogLead(lead);
    setCrmLogForm({ channel, callStatus: "", note: "" });
  };

  const saveCrmLog = async () => {
    if (!crmLogLead || !crmLogForm.callStatus) return;
    setSavingLog(true);
    await supabase.from("crm_logs").insert({ lead_id: crmLogLead.id, contact_channel: crmLogForm.channel, call_status: crmLogForm.callStatus, call_note: crmLogForm.note });
    setSavingLog(false);
    setCrmLogLead(null);
    setCrmLogForm(emptyCrmLog);
  };

  const openAdd = () => { setEditingLead(null); setForm(emptyForm); setShowModal(true); };

  const handleSave = async () => {
    if (!form.customer_name || !form.phone) return;
    setSaving(true);
    if (editingLead) {
      await supabase.from("leads").update({ customer_name: form.customer_name, phone: form.phone, budget: Number(form.budget) || 0, source: form.source, status: form.status, notes: form.notes, updated_at: new Date().toISOString() }).eq("id", editingLead.id);
    } else {
      await supabase.from("leads").insert({ customer_name: form.customer_name, phone: form.phone, budget: Number(form.budget) || 0, source: form.source, status: form.status, notes: form.notes, project_id: PROJECT_ID, ai_score: 50 });
    }
    setSaving(false);
    setShowModal(false);
    setEditingLead(null);
    setForm(emptyForm);
    fetchLeads(dateStart, dateEnd, leadsLimit);
  };

  const handleUpdateStatus = async (lead: Lead, newStatus: LeadStatus) => {
    await supabase.from("leads").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", lead.id);
    setSelectedLead(null);
    fetchLeads(dateStart, dateEnd, leadsLimit);
  };

  const exportCSV = () => {
    const headers = ["ชื่อลูกค้า", "เบอร์โทร", "งบประมาณ", "แหล่งที่มา", "สถานะ", "AI Score", "หมายเหตุ"];
    const rows = leads.map((l) =>
      [l.customer_name, l.phone, l.budget, l.source, l.status, l.ai_score ?? "", (l.notes ?? "").replace(/,/g, " ")].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-leads-${dateStart}-${dateEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">CRM · ฝ่ายขาย</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : `${leads.length} ราย · ปิดการขาย ${closeRate}%`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportCSV} className="flex items-center gap-1.5 bg-aviva-card border border-aviva-gold/20 text-aviva-secondary text-xs font-bold px-3 py-2 rounded-xl">
                <Download size={13} /> CSV
              </button>
              <button onClick={openAdd} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
                <Plus size={14} /> เพิ่ม Lead
              </button>
            </div>
          </div>
          <PeriodFilter period={period} onChange={handlePeriodChange} />
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "ทั้งหมด", value: leads.length, color: "text-aviva-text" },
            { label: "Booking", value: stageCounts["Booking"] ?? 0, color: "text-aviva-gold" },
            { label: "Loan", value: stageCounts["Loan Process"] ?? 0, color: "text-blue-400" },
            { label: "โอนแล้ว", value: closedCount, color: "text-green-400" },
          ].map(({ label, value, color }) => (
            <GlassCard key={label} className="p-3 text-center">
              <p className={clsx("text-xl font-bold", color)}>{value}</p>
              <p className="text-[10px] text-aviva-secondary mt-0.5">{label}</p>
            </GlassCard>
          ))}
        </div>

        {/* AI Insight */}
        {leads.length > 0 && closeRate < 20 && (
          <AIInsightPanel type="warning" priority="medium"
            title={`อัตราปิดการขายต่ำ (${closeRate}%)`}
            message="ควรเพิ่มการ follow-up ลูกค้าที่อยู่ในขั้น Site Visit และ Booking เพื่อเร่งปิดการขาย" />
        )}
        {closedCount > 0 && (
          <AIInsightPanel type="success" priority="low"
            title={`ปิดการขายแล้ว ${closedCount} ราย`}
            message={`ยอดขายรวมประมาณ ฿${(leads.filter(l => l.status === "Closed Deal").reduce((s, l) => s + Number(l.budget), 0) / 1_000_000).toFixed(1)}M ในช่วงที่เลือก`} />
        )}

        {/* Main tabs */}
        <div className="flex gap-2">
          {([["pipeline", "Pipeline"], ["team", "ผลงานทีม"]] as [MainTab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setMainTab(k)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                mainTab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>{l}</button>
          ))}
        </div>

        {mainTab === "pipeline" && (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
              <input type="text" placeholder="ค้นหาลูกค้า..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/40" />
            </div>

            <div>
              <SectionHeader title="Pipeline" subtitle="แตะเพื่อกรอง" />
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {pipelineStages.map((stage) => (
                  <button key={stage} onClick={() => setActiveStage(stage)}
                    className={clsx("flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      activeStage === stage ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                    )}>
                    {stage}
                    <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      activeStage === stage ? "bg-aviva-bg/20 text-aviva-bg" : "bg-aviva-gold/10 text-aviva-gold"
                    )}>
                      {stageCounts[stage] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {loading ? [1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />) :
                filtered.length === 0 ? (
                  <GlassCard className="p-8 text-center">
                    <p className="text-aviva-secondary text-sm">ยังไม่มี Lead ในขั้นนี้</p>
                  </GlassCard>
                ) : (
                  filtered.map((lead) => (
                    <GlassCard key={lead.id} className="p-4 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => setSelectedLead(lead)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-aviva-text">{lead.customer_name}</h3>
                            <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", sourceColor[lead.source] ?? "bg-gray-500/20 text-gray-400")}>{lead.source}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-xs text-aviva-secondary"><Phone size={10} />{lead.phone}</span>
                            <span className="text-xs text-aviva-gold font-medium">{formatBudget(lead.budget)}</span>
                          </div>
                          {lead.notes && <p className="text-[10px] text-aviva-secondary/70 mt-1 truncate">{lead.notes}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={(e) => openCall(lead, e)} className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-[10px] font-medium">
                              <PhoneCall size={10} /> โทร
                            </button>
                            <button onClick={(e) => openChat(lead, e)} className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-[10px] font-medium">
                              <MessageCircle size={10} />{["TikTok", "Instagram"].includes(lead.source) ? lead.source : "LINE"}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => openEdit(lead, e)} className="p-1.5 rounded-lg bg-aviva-bg border border-aviva-gold/10 hover:border-aviva-gold/40 transition-all">
                            <Pencil size={12} className="text-aviva-secondary" />
                          </button>
                          <div className="flex flex-col items-center gap-0.5">
                            <Star size={12} className="text-aviva-gold" />
                            <span className={clsx("text-lg font-bold", scoreColor(lead.ai_score ?? 0))}>{lead.ai_score ?? "—"}</span>
                            <span className="text-[9px] text-aviva-secondary">AI Score</span>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  ))
                )}
              {!loading && leads.length >= leadsLimit && (
                <button onClick={() => { const next = leadsLimit + 50; setLeadsLimit(next); fetchLeads(dateStart, dateEnd, next); }}
                  className="w-full py-3 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl bg-aviva-card hover:border-aviva-gold/30 transition-all">
                  โหลดเพิ่มเติม (แสดง {leadsLimit} รายการแล้ว)
                </button>
              )}
            </div>
          </>
        )}

        {mainTab === "team" && (
          <div className="space-y-3">
            <SectionHeader title="ผลงานทีมขาย" subtitle={`ช่วงที่เลือก · ${leads.length} Leads รวม`} />
            {teamStats.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <TrendingUp size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีข้อมูลในช่วงนี้</p>
              </GlassCard>
            ) : (
              teamStats.map((s) => (
                <GlassCard key={s.name} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-bold text-aviva-text">{s.name}</p>
                      <p className="text-xs text-aviva-secondary">{s.total} Leads ทั้งหมด</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-aviva-gold">{s.closeRate}%</p>
                      <p className="text-[10px] text-aviva-secondary">อัตราปิด</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Site Visit", value: s.siteVisit, color: "text-blue-400" },
                      { label: "Booking", value: s.booking, color: "text-aviva-gold" },
                      { label: "โอนแล้ว", value: s.closed, color: "text-green-400" },
                      { label: "ยอดขาย", value: `฿${(s.revenue / 1_000_000).toFixed(1)}M`, color: "text-aviva-text" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center bg-aviva-bg rounded-xl p-2">
                        <p className={clsx("text-sm font-bold", color)}>{value}</p>
                        <p className="text-[9px] text-aviva-secondary mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        )}
      </div>

      {/* CRM Log Modal */}
      {crmLogLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-aviva-text">บันทึกการติดต่อ</h2>
                <p className="text-xs text-aviva-secondary">{crmLogLead.customer_name} · {crmLogLead.phone}</p>
              </div>
              <button onClick={() => setCrmLogLead(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {crmLogForm.channel === "Phone" ? (
              <a href={`tel:${crmLogLead.phone}`} className="flex items-center justify-center gap-2 w-full py-3 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-sm font-medium">
                <PhoneCall size={16} /> กดโทร {crmLogLead.phone}
              </a>
            ) : (
              <a href={getChatLink(crmLogLead)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-medium">
                <MessageCircle size={16} /> เปิด {crmLogForm.channel}
              </a>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ช่องทาง</label>
                <select value={crmLogForm.channel} onChange={(e) => setCrmLogForm({ ...crmLogForm, channel: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {["Phone", "LINE", "Instagram", "TikTok"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผลการติดต่อ *</label>
                <select value={crmLogForm.callStatus} onChange={(e) => setCrmLogForm({ ...crmLogForm, callStatus: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  <option value="">-- เลือกผลการติดต่อ --</option>
                  {CALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">บันทึกเพิ่มเติม</label>
                <textarea value={crmLogForm.note} onChange={(e) => setCrmLogForm({ ...crmLogForm, note: e.target.value })}
                  placeholder="รายละเอียดการพูดคุย..." rows={2}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
            </div>
            <button onClick={saveCrmLog} disabled={savingLog || !crmLogForm.callStatus}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {savingLog ? "กำลังบันทึก..." : "บันทึก CRM Log"}
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">{editingLead ? "แก้ไข Lead" : "เพิ่ม Lead ใหม่"}</h2>
              <button onClick={() => { setShowModal(false); setEditingLead(null); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อลูกค้า *</label>
                <input type="text" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="ชื่อ-นามสกุล"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร *</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0XX-XXX-XXXX"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">งบประมาณ (บาท)</label>
                  <input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    placeholder="3500000"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">แหล่งที่มา</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {pipelineStages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="บันทึกเพิ่มเติม..." rows={2}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.customer_name || !form.phone}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : editingLead ? "บันทึกการแก้ไข" : "บันทึก Lead"}
            </button>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-aviva-text">{selectedLead.customer_name}</h2>
                <p className="text-xs text-aviva-secondary">{selectedLead.phone} · {formatBudget(selectedLead.budget)}</p>
              </div>
              <button onClick={() => setSelectedLead(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <p className="text-xs text-aviva-secondary">เปลี่ยนสถานะ:</p>
            <div className="grid grid-cols-2 gap-2">
              {pipelineStages.map((stage) => (
                <button key={stage} onClick={() => handleUpdateStatus(selectedLead, stage)}
                  className={clsx("py-2.5 px-3 rounded-xl text-xs font-medium border transition-all",
                    selectedLead.status === stage ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                  )}>
                  {stage}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
