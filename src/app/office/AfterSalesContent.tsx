"use client";
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, X, Clock, ClipboardCheck,
  Receipt, FileText, Users, Phone, Briefcase, AlertCircle, Megaphone,
  Sparkles, Wrench, CheckCircle, AlertTriangle, Star, Download,
  XCircle, ShieldAlert, Package, Printer, ChevronDown, ChevronUp,
  FolderOpen, Upload, Search, Home, BookOpen, Pencil, ShoppingCart, Paperclip,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { downloadCsv } from "@/lib/export-csv";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import ProgressBar from "@/components/ProgressBar";
import AIInsightPanel from "@/components/AIInsightPanel";
import AttachDocButton from "@/components/AttachDocButton";
import { renderDocShell, renderItemsTable, esc, type DocTemplate } from "@/lib/doc-templates";
import { supabase } from "@/lib/supabase";
import { postJv, yymm } from "@/lib/jv";
import { logAction } from "@/lib/audit";
import { attachDocumentToEntity } from "@/lib/doc-attach";
import { useCurrentUser } from "@/lib/user-context";
import PeriodFilter, { type Period } from "@/components/PeriodFilter";
import { createNotification } from "@/lib/notify";
import { loadMySwaps, loadPendingSwaps, requestSwap, decideSwap, thDate as thSwapDate, type OffDaySwap } from "@/lib/off-day-swaps";
import Toast, { type ToastType } from "@/components/Toast";
import { parseAmount, parseAmountOrZero, AMOUNT_ERROR } from "@/lib/money";
import { thaiDbError } from "@/lib/db-errors";
import { uploadFailText } from "@/lib/upload-photos";
import { MATERIAL_CATEGORIES, DEFAULT_MATERIAL_CATEGORY } from "@/lib/material-categories";
import DeptAIChat from "@/components/DeptAIChat";
import DeptBriefingPanel from "@/components/DeptBriefingPanel";
import { generateDocNumber } from "@/lib/doc-numbers";
import { uploadPhotos } from "@/lib/upload-photos";
import MultiPhotoInput from "@/components/MultiPhotoInput";
import { createLeaveRequest } from "@/lib/work-actions";
import { resolveApprovalQueue, closeWorkQueue } from "@/lib/workflow-events";
import { finalizeSale } from "@/lib/sales-finalize";
import { broadcastCelebration } from "@/lib/celebrate";
import { SLA_DAYS, calcSlaDueAt, APPR_LABEL, APPR_DEPT, summarizeApproval } from "@/lib/approval-matrix";
import ApprovalRouteBar from "@/components/ApprovalRouteBar";
import ApprovalVerifyModal, { type VerifyLog } from "@/components/ApprovalVerifyModal";
import PettyCashPanel from "@/components/PettyCashPanel";
import PurchaseRequestPanel from "@/components/PurchaseRequestPanel";
import { useFocusHighlight } from "@/lib/use-focus-highlight";
import RecurringExpensePanel from "@/components/RecurringExpensePanel";
import { expenseAccountFor, revenueAccountFor, categoryFromDescription, calcTax, calcContractorPay, CASH, BANK, INPUT_VAT, WHT_PAYABLE, RETENTION_PAYABLE, WIP, DEFAULT_CONTRACTOR_WHT, DEFAULT_RETENTION } from "@/lib/gl-accounts";
import { thaiDateStr } from "@/lib/thai-date";
import dynamic from "next/dynamic";
import { thaiMonthStr } from "@/lib/thai-date";
import { ASSIGNED_TO_OPTIONS, Claim, FilterStatus, ISSUE_TYPES, PROJECT_ID, emptyClaimForm, issueColor, issueTh, statusConfig } from "./_shared";

