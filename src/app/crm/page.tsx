"use client";

import { useState, useEffect } from "react";
import { Search, Star, Phone, Plus, X, Pencil } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
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
}

const sourceColor: Record<string, string> = {
  Facebook: "bg-blue-500/20 text-blue-400",
  TikTok: "bg-pink-500/20 text-pink-400",
  Google: "bg-green-500/20 text-green-400",
  Referral: "bg-purple-500/20 text-purple-400",
};

const SOURCES = ["Facebook", "TikTok", "Google", "Referral", "Walk-in", "อื่นๆ"];

function scoreColor(score: number) {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function formatBudget(n: number) {
  return `฿${(n / 1_000_000).toFixed(1)}M`;
}

const emptyForm = {
  customer_name: "",
  phone: "",
  budget: "",
  source: "Facebook",
  status: "New Lead" as LeadStatus,
  notes: "",
};

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<LeadStatus>("New Lead");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const fetchLeads = () => {
    supabase
      .from("leads")
      .select("*")
      .eq("project_id", PROJECT_ID)
      .order("created_at_default", { ascending: false })
      .then(({ data }) => {
        setLeads((data as Lead[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(() => { fetchLeads(); }, []);

  const stageCounts = Object.fromEntries(
    pipelineStages.map((s) => [s, leads.filter((l) => l.status === s).length])
  ) as Record<LeadStatus, number>;

  const filtered = leads.filter(
    (l) =>
      l.status === activeStage &&
      (search === "" || l.customer_name.includes(search))
  );

  const openEdit = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLead(lead);
    setForm({
      customer_name: lead.customer_name,
      phone: lead.phone,
      budget: String(lead.budget),
      source: lead.source,
      status: lead.status,
      notes: lead.notes ?? "",
    });
    setShowModal(true);
  };

  const openAdd = () => {
    setEditingLead(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.customer_name || !form.phone) return;
    setSaving(true);
    if (editingLead) {
      await supabase.from("leads").update({
        customer_name: form.customer_name,
        phone: form.phone,
        budget: Number(form.budget) || 0,
        source: form.source,
        status: form.status,
        notes: form.notes,
        updated_at: new Date().toISOString(),
      }).eq("id", editingLead.id);
    } else {
      await supabase.from("leads").insert({
        customer_name: form.customer_name,
        phone: form.phone,
        budget: Number(form.budget) || 0,
        source: form.source,
        status: form.status,
        notes: form.notes,
        project_id: PROJECT_ID,
        ai_score: 50,
      });
    }
    setSaving(false);
    setShowModal(false);
    setEditingLead(null);
    setForm(emptyForm);
    fetchLeads();
  };

  const handleUpdateStatus = async (lead: Lead, newStatus: LeadStatus) => {
    await supabase.from("leads").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", lead.id);
    setSelectedLead(null);
    fetchLeads();
  };

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">CRM · ฝ่ายขาย</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : `${leads.length} ราย · Real-time`}
              </p>
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl"
            >
              <Plus size={14} /> เพิ่ม Lead
            </button>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
            <input
              type="text"
              placeholder="ค้นหาลูกค้า..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/40"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "ทั้งหมด", value: leads.length, color: "text-aviva-text" },
            { label: "Booking", value: stageCounts["Booking"] ?? 0, color: "text-aviva-gold" },
            { label: "Loan", value: stageCounts["Loan Process"] ?? 0, color: "text-blue-400" },
            { label: "โอนแล้ว", value: stageCounts["Closed Deal"] ?? 0, color: "text-green-400" },
          ].map(({ label, value, color }) => (
            <GlassCard key={label} className="p-3 text-center">
              <p className={clsx("text-xl font-bold", color)}>{value}</p>
              <p className="text-[10px] text-aviva-secondary mt-0.5">{label}</p>
            </GlassCard>
          ))}
        </div>

        <div>
          <SectionHeader title="Pipeline" subtitle="แตะเพื่อกรอง" />
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {pipelineStages.map((stage) => (
              <button
                key={stage}
                onClick={() => setActiveStage(stage)}
                className={clsx(
                  "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  activeStage === stage
                    ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                    : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                )}
              >
                {stage}
                <span className={clsx(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  activeStage === stage ? "bg-aviva-bg/20 text-aviva-bg" : "bg-aviva-gold/10 text-aviva-gold"
                )}>
                  {stageCounts[stage] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <p className="text-aviva-secondary text-sm">ยังไม่มี Lead ในขั้นนี้</p>
            </GlassCard>
          ) : (
            filtered.map((lead) => (
              <GlassCard
                key={lead.id}
                className="p-4 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => setSelectedLead(lead)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-aviva-text">{lead.customer_name}</h3>
                      <span className={clsx(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        sourceColor[lead.source] ?? "bg-gray-500/20 text-gray-400"
                      )}>
                        {lead.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-aviva-secondary">
                        <Phone size={10} />{lead.phone}
                      </span>
                      <span className="text-xs text-aviva-gold font-medium">
                        {formatBudget(lead.budget)}
                      </span>
                    </div>
                    {lead.notes && (
                      <p className="text-[10px] text-aviva-secondary/70 mt-1 truncate">{lead.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => openEdit(lead, e)}
                      className="p-1.5 rounded-lg bg-aviva-bg border border-aviva-gold/10 hover:border-aviva-gold/40 transition-all"
                    >
                      <Pencil size={12} className="text-aviva-secondary" />
                    </button>
                    <div className="flex flex-col items-center gap-0.5">
                      <Star size={12} className="text-aviva-gold" />
                      <span className={clsx("text-lg font-bold", scoreColor(lead.ai_score ?? 0))}>
                        {lead.ai_score ?? "—"}
                      </span>
                      <span className="text-[9px] text-aviva-secondary">AI Score</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">
                {editingLead ? "แก้ไข Lead" : "เพิ่ม Lead ใหม่"}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingLead(null); }}>
                <X size={20} className="text-aviva-secondary" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อลูกค้า *</label>
                <input type="text" value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="ชื่อ-นามสกุล"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร *</label>
                <input type="tel" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0XX-XXX-XXXX"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">งบประมาณ (บาท)</label>
                  <input type="number" value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    placeholder="3500000"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">แหล่งที่มา</label>
                  <select value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                <select value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {pipelineStages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="บันทึกเพิ่มเติม..."
                  rows={2}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
            </div>

            <button onClick={handleSave}
              disabled={saving || !form.customer_name || !form.phone}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : editingLead ? "บันทึกการแก้ไข" : "บันทึก Lead"}
            </button>
          </div>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-aviva-text">{selectedLead.customer_name}</h2>
                <p className="text-xs text-aviva-secondary">{selectedLead.phone} · {formatBudget(selectedLead.budget)}</p>
              </div>
              <button onClick={() => setSelectedLead(null)}>
                <X size={20} className="text-aviva-secondary" />
              </button>
            </div>
            <p className="text-xs text-aviva-secondary">เปลี่ยนสถานะ:</p>
            <div className="grid grid-cols-2 gap-2">
              {pipelineStages.map((stage) => (
                <button key={stage}
                  onClick={() => handleUpdateStatus(selectedLead, stage)}
                  className={clsx(
                    "py-2.5 px-3 rounded-xl text-xs font-medium border transition-all",
                    selectedLead.status === stage
                      ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                      : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
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
