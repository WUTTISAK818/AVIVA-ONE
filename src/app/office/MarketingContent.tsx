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
import { Campaign, MONTH_TH, MarketingBudget, PROJECT_ID, cpl, emptyCampaignForm, platformStyle, roi, statusLabel, statusStyle } from "./_shared";

export default function MarketingContent() {
  const user = useCurrentUser();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [budgets, setBudgets] = useState<MarketingBudget[]>([]);
  const [loading, setLoading] = useState(true);
  // B4: ราคาขายเฉลี่ยจริง (จากลูกค้าที่ปิดการขาย) ใช้คำนวณ ROI แทน hardcode
  const [avgUnitPrice, setAvgUnitPrice] = useState(9_500_000);
  useEffect(() => {
    supabase.from("leads").select("contract_price,budget").eq("project_id", PROJECT_ID).eq("status", "Closed Deal")
      .then(({ data }) => {
        const vals = ((data ?? []) as { contract_price: number | null; budget: number | null }[])
          .map(r => Number(r.contract_price ?? r.budget) || 0).filter(v => v > 0);
        if (vals.length) setAvgUnitPrice(Math.round(vals.reduce((s, v) => s + v, 0) / vals.length));
      });
  }, []);
  const [activeView, setActiveView] = useState<"campaigns" | "budget">("campaigns");
  const [filter, setFilter] = useState<"all" | "Facebook" | "TikTok" | "Google">("all");
  const [showModal, setShowModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [form, setForm] = useState(emptyCampaignForm);
  const [budgetForm, setBudgetForm] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, budget_amount: "", executive_name: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [editCampForm, setEditCampForm] = useState({ spent: "", leads_generated: "", impressions: "", clicks: "", conversions: "", status: "active" });
  const [mktPeriod, setMktPeriod] = useState<Period>("month");
  const [mktStart, setMktStart] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; });
  const [mktEnd, setMktEnd] = useState(() => thaiDateStr());
  const [showMktPRModal, setShowMktPRModal] = useState(false);
  const [mktPRForm, setMktPRForm] = useState({ supplier_name: "", description: "", amount: "", notes: "" });
  const [mktPRSaving, setMktPRSaving] = useState(false);

  const fetchCampaigns = () => {
    let q = supabase.from("campaigns").select("*").eq("project_id", PROJECT_ID);
    if (mktStart) q = q.gte("created_at", mktStart);
    if (mktEnd) q = q.lte("created_at", mktEnd + "T23:59:59");
    q.order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => { setCampaigns((data as Campaign[]) ?? []); setLoading(false); });
  };

  const fetchBudgets = () => {
    supabase.from("marketing_budgets").select("*").eq("project_id", PROJECT_ID)
      .order("year", { ascending: false }).order("month", { ascending: false }).limit(300)
      .then(({ data }) => setBudgets((data as MarketingBudget[]) ?? []));
  };

  useEffect(() => { fetchCampaigns(); fetchBudgets(); }, [mktStart, mktEnd]);

  const openEditCampaign = (c: Campaign) => {
    setEditCampaign(c);
    setEditCampForm({ spent: String(c.spent), leads_generated: String(c.leads_generated), impressions: String(c.impressions ?? 0), clicks: String(c.clicks ?? 0), conversions: String(c.conversions), status: c.status });
  };

  const handleUpdateCampaign = async () => {
    if (!editCampaign) return;
    setSaving(true);
    await supabase.from("campaigns").update({
      spent: Number(editCampForm.spent) || 0,
      leads_generated: Number(editCampForm.leads_generated) || 0,
      impressions: Number(editCampForm.impressions) || 0,
      clicks: Number(editCampForm.clicks) || 0,
      conversions: Number(editCampForm.conversions) || 0,
      status: editCampForm.status,
    }).eq("id", editCampaign.id);
    setSaving(false);
    setEditCampaign(null);
    fetchCampaigns();
  };

  const filtered = filter === "all" ? campaigns : campaigns.filter(c => c.platform === filter);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads_generated, 0);
  const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgROI = campaigns.length
    ? Math.round(campaigns.reduce((s, c) => s + roi(c, avgUnitPrice), 0) / campaigns.length)
    : 0;
  const totalBudgetAllocated = budgets.reduce((s, b) => s + Number(b.budget_amount), 0);

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    await supabase.from("campaigns").insert({
      project_id: PROJECT_ID,
      name: form.name,
      platform: form.platform,
      budget: parseAmountOrZero(form.budget) ?? 0,
      spent: 0,
      leads_generated: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      status: "active",
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      executive_name: form.executive_name || null,
      campaign_link: form.campaign_link || null,
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyCampaignForm);
    fetchCampaigns();
  };

  const handleSaveBudget = async () => {
    if (!budgetForm.budget_amount) return;
    setSaving(true);
    const amt = Number(budgetForm.budget_amount);
    const { data: bud } = await supabase.from("marketing_budgets").upsert({
      project_id: PROJECT_ID,
      year: budgetForm.year,
      month: budgetForm.month,
      budget_amount: amt,
      executive_name: budgetForm.executive_name,
      notes: budgetForm.notes,
    }, { onConflict: "project_id,year,month" }).select("id").single();

    // เข้าสายอนุมัติงบการตลาด (MKTG) — ออกเลขเอกสาร + ส่งผู้บริหารพิจารณา (โผล่ใน /approvals + กล่องงาน)
    const mktgDocNum = await generateDocNumber("MKTG");
    await supabase.from("approval_logs").insert({
      workflow_type: "Marketing_Budget",
      source_doc_index: `${mktgDocNum} | งบการตลาด ${budgetForm.month}/${budgetForm.year} ฿${amt.toLocaleString()} | โดย ${user?.full_name ?? user?.email ?? "ฝ่ายการตลาด"}`,
      submitted_by_user_id: user?.id ?? null,
      source_record_id: bud?.id ?? null,
      current_approver_role: "manager",
      action_taken: "Pending",
      amount: amt,
      sla_due_at: calcSlaDueAt("Marketing_Budget"),
      assigned_to_name: "ผู้จัดการ",
    });
    await createNotification({ type: "approval", title: "ขออนุมัติงบการตลาด", message: `${mktgDocNum} · งบเดือน ${budgetForm.month}/${budgetForm.year} ฿${amt.toLocaleString()}`, from_dept: "ฝ่ายการตลาด", to_dept: "ผู้บริหาร" });
    await logAction("marketing", "request_approval", `ขออนุมัติงบการตลาด ฿${amt.toLocaleString()}`, bud?.id ?? undefined);

    setSaving(false);
    setShowBudgetModal(false);
    setBudgetForm({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, budget_amount: "", executive_name: "", notes: "" });
    fetchBudgets();
  };

  const exportCampaignsCSV = () => {
    const rows = [["ชื่อแคมเปญ", "Platform", "งบ", "ใช้ไป", "Leads", "Conversion", "ROI%", "สถานะ"]];
    campaigns.forEach(c => rows.push([c.name, c.platform, String(c.budget), String(c.spent), String(c.leads_generated), String(c.conversions), String(roi(c, avgUnitPrice)), c.status]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8,﻿" + encodeURIComponent(csv); a.download = "campaigns.csv"; a.click();
  };

  const handleCreateMktPR = async () => {
    if (!mktPRForm.supplier_name || !mktPRForm.description) return;
    setMktPRSaving(true);
    const poDocNum = await generateDocNumber("PO");
    const total = Number(mktPRForm.amount) || 0;
    const { data: poData, error: poErr } = await supabase.from("purchase_orders").insert({
      project_id: PROJECT_ID,
      po_number: poDocNum,
      supplier_name: mktPRForm.supplier_name,
      items: [{ name: mktPRForm.description, qty: 1, unit: "รายการ", unit_price: total }],
      total_amount: total,
      status: "draft",
      requested_by: user?.full_name ?? user?.email ?? "Unknown",
      notes: mktPRForm.notes,
    }).select().single();
    if (poErr) { setMktPRSaving(false); return; }
    if (poData) {
      await supabase.from("approval_logs").insert({
        workflow_type: "Material_Purchase",
        source_doc_index: `${poDocNum} | ฝ่ายการตลาด — ${mktPRForm.supplier_name} — ${mktPRForm.description} | โดย ${user?.full_name ?? "Unknown"}`,
        submitted_by_user_id: user?.id ?? null,
        source_record_id: poData.id,
        current_approver_role: "manager",
        action_taken: "Pending",
        amount: total,
        sla_due_at: calcSlaDueAt("Material_Purchase"),
        assigned_to_name: "ผู้จัดการ",
      });
      await createNotification({
        type: "approval",
        title: "ขอสั่งซื้อ/จ้างบริการ (ฝ่ายการตลาด)",
        message: `จาก ${user?.full_name ?? "ฝ่ายการตลาด"} · ${mktPRForm.supplier_name}${total > 0 ? ` ฿${total.toLocaleString("th-TH")}` : ""} · ส่งให้ผู้จัดการพิจารณา`,
        from_dept: "ฝ่ายการตลาด",
      });
    }
    setMktPRSaving(false);
    setShowMktPRModal(false);
    setMktPRForm({ supplier_name: "", description: "", amount: "", notes: "" });
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <DeptAIChat dept="marketing" label="AI ฝ่ายการตลาด" />
      <DeptBriefingPanel dept="marketing" label="ฝ่ายการตลาด" />
      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-aviva-gold" />
            <span className="text-xs text-aviva-secondary">Leads ทั้งหมด</span>
          </div>
          <p className="text-2xl font-bold text-aviva-text">{loading ? "—" : totalLeads}</p>
        </GlassCard>
        <GlassCard className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-aviva-gold" />
            <span className="text-xs text-aviva-secondary">งบที่ใช้</span>
          </div>
          <p className="text-2xl font-bold text-aviva-text">
            ฿{loading ? "—" : (totalSpent / 1000).toFixed(0)}K
          </p>
        </GlassCard>
        <GlassCard gold className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-aviva-gold" />
            <span className="text-xs text-aviva-secondary">Avg. ROI</span>
          </div>
          <p className="text-2xl font-bold text-aviva-gold">{loading ? "—" : `${avgROI}%`}</p>
        </GlassCard>
        <GlassCard className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone size={14} className="text-aviva-gold" />
            <span className="text-xs text-aviva-secondary">Conversions</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{loading ? "—" : totalConversions}</p>
        </GlassCard>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button onClick={() => setActiveView("campaigns")}
          className={clsx("flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
            activeView === "campaigns" ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
          )}>แคมเปญ</button>
        <button onClick={() => setActiveView("budget")}
          className={clsx("flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
            activeView === "budget" ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
          )}>งบประมาณ</button>
      </div>

      {activeView === "campaigns" && (
        <>
          <AIInsightPanel type="success" priority="medium"
            title="AI: Facebook ROI สูงสุด"
            message="แคมเปญ Facebook มี ROI เฉลี่ยสูงสุด แนะนำเพิ่มงบอีก 20% และทดสอบ Creative ใหม่ในกลุ่มเป้าหมาย 35-50 ปีครับ" />
          <PeriodFilter period={mktPeriod} onChange={(p, s, e) => { setMktPeriod(p); setMktStart(s); setMktEnd(e); }} />
          <div className="flex gap-2">
            <button onClick={() => setShowModal(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm">
              <Plus size={16} /> สร้างแคมเปญ
            </button>
            <button onClick={exportCampaignsCSV}
              className="flex items-center gap-1.5 bg-aviva-card border border-aviva-gold/20 text-aviva-secondary px-3 py-3 rounded-2xl text-xs">
              <Download size={14} /> CSV
            </button>
          </div>
          <button onClick={() => setShowMktPRModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold py-2.5 rounded-2xl text-sm">
            <ShoppingCart size={15} /> ขอสั่งซื้อ/จ้างบริการ
          </button>
          {campaigns.length > 0 && (() => {
            const maxLeads = Math.max(...campaigns.map(c => c.leads_generated || 0), 1);
            return (
              <GlassCard className="p-4">
                <p className="text-xs font-semibold text-aviva-gold mb-3">📊 ประสิทธิภาพแคมเปญ (Leads · งบที่ใช้/งบ)</p>
                <div className="space-y-2.5">
                  {campaigns.slice(0, 8).map(c => {
                    const spentPct = c.budget > 0 ? Math.min(100, Math.round((c.spent / c.budget) * 100)) : 0;
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-aviva-text truncate max-w-[60%]">{c.name}</span>
                          <span className="text-aviva-secondary">{c.leads_generated || 0} leads · ฿{Number(c.spent).toLocaleString()}/{Number(c.budget).toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-aviva-bg rounded-full overflow-hidden">
                          <div className="h-full bg-aviva-gold rounded-full" style={{ width: `${Math.round(((c.leads_generated || 0) / maxLeads) * 100)}%` }} />
                        </div>
                        <div className="h-1 bg-aviva-bg rounded-full overflow-hidden mt-0.5">
                          <div className={clsx("h-full rounded-full", spentPct > 90 ? "bg-red-400" : "bg-blue-400")} style={{ width: `${spentPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-3 text-[9px] text-aviva-secondary">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-aviva-gold inline-block" /> Leads</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> งบที่ใช้ (% ของงบ)</span>
                </div>
              </GlassCard>
            );
          })()}
          <div>
            <SectionHeader title="แคมเปญ" subtitle="กรองตาม Platform" />
            <div className="flex gap-2 mb-4">
              {(["all", "Facebook", "TikTok", "Google"] as const).map(p => (
                <button key={p} onClick={() => setFilter(p)}
                  className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                    filter === p ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                  )}>{p === "all" ? "ทั้งหมด" : p}</button>
              ))}
            </div>
            <div className="space-y-3">
              {loading
                ? [1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl bg-aviva-card/50 animate-pulse" />)
                : filtered.map(c => {
                    const pStyle = platformStyle[c.platform] ?? { color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" };
                    const spentPct = Math.round((c.spent / (c.budget || 1)) * 100);
                    return (
                      <GlassCard key={c.id} className={clsx("p-4 border", pStyle.bg)}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-aviva-text">{c.name}</h3>
                              <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", statusStyle[c.status] ?? "bg-gray-500/20 text-gray-400")}>
                                {statusLabel[c.status] ?? c.status}
                              </span>
                            </div>
                            <span className={clsx("text-xs font-medium", pStyle.color)}>{c.platform}</span>
                            {c.executive_name && (
                              <p className="text-[10px] text-aviva-secondary mt-0.5">ผู้รับผิดชอบ: {c.executive_name}</p>
                            )}
                            {c.campaign_link && (
                              <a href={c.campaign_link} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-400 underline mt-0.5 inline-block">ดูข้อมูลแคมเปญ</a>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0 space-y-1">
                            <p className="text-lg font-bold text-aviva-gold">{roi(c, avgUnitPrice)}%</p>
                            <p className="text-[10px] text-aviva-secondary">ROI</p>
                            <button onClick={() => openEditCampaign(c)}
                              className="text-[10px] bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 px-2 py-0.5 rounded-lg">
                              แก้ไข
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center">
                            <p className="text-sm font-bold text-aviva-text">{c.leads_generated}</p>
                            <p className="text-[10px] text-aviva-secondary">Leads</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-aviva-text">฿{cpl(c)}</p>
                            <p className="text-[10px] text-aviva-secondary">CPL</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-green-400">{c.conversions}</p>
                            <p className="text-[10px] text-aviva-secondary">Conversion</p>
                          </div>
                        </div>
                        <ProgressBar
                          label={`ใช้ไป ฿${(c.spent / 1000).toFixed(0)}K / ฿${(c.budget / 1000).toFixed(0)}K`}
                          value={spentPct} color={spentPct > 90 ? "red" : "gold"} />
                      </GlassCard>
                    );
                  })
              }
            </div>
          </div>
        </>
      )}

      {activeView === "budget" && (
        <>
          <GlassCard gold className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-aviva-secondary">งบประมาณทั้งหมดที่จัดสรร</p>
                <p className="text-2xl font-bold text-aviva-gold">฿{(totalBudgetAllocated / 1000).toFixed(0)}K</p>
              </div>
              <DollarSign size={28} className="text-aviva-gold/40" />
            </div>
          </GlassCard>
          <button onClick={() => setShowBudgetModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm">
            <Plus size={16} /> กำหนดงบประมาณ
          </button>
          <div className="space-y-3">
            <SectionHeader title="งบประมาณรายเดือน" subtitle="กำหนดโดยผู้บริหาร" />
            {budgets.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <p className="text-aviva-secondary text-sm">ยังไม่มีการกำหนดงบ</p>
              </GlassCard>
            ) : budgets.map(b => (
              <GlassCard key={b.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-aviva-text">{MONTH_TH[b.month - 1]} {b.year}</p>
                    {b.executive_name && <p className="text-xs text-aviva-secondary mt-0.5">อนุมัติโดย: {b.executive_name}</p>}
                    {b.notes && <p className="text-[11px] text-aviva-secondary/70 mt-0.5">{b.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-aviva-gold">฿{Number(b.budget_amount).toLocaleString("th-TH")}</p>
                    <p className="text-[10px] text-aviva-secondary">งบที่จัดสรร</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}

      {/* Create Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">สร้างแคมเปญใหม่</h2>
              <button aria-label="ปิด" onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="mktform-name" className="text-xs text-aviva-secondary mb-1 block">ชื่อแคมเปญ *</label>
                <input id="mktform-name" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="เช่น AVIVA — Facebook Q3 2026"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mktform-platform" className="text-xs text-aviva-secondary mb-1 block">Platform</label>
                  <select id="mktform-platform" value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {["Facebook", "TikTok", "Google", "LINE", "อื่นๆ"].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="mktform-budget" className="text-xs text-aviva-secondary mb-1 block">งบประมาณ (บาท)</label>
                  <input id="mktform-budget" type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
                    placeholder="50000"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label htmlFor="mktform-executive_name" className="text-xs text-aviva-secondary mb-1 block">ผู้รับผิดชอบ / ผู้อนุมัติ</label>
                <input id="mktform-executive_name" type="text" value={form.executive_name} onChange={e => setForm({ ...form, executive_name: e.target.value })}
                  placeholder="ชื่อผู้บริหารที่รับผิดชอบ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="mktform-campaign_link" className="text-xs text-aviva-secondary mb-1 block">ลิงก์ข้อมูลแคมเปญ</label>
                <input id="mktform-campaign_link" type="url" value={form.campaign_link} onChange={e => setForm({ ...form, campaign_link: e.target.value })}
                  placeholder="https://docs.google.com/..."
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mktform-start_date" className="text-xs text-aviva-secondary mb-1 block">วันเริ่ม</label>
                  <input id="mktform-start_date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label htmlFor="mktform-end_date" className="text-xs text-aviva-secondary mb-1 block">วันสิ้นสุด</label>
                  <input id="mktform-end_date" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.name}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "สร้างแคมเปญ"}
            </button>
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">กำหนดงบประมาณ</h2>
              <button onClick={() => setShowBudgetModal(false)} aria-label="ปิด"><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="budgetform-year" className="text-xs text-aviva-secondary mb-1 block">ปี</label>
                  <select id="budgetform-year" value={budgetForm.year} onChange={e => setBudgetForm({ ...budgetForm, year: Number(e.target.value) })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="budgetform-month" className="text-xs text-aviva-secondary mb-1 block">เดือน</label>
                  <select id="budgetform-month" value={budgetForm.month} onChange={e => setBudgetForm({ ...budgetForm, month: Number(e.target.value) })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {MONTH_TH.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="budgetform-budget_amount" className="text-xs text-aviva-secondary mb-1 block">งบประมาณ (บาท) *</label>
                <input id="budgetform-budget_amount" type="number" value={budgetForm.budget_amount} onChange={e => setBudgetForm({ ...budgetForm, budget_amount: e.target.value })}
                  placeholder="100000"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="budgetform-executive_name" className="text-xs text-aviva-secondary mb-1 block">ผู้อนุมัติงบ</label>
                <input id="budgetform-executive_name" type="text" value={budgetForm.executive_name} onChange={e => setBudgetForm({ ...budgetForm, executive_name: e.target.value })}
                  placeholder="ชื่อผู้บริหาร"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="budgetform-notes" className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea id="budgetform-notes" value={budgetForm.notes} onChange={e => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                  placeholder="รายละเอียดแผนการใช้งบ..."
                  rows={2} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
            </div>
            <button onClick={handleSaveBudget} disabled={saving || !budgetForm.budget_amount}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกงบประมาณ"}
            </button>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {editCampaign && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-aviva-text">อัปเดตแคมเปญ</h2>
                <p className="text-xs text-aviva-secondary">{editCampaign.name}</p>
              </div>
              <button aria-label="ปิด" onClick={() => setEditCampaign(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="editcampform-status" className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                <select id="editcampform-status" value={editCampForm.status} onChange={e => setEditCampForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  <option value="active">กำลังทำงาน</option>
                  <option value="paused">หยุดชั่วคราว</option>
                  <option value="ended">สิ้นสุดแล้ว</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="editcampform-spent" className="text-xs text-aviva-secondary mb-1 block">ยอดใช้จ่าย (฿)</label>
                  <input id="editcampform-spent" type="number" value={editCampForm.spent} onChange={e => setEditCampForm(p => ({ ...p, spent: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label htmlFor="editcampform-leads_generated" className="text-xs text-aviva-secondary mb-1 block">Leads ที่ได้</label>
                  <input id="editcampform-leads_generated" type="number" value={editCampForm.leads_generated} onChange={e => setEditCampForm(p => ({ ...p, leads_generated: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label htmlFor="editcampform-impressions" className="text-xs text-aviva-secondary mb-1 block">Impressions</label>
                  <input id="editcampform-impressions" type="number" value={editCampForm.impressions} onChange={e => setEditCampForm(p => ({ ...p, impressions: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label htmlFor="editcampform-clicks" className="text-xs text-aviva-secondary mb-1 block">Clicks</label>
                  <input id="editcampform-clicks" type="number" value={editCampForm.clicks} onChange={e => setEditCampForm(p => ({ ...p, clicks: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label htmlFor="editcampform-conversions" className="text-xs text-aviva-secondary mb-1 block">Conversions</label>
                  <input id="editcampform-conversions" type="number" value={editCampForm.conversions} onChange={e => setEditCampForm(p => ({ ...p, conversions: e.target.value }))}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
            </div>
            <button onClick={handleUpdateCampaign} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกข้อมูลแคมเปญ"}
            </button>
          </div>
        </div>
      )}

      {/* Purchase Request Modal — Marketing */}
      {showMktPRModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">ขอสั่งซื้อ/จ้างบริการ</h2>
              <button onClick={() => setShowMktPRModal(false)} aria-label="ปิด"><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="mktprform-supplier_name" className="text-xs text-aviva-secondary mb-1 block">ผู้จำหน่าย / บริษัทรับจ้าง *</label>
                <input id="mktprform-supplier_name" type="text" value={mktPRForm.supplier_name} onChange={e => setMktPRForm(p => ({ ...p, supplier_name: e.target.value }))}
                  placeholder="ชื่อร้าน / บริษัท"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="mktprform-description" className="text-xs text-aviva-secondary mb-1 block">รายการที่ต้องการ *</label>
                <input id="mktprform-description" type="text" value={mktPRForm.description} onChange={e => setMktPRForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="เช่น ค่าจ้างทำกราฟิก, ค่าโฆษณา Facebook"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="mktprform-amount" className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท)</label>
                <input id="mktprform-amount" type="number" value={mktPRForm.amount} onChange={e => setMktPRForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="mktprform-notes" className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea id="mktprform-notes" value={mktPRForm.notes} onChange={e => setMktPRForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="รายละเอียดเพิ่มเติม"
                  rows={2}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
            </div>
            <button onClick={handleCreateMktPR} disabled={mktPRSaving || !mktPRForm.supplier_name || !mktPRForm.description}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {mktPRSaving ? "กำลังส่งคำขอ..." : "ส่งคำขออนุมัติ"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
