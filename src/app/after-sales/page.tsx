"use client";

import { useEffect, useState } from "react";
import { Wrench, CheckCircle, Clock, AlertCircle, Star, Plus, X } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface Claim {
  id: string;
  customer_name: string;
  issue_type: string;
  description: string;
  status: "pending" | "in_progress" | "resolved";
  assigned_to: string;
  scheduled_date: string;
  satisfaction_score: number | null;
  created_at: string;
}

type FilterStatus = "all" | "pending" | "in_progress" | "resolved";

const statusConfig = {
  pending:     { label: "รอดำเนินการ", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  in_progress: { label: "กำลังดำเนินการ", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  resolved:    { label: "เสร็จสิ้น", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
};

const issueColor: Record<string, string> = {
  Plumbing:   "bg-blue-500/20 text-blue-400",
  Electrical: "bg-yellow-500/20 text-yellow-400",
  Structure:  "bg-red-500/20 text-red-400",
  Paint:      "bg-purple-500/20 text-purple-400",
  Other:      "bg-gray-500/20 text-gray-400",
};

const issueTh: Record<string, string> = {
  Plumbing:   "ท่อน้ำ",
  Electrical: "ไฟฟ้า",
  Structure:  "โครงสร้าง",
  Paint:      "สีและทาสี",
  Other:      "อื่นๆ",
};

const ISSUE_TYPES = ["Plumbing", "Electrical", "Structure", "Paint", "Other"];
const ASSIGNED_TO_OPTIONS = ["พี่ท (วิศวกร)", "ผู้รับเหมา A", "ผู้รับเหมา B", "ทีมช่างทั่วไป"];

const emptyForm = {
  customer_name: "",
  issue_type: "Other",
  description: "",
  assigned_to: "พี่ท (วิศวกร)",
  scheduled_date: "",
  status: "pending" as Claim["status"],
};

export default function AfterSalesPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchClaims = () => {
    supabase.from("warranty_claims").select("*").eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setClaims((data as Claim[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchClaims(); }, []);

  const counts = {
    pending:     claims.filter(c => c.status === "pending").length,
    in_progress: claims.filter(c => c.status === "in_progress").length,
    resolved:    claims.filter(c => c.status === "resolved").length,
  };

  const avgSatisfaction = (() => {
    const scored = claims.filter(c => c.satisfaction_score !== null);
    if (!scored.length) return null;
    return (scored.reduce((s, c) => s + (c.satisfaction_score ?? 0), 0) / scored.length).toFixed(1);
  })();

  const filtered = filter === "all" ? claims : claims.filter(c => c.status === filter);

  const handleSave = async () => {
    if (!form.customer_name || !form.description) return;
    setSaving(true);
    await supabase.from("warranty_claims").insert({
      project_id: PROJECT_ID,
      customer_name: form.customer_name,
      issue_type: form.issue_type,
      description: form.description,
      assigned_to: form.assigned_to,
      scheduled_date: form.scheduled_date || null,
      status: form.status,
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyForm);
    fetchClaims();
  };

  const handleUpdateStatus = async (id: string, newStatus: Claim["status"]) => {
    await supabase.from("warranty_claims").update({ status: newStatus }).eq("id", id);
    setSelectedClaim(null);
    fetchClaims();
  };

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">After Sales & Warranty</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : `${claims.length} เคส · Real-time`}
              </p>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
              <Plus size={14} /> แจ้งซ่อม
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "ทั้งหมด", value: claims.length, color: "text-aviva-text" },
            { label: "รอดำเนินการ", value: counts.pending, color: "text-yellow-400" },
            { label: "กำลังทำ", value: counts.in_progress, color: "text-blue-400" },
          ].map(({ label, value, color }) => (
            <GlassCard key={label} className="p-3 text-center">
              <p className={clsx("text-xl font-bold", color)}>{loading ? "—" : value}</p>
              <p className="text-[10px] text-aviva-secondary mt-0.5">{label}</p>
            </GlassCard>
          ))}
          <GlassCard gold className="p-3 text-center">
            <div className="flex items-center justify-center gap-0.5 mb-0.5">
              <Star size={12} className="text-aviva-gold" />
              <p className="text-xl font-bold text-aviva-gold">{avgSatisfaction ?? "—"}</p>
            </div>
            <p className="text-[10px] text-aviva-secondary">Satisfaction</p>
          </GlassCard>
        </div>

        <div className="flex gap-2">
          {(["all", "pending", "in_progress", "resolved"] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                filter === f ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>
              {f === "all" ? "ทั้งหมด" : statusConfig[f].label.split(" ")[0]}
            </button>
          ))}
        </div>

        <div>
          <SectionHeader title={`เคส (${filtered.length})`} subtitle="แตะเพื่ออัปเดตสถานะ" />
          <div className="space-y-3">
            {loading
              ? [1,2,3].map(i => <div key={i} className="h-28 rounded-2xl bg-aviva-card/50 animate-pulse" />)
              : filtered.length === 0
              ? <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ไม่มีเคสในสถานะนี้</p></GlassCard>
              : filtered.map(claim => {
                  const sConf = statusConfig[claim.status];
                  const Icon = sConf.icon;
                  return (
                    <GlassCard key={claim.id} className={clsx("p-4 border cursor-pointer active:scale-[0.98] transition-transform", sConf.bg)}
                      onClick={() => setSelectedClaim(claim)}>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5"><Icon size={16} className={sConf.color} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-semibold text-aviva-text">{claim.customer_name}</h3>
                            <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", issueColor[claim.issue_type])}>
                              {issueTh[claim.issue_type] ?? claim.issue_type}
                            </span>
                          </div>
                          <p className="text-xs text-aviva-secondary mb-2">{claim.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Wrench size={10} className="text-aviva-secondary" />
                              <span className="text-[10px] text-aviva-secondary">{claim.assigned_to}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {claim.satisfaction_score && (
                                <div className="flex items-center gap-0.5">
                                  <Star size={10} className="text-aviva-gold" />
                                  <span className="text-[10px] text-aviva-gold font-bold">{claim.satisfaction_score}/5</span>
                                </div>
                              )}
                              {claim.scheduled_date && (
                                <span className="text-[10px] text-aviva-secondary">{claim.scheduled_date}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
          </div>
        </div>
      </div>

      {/* Add Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">แจ้งซ่อม / Warranty</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อลูกค้า *</label>
                <input type="text" value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="ชื่อเจ้าของบ้าน"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ประเภทปัญหา</label>
                  <select value={form.issue_type} onChange={(e) => setForm({ ...form, issue_type: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {ISSUE_TYPES.map(t => <option key={t} value={t}>{issueTh[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">มอบหมายให้</label>
                  <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {ASSIGNED_TO_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียดปัญหา *</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="อธิบายปัญหาที่พบ..."
                  rows={3}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันที่นัดซ่อม</label>
                <input type="date" value={form.scheduled_date}
                  onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.customer_name || !form.description}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกเคส"}
            </button>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-aviva-text">{selectedClaim.customer_name}</h2>
                <p className="text-xs text-aviva-secondary">{issueTh[selectedClaim.issue_type]} · {selectedClaim.assigned_to}</p>
              </div>
              <button onClick={() => setSelectedClaim(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <p className="text-sm text-aviva-text">{selectedClaim.description}</p>
            <p className="text-xs text-aviva-secondary">อัปเดตสถานะ:</p>
            <div className="grid grid-cols-3 gap-2">
              {(["pending", "in_progress", "resolved"] as Claim["status"][]).map(s => (
                <button key={s} onClick={() => handleUpdateStatus(selectedClaim.id, s)}
                  className={clsx("py-2.5 rounded-xl text-xs font-medium border transition-all",
                    selectedClaim.status === s
                      ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                      : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                  )}>
                  {statusConfig[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