export default function AfterSalesContent() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [form, setForm] = useState(emptyClaimForm);
  const [saving, setSaving] = useState(false);
  const [kpiModalAS, setKpiModalAS] = useState<"all" | "pending" | "in_progress" | "resolved" | null>(null);
  const [resolveScore, setResolveScore] = useState<number | null>(null);

  const fetchClaims = () => {
    supabase.from("warranty_claims").select("*").eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => { setClaims((data as Claim[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchClaims(); }, []);

  // UX-10: ดึงผู้รับผิดชอบจากพนักงานฝ่ายก่อสร้าง (fallback เป็นรายการเริ่มต้นถ้าไม่มีข้อมูล)
  const [assignees, setAssignees] = useState<string[]>(ASSIGNED_TO_OPTIONS);
  useEffect(() => {
    supabase.from("employees_directory").select("full_name").eq("department", "ฝ่ายก่อสร้าง")
      .then(({ data }) => {
        const names = ((data ?? []) as { full_name: string }[]).map(e => e.full_name).filter(Boolean);
        if (names.length) setAssignees(names);
      });
  }, []);

  // ผูกกับแปลงจริง (เลิก free-text) เพื่อวิเคราะห์ defect/เคลมต่อแปลงได้
  const [houseOpts, setHouseOpts] = useState<{ plot_number: number | null; house_number: string }[]>([]);
  useEffect(() => {
    supabase.from("houses").select("plot_number,house_number").eq("project_id", PROJECT_ID).order("plot_number").limit(300)
      .then(({ data }) => setHouseOpts((data ?? []) as { plot_number: number | null; house_number: string }[]));
  }, []);

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
    const docNum = await generateDocNumber("WR");
    await supabase.from("warranty_claims").insert({
      project_id: PROJECT_ID,
      doc_number: docNum,
      customer_name: form.customer_name,
      house_number: form.house_number || null,
      issue_type: form.issue_type,
      description: form.description,
      assigned_to: form.assigned_to,
      scheduled_date: form.scheduled_date || null,
      status: form.status,
    });
    await createNotification({
      type: "claim",
      title: `แจ้งซ่อมใหม่ — ${docNum}`,
      message: `${form.customer_name} — ${issueTh[form.issue_type] ?? form.issue_type}: ${form.description} · ผู้รับผิดชอบ: ${form.assigned_to}`,
      from_dept: "ฝ่ายหลังการขาย",
      to_dept: "ฝ่ายก่อสร้าง",
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyClaimForm);
    fetchClaims();
  };

  const handleUpdateStatus = async (id: string, newStatus: Claim["status"]) => {
    const claim = claims.find(c => c.id === id);
    // C5: บังคับให้คะแนนความพึงพอใจก่อนปิดงาน (กันค่า null ทำให้ค่าเฉลี่ยไม่ครบ)
    if (newStatus === "resolved" && !resolveScore) {
      if (typeof window !== "undefined") window.alert("กรุณาให้คะแนนความพึงพอใจลูกค้า (1-5 ดาว) ก่อนปิดงาน");
      return;
    }
    const updateData: Record<string, unknown> = { status: newStatus };
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
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <DeptAIChat dept="after-sales" label="AI ฝ่ายหลังการขาย" />
      <DeptBriefingPanel dept="after-sales" label="ฝ่ายหลังการขาย" />
      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { label: "ทั้งหมด", value: claims.length, color: "text-aviva-text", filter: "all" as const },
          { label: "รอดำเนินการ", value: counts.pending, color: "text-yellow-400", filter: "pending" as const },
          { label: "กำลังทำ", value: counts.in_progress, color: "text-blue-400", filter: "in_progress" as const },
        ]).map(({ label, value, color, filter }) => (
          <button key={label} onClick={() => setKpiModalAS(filter)} className="active:scale-[0.96] transition-transform w-full text-left">
            <GlassCard className="p-3 text-center">
              <p className={clsx("text-xl font-bold", color)}>{loading ? "—" : value}</p>
              <p className="text-[10px] text-aviva-secondary mt-0.5">{label}</p>
            </GlassCard>
          </button>
        ))}
        <button onClick={() => setKpiModalAS("resolved")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard gold className="p-3 text-center">
            <div className="flex items-center justify-center gap-0.5 mb-0.5">
              <Star size={12} className="text-aviva-gold" />
              <p className="text-xl font-bold text-aviva-gold">{avgSatisfaction ?? "—"}</p>
            </div>
            <p className="text-[10px] text-aviva-secondary">Satisfaction</p>
          </GlassCard>
        </button>
      </div>

      <AIInsightPanel
        type="alert"
        priority="high"
        title="AI: Claims รออนุมัติ"
        message="Claims ที่ค้างเกิน 7 วันควรได้รับการดำเนินการทันที ตรวจสอบสาเหตุและมอบหมายผู้รับผิดชอบให้ชัดเจน"
      />

      {/* Add + Export */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowModal(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm"
        >
          <Plus size={16} /> แจ้งซ่อม
        </button>
        <button
          onClick={() => downloadCsv(`warranty-claims-${thaiDateStr()}`,
            ["ลูกค้า", "บ้านเลขที่", "ประเภท", "รายละเอียด", "สถานะ", "ผู้รับผิดชอบ", "นัดวันที่", "คะแนนพอใจ", "วันที่แจ้ง"],
            claims.map(c => [c.customer_name, c.house_number, c.issue_type, c.description, c.status, c.assigned_to, c.scheduled_date, c.satisfaction_score, c.created_at ? new Date(c.created_at).toLocaleDateString("th-TH") : ""]))}
          className="px-4 bg-aviva-card border border-aviva-gold/20 text-aviva-secondary font-bold rounded-2xl text-xs"
        >
          CSV
        </button>
      </div>

      {/* Filter tabs */}
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

      {/* Claims List */}
      <div>
        <SectionHeader title={`เคส (${filtered.length})`} subtitle="แตะเพื่ออัปเดตสถานะ" />
        <div className="space-y-3">
          {loading
            ? [1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-aviva-card/50 animate-pulse" />)
            : filtered.length === 0
            ? <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ไม่มีเคสในสถานะนี้</p></GlassCard>
            : filtered.map(claim => {
                const sConf = statusConfig[claim.status];
                const Icon = sConf.icon;
                return (
                  <GlassCard key={claim.id}
                    className={clsx("p-4 border cursor-pointer active:scale-[0.98] transition-transform", sConf.bg)}
                    onClick={() => setSelectedClaim(claim)}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5"><Icon size={16} className={sConf.color} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-sm font-semibold text-aviva-text">{claim.customer_name}</h3>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", issueColor[claim.issue_type])}>
                              {issueTh[claim.issue_type] ?? claim.issue_type}
                            </span>
                            {claim.house_number && <span className="text-[10px] text-aviva-secondary bg-aviva-bg px-1.5 py-0.5 rounded-full border border-aviva-gold/20">{claim.house_number}</span>}
                          </div>
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
              })
          }
        </div>
      </div>

      {/* Add Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">แจ้งซ่อม / Warranty</h2>
              <button aria-label="ปิด" onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="claimform-customer_name" className="text-xs text-aviva-secondary mb-1 block">ชื่อลูกค้า *</label>
                <input id="claimform-customer_name" type="text" value={form.customer_name}
                  onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="ชื่อเจ้าของบ้าน"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="claimform-house_number" className="text-xs text-aviva-secondary mb-1 block">บ้าน/แปลงที่</label>
                <select id="claimform-house_number" value={form.house_number}
                  onChange={e => setForm({ ...form, house_number: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  <option value="">— เลือกแปลง —</option>
                  {houseOpts.map(h => <option key={h.house_number} value={h.house_number}>{h.house_number}</option>)}
                  <option value="ส่วนกลาง">ส่วนกลาง / อื่นๆ</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="claimform-issue_type" className="text-xs text-aviva-secondary mb-1 block">ประเภทปัญหา</label>
                  <select id="claimform-issue_type" value={form.issue_type} onChange={e => setForm({ ...form, issue_type: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {ISSUE_TYPES.map(t => <option key={t} value={t}>{issueTh[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="claimform-assigned_to" className="text-xs text-aviva-secondary mb-1 block">มอบหมายให้</label>
                  <select id="claimform-assigned_to" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="claimform-description" className="text-xs text-aviva-secondary mb-1 block">รายละเอียดปัญหา *</label>
                <textarea id="claimform-description" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="อธิบายปัญหาที่พบ..." rows={3}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div>
                <label htmlFor="claimform-scheduled_date" className="text-xs text-aviva-secondary mb-1 block">วันที่นัดซ่อม</label>
                <input id="claimform-scheduled_date" type="date" value={form.scheduled_date}
                  onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
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
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-aviva-text">{selectedClaim.customer_name}</h2>
                <p className="text-xs text-aviva-secondary">{issueTh[selectedClaim.issue_type]} · {selectedClaim.assigned_to}</p>
              </div>
              <button onClick={() => setSelectedClaim(null)} aria-label="ปิด"><X size={20} className="text-aviva-secondary" /></button>
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
            <div>
              <p className="text-xs text-aviva-secondary mb-2">คะแนนความพึงพอใจลูกค้า (ถ้ามี):</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setResolveScore(resolveScore === n ? null : n)}
                    className={clsx("flex-1 py-1.5 rounded-lg text-sm font-bold border transition-all",
                      resolveScore === n ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                    )}>
                    {n}⭐
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Detail Modal */}
      {kpiModalAS && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 mb-14 flex flex-col" style={{ maxHeight: "75vh" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-aviva-text">
                {kpiModalAS === "all" ? "แจ้งซ่อมทั้งหมด" :
                 kpiModalAS === "pending" ? "รอดำเนินการ" :
                 kpiModalAS === "in_progress" ? "กำลังดำเนินการ" : `แก้ไขแล้ว · ⭐ ${avgSatisfaction ?? "—"}`}
                {kpiModalAS !== "resolved" && (
                  <span className="ml-1.5 text-xs font-normal text-aviva-secondary">
                    ({(kpiModalAS === "all" ? claims : claims.filter(c => c.status === kpiModalAS)).length} รายการ)
                  </span>
                )}
              </h2>
              <button onClick={() => setKpiModalAS(null)} aria-label="ปิด"><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {(kpiModalAS === "all" ? claims : claims.filter(c => c.status === kpiModalAS)).map(c => {
                const sc = statusConfig[c.status];
                return (
                  <div key={c.id} className="p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-aviva-text truncate">{c.customer_name}</p>
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0", sc?.bg, sc?.color)}>
                        {sc?.label ?? c.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-aviva-secondary">{c.description}</p>
                    {c.satisfaction_score && (
                      <p className="text-[10px] text-aviva-gold mt-0.5">⭐ {c.satisfaction_score}/5</p>
                    )}
                  </div>
                );
              })}
              {(kpiModalAS === "all" ? claims : claims.filter(c => c.status === kpiModalAS)).length === 0 && (
                <p className="text-center text-aviva-secondary text-sm py-8">ไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
