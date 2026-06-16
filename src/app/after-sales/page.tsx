"use client";
import { useState, useEffect } from "react";
import { ShieldCheck, Plus, X, Clock, CheckCircle, AlertTriangle, Star, Phone, Home, Wrench, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { createNotification } from "@/lib/notify";
import { generateDocNumber } from "@/lib/doc-numbers";
import { useCurrentUser } from "@/lib/user-context";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import Toast, { type ToastType } from "@/components/Toast";
import DeptAIChat from "@/components/DeptAIChat";
import Link from "next/link";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface Claim {
  id: string;
  doc_number: string;
  customer_name: string;
  house_number: string | null;
  issue_type: string;
  description: string;
  status: "pending" | "in_progress" | "resolved";
  assigned_to: string | null;
  scheduled_date: string | null;
  satisfaction_score: number | null;
  created_at: string;
  updated_at?: string;
}

const ISSUE_TYPES = ["โครงสร้าง", "ระบบไฟฟ้า", "ระบบประปา", "หลังคา/รางน้ำ", "ประตู/หน้าต่าง", "พื้น/กระเบื้อง", "สี/ผนัง", "อื่นๆ"];

const issueTh: Record<string, string> = {
  "โครงสร้าง": "โครงสร้าง", "ระบบไฟฟ้า": "ไฟฟ้า", "ระบบประปา": "ประปา",
  "หลังคา/รางน้ำ": "หลังคา", "ประตู/หน้าต่าง": "ประตู/หน้าต่าง",
  "พื้น/กระเบื้อง": "พื้น", "สี/ผนัง": "สีผนัง", "อื่นๆ": "อื่นๆ",
};

const statusConfig = {
  pending:     { label: "รอดำเนินการ",    color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", icon: Clock },
  in_progress: { label: "กำลังดำเนินการ", color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/20",   icon: Wrench },
  resolved:    { label: "แก้ไขแล้ว",      color: "text-green-400",  bg: "bg-green-400/10 border-green-400/20", icon: CheckCircle },
};

const emptyForm = { customer_name: "", house_number: "", issue_type: "โครงสร้าง", description: "", assigned_to: "", scheduled_date: "", status: "pending" as Claim["status"] };

function slaDays(createdAt: string, status: Claim["status"]): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

function SLABadge({ days, status }: { days: number; status: Claim["status"] }) {
  if (status === "resolved") return null;
  const overdue = days > 7;
  const warning = days > 3;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${overdue ? "bg-red-500/20 text-red-400" : warning ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"}`}>
      {days} วัน{overdue ? " ⚠" : ""}
    </span>
  );
}

export default function AfterSalesPage() {
  const user = useCurrentUser();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "resolved">("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resolveScore, setResolveScore] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const fetchClaims = () => {
    supabase.from("warranty_claims").select("*").eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setClaims((data as Claim[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchClaims(); }, []);

  const showToast = (msg: string, type: ToastType = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const counts = {
    all: claims.length,
    pending: claims.filter(c => c.status === "pending").length,
    in_progress: claims.filter(c => c.status === "in_progress").length,
    resolved: claims.filter(c => c.status === "resolved").length,
  };

  const avgScore = (() => {
    const s = claims.filter(c => c.satisfaction_score !== null);
    if (!s.length) return null;
    return (s.reduce((a, c) => a + (c.satisfaction_score ?? 0), 0) / s.length).toFixed(1);
  })();

  const overdueCount = claims.filter(c => c.status !== "resolved" && slaDays(c.created_at, c.status) > 7).length;

  const filtered = filter === "all" ? claims : claims.filter(c => c.status === filter);

  const handleSave = async () => {
    if (!form.customer_name || !form.description) return;
    setSaving(true);
    const docNum = await generateDocNumber("WR");
    await supabase.from("warranty_claims").insert({
      project_id: PROJECT_ID,
      doc_number: docNum,
      customer_name: form.customer_name,
      house_number: form.house_number || null,
      issue_type: form.issue_type,
      description: form.description,
      assigned_to: form.assigned_to || null,
      scheduled_date: form.scheduled_date || null,
      status: form.status,
    });
    await createNotification({
      type: "claim",
      title: `แจ้งซ่อมใหม่ — ${docNum}`,
      message: `${form.customer_name} — ${issueTh[form.issue_type] ?? form.issue_type}: ${form.description}`,
      from_dept: "ฝ่ายหลังการขาย",
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyForm);
    fetchClaims();
    showToast(`บันทึกแจ้งซ่อม ${docNum} แล้ว`);
  };

  const handleUpdateStatus = async (id: string, newStatus: Claim["status"]) => {
    const claim = claims.find(c => c.id === id);
    const updateData: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "resolved" && resolveScore) updateData.satisfaction_score = resolveScore;
    await supabase.from("warranty_claims").update(updateData).eq("id", id);
    const statusTh: Record<string, string> = { pending: "รอดำเนินการ", in_progress: "กำลังดำเนินการ", resolved: "แก้ไขแล้ว" };
    if (claim) {
      await createNotification({
        type: newStatus === "resolved" ? "success" : "info",
        title: `${statusTh[newStatus] ?? newStatus} — แจ้งซ่อม`,
        message: `${claim.issue_type}: ${claim.description ?? ""} — ${claim.customer_name}`,
        from_dept: "ฝ่ายหลังการขาย",
        to_dept: "ฝ่ายหลังการขาย",
      });
    }
    setSelectedClaim(null);
    setResolveScore(null);
    fetchClaims();
    showToast(newStatus === "resolved" ? "แก้ไขเรียบร้อยแล้ว ✓" : "อัปเดตสถานะแล้ว");
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-28">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-aviva-gold" />
              <h1 className="text-lg font-bold text-aviva-text">บริการหลังการขาย</h1>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1 text-xs font-bold text-aviva-bg bg-aviva-gold px-3 py-2 rounded-xl">
              <Plus size={13} /> แจ้งซ่อม
            </button>
          </div>
          {overdueCount > 0 && (
            <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={12} className="text-red-400" />
              <p className="text-[11px] text-red-400 font-bold">เกิน SLA 7 วัน: {overdueCount} รายการ — ดำเนินการด่วน</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-2">
          {([
            { key: "all",        label: "ทั้งหมด",       color: "text-aviva-gold" },
            { key: "pending",    label: "รอดำเนิน",      color: "text-yellow-400" },
            { key: "in_progress",label: "กำลังแก้",      color: "text-blue-400" },
            { key: "resolved",   label: "แก้แล้ว",       color: "text-green-400" },
          ] as const).map(({ key, label, color }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`bg-aviva-card rounded-xl p-2.5 text-center transition-all ${filter === key ? "ring-1 ring-aviva-gold/40" : ""}`}>
              <p className={`text-lg font-bold ${color}`}>{counts[key]}</p>
              <p className="text-[9px] text-aviva-secondary leading-tight">{label}</p>
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2">
          <GlassCard className="p-3">
            <p className="text-[10px] text-aviva-secondary">คะแนนความพึงพอใจเฉลี่ย</p>
            <div className="flex items-center gap-1 mt-1">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <p className="text-lg font-bold text-aviva-text">{avgScore ?? "—"}</p>
              <span className="text-[10px] text-aviva-secondary">/ 5</span>
            </div>
          </GlassCard>
          <GlassCard className="p-3">
            <p className="text-[10px] text-aviva-secondary">อัตราแก้ไขสำเร็จ</p>
            <p className="text-lg font-bold text-green-400 mt-1">
              {claims.length > 0 ? Math.round((counts.resolved / claims.length) * 100) : 0}%
            </p>
          </GlassCard>
        </div>

        {/* AI Assistant */}
        <GlassCard className="p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-aviva-secondary uppercase tracking-wide">AI ผู้ช่วยฝ่ายหลังการขาย</p>
          </div>
          <DeptAIChat dept="after-sales" label="AI หลังการขาย" />
        </GlassCard>

        {/* Claims List */}
        <div>
          <SectionHeader title={`รายการแจ้งซ่อม (${filtered.length})`} subtitle="เรียงตามวันที่แจ้งล่าสุด" />
          {loading ? (
            [1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse mb-2" />)
          ) : filtered.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <ShieldCheck size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
              <p className="text-aviva-secondary text-sm">ไม่มีรายการแจ้งซ่อม</p>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => {
                const sc = statusConfig[c.status];
                const StatusIcon = sc.icon;
                const days = slaDays(c.created_at, c.status);
                return (
                  <button key={c.id} onClick={() => setSelectedClaim(c)}
                    className="w-full text-left">
                    <GlassCard className={`p-3 transition-all active:scale-[0.98] ${days > 7 && c.status !== "resolved" ? "border border-red-500/30" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}>
                              {sc.label}
                            </span>
                            <span className="text-[10px] text-aviva-secondary font-mono">{c.doc_number}</span>
                            <SLABadge days={days} status={c.status} />
                          </div>
                          <p className="text-sm font-bold text-aviva-text truncate">{c.customer_name}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {c.house_number && (
                              <span className="flex items-center gap-0.5 text-[10px] text-aviva-secondary">
                                <Home size={9} />{c.house_number}
                              </span>
                            )}
                            <span className="text-[10px] text-aviva-secondary">{issueTh[c.issue_type] ?? c.issue_type}</span>
                          </div>
                          <p className="text-[11px] text-aviva-secondary/70 truncate mt-0.5">{c.description}</p>
                          {c.scheduled_date && (
                            <p className="text-[10px] text-aviva-gold mt-0.5">
                              นัดซ่อม: {new Date(c.scheduled_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <StatusIcon size={14} className={sc.color} />
                          {c.satisfaction_score && (
                            <div className="flex items-center gap-0.5">
                              <Star size={9} className="text-yellow-400 fill-yellow-400" />
                              <span className="text-[10px] text-yellow-400 font-bold">{c.satisfaction_score}</span>
                            </div>
                          )}
                          <ChevronRight size={12} className="text-aviva-secondary/40" />
                        </div>
                      </div>
                    </GlassCard>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick link to office for managers */}
        {(user?.isManager || user?.isAdmin) && (
          <Link href="/office" className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-aviva-gold/20 text-aviva-secondary text-xs">
            ดูข้อมูลฝ่ายออฟฟิศทั้งหมด →
          </Link>
        )}
      </div>

      {/* Add Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">แจ้งซ่อม / Warranty Claim</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อลูกค้า *</label>
                <input value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})}
                  placeholder="ชื่อ-นามสกุลลูกค้า"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ยูนิต/แปลงที่</label>
                <input value={form.house_number} onChange={e => setForm({...form, house_number: e.target.value})}
                  placeholder="เช่น แปลงที่ 5 / ที่ดิน 52 ตร.วา / AVA"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ประเภทปัญหา</label>
                <select value={form.issue_type} onChange={e => setForm({...form, issue_type: e.target.value})}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียดปัญหา *</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  rows={3} placeholder="อธิบายปัญหาที่พบโดยละเอียด..."
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ผู้รับผิดชอบ</label>
                  <input value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}
                    placeholder="ชื่อช่างหรือผู้รับเหมา"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">นัดซ่อมวันที่</label>
                  <input type="date" value={form.scheduled_date} onChange={e => setForm({...form, scheduled_date: e.target.value})}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.customer_name || !form.description}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกแจ้งซ่อม"}
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-aviva-text">รายละเอียดแจ้งซ่อม</h2>
                <p className="text-xs text-aviva-secondary font-mono">{selectedClaim.doc_number}</p>
              </div>
              <button onClick={() => { setSelectedClaim(null); setResolveScore(null); }}>
                <X size={20} className="text-aviva-secondary" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-aviva-gold" />
                <span className="font-bold text-aviva-text">{selectedClaim.customer_name}</span>
              </div>
              {selectedClaim.house_number && (
                <div className="flex items-center gap-2">
                  <Home size={13} className="text-aviva-gold" />
                  <span className="text-aviva-secondary text-xs">{selectedClaim.house_number}</span>
                </div>
              )}
              <div className="bg-aviva-bg/50 rounded-xl p-3">
                <p className="text-[10px] text-aviva-secondary mb-1">ประเภท: {selectedClaim.issue_type}</p>
                <p className="text-sm text-aviva-text">{selectedClaim.description}</p>
              </div>
              {selectedClaim.assigned_to && (
                <p className="text-xs text-aviva-secondary">ผู้รับผิดชอบ: <span className="text-aviva-text">{selectedClaim.assigned_to}</span></p>
              )}
              {selectedClaim.scheduled_date && (
                <p className="text-xs text-aviva-gold">นัดซ่อม: {new Date(selectedClaim.scheduled_date).toLocaleDateString("th-TH", { dateStyle: "long" })}</p>
              )}
              <div className="flex items-center gap-2">
                <SLABadge days={slaDays(selectedClaim.created_at, selectedClaim.status)} status={selectedClaim.status} />
                <span className="text-[10px] text-aviva-secondary">นับจากวันแจ้ง {new Date(selectedClaim.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
              </div>
            </div>

            {selectedClaim.status !== "resolved" && (
              <div>
                <p className="text-xs text-aviva-secondary mb-2">เปลี่ยนสถานะ:</p>
                {selectedClaim.status === "pending" && (
                  <button onClick={() => handleUpdateStatus(selectedClaim.id, "in_progress")}
                    className="w-full py-3 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold text-sm mb-2">
                    รับดำเนินการ
                  </button>
                )}
                {selectedClaim.status === "in_progress" && (
                  <div className="space-y-2">
                    <p className="text-xs text-aviva-secondary">ให้คะแนนความพึงพอใจลูกค้า:</p>
                    <div className="flex items-center gap-2 justify-center">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setResolveScore(n)}
                          className={`p-2 rounded-xl transition-all ${resolveScore === n ? "bg-yellow-400/20 scale-110" : "bg-aviva-bg"}`}>
                          <Star size={20} className={resolveScore && resolveScore >= n ? "text-yellow-400 fill-yellow-400" : "text-aviva-secondary"} />
                        </button>
                      ))}
                    </div>
                    <button onClick={() => handleUpdateStatus(selectedClaim.id, "resolved")}
                      className="w-full py-3 rounded-2xl bg-green-500/20 text-green-400 border border-green-500/30 font-bold text-sm">
                      ✓ แก้ไขเรียบร้อย
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedClaim.status === "resolved" && selectedClaim.satisfaction_score && (
              <div className="flex items-center gap-2 justify-center py-2">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} size={18} className={n <= selectedClaim.satisfaction_score! ? "text-yellow-400 fill-yellow-400" : "text-aviva-secondary/30"} />
                ))}
                <span className="text-sm text-yellow-400 font-bold ml-1">{selectedClaim.satisfaction_score}/5</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
