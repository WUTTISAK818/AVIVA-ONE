"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, X, Clock, ClipboardCheck,
  Receipt, FileText, Users, Phone, Briefcase, AlertCircle, Megaphone,
  Sparkles, Wrench, CheckCircle, AlertTriangle, Star, Download,
  XCircle, ShieldAlert, Package, Printer, ChevronDown, ChevronUp,
  FolderOpen, Upload, Search, Home,
} from "lucide-react";
import clsx from "clsx";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import ProgressBar from "@/components/ProgressBar";
import AIInsightPanel from "@/components/AIInsightPanel";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/audit";
import { useCurrentUser } from "@/lib/user-context";
import PeriodFilter, { type Period } from "@/components/PeriodFilter";
import { createNotification } from "@/lib/notify";

type OfficeTab = "finance" | "accounting" | "marketing" | "hr" | "after-sales" | "approvals" | "materials" | "payroll" | "community" | "documents";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const today = new Date().toISOString().split("T")[0];

// ─── Shared formatters ────────────────────────────────────────────────────────

function formatM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `฿${(Math.abs(n) / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `฿${(Math.abs(n) / 1_000).toFixed(0)}K`;
  return `฿${Math.abs(n).toLocaleString("th-TH")}`;
}

function formatThb(n: number) {
  return n.toLocaleString("th-TH");
}

// ─── Finance ──────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
}

interface Approval {
  id: string;
  description: string;
  amount: number;
  status: string;
  requested_by: string;
  created_at: string;
}

const FINANCE_CATEGORIES = ["ค่าก่อสร้าง", "ค่าวัสดุ", "ค่าการตลาด", "เงินเดือน", "ค่าดำเนินการ", "รายรับจากการขาย", "อื่นๆ"];

const emptyFinanceForm = {
  transaction_type: "expense",
  amount: "",
  description: "",
  category: "ค่าก่อสร้าง",
};

function FinanceContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [materialPurchasePending, setMaterialPurchasePending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyFinanceForm);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"txn" | "approval">("txn");
  const [period, setPeriod] = useState<Period>("month");
  const [dateStart, setDateStart] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; });
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [finLimit, setFinLimit] = useState(50);
  const [kpiModal, setKpiModal] = useState<"income" | "expense" | "cashflow" | "pending" | null>(null);

  const fetchData = (limit = finLimit) => {
    let txnQ = supabase.from("finance_transactions").select("*").eq("project_id", PROJECT_ID);
    if (dateStart) txnQ = txnQ.gte("created_at", dateStart);
    if (dateEnd) txnQ = txnQ.lte("created_at", dateEnd + "T23:59:59");
    Promise.all([
      txnQ.order("created_at", { ascending: false }).limit(limit),
      supabase.from("approvals").select("*").eq("module", "finance")
        .order("created_at", { ascending: false }),
      supabase.from("approval_logs").select("approval_id", { count: "exact", head: true })
        .eq("workflow_type", "Material_Purchase").eq("action_taken", "Pending"),
    ]).then(([txnRes, apprRes, matRes]) => {
      setTransactions((txnRes.data as Transaction[]) ?? []);
      setApprovals((apprRes.data as Approval[]) ?? []);
      setMaterialPurchasePending(matRes.count ?? 0);
      setLoading(false);
    });
  };

  useEffect(() => { setFinLimit(50); fetchData(50); }, [dateStart, dateEnd]);

  const totalIncome = transactions
    .filter(t => t.transaction_type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions
    .filter(t => t.transaction_type === "expense")
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const netCashflow = totalIncome - totalExpenses;
  const pendingApprovals = approvals.filter(a => a.status === "pending").length;

  const exportCSV = () => {
    const rows = [["วันที่", "ประเภท", "รายละเอียด", "จำนวนเงิน"]];
    transactions.forEach(tx => rows.push([
      new Date(tx.created_at).toLocaleDateString("th-TH"),
      tx.transaction_type === "income" ? "รายรับ" : "รายจ่าย",
      tx.description,
      String(tx.amount),
    ]));
    const csv = "﻿" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `finance_${dateStart}_${dateEnd}.csv`;
    a.click();
  };

  const handleSave = async () => {
    if (!form.amount || !form.description) return;
    setSaving(true);
    const amt = Number(form.amount);
    if (amt >= 100000) {
      const { data } = await supabase.from("approvals").insert({
        module: "finance",
        reference_type: "transaction",
        amount: amt,
        description: `[${form.category}] ${form.description}`,
        status: "pending",
        requested_by: "Admin",
      }).select().single();
      await logAction("finance", "request_approval", `ขออนุมัติ ฿${amt.toLocaleString()} — ${form.description}`, data?.id);
      await createNotification({ type: "approval", title: "ขออนุมัติรายจ่าย", message: `[${form.category}] ${form.description} ฿${amt.toLocaleString()}`, from_dept: "ฝ่ายการเงิน" });
    } else {
      const { data } = await supabase.from("finance_transactions").insert({
        project_id: PROJECT_ID,
        transaction_type: form.transaction_type,
        amount: form.transaction_type === "expense" ? -amt : amt,
        description: `[${form.category}] ${form.description}`,
      }).select().single();
      await logAction("finance", "add_transaction", `เพิ่มรายการ ${form.transaction_type} ฿${amt.toLocaleString()} — ${form.description}`, data?.id);
    }
    setSaving(false);
    setShowModal(false);
    setForm(emptyFinanceForm);
    fetchData();
  };

  const handleApprove = async (id: string, approved: boolean) => {
    const approval = approvals.find(a => a.id === id);
    if (!approval) return;
    await supabase.from("approvals").update({
      status: approved ? "approved" : "rejected",
      approved_by: "Admin",
      approved_at: new Date().toISOString(),
    }).eq("id", id);
    if (approved) {
      await supabase.from("finance_transactions").insert({
        project_id: PROJECT_ID,
        transaction_type: "expense",
        amount: -approval.amount,
        description: approval.description,
      });
    }
    await logAction("finance", approved ? "approve" : "reject",
      `${approved ? "อนุมัติ" : "ปฏิเสธ"} ฿${approval.amount.toLocaleString()} — ${approval.description}`, id);
    await createNotification({
      type: approved ? "success" : "info",
      title: approved ? "อนุมัติรายจ่ายแล้ว" : "ปฏิเสธรายจ่าย",
      message: `${approval.description} ฿${approval.amount.toLocaleString()}`,
      from_dept: "ฝ่ายการเงิน",
    });
    fetchData();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      {materialPurchasePending > 0 && (
        <GlassCard className="p-3 border border-orange-500/20 bg-orange-500/5">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className="text-orange-400 flex-shrink-0" />
            <span className="text-xs text-orange-400 flex-1">
              รออนุมัติจัดซื้อวัสดุ <b>{materialPurchasePending}</b> รายการ
            </span>
          </div>
        </GlassCard>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setKpiModal("income")} className="active:scale-[0.97] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <TrendingUp size={16} className="text-green-400 mx-auto mb-1" />
            <p className="text-base font-bold text-green-400">{formatM(totalIncome || 0)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายรับรวม</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModal("expense")} className="active:scale-[0.97] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <TrendingDown size={16} className="text-red-400 mx-auto mb-1" />
            <p className="text-base font-bold text-red-400">{formatM(totalExpenses || 0)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายจ่ายรวม</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModal("cashflow")} className="active:scale-[0.97] transition-transform w-full text-left">
          <GlassCard gold className="p-3 text-center">
            <DollarSign size={16} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-base font-bold text-aviva-gold">{formatM(netCashflow || 0)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">Net Cashflow</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModal("pending")} className="active:scale-[0.97] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <ClipboardCheck size={16} className="text-yellow-400 mx-auto mb-1" />
            <p className="text-base font-bold text-yellow-400">{pendingApprovals}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รออนุมัติ</p>
          </GlassCard>
        </button>
      </div>

      <AIInsightPanel
        type="info"
        priority="medium"
        title="AI: วิเคราะห์การเงิน"
        message="รายจ่ายเดือนนี้ควรตรวจสอบหมวดก่อสร้าง แนะนำทบทวนงบประมาณผู้รับเหมาก่อนสิ้นไตรมาส"
      />

      <PeriodFilter period={period} onChange={(p, s, e) => { setPeriod(p); setDateStart(s); setDateEnd(e); }} />

      {/* Add + Export buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowModal(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm"
        >
          <Plus size={16} /> เพิ่มรายการเงิน
        </button>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 border border-aviva-gold/30 text-aviva-gold px-4 py-3 rounded-2xl text-sm font-medium"
        >
          <Download size={15} /> CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { k: "txn", l: "รายการทั้งหมด" },
          { k: "approval", l: `รออนุมัติ${pendingApprovals > 0 ? ` (${pendingApprovals})` : ""}` },
        ].map(({ k, l }) => (
          <button key={k} onClick={() => setActiveTab(k as "txn" | "approval")}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              activeTab === k
                ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
      </div>

      {activeTab === "txn" && (
        <div className="space-y-2">
          <SectionHeader title="รายการล่าสุด" />
          {loading
            ? [1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-aviva-card/50 animate-pulse" />)
            : transactions.length === 0
            ? <GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการ</p></GlassCard>
            : transactions.map(tx => (
              <GlassCard key={tx.id} className="p-3 flex items-center gap-3">
                <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  tx.transaction_type === "income" ? "bg-green-500/10" : "bg-red-500/10")}>
                  {tx.transaction_type === "income"
                    ? <TrendingUp size={14} className="text-green-400" />
                    : <TrendingDown size={14} className="text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-aviva-text font-medium truncate">{tx.description}</p>
                  <p className="text-[10px] text-aviva-secondary">{new Date(tx.created_at).toLocaleDateString("th-TH")}</p>
                </div>
                <span className={clsx("text-sm font-bold flex-shrink-0", Number(tx.amount) > 0 ? "text-green-400" : "text-red-400")}>
                  {Number(tx.amount) > 0 ? "+" : ""}{formatM(tx.amount)}
                </span>
              </GlassCard>
            ))
          }
          {!loading && transactions.length >= finLimit && (
            <button onClick={() => { const next = finLimit + 50; setFinLimit(next); fetchData(next); }}
              className="w-full py-2.5 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-xl bg-aviva-bg hover:border-aviva-gold/30 transition-all mt-1">
              โหลดเพิ่มเติม (แสดง {finLimit} รายการแล้ว)
            </button>
          )}
        </div>
      )}

      {activeTab === "approval" && (
        <div className="space-y-3">
          <SectionHeader title="รายการรออนุมัติ" subtitle="≥ ฿100,000 ต้องอนุมัติก่อน" />
          {approvals.length === 0
            ? <GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ไม่มีรายการรออนุมัติ</p></GlassCard>
            : approvals.map(ap => (
              <GlassCard key={ap.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-aviva-text">{ap.description}</p>
                    <p className="text-xs text-aviva-secondary mt-0.5">โดย: {ap.requested_by}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-aviva-gold">฿{ap.amount.toLocaleString("th-TH")}</p>
                    <span className={clsx("text-[10px] px-2 py-0.5 rounded-full",
                      ap.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                      ap.status === "approved" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    )}>
                      {ap.status === "pending" ? "รออนุมัติ" : ap.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธ"}
                    </span>
                  </div>
                </div>
                {ap.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(ap.id, true)}
                      className="flex-1 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-medium">
                      อนุมัติ
                    </button>
                    <button onClick={() => handleApprove(ap.id, false)}
                      className="flex-1 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-medium">
                      ปฏิเสธ
                    </button>
                  </div>
                )}
              </GlassCard>
            ))
          }
        </div>
      )}

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เพิ่มรายการเงิน</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>

            <div className="flex gap-2">
              {[
                { val: "expense", label: "รายจ่าย", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                { val: "income", label: "รายรับ", color: "bg-green-500/20 text-green-400 border-green-500/30" },
              ].map(({ val, label, color }) => (
                <button key={val} onClick={() => setForm({ ...form, transaction_type: val })}
                  className={clsx("flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all",
                    form.transaction_type === val ? color : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10"
                  )}>{label}</button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท) *</label>
                <input type="number" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                {Number(form.amount) >= 100000 && (
                  <p className="text-[11px] text-yellow-400 mt-1 flex items-center gap-1">
                    <Clock size={10} /> ≥ ฿100,000 จะเข้าระบบอนุมัติก่อน
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด *</label>
                <input type="text" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="อธิบายรายการ..."
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {FINANCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving || !form.amount || !form.description}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : Number(form.amount) >= 100000 ? "ส่งขออนุมัติ" : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {/* KPI Detail Modal */}
      {kpiModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 mb-14 flex flex-col" style={{ maxHeight: "75vh" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-aviva-text">
                {kpiModal === "income" ? "รายรับทั้งหมด" :
                 kpiModal === "expense" ? "รายจ่ายทั้งหมด" :
                 kpiModal === "cashflow" ? "รายการทั้งหมด" : "รออนุมัติ"}
              </h2>
              <button onClick={() => setKpiModal(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {kpiModal === "pending" ? (
                approvals.filter(a => a.status === "pending").map(a => (
                  <div key={a.id} className="p-3 rounded-xl bg-aviva-bg border border-yellow-500/20">
                    <p className="text-xs font-semibold text-aviva-text">{a.description}</p>
                    <p className="text-[10px] text-yellow-400 mt-0.5">{formatM(Number(a.amount))}</p>
                  </div>
                ))
              ) : (
                transactions
                  .filter(t => kpiModal === "cashflow" || t.transaction_type === (kpiModal === "income" ? "income" : "expense"))
                  .map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-aviva-text truncate">{t.description}</p>
                        <p className="text-[10px] text-aviva-secondary">{new Date(t.created_at).toLocaleDateString("th-TH")}</p>
                      </div>
                      <p className={clsx("text-xs font-bold flex-shrink-0",
                        t.transaction_type === "income" ? "text-green-400" : "text-red-400"
                      )}>{formatM(Math.abs(Number(t.amount)))}</p>
                    </div>
                  ))
              )}
              {(kpiModal === "pending"
                ? approvals.filter(a => a.status === "pending")
                : transactions.filter(t => kpiModal === "cashflow" || t.transaction_type === (kpiModal === "income" ? "income" : "expense"))
              ).length === 0 && (
                <p className="text-center text-aviva-secondary text-sm py-8">ไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Accounting ───────────────────────────────────────────────────────────────

interface ReceiptRow {
  id: string;
  receipt_number: string;
  receipt_date: string;
  vendor_name: string;
  description: string;
  amount: number;
  category: string;
  receipt_type: string;
  created_at: string;
}

const ACCOUNTING_CATEGORIES = ["วัสดุก่อสร้าง", "ค่าแรง", "ค่าสาธารณูปโภค", "ค่าอุปกรณ์สำนักงาน", "ค่าการตลาด", "ค่าขนส่ง", "อื่นๆ"];

const emptyReceiptForm = {
  receipt_date: today,
  vendor_name: "",
  description: "",
  amount: "",
  category: "วัสดุก่อสร้าง",
  receipt_type: "expense",
  receipt_number: "",
};

function AccountingContent() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyReceiptForm);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [acctPeriod, setAcctPeriod] = useState<Period>("month");
  const [acctStart, setAcctStart] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; });
  const [acctEnd, setAcctEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [acctLimit, setAcctLimit] = useState(50);
  const [kpiModalAcct, setKpiModalAcct] = useState<"all" | "income" | "expense" | null>(null);

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

  useEffect(() => { setAcctLimit(50); fetchReceipts(50); }, [acctStart, acctEnd]);

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
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `receipts_${acctStart}_${acctEnd}.csv`;
    a.click();
  };

  const handleSave = async () => {
    if (!form.vendor_name || !form.amount) return;
    setSaving(true);
    await supabase.from("receipts").insert({
      project_id: PROJECT_ID,
      receipt_date: form.receipt_date,
      vendor_name: form.vendor_name,
      description: form.description,
      amount: Number(form.amount),
      category: form.category,
      receipt_type: form.receipt_type,
      receipt_number: form.receipt_number || `RC-${Date.now().toString().slice(-6)}`,
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyReceiptForm);
    fetchReceipts();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
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

      <PeriodFilter period={acctPeriod} onChange={(p, s, e) => { setAcctPeriod(p); setAcctStart(s); setAcctEnd(e); }} />

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

      {/* Receipt List */}
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

      {/* Add Receipt Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">บันทึกบิล / ใบเสร็จ</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
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
                  <label className="text-xs text-aviva-secondary mb-1 block">วันที่</label>
                  <input type="date" value={form.receipt_date}
                    onChange={e => setForm({ ...form, receipt_date: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เลขที่บิล (ถ้ามี)</label>
                  <input type="text" value={form.receipt_number}
                    onChange={e => setForm({ ...form, receipt_number: e.target.value })}
                    placeholder="RC-001"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อผู้ขาย / แหล่งที่มา *</label>
                <input type="text" value={form.vendor_name}
                  onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                  placeholder="ร้าน / บริษัท / ชื่อ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด</label>
                <input type="text" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="รายละเอียดสินค้า/บริการ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท) *</label>
                  <input type="number" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    placeholder="0"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
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
              <button onClick={() => setKpiModalAcct(null)}><X size={20} className="text-aviva-secondary" /></button>
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

// ─── Marketing ────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  platform: string;
  budget: number;
  spent: number;
  leads_generated: number;
  impressions: number;
  clicks: number;
  conversions: number;
  status: string;
  executive_name?: string;
  campaign_link?: string;
}

interface MarketingBudget {
  id: string;
  year: number;
  month: number;
  budget_amount: number;
  executive_name: string;
  notes: string;
}

const platformStyle: Record<string, { color: string; bg: string }> = {
  Facebook: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  TikTok:   { color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  Google:   { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
};

const statusStyle: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  paused: "bg-yellow-500/20 text-yellow-400",
  ended:  "bg-gray-500/20 text-gray-400",
};

const statusLabel: Record<string, string> = {
  active: "กำลังทำงาน",
  paused: "หยุดชั่วคราว",
  ended:  "สิ้นสุดแล้ว",
};

function roi(campaign: Campaign) {
  const avgHousePrice = 9_500_000;
  const revenue = campaign.conversions * avgHousePrice;
  return campaign.spent > 0 ? Math.round((revenue / campaign.spent) * 100) : 0;
}

function cpl(campaign: Campaign) {
  return campaign.leads_generated > 0
    ? Math.round(campaign.spent / campaign.leads_generated).toLocaleString()
    : "—";
}

const emptyCampaignForm = { name: "", platform: "Facebook", budget: "", start_date: "", end_date: "", executive_name: "", campaign_link: "" };

const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function MarketingContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [budgets, setBudgets] = useState<MarketingBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"campaigns" | "budget">("campaigns");
  const [filter, setFilter] = useState<"all" | "Facebook" | "TikTok" | "Google">("all");
  const [showModal, setShowModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [form, setForm] = useState(emptyCampaignForm);
  const [budgetForm, setBudgetForm] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, budget_amount: "", executive_name: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [mktPeriod, setMktPeriod] = useState<Period>("month");
  const [mktStart, setMktStart] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; });
  const [mktEnd, setMktEnd] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchCampaigns = () => {
    let q = supabase.from("campaigns").select("*").eq("project_id", PROJECT_ID);
    if (mktStart) q = q.gte("created_at", mktStart);
    if (mktEnd) q = q.lte("created_at", mktEnd + "T23:59:59");
    q.order("created_at", { ascending: false })
      .then(({ data }) => { setCampaigns((data as Campaign[]) ?? []); setLoading(false); });
  };

  const fetchBudgets = () => {
    supabase.from("marketing_budgets").select("*").eq("project_id", PROJECT_ID)
      .order("year", { ascending: false }).order("month", { ascending: false })
      .then(({ data }) => setBudgets((data as MarketingBudget[]) ?? []));
  };

  useEffect(() => { fetchCampaigns(); fetchBudgets(); }, [mktStart, mktEnd]);

  const filtered = filter === "all" ? campaigns : campaigns.filter(c => c.platform === filter);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads_generated, 0);
  const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgROI = campaigns.length
    ? Math.round(campaigns.reduce((s, c) => s + roi(c), 0) / campaigns.length)
    : 0;
  const totalBudgetAllocated = budgets.reduce((s, b) => s + Number(b.budget_amount), 0);

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    await supabase.from("campaigns").insert({
      project_id: PROJECT_ID,
      name: form.name,
      platform: form.platform,
      budget: Number(form.budget) || 0,
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
    await supabase.from("marketing_budgets").upsert({
      project_id: PROJECT_ID,
      year: budgetForm.year,
      month: budgetForm.month,
      budget_amount: Number(budgetForm.budget_amount),
      executive_name: budgetForm.executive_name,
      notes: budgetForm.notes,
    }, { onConflict: "project_id,year,month" });
    setSaving(false);
    setShowBudgetModal(false);
    fetchBudgets();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
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
          <button onClick={() => setShowModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm">
            <Plus size={16} /> สร้างแคมเปญ
          </button>
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
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-aviva-gold">{roi(c)}%</p>
                            <p className="text-[10px] text-aviva-secondary">ROI</p>
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
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อแคมเปญ *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="เช่น AVIVA — Facebook Q3 2026"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">Platform</label>
                  <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {["Facebook", "TikTok", "Google", "LINE", "อื่นๆ"].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">งบประมาณ (บาท)</label>
                  <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
                    placeholder="50000"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้รับผิดชอบ / ผู้อนุมัติ</label>
                <input type="text" value={form.executive_name} onChange={e => setForm({ ...form, executive_name: e.target.value })}
                  placeholder="ชื่อผู้บริหารที่รับผิดชอบ"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ลิงก์ข้อมูลแคมเปญ</label>
                <input type="url" value={form.campaign_link} onChange={e => setForm({ ...form, campaign_link: e.target.value })}
                  placeholder="https://docs.google.com/..."
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">วันเริ่ม</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">วันสิ้นสุด</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
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
              <button onClick={() => setShowBudgetModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ปี</label>
                  <select value={budgetForm.year} onChange={e => setBudgetForm({ ...budgetForm, year: Number(e.target.value) })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เดือน</label>
                  <select value={budgetForm.month} onChange={e => setBudgetForm({ ...budgetForm, month: Number(e.target.value) })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {MONTH_TH.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">งบประมาณ (บาท) *</label>
                <input type="number" value={budgetForm.budget_amount} onChange={e => setBudgetForm({ ...budgetForm, budget_amount: e.target.value })}
                  placeholder="100000"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้อนุมัติงบ</label>
                <input type="text" value={budgetForm.executive_name} onChange={e => setBudgetForm({ ...budgetForm, executive_name: e.target.value })}
                  placeholder="ชื่อผู้บริหาร"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <textarea value={budgetForm.notes} onChange={e => setBudgetForm({ ...budgetForm, notes: e.target.value })}
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
    </div>
  );
}

// ─── HR ───────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  employee_code?: string;
  full_name: string;
  nickname: string;
  phone: string;
  email: string;
  department: string;
  position: string;
  base_salary: number;
  commission_rate: number;
  start_date: string;
  status: string;
}

const DEPARTMENTS = ["ฝ่ายขาย", "ฝ่ายก่อสร้าง", "ฝ่ายการเงิน", "ฝ่ายบัญชี", "ฝ่ายบุคคล", "ฝ่ายบริหาร"];

const deptColor: Record<string, string> = {
  "ฝ่ายขาย":     "bg-blue-500/20 text-blue-400",
  "ฝ่ายก่อสร้าง": "bg-orange-500/20 text-orange-400",
  "ฝ่ายการเงิน":  "bg-green-500/20 text-green-400",
  "ฝ่ายบัญชี":   "bg-purple-500/20 text-purple-400",
  "ฝ่ายบุคคล":   "bg-pink-500/20 text-pink-400",
  "ฝ่ายบริหาร":  "bg-aviva-gold/20 text-aviva-gold",
};

const emptyEmployeeForm = {
  full_name: "",
  nickname: "",
  phone: "",
  email: "",
  department: "ฝ่ายขาย",
  position: "",
  base_salary: "",
  commission_rate: "",
  start_date: today,
};

function HRContent() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyEmployeeForm);
  const [saving, setSaving] = useState(false);
  const [filterDept, setFilterDept] = useState("ทั้งหมด");
  const [kpiModalHR, setKpiModalHR] = useState<"employees" | "probation" | "salary" | null>(null);

  const fetchEmployees = () => {
    supabase.from("employees").select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEmployees((data as Employee[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(() => { fetchEmployees(); }, []);

  const active = employees.filter(e => e.status === "active");
  const filtered = filterDept === "ทั้งหมด" ? employees : employees.filter(e => e.department === filterDept);

  const probationAlerts = active.flatMap(e => {
    if (!e.start_date) return [];
    const days = Math.floor((Date.now() - new Date(e.start_date).getTime()) / 86400000);
    return days >= 80 && days <= 180 ? [{ ...e, probationDays: days }] : [];
  });

  const handleSave = async () => {
    if (!form.full_name) return;
    setSaving(true);
    await supabase.from("employees").insert({
      full_name: form.full_name,
      nickname: form.nickname,
      phone: form.phone,
      email: form.email,
      department: form.department,
      position: form.position,
      base_salary: Number(form.base_salary) || 0,
      commission_rate: Number(form.commission_rate) || 0,
      start_date: form.start_date,
      status: "active",
    });
    await logAction("hr", "add_employee", `เพิ่มพนักงาน ${form.full_name} ${form.department}`);
    setSaving(false);
    setShowModal(false);
    setForm(emptyEmployeeForm);
    fetchEmployees();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setKpiModalHR("employees")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <Users size={14} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-xl font-bold text-aviva-text">{active.length}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">พนักงานทั้งหมด</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModalHR("probation")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard className="p-3 text-center">
            <Clock size={14} className="text-yellow-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-yellow-400">{probationAlerts.length}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">ทดลองงาน</p>
          </GlassCard>
        </button>
        <button onClick={() => setKpiModalHR("salary")} className="active:scale-[0.96] transition-transform w-full text-left">
          <GlassCard gold className="p-3 text-center">
            <DollarSign size={14} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-xl font-bold text-aviva-gold">
              {formatM(active.reduce((s, e) => s + Number(e.base_salary), 0))}
            </p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">เงินเดือนรวม</p>
          </GlassCard>
        </button>
      </div>

      <AIInsightPanel
        type="warning"
        priority="medium"
        title="AI: Probation Alert"
        message="ตรวจสอบพนักงานทดลองงานที่ใกล้ครบกำหนด ดำเนินการประเมินและออกเอกสารก่อน 120 วัน"
      />

      {probationAlerts.length > 0 && (
        <GlassCard className="p-3 border border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-yellow-400">แจ้งเตือน Probation ครบ 80 วัน</p>
              <div className="mt-1 space-y-0.5">
                {probationAlerts.map(e => (
                  <p key={e.id} className="text-[11px] text-yellow-400/80">
                    {e.full_name} · {e.department} · {e.probationDays} วัน
                  </p>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Add button */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm"
      >
        <Plus size={16} /> เพิ่มพนักงาน
      </button>

      {/* Dept Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {["ทั้งหมด", ...DEPARTMENTS].map(dept => (
          <button key={dept} onClick={() => setFilterDept(dept)}
            className={clsx("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              filterDept === dept
                ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{dept}</button>
        ))}
      </div>

      {/* Employee List */}
      <div>
        <SectionHeader title="รายชื่อพนักงาน" subtitle={loading ? "กำลังโหลด..." : `${filtered.length} คน`} />
        <div className="space-y-3">
          {loading
            ? [1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
            : filtered.length === 0
            ? (
              <GlassCard className="p-8 text-center">
                <Users size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีพนักงาน</p>
              </GlassCard>
            )
            : filtered.map(emp => (
              <GlassCard key={emp.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-aviva-gold/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-aviva-gold font-bold text-sm">
                      {emp.nickname || emp.full_name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {emp.employee_code && (
                        <span className="text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-md border border-aviva-gold/20 flex-shrink-0">{emp.employee_code}</span>
                      )}
                      <p className="text-sm font-semibold text-aviva-text">{emp.full_name}</p>
                      {emp.nickname && <span className="text-xs text-aviva-secondary">({emp.nickname})</span>}
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full",
                        deptColor[emp.department] ?? "bg-gray-500/20 text-gray-400")}>
                        {emp.department}
                      </span>
                    </div>
                    {emp.position && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Briefcase size={10} className="text-aviva-secondary" />
                        <p className="text-xs text-aviva-secondary">{emp.position}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {emp.phone && (
                        <span className="flex items-center gap-1 text-xs text-aviva-secondary">
                          <Phone size={10} />{emp.phone}
                        </span>
                      )}
                      {emp.base_salary > 0 && (
                        <span className="text-xs text-aviva-gold font-medium">
                          ฿{formatThb(emp.base_salary)}/เดือน
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={clsx("text-[10px] px-2 py-1 rounded-full flex-shrink-0",
                    emp.status === "active"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-500/20 text-gray-400"
                  )}>
                    {emp.status === "active" ? "ทำงานอยู่" : "ลาออก"}
                  </span>
                </div>
              </GlassCard>
            ))
          }
        </div>
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[85vh] overflow-y-auto mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เพิ่มพนักงาน</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ชื่อ-นามสกุล *</label>
                  <input type="text" value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    placeholder="ชื่อจริง นามสกุล"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ชื่อเล่น</label>
                  <input type="text" value={form.nickname}
                    onChange={e => setForm({ ...form, nickname: e.target.value })}
                    placeholder="ชื่อเล่น"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร</label>
                <input type="tel" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="0XX-XXX-XXXX"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">Email</label>
                <input type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ฝ่าย</label>
                  <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ตำแหน่ง</label>
                  <input type="text" value={form.position}
                    onChange={e => setForm({ ...form, position: e.target.value })}
                    placeholder="เช่น พนักงานขาย"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เงินเดือน (บาท)</label>
                  <input type="number" value={form.base_salary}
                    onChange={e => setForm({ ...form, base_salary: e.target.value })}
                    placeholder="15000"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ค่าคอม (%)</label>
                  <input type="number" value={form.commission_rate}
                    onChange={e => setForm({ ...form, commission_rate: e.target.value })}
                    placeholder="1.5" step="0.1"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันเริ่มงาน</label>
                <input type="date" value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.full_name}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "เพิ่มพนักงาน"}
            </button>
          </div>
        </div>
      )}

      {/* KPI Detail Modal */}
      {kpiModalHR && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 mb-14 flex flex-col" style={{ maxHeight: "75vh" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-aviva-text">
                {kpiModalHR === "employees" ? "พนักงานทั้งหมด" :
                 kpiModalHR === "probation" ? "ทดลองงาน" : "เงินเดือนรวมแยกฝ่าย"}
                {kpiModalHR !== "salary" && (
                  <span className="ml-1.5 text-xs font-normal text-aviva-secondary">
                    ({kpiModalHR === "probation" ? probationAlerts.length : active.length} คน)
                  </span>
                )}
              </h2>
              <button onClick={() => setKpiModalHR(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {kpiModalHR === "salary" ? (
                Object.entries(
                  active.reduce((acc, e) => {
                    const dept = e.department || "ไม่ระบุ";
                    acc[dept] = (acc[dept] || 0) + Number(e.base_salary);
                    return acc;
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1]).map(([dept, total]) => (
                  <div key={dept} className="flex items-center justify-between p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                    <p className="text-xs font-semibold text-aviva-text">{dept}</p>
                    <p className="text-xs font-bold text-aviva-gold">{formatM(total)}</p>
                  </div>
                ))
              ) : (
                (kpiModalHR === "probation"
                  ? probationAlerts.map(e => ({ ...e }))
                  : active
                ).map(e => (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-aviva-bg border border-aviva-gold/10">
                    {e.employee_code && (
                      <span className="text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded border border-aviva-gold/20 flex-shrink-0">
                        {e.employee_code}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-aviva-text truncate">{e.full_name}</p>
                      <p className="text-[10px] text-aviva-secondary">{e.department} · {e.position}</p>
                    </div>
                    <p className="text-xs font-bold text-aviva-gold flex-shrink-0">{formatM(Number(e.base_salary))}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── After Sales ──────────────────────────────────────────────────────────────

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

const emptyClaimForm = {
  customer_name: "",
  issue_type: "Other",
  description: "",
  assigned_to: "พี่ท (วิศวกร)",
  scheduled_date: "",
  status: "pending" as Claim["status"],
};

function AfterSalesContent() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [form, setForm] = useState(emptyClaimForm);
  const [saving, setSaving] = useState(false);
  const [kpiModalAS, setKpiModalAS] = useState<"all" | "pending" | "in_progress" | "resolved" | null>(null);

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
    await createNotification({
      type: "claim",
      title: "แจ้งซ่อมใหม่",
      message: `${form.customer_name} — ${issueTh[form.issue_type] ?? form.issue_type}: ${form.description}`,
      from_dept: "ฝ่ายหลังการขาย",
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyClaimForm);
    fetchClaims();
  };

  const handleUpdateStatus = async (id: string, newStatus: Claim["status"]) => {
    await supabase.from("warranty_claims").update({ status: newStatus }).eq("id", id);
    setSelectedClaim(null);
    fetchClaims();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
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

      {/* Add button */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm"
      >
        <Plus size={16} /> แจ้งซ่อม
      </button>

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
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อลูกค้า *</label>
                <input type="text" value={form.customer_name}
                  onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="ชื่อเจ้าของบ้าน"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ประเภทปัญหา</label>
                  <select value={form.issue_type} onChange={e => setForm({ ...form, issue_type: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {ISSUE_TYPES.map(t => <option key={t} value={t}>{issueTh[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">มอบหมายให้</label>
                  <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    {ASSIGNED_TO_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียดปัญหา *</label>
                <textarea value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="อธิบายปัญหาที่พบ..." rows={3}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันที่นัดซ่อม</label>
                <input type="date" value={form.scheduled_date}
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
              <button onClick={() => setKpiModalAS(null)}><X size={20} className="text-aviva-secondary" /></button>
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

// ─── Approvals ────────────────────────────────────────────────────────────────

interface ApprovalLog {
  approval_id: string;
  source_doc_index: string;
  workflow_type: string;
  current_approver_role: string;
  action_taken: string;
  action_timestamp: string | null;
  approver_email: string | null;
  rejection_comment: string | null;
  amount: number | null;
}

type ApprovalsFilterTab = "pending" | "approved" | "rejected";

function fmtAmt(n: number) {
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

function ApprovalsContent() {
  const user = useCurrentUser();
  const [logs, setLogs] = useState<ApprovalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<ApprovalsFilterTab>("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchLogs = () => {
    supabase.from("approval_logs").select("*")
      .order("action_timestamp", { ascending: false, nullsFirst: true })
      .limit(100)
      .then(({ data }) => { setLogs((data as ApprovalLog[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter((l) => {
    if (filterTab === "pending") return l.action_taken === "Pending";
    if (filterTab === "approved") return l.action_taken === "Approved";
    return l.action_taken === "Rejected";
  });

  const pendingCount = logs.filter((l) => l.action_taken === "Pending").length;

  const handleApprove = async (id: string) => {
    setSaving(true);
    await supabase.from("approval_logs").update({
      action_taken: "Approved",
      action_timestamp: new Date().toISOString(),
      approver_email: user?.email,
    }).eq("approval_id", id);
    setSaving(false);
    fetchLogs();
  };

  const handleReject = async (id: string) => {
    setSaving(true);
    await supabase.from("approval_logs").update({
      action_taken: "Rejected",
      action_timestamp: new Date().toISOString(),
      approver_email: user?.email,
      rejection_comment: rejectComment,
    }).eq("approval_id", id);
    setSaving(false);
    setRejectingId(null);
    setRejectComment("");
    fetchLogs();
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex gap-2">
        {[
          { k: "pending",  l: `รออนุมัติ${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
          { k: "approved", l: "อนุมัติแล้ว" },
          { k: "rejected", l: "ปฏิเสธ" },
        ].map(({ k, l }) => (
          <button key={k} onClick={() => setFilterTab(k as ApprovalsFilterTab)}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              filterTab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <ClipboardCheck size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ไม่มีรายการในหมวดนี้</p>
          </GlassCard>
        ) : (
          filtered.map((log) => (
            <GlassCard key={log.approval_id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-aviva-gold">{log.source_doc_index}</span>
                    {log.amount != null && log.amount > 50000 && (
                      <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <ShieldAlert size={9} /> ต้องอนุมัติ 2 ชั้น
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-aviva-text mt-0.5">{log.workflow_type}</p>
                  <p className="text-xs text-aviva-secondary">ผู้อนุมัติ: {log.current_approver_role}</p>
                  {log.action_timestamp && (
                    <p className="text-[10px] text-aviva-secondary/60">
                      {new Date(log.action_timestamp).toLocaleDateString("th-TH")}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {log.amount != null && <p className="text-sm font-bold text-aviva-gold">{fmtAmt(log.amount)}</p>}
                  <span className={clsx("text-[10px] px-2 py-0.5 rounded-full",
                    log.action_taken === "Pending" ? "bg-yellow-500/20 text-yellow-400" :
                    log.action_taken === "Approved" ? "bg-green-500/20 text-green-400" :
                    "bg-red-500/20 text-red-400"
                  )}>
                    {log.action_taken === "Pending" ? "รออนุมัติ" : log.action_taken === "Approved" ? "อนุมัติแล้ว" : "ปฏิเสธ"}
                  </span>
                </div>
              </div>

              {log.rejection_comment && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                  เหตุผล: {log.rejection_comment}
                </p>
              )}

              {log.action_taken === "Pending" && (
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(log.approval_id)} disabled={saving}
                    className="flex-1 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                    <CheckCircle size={12} /> อนุมัติ
                  </button>
                  <button onClick={() => { setRejectingId(log.approval_id); setRejectComment(""); }} disabled={saving}
                    className="flex-1 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                    <XCircle size={12} /> ปฏิเสธ
                  </button>
                </div>
              )}
            </GlassCard>
          ))
        )}
      </div>

      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เหตุผลการปฏิเสธ</h2>
              <button onClick={() => setRejectingId(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <textarea value={rejectComment} onChange={(e) => setRejectComment(e.target.value)}
              placeholder="ระบุเหตุผล..." rows={3}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
            <button onClick={() => handleReject(rejectingId)} disabled={saving || !rejectComment.trim()}
              className="w-full bg-red-500 text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "ยืนยันการปฏิเสธ"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Materials / Stock ────────────────────────────────────────────────────────

interface Material {
  id: string; name: string; unit: string; unit_price: number;
  quantity: number; min_stock: number; current_stock: number;
  status: string; supplier: string; delivery_date: string;
}
interface PurchaseOrder {
  id: string; po_number: string; supplier_name: string;
  items: { name: string; qty: number; unit: string; unit_price: number }[];
  total_amount: number; status: string; requested_by: string; created_at: string;
}

function MaterialsContent() {
  const user = useCurrentUser();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [activeView, setActiveView] = useState<"stock" | "po">("stock");
  const [loading, setLoading] = useState(true);
  const [showPOModal, setShowPOModal] = useState(false);
  const [poForm, setPoForm] = useState({ supplier_name: "", items: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  const fetchData = () => {
    Promise.all([
      supabase.from("materials").select("*").eq("project_id", PROJECT_ID).order("name"),
      supabase.from("purchase_orders").select("*").eq("project_id", PROJECT_ID).order("created_at", { ascending: false }),
    ]).then(([mRes, pRes]) => {
      setMaterials((mRes.data as Material[]) ?? []);
      setPos((pRes.data as PurchaseOrder[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(() => { fetchData(); }, []);

  const stockStatus = (m: Material) => {
    const cur = m.current_stock ?? 0;
    const min = m.min_stock ?? 0;
    if (cur === 0) return { label: "หมด", cls: "bg-red-500/20 text-red-400" };
    if (cur < min) return { label: "ต่ำ", cls: "bg-yellow-500/20 text-yellow-400" };
    return { label: "OK", cls: "bg-green-500/20 text-green-400" };
  };

  const poStatusLabel: Record<string, { label: string; cls: string }> = {
    draft:            { label: "ร่าง",         cls: "bg-gray-500/20 text-gray-400" },
    pending_approval: { label: "รออนุมัติ",     cls: "bg-yellow-500/20 text-yellow-400" },
    approved:         { label: "อนุมัติแล้ว",   cls: "bg-green-500/20 text-green-400" },
    received:         { label: "รับของแล้ว",    cls: "bg-blue-500/20 text-blue-400" },
    cancelled:        { label: "ยกเลิก",        cls: "bg-red-500/20 text-red-400" },
  };

  const handleCreatePO = async () => {
    if (!poForm.supplier_name || !poForm.items) return;
    setSaving(true);
    let parsedItems = [];
    try { parsedItems = JSON.parse(poForm.items); } catch { parsedItems = [{ name: poForm.items, qty: 1, unit: "ชิ้น", unit_price: 0 }]; }
    const total = parsedItems.reduce((s: number, i: { qty: number; unit_price: number }) => s + (i.qty * i.unit_price), 0);
    await supabase.from("purchase_orders").insert({
      project_id: PROJECT_ID,
      supplier_name: poForm.supplier_name,
      items: parsedItems,
      total_amount: total,
      status: "draft",
      requested_by: user?.full_name ?? user?.email ?? "Unknown",
      notes: poForm.notes,
    });
    setSaving(false);
    setShowPOModal(false);
    setPoForm({ supplier_name: "", items: "", notes: "" });
    fetchData();
  };

  const handlePOApprove = async (id: string) => {
    await supabase.from("purchase_orders").update({ status: "approved", approved_by: user?.full_name, approved_at: new Date().toISOString() }).eq("id", id);
    fetchData();
  };

  const lowStockCount = materials.filter(m => (m.current_stock ?? 0) < (m.min_stock ?? 0)).length;

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center">
          <Package size={14} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-lg font-bold text-aviva-text">{materials.length}</p>
          <p className="text-[10px] text-aviva-secondary">รายการวัสดุ</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <AlertTriangle size={14} className="text-yellow-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-yellow-400">{lowStockCount}</p>
          <p className="text-[10px] text-aviva-secondary">สต๊อกต่ำ</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <FileText size={14} className="text-blue-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-blue-400">{pos.filter(p => p.status === "pending_approval").length}</p>
          <p className="text-[10px] text-aviva-secondary">รออนุมัติ PO</p>
        </GlassCard>
      </div>

      {/* View tabs */}
      <div className="flex gap-2">
        {[{ k: "stock", l: "สต๊อกวัสดุ" }, { k: "po", l: "ใบสั่งซื้อ" }].map(({ k, l }) => (
          <button key={k} onClick={() => setActiveView(k as "stock" | "po")}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              activeView === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
        {(user?.isManager || user?.isAdmin) && (
          <button onClick={() => setShowPOModal(true)}
            className="flex items-center gap-1 bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/30 px-3 py-2 rounded-xl text-xs font-medium">
            <Plus size={12} /> PO
          </button>
        )}
      </div>

      {/* Stock View */}
      {activeView === "stock" && (
        <div className="space-y-2">
          {loading ? [1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-aviva-card/50 animate-pulse" />) :
           materials.map(m => {
            const st = stockStatus(m);
            return (
              <GlassCard key={m.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-aviva-card flex items-center justify-center flex-shrink-0">
                    <Package size={16} className="text-aviva-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-aviva-text font-medium truncate">{m.name}</p>
                    <p className="text-[10px] text-aviva-secondary">
                      สต๊อก: {m.current_stock ?? 0} {m.unit} · ขั้นต่ำ: {m.min_stock ?? 0} {m.unit}
                    </p>
                  </div>
                  <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full", st.cls)}>{st.label}</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* PO View */}
      {activeView === "po" && (
        <div className="space-y-2">
          {loading ? [1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-aviva-card/50 animate-pulse" />) :
           pos.length === 0 ? (
            <GlassCard className="p-8 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีใบสั่งซื้อ</p></GlassCard>
           ) : pos.map(po => {
            const stConf = poStatusLabel[po.status] ?? { label: po.status, cls: "bg-gray-500/20 text-gray-400" };
            const isExpanded = expandedPO === po.id;
            return (
              <GlassCard key={po.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-aviva-gold">{po.po_number ?? "—"}</span>
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full", stConf.cls)}>{stConf.label}</span>
                    </div>
                    <p className="text-sm text-aviva-text mt-0.5">{po.supplier_name}</p>
                    <p className="text-[10px] text-aviva-secondary">โดย {po.requested_by} · ฿{(po.total_amount ?? 0).toLocaleString("th-TH")}</p>
                  </div>
                  <button onClick={() => setExpandedPO(isExpanded ? null : po.id)} className="text-aviva-secondary/50 mt-1">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {isExpanded && Array.isArray(po.items) && (
                  <div className="bg-aviva-bg rounded-xl p-2 space-y-1">
                    {po.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-aviva-secondary">{item.name} × {item.qty} {item.unit}</span>
                        <span className="text-aviva-text">฿{(item.qty * item.unit_price).toLocaleString("th-TH")}</span>
                      </div>
                    ))}
                  </div>
                )}
                {po.status === "pending_approval" && (user?.isManager || user?.isAdmin) && (
                  <button onClick={() => handlePOApprove(po.id)}
                    className="w-full py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                    <CheckCircle size={12} /> อนุมัติ PO
                  </button>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Create PO Modal */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">สร้างใบสั่งซื้อ (PO)</h2>
              <button onClick={() => setShowPOModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อผู้จำหน่าย *</label>
                <input value={poForm.supplier_name} onChange={e => setPoForm(p => ({ ...p, supplier_name: e.target.value }))}
                  placeholder="บ. วัสดุก่อสร้าง จก." className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายการวัสดุ *</label>
                <textarea value={poForm.items} onChange={e => setPoForm(p => ({ ...p, items: e.target.value }))}
                  placeholder={'[{"name":"เหล็กเส้น 12mm","qty":100,"unit":"เส้น","unit_price":85}]'}
                  rows={3} className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมายเหตุ</label>
                <input value={poForm.notes} onChange={e => setPoForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="หมายเหตุเพิ่มเติม" className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <button onClick={handleCreatePO} disabled={saving || !poForm.supplier_name}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "สร้าง PO"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

interface PayrollEmployee extends Employee {
  commission_amount?: number;
  sso?: number;
  net?: number;
}

function PayrollContent() {
  const user = useCurrentUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [payslipEmp, setPayslipEmp] = useState<PayrollEmployee | null>(null);
  const [specialIncomes, setSpecialIncomes] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("employees").select("*").eq("status", "active")
      .order("department")
      .then(({ data }) => { setEmployees((data as Employee[]) ?? []); setLoading(false); });
  }, []);

  const calcSSO = (base: number) => Math.min(base * 0.05, 750);
  const calcCommission = (emp: Employee) => 0;

  const calcPayroll = (emp: Employee): PayrollEmployee => {
    const special = parseFloat(specialIncomes[emp.id] ?? "0") || 0;
    const commission = calcCommission(emp);
    const sso = calcSSO(emp.base_salary);
    const gross = emp.base_salary + commission + special;
    const tax = gross > 26000 ? Math.round((gross - 26000) * 0.05) : 0;
    return { ...emp, commission_amount: commission, sso, net: gross - sso - tax };
  };

  const totalNetPayroll = employees.reduce((sum, emp) => sum + (calcPayroll(emp).net ?? 0), 0);

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-aviva-secondary mb-1 block">เดือนที่คำนวณ</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
        </div>
        <div className="text-right mt-4">
          <p className="text-[10px] text-aviva-secondary">เงินเดือนรวมสุทธิ</p>
          <p className="text-lg font-bold text-aviva-gold">฿{totalNetPayroll.toLocaleString("th-TH")}</p>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? [1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-aviva-card/50 animate-pulse" />) :
         employees.map(emp => {
          const pr = calcPayroll(emp);
          return (
            <GlassCard key={emp.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-aviva-text font-medium">{emp.full_name}</p>
                  <p className="text-[10px] text-aviva-secondary">{emp.department} · {emp.position}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-aviva-gold">฿{(pr.net ?? 0).toLocaleString("th-TH")}</p>
                  <p className="text-[10px] text-aviva-secondary">สุทธิ</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div className="bg-aviva-bg/50 rounded-lg p-1.5 text-center">
                  <p className="text-aviva-secondary">เงินเดือน</p>
                  <p className="text-aviva-text font-medium">฿{emp.base_salary.toLocaleString("th-TH")}</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-lg p-1.5 text-center">
                  <p className="text-aviva-secondary">ประกันสังคม</p>
                  <p className="text-red-400 font-medium">-฿{(pr.sso ?? 0).toLocaleString("th-TH")}</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-lg p-1.5 text-center">
                  <p className="text-aviva-secondary">รายได้พิเศษ</p>
                  <input type="number" value={specialIncomes[emp.id] ?? ""}
                    onChange={e => setSpecialIncomes(p => ({ ...p, [emp.id]: e.target.value }))}
                    placeholder="0"
                    className="w-full text-center text-aviva-text bg-transparent outline-none text-[10px]" />
                </div>
              </div>
              <button onClick={() => setPayslipEmp(pr)}
                className="w-full py-1.5 bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                <Printer size={11} /> ดูสลิปเงินเดือน
              </button>
            </GlassCard>
          );
        })}
      </div>

      {/* Payslip Modal */}
      {payslipEmp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 print-area">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">สลิปเงินเดือน</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="text-xs text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Printer size={11} /> พิมพ์
                </button>
                <button onClick={() => setPayslipEmp(null)}><X size={18} className="text-aviva-secondary" /></button>
              </div>
            </div>
            <div className="text-center border-b border-aviva-gold/20 pb-3">
              <p className="text-xs font-bold text-aviva-gold tracking-widest">AVIVA ONE</p>
              <p className="text-xs text-aviva-secondary mt-0.5">สลิปเงินเดือนประจำเดือน {month}</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-aviva-secondary">ชื่อ-สกุล</span>
                <span className="text-aviva-text font-medium">{payslipEmp.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aviva-secondary">ตำแหน่ง</span>
                <span className="text-aviva-text">{payslipEmp.position}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aviva-secondary">แผนก</span>
                <span className="text-aviva-text">{payslipEmp.department}</span>
              </div>
            </div>
            <div className="border-t border-aviva-gold/10 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-aviva-secondary">เงินเดือนพื้นฐาน</span>
                <span className="text-aviva-text">฿{payslipEmp.base_salary.toLocaleString("th-TH")}</span>
              </div>
              {(payslipEmp.commission_amount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-aviva-secondary">ค่าคอมมิชชั่น</span>
                  <span className="text-green-400">+฿{(payslipEmp.commission_amount ?? 0).toLocaleString("th-TH")}</span>
                </div>
              )}
              {(specialIncomes[payslipEmp.id] && parseFloat(specialIncomes[payslipEmp.id]) > 0) && (
                <div className="flex justify-between">
                  <span className="text-aviva-secondary">รายได้พิเศษ</span>
                  <span className="text-green-400">+฿{parseFloat(specialIncomes[payslipEmp.id]).toLocaleString("th-TH")}</span>
                </div>
              )}
              <div className="flex justify-between text-red-400">
                <span>หัก: ประกันสังคม (5%, สูงสุด ฿750)</span>
                <span>-฿{(payslipEmp.sso ?? 0).toLocaleString("th-TH")}</span>
              </div>
              <div className="flex justify-between font-bold text-aviva-gold border-t border-aviva-gold/20 pt-2 mt-1">
                <span>เงินได้สุทธิ</span>
                <span>฿{(payslipEmp.net ?? 0).toLocaleString("th-TH")}</span>
              </div>
            </div>
            <p className="text-[10px] text-aviva-secondary/40 text-center">เอกสารนี้ออกโดยระบบ AVIVA ONE · {new Date().toLocaleDateString("th-TH")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Community (ค่าส่วนกลาง) ─────────────────────────────────────────────────

interface CommunityMember {
  member_id: string;
  house_id: string | null;
  owner_name: string;
  owner_phone: string;
  area_sqw: number;
  annual_fee: number;
  fee_status: string;
  transferred_at: string | null;
}

function CommunityContent() {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ owner_name: "", owner_phone: "", area_sqw: "" });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "Paid" | "Unpaid">("all");

  const fetchMembers = () => {
    supabase.from("community_members").select("*").order("owner_name")
      .then(({ data }) => { setMembers((data as CommunityMember[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchMembers(); }, []);

  const fmtFee = (n: number) => `฿${Number(n).toLocaleString("th-TH")}`;
  const totalFee = members.reduce((s, m) => s + Number(m.annual_fee), 0);
  const paidCount = members.filter((m) => m.fee_status === "Paid").length;
  const unpaidCount = members.filter((m) => m.fee_status === "Unpaid").length;
  const filtered = filterStatus === "all" ? members : members.filter((m) => m.fee_status === filterStatus);

  const handleAdd = async () => {
    if (!form.owner_name || !form.area_sqw) return;
    setSaving(true);
    await supabase.from("community_members").insert({
      owner_name: form.owner_name,
      owner_phone: form.owner_phone,
      area_sqw: Number(form.area_sqw),
      fee_status: "Unpaid",
    });
    setSaving(false);
    setShowModal(false);
    setForm({ owner_name: "", owner_phone: "", area_sqw: "" });
    fetchMembers();
  };

  const handleMarkPaid = async (id: string) => {
    await supabase.from("community_members").update({ fee_status: "Paid" }).eq("member_id", id);
    fetchMembers();
  };

  return (
    <>
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-aviva-secondary">
          {loading ? "กำลังโหลด..." : `${members.length} สมาชิก · รวม ${fmtFee(totalFee)}`}
        </p>
        <button onClick={() => { setForm({ owner_name: "", owner_phone: "", area_sqw: "" }); setShowModal(true); }}
          className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
          <Plus size={14} /> เพิ่มสมาชิก
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <GlassCard className="p-3 text-center">
          <Users size={16} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-xl font-bold text-aviva-text">{members.length}</p>
          <p className="text-[10px] text-aviva-secondary">สมาชิกทั้งหมด</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <CheckCircle size={16} className="text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-400">{paidCount}</p>
          <p className="text-[10px] text-aviva-secondary">ชำระแล้ว</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <DollarSign size={16} className="text-red-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-red-400">{unpaidCount}</p>
          <p className="text-[10px] text-aviva-secondary">ค้างชำระ</p>
        </GlassCard>
      </div>

      <div className="flex gap-2">
        {[{ k: "all", l: "ทั้งหมด" }, { k: "Unpaid", l: "ค้างชำระ" }, { k: "Paid", l: "ชำระแล้ว" }].map(({ k, l }) => (
          <button key={k} onClick={() => setFilterStatus(k as "all" | "Paid" | "Unpaid")}
            className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
              filterStatus === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
      </div>

      <div className="space-y-3">
        <SectionHeader title="ทะเบียนสมาชิก" subtitle="ค่าส่วนกลาง = พื้นที่ × ฿30/ตร.ว." />
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Home size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีสมาชิก</p>
          </GlassCard>
        ) : (
          filtered.map((m) => (
            <GlassCard key={m.member_id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-aviva-text">{m.owner_name}</p>
                  {m.owner_phone && <p className="text-xs text-aviva-secondary">{m.owner_phone}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-aviva-secondary">{m.area_sqw} ตร.ว.</span>
                    <span className="text-xs font-medium text-aviva-gold">{fmtFee(Number(m.annual_fee))}/ปี</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={clsx("text-[10px] px-2 py-0.5 rounded-full",
                    m.fee_status === "Paid" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {m.fee_status === "Paid" ? "ชำระแล้ว" : "ค้างชำระ"}
                  </span>
                  {m.fee_status === "Unpaid" && (
                    <button onClick={() => handleMarkPaid(m.member_id)}
                      className="text-[10px] bg-aviva-gold/20 text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg">
                      บันทึกรับชำระ
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>

    {showModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-aviva-text">เพิ่มสมาชิกใหม่</h2>
            <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ชื่อเจ้าของ *</label>
              <input type="text" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                placeholder="ชื่อ-นามสกุล"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร</label>
              <input type="tel" value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                placeholder="0XX-XXX-XXXX"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">พื้นที่ (ตร.ว.) *</label>
              <input type="number" value={form.area_sqw} onChange={(e) => setForm({ ...form, area_sqw: e.target.value })}
                placeholder="50"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              {form.area_sqw && (
                <p className="text-xs text-aviva-gold mt-1">ค่าส่วนกลางต่อปี: ฿{(Number(form.area_sqw) * 30).toLocaleString("th-TH")}</p>
              )}
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving || !form.owner_name || !form.area_sqw}
            className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "เพิ่มสมาชิก"}
          </button>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Documents (เอกสาร) ───────────────────────────────────────────────────────

interface OfficeDocument {
  id: string;
  doc_number?: string;
  name: string;
  category: string;
  status: "pending" | "approved" | "rejected";
  uploaded_by: string;
  approved_by: string | null;
  created_at: string;
}

type DocFilterCat = "all" | "Contract" | "Loan" | "Permit" | "Utility";

const docStatusConfig = {
  approved: { label: "อนุมัติแล้ว", icon: CheckCircle, color: "text-green-400", bg: "border-green-400/20" },
  pending:  { label: "รออนุมัติ",   icon: Clock,        color: "text-yellow-400", bg: "border-yellow-400/20" },
  rejected: { label: "ปฏิเสธ",      icon: XCircle,      color: "text-red-400",    bg: "border-red-400/20" },
};

const docCategoryStyle: Record<string, string> = {
  Contract: "bg-purple-500/20 text-purple-400",
  Loan:     "bg-blue-500/20 text-blue-400",
  Permit:   "bg-orange-500/20 text-orange-400",
  Utility:  "bg-teal-500/20 text-teal-400",
  Other:    "bg-gray-500/20 text-gray-400",
};

const docCategoryTh: Record<string, string> = {
  Contract: "สัญญา",
  Loan:     "สินเชื่อ",
  Permit:   "ใบอนุญาต",
  Utility:  "สาธารณูปโภค",
  Other:    "อื่นๆ",
};

function DocumentsContent() {
  const [docs, setDocs] = useState<OfficeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DocFilterCat>("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Contract", uploaded_by: "Admin", file_url: "" });
  const [saving, setSaving] = useState(false);

  const fetchDocs = () => {
    supabase.from("documents").select("*").eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setDocs((data as OfficeDocument[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchDocs(); }, []);

  const counts = {
    approved: docs.filter(d => d.status === "approved").length,
    pending:  docs.filter(d => d.status === "pending").length,
  };

  const filtered = docs.filter(
    d => (filter === "all" || d.category === filter) &&
      (search === "" || d.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    await supabase.from("documents").insert({
      project_id: PROJECT_ID,
      name: form.name,
      category: form.category,
      uploaded_by: form.uploaded_by,
      file_url: form.file_url || null,
      status: "pending",
    });
    setSaving(false);
    setShowModal(false);
    setForm({ name: "", category: "Contract", uploaded_by: "Admin", file_url: "" });
    fetchDocs();
  };

  const handleApprove = async (id: string, approve: boolean) => {
    await supabase.from("documents").update({
      status: approve ? "approved" : "rejected",
      approved_by: "Admin",
    }).eq("id", id);
    fetchDocs();
  };

  return (
    <>
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-aviva-secondary">
          {loading ? "กำลังโหลด..." : `${docs.length} ไฟล์`}
        </p>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
          <Upload size={13} /> เพิ่มเอกสาร
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center">
          <CheckCircle size={16} className="text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-400">{loading ? "—" : counts.approved}</p>
          <p className="text-[10px] text-aviva-secondary">อนุมัติแล้ว</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <Clock size={16} className="text-yellow-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-yellow-400">{loading ? "—" : counts.pending}</p>
          <p className="text-[10px] text-aviva-secondary">รออนุมัติ</p>
        </GlassCard>
        <GlassCard gold className="p-3 text-center">
          <FolderOpen size={16} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-xl font-bold text-aviva-gold">{loading ? "—" : docs.length}</p>
          <p className="text-[10px] text-aviva-secondary">ทั้งหมด</p>
        </GlassCard>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
        <input
          type="text"
          placeholder="ค้นหาเอกสาร..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/40"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "Contract", "Loan", "Permit", "Utility"] as DocFilterCat[]).map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={clsx("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              filter === cat ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>
            {cat === "all" ? "ทั้งหมด" : docCategoryTh[cat]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <SectionHeader title={`เอกสาร (${filtered.length})`} />
        {loading
          ? [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-aviva-card/50 animate-pulse" />)
          : filtered.length === 0
          ? (
            <GlassCard className="p-8 text-center">
              <p className="text-aviva-secondary text-sm">ไม่พบเอกสาร</p>
            </GlassCard>
          )
          : filtered.map((doc) => {
              const sConf = docStatusConfig[doc.status] ?? docStatusConfig.pending;
              const Icon = sConf.icon;
              return (
                <GlassCard key={doc.id} className={clsx("p-3 border", sConf.bg)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-aviva-card flex items-center justify-center flex-shrink-0">
                      <FolderOpen size={16} className="text-aviva-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {doc.doc_number && (
                          <span className="text-[10px] font-bold text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-md border border-aviva-gold/20 flex-shrink-0">
                            {doc.doc_number}
                          </span>
                        )}
                        <p className="text-sm text-aviva-text font-medium truncate">{doc.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", docCategoryStyle[doc.category])}>
                          {docCategoryTh[doc.category] ?? doc.category}
                        </span>
                        <span className="text-[10px] text-aviva-secondary">{doc.uploaded_by}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <Icon size={14} className={sConf.color} />
                      <span className={clsx("text-[10px] font-medium", sConf.color)}>{sConf.label}</span>
                    </div>
                  </div>
                  {doc.status === "pending" && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleApprove(doc.id, true)}
                        className="flex-1 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium">
                        อนุมัติ
                      </button>
                      <button onClick={() => handleApprove(doc.id, false)}
                        className="flex-1 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium">
                        ปฏิเสธ
                      </button>
                    </div>
                  )}
                </GlassCard>
              );
            })}
      </div>
    </div>

    {showModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-aviva-text">เพิ่มเอกสาร</h2>
            <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ชื่อเอกสาร *</label>
              <input type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น สัญญาจะซื้อจะขาย บ้านเลข A-01"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {["Contract","Loan","Permit","Utility","Other"].map(c =>
                    <option key={c} value={c}>{docCategoryTh[c] ?? c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">อัปโหลดโดย</label>
                <input type="text" value={form.uploaded_by}
                  onChange={(e) => setForm({ ...form, uploaded_by: e.target.value })}
                  placeholder="ชื่อผู้อัปโหลด"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ลิงค์ไฟล์ (Google Drive / URL)</label>
              <input type="url" value={form.file_url}
                onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                placeholder="https://drive.google.com/..."
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !form.name}
            className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "เพิ่มเอกสาร"}
          </button>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS: { key: OfficeTab; label: string; managerOnly?: boolean; constructionOnly?: boolean; adminOnly?: boolean }[] = [
  { key: "finance",     label: "การเงิน" },
  { key: "accounting",  label: "บัญชี" },
  { key: "marketing",   label: "การตลาด" },
  { key: "hr",          label: "บุคคล" },
  { key: "after-sales", label: "หลังการขาย" },
  { key: "approvals",   label: "อนุมัติ",    managerOnly: true },
  { key: "materials",   label: "คลังวัสดุ",  constructionOnly: true },
  { key: "payroll",     label: "เงินเดือน",  managerOnly: true },
  { key: "documents",   label: "เอกสาร" },
  { key: "community",   label: "ค่าส่วนกลาง", adminOnly: true },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OfficePage() {
  const user = useCurrentUser();
  const [activeTab, setActiveTab] = useState<OfficeTab>("finance");

  const isConstruction = user?.department === "ฝ่ายก่อสร้าง";
  const visibleTabs = TABS.filter(t => {
    if (t.adminOnly && !user?.isAdmin) return false;
    if (t.managerOnly && !user?.isManager && !user?.isAdmin) return false;
    if (t.constructionOnly && !isConstruction && !user?.isManager && !user?.isAdmin) return false;
    return true;
  });

  useEffect(() => {
    if (user?.department === "ฝ่ายบัญชี") setActiveTab("accounting");
    else if (user?.department === "ฝ่ายการเงิน") setActiveTab("finance");
    else if (user?.department === "ฝ่ายบุคคล") setActiveTab("hr");
    else if (user?.department === "ฝ่ายการตลาด") setActiveTab("marketing");
    else if (user?.department === "ฝ่ายหลังการขาย") setActiveTab("after-sales");
  }, [user]);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {/* Sticky tab header */}
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-3">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-aviva-text mb-3">ออฟฟิศ</h1>
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {visibleTabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={clsx(
                  "flex-shrink-0 py-2 px-3 rounded-xl text-[11px] font-semibold border transition-all whitespace-nowrap",
                  activeTab === key
                    ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                    : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conditional content */}
      {activeTab === "finance"     && <FinanceContent />}
      {activeTab === "accounting"  && <AccountingContent />}
      {activeTab === "marketing"   && <MarketingContent />}
      {activeTab === "hr"          && <HRContent />}
      {activeTab === "after-sales" && <AfterSalesContent />}
      {activeTab === "approvals"   && <ApprovalsContent />}
      {activeTab === "materials"   && <MaterialsContent />}
      {activeTab === "payroll"     && <PayrollContent />}
      {activeTab === "community"   && <CommunityContent />}
      {activeTab === "documents"   && <DocumentsContent />}
    </div>
  );
}
