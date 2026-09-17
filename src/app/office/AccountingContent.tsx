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
import { ACCOUNTING_CATEGORIES, ConstructionJv, PROJECT_ID, ReceiptRow, clearFormDraft, emptyReceiptForm, formatM, formatThb, jvTemplates, receiptTemplates, useFormDraft } from "./_shared";

export default function AccountingContent() {
  const user = useCurrentUser();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyReceiptForm);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [acctPeriod, setAcctPeriod] = useState<Period>("month");
  const [acctStart, setAcctStart] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; });
  const [acctEnd, setAcctEnd] = useState(() => thaiDateStr());
  const [acctLimit, setAcctLimit] = useState(50);
  const [kpiModalAcct, setKpiModalAcct] = useState<"all" | "income" | "expense" | null>(null);
  const [acctEntries, setAcctEntries] = useState<ConstructionJv[]>([]);
  const [acctView, setAcctView] = useState<"receipts" | "construction">("receipts");
  const [acctToast, setAcctToast] = useState<{ msg: string; type: ToastType } | null>(null);
  useFormDraft("office-draft-accounting", form, setForm, showModal);

  const fetchReceipts = (limit = acctLimit) => {
    let q = supabase.from("receipts").select("*").eq("project_id", PROJECT_ID);
    if (acctStart) q = q.gte("receipt_date", acctStart);
    if (acctEnd) q = q.lte("receipt_date", acctEnd);
    q.order("receipt_date", { ascending: false }).limit(limit)
      .then(({ data }) => {
        setReceipts((data as ReceiptRow[]) ?? []);
        setLoading(false);
      });
  };

  const fetchConstructionJvs = async () => {
    const { data } = await supabase.from("jv_entries")
      .select("id,jv_number,jv_date,description,ref_number,total_debit")
      .eq("project_id", PROJECT_ID)
      .like("description", "จ่ายงวดก่อสร้าง%")
      .order("jv_date", { ascending: false }).limit(300)
      .limit(50);
    const entries = (data as ConstructionJv[]) ?? [];
    // ดึงบรรทัดบัญชีจริง (jv_lines) มาแนบ เพื่อให้ใบสำคัญลงบัญชีแสดงครบทุกบรรทัด (WHT/ประกันผลงาน/ธนาคาร)
    if (entries.length > 0) {
      const { data: lineData } = await supabase.from("jv_lines")
        .select("jv_id,account_code,account_name,debit,credit")
        .in("jv_id", entries.map(e => e.id));
      if (lineData) {
        const byJv = new Map<string, ConstructionJv["lines"]>();
        for (const l of lineData as { jv_id: string; account_code: string; account_name: string; debit: number; credit: number }[]) {
          if (!byJv.has(l.jv_id)) byJv.set(l.jv_id, []);
          byJv.get(l.jv_id)!.push({ account_code: l.account_code, account_name: l.account_name, debit: Number(l.debit), credit: Number(l.credit) });
        }
        entries.forEach(e => { e.lines = byJv.get(e.id); });
      }
    }
    setAcctEntries(entries);
  };

  useEffect(() => { setAcctLimit(50); fetchReceipts(50); fetchConstructionJvs(); }, [acctStart, acctEnd]);

  const totalExpense = receipts.filter(r => r.receipt_type === "expense").reduce((s, r) => s + Number(r.amount), 0);
  const totalIncome = receipts.filter(r => r.receipt_type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const filtered = filterType === "all" ? receipts : receipts.filter(r => r.receipt_type === filterType);

  const exportCSV = () => {
    const rows = [["วันที่", "เลขที่", "ประเภท", "ผู้ขาย", "รายละเอียด", "หมวด", "จำนวนเงิน"]];
    filtered.forEach(r => rows.push([
      r.receipt_date,
      r.receipt_number,
      r.receipt_type === "income" ? "รายรับ" : "รายจ่าย",
      r.vendor_name,
      r.description ?? "",
      r.category,
      String(r.amount),
    ]));
    const csv = "﻿" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    const rcptUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.href = rcptUrl;
    a.download = `receipts_${acctStart}_${acctEnd}.csv`;
    a.click();
    URL.revokeObjectURL(rcptUrl);
  };

  const handleSave = async () => {
    if (!form.vendor_name) { setAcctToast({ msg: "กรอกชื่อผู้ขาย/แหล่งที่มาก่อนบันทึก", type: "error" }); return; }
    // มาตรฐานทีม: ยอดเงินผ่าน parseAmount (กัน NaN/ติดลบ/ลูกน้ำ)
    const amt = parseAmount(form.amount);
    if (amt === null) { setAcctToast({ msg: AMOUNT_ERROR, type: "error" }); return; }
    setSaving(true);
    const rcptNum = form.receipt_number || `RC-${Date.now().toString().slice(-6)}`;
    const { error: rcptErr } = await supabase.from("receipts").insert({
      project_id: PROJECT_ID,
      receipt_date: form.receipt_date,
      vendor_name: form.vendor_name,
      description: form.description,
      amount: amt,
      category: form.category,
      receipt_type: form.receipt_type,
      receipt_number: rcptNum,
    });
    if (rcptErr) { setSaving(false); setAcctToast({ msg: thaiDbError(rcptErr, "บันทึกบิล"), type: "error" }); return; }
    // When recording income receipt, also create AR invoice for accounting integration
    if (form.receipt_type === "income") {
      const invNum = `INV-${Date.now().toString().slice(-6)}`;
      const { error: arErr } = await supabase.from("ar_invoices").insert({
        invoice_number: invNum,
        customer_name: form.vendor_name,
        invoice_date: form.receipt_date,
        due_date: form.receipt_date,
        base_amount: amt,
        vat_amount: 0,
        total_amount: amt,
        paid_amount: amt,
        status: "paid",
        description: form.description || form.category,
        project_id: PROJECT_ID,
        ref_number: rcptNum,
      });
      if (arErr) setAcctToast({ msg: thaiDbError(arErr, "สร้างใบแจ้งหนี้ AR (บิลบันทึกแล้ว)"), type: "error" });
    }
    setSaving(false);
    setShowModal(false);
    setForm(emptyReceiptForm);
    clearFormDraft("office-draft-accounting");
    setAcctToast({ msg: "บันทึกบิลเรียบร้อย", type: "success" });
    fetchReceipts();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      {acctToast && <Toast message={acctToast.msg} type={acctToast.type} onClose={() => setAcctToast(null)} />}
      <DeptAIChat dept="accounting" label="AI ฝ่ายบัญชี" />
      <DeptBriefingPanel dept="accounting" label="ฝ่ายบัญชี" />
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setKpiModalAcct("all")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <Receipt size={14} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-lg font-bold text-aviva-text">{receipts.length}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">ใบเสร็จทั้งหมด</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModalAcct("income")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <TrendingUp size={14} className="text-green-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-400">{formatM(totalIncome)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายรับทั้งหมด</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModalAcct("expense")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <TrendingDown size={14} className="text-red-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-red-400">{formatM(totalExpense)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายจ่ายทั้งหมด</p>
          </GlassCard>
        </button>
      </div>

      <AIInsightPanel
        type="success"
        priority="low"
        title="AI: รายรับสูงขึ้น"
        message="ยอดรับเงินเดือนนี้เพิ่มขึ้นจากเดือนก่อน แนะนำตรวจสอบการจับคู่ใบเสร็จกับสัญญาให้ครบถ้วน"
      />

      {/* Full accounting system link */}
      <Link
        href="/office/accounting"
        className="flex items-center justify-between w-full bg-aviva-gold/10 border border-aviva-gold/30 text-aviva-gold px-4 py-3 rounded-2xl text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <BookOpen size={16} />
          ระบบบัญชีเต็มรูปแบบ (JV · AR · AP · ภาษี · TFRS15)
        </span>
        <span className="text-aviva-gold/60">→</span>
      </Link>

      <div className="flex items-center gap-2">
        <div className="flex-1"><PeriodFilter period={acctPeriod} onChange={(p, s, e) => { setAcctPeriod(p); setAcctStart(s); setAcctEnd(e); }} /></div>
        <button
          onClick={() => downloadCsv(`accounting-receipts-${thaiDateStr()}`,
            ["วันที่", "เลขที่บิล", "ผู้ขาย/แหล่งที่มา", "ประเภท", "หมวด", "จำนวนเงิน", "รายละเอียด"],
            receipts.map(r => [r.receipt_date ?? "", r.receipt_number ?? "", r.vendor_name ?? "", r.receipt_type === "income" ? "รายรับ" : "รายจ่าย", r.category ?? "", r.amount ?? 0, r.description ?? ""]))}
          className="flex items-center gap-1 text-[11px] font-semibold text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/30 px-2.5 py-1.5 rounded-xl flex-shrink-0"
        >
          <Download size={11} /> CSV
        </button>
      </div>

      {/* Add + Export buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowModal(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm"
        >
          <Plus size={16} /> บันทึกบิล
        </button>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 border border-aviva-gold/30 text-aviva-gold px-4 py-3 rounded-2xl text-sm font-medium"
        >
          <Download size={15} /> CSV
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "ทั้งหมด" },
          { key: "expense", label: "รายจ่าย" },
          { key: "income", label: "รายรับ" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilterType(key as typeof filterType)}
            className={clsx("px-4 py-1.5 rounded-full text-xs font-medium border transition-all",
              filterType === key
                ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{label}</button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        {[
          { k: "receipts", l: "บิล / ใบเสร็จ" },
          { k: "construction", l: `บัญชีก่อสร้าง${acctEntries.length > 0 ? ` (${acctEntries.length})` : ""}` },
        ].map(({ k, l }) => (
          <button key={k} onClick={() => setAcctView(k as "receipts" | "construction")}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              acctView === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
      </div>

      {acctView === "construction" && (
        <div className="space-y-2">
          <SectionHeader title="บัญชีก่อสร้าง" subtitle="รายการจ่ายงวดผู้รับเหมา" />
          {acctEntries.length === 0 ? (
            <GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการ</p></GlassCard>
          ) : acctEntries.map(e => (
            <GlassCard key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-aviva-text truncate">{e.description}</p>
                  <p className="text-xs text-aviva-secondary mt-0.5">{e.jv_date} · {e.jv_number}</p>
                  {e.ref_number && <p className="text-[10px] text-aviva-secondary/60">Ref: {e.ref_number}</p>}
                  <div className="text-[10px] text-aviva-secondary/60 mt-0.5">
                    {e.lines && e.lines.length > 0
                      ? e.lines.map(l => `${l.debit > 0 ? "Dr" : "Cr"} ${l.account_code} ${l.account_name}`).join(" / ")
                      : "Dr: 2100 เจ้าหนี้ผู้รับเหมา / Cr: 1120 เงินฝากธนาคาร"}
                  </div>
                  <div className="mt-1.5">
                    <AttachDocButton entityType="jv_entry" entityId={e.id} attachedBy={user?.full_name ?? ""} templates={jvTemplates(e)} />
                  </div>
                </div>
                <p className="text-sm font-bold text-red-400 flex-shrink-0">-฿{e.total_debit.toLocaleString()}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {acctView === "receipts" && (
      <div>
        <SectionHeader title="รายการบิล / ใบเสร็จ" subtitle={loading ? "กำลังโหลด..." : `${receipts.length} รายการ`} />
        <div className="space-y-2">
          {loading
            ? [1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
            : filtered.length === 0
            ? (
              <GlassCard className="p-8 text-center">
                <Receipt size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีรายการ</p>
              </GlassCard>
            )
            : filtered.map(r => (
              <GlassCard key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className={r.receipt_type === "expense" ? "text-red-400" : "text-green-400"} />
                      <p className="text-sm font-medium text-aviva-text truncate">{r.vendor_name}</p>
                      <span className="text-[10px] bg-aviva-gold/10 text-aviva-gold px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {r.category}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-aviva-secondary mt-0.5 truncate">{r.description}</p>
                    )}
                    <p className="text-[10px] text-aviva-secondary/60 mt-0.5">{r.receipt_date} · {r.receipt_number}</p>
                    <div className="mt-1.5">
                      <AttachDocButton entityType="receipt" entityId={r.id} attachedBy={user?.full_name ?? ""} templates={receiptTemplates(r)} />
                    </div>
                  </div>
                  <p className={clsx("text-sm font-bold flex-shrink-0",
                    r.receipt_type === "expense" ? "text-red-400" : "text-green-400")}>
                    {r.receipt_type === "expense" ? "-" : "+"}฿{formatThb(Number(r.amount))}
                  </p>
                </div>
              </GlassCard>
            ))
          }
          {!loading && receipts.length >= acctLimit && (
            <button onClick={() => { const next = acctLimit + 50; setAcctLimit(next); fetchReceipts(next); }}
              className="w-full py-2.5 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl bg-aviva-bg hover:border-aviva-gold/30 transition-all mt-1">
              โหลดเพิ่มเติม (แสดง {acctLimit} รายการแล้ว)
            </button>
          )}
        </div>
      </div>
      )}

      {/* Add Receipt Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">บันทึกบิล / ใบเสร็จ</h2>
              <button aria-label="ปิด" onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                {[
                  { val: "expense", label: "รายจ่าย", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                  { val: "income", label: "รายรับ", color: "bg-green-500/20 text-green-400 border-green-500/30" },
                ].map(({ val, label, color }) => (
                  <button key={val} onClick={() => setForm({ ...form, receipt_type: val })}
                    className={clsx("flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all",
                      form.receipt_type === val ? color : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                    )}>{label}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="accform-receipt_date" className="text-xs text-aviva-secondary mb-1 block">วันที่</label>
                  <input id="accform-receipt_date" type="date" value={form.receipt_date}
                    onChange={e => setForm({ ...form, receipt_date: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label htmlFor="accform-receipt_number" className="text-xs text-aviva-secondary mb-1 block">เลขที่บิล (ถ้ามี)</label>
                  <input id="accform-receipt_number" type="text" value={form.receipt_number}
                    onChange={e => setForm({ ...form, receipt_number: e.target.value })}
                    placeholder="RC-001"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label htmlFor="accform-vendor_name" className="text-xs text-aviva-secondary mb-1 block">ชื่อผู้ขาย / แหล่งที่มา *</label>
                <input id="accform-vendor_name" type="text" value={form.vendor_name}
                  onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                  placeholder="ร้าน / บริษัท / ชื่อ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label htmlFor="accform-description" className="text-xs text-aviva-secondary mb-1 block">รายละเอียด</label>
                <input id="accform-description" type="text" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="รายละเอียดสินค้า/บริการ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="accform-amount" className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท) *</label>
                  <input id="accform-amount" type="number" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    placeholder="0"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label htmlFor="accform-category" className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                  <select id="accform-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {ACCOUNTING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.vendor_name || !form.amount}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {/* KPI Detail Modal */}
      {kpiModalAcct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 mb-14 flex flex-col" style={{ maxHeight: "75vh" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-aviva-text">
                {kpiModalAcct === "all" ? "ใบเสร็จทั้งหมด" :
                 kpiModalAcct === "income" ? "รายรับ" : "รายจ่าย"}
                <span className="ml-1.5 text-xs font-normal text-aviva-secondary">
                  ({(kpiModalAcct === "all" ? receipts : receipts.filter(r => r.receipt_type === kpiModalAcct)).length} รายการ)
                </span>
              </h2>
              <button aria-label="ปิด" onClick={() => setKpiModalAcct(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {(kpiModalAcct === "all" ? receipts : receipts.filter(r => r.receipt_type === kpiModalAcct)).map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-aviva-text truncate">{r.vendor_name}</p>
                    <p className="text-[10px] text-aviva-secondary">{r.receipt_date} · {r.category}</p>
                  </div>
                  <p className={clsx("text-xs font-bold flex-shrink-0",
                    r.receipt_type === "income" ? "text-green-400" : "text-red-400"
                  )}>{formatM(Number(r.amount))}</p>
                </div>
              ))}
              {(kpiModalAcct === "all" ? receipts : receipts.filter(r => r.receipt_type === kpiModalAcct)).length === 0 && (
                <p className="text-center text-aviva-secondary text-sm py-8">ไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
