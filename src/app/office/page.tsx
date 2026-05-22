"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, X, Clock, ClipboardCheck,
  Receipt, FileText, Users, Phone, Briefcase, AlertCircle, Megaphone,
  Sparkles, Wrench, CheckCircle, AlertTriangle, Star, Download,
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

type OfficeTab = "finance" | "accounting" | "marketing" | "hr" | "after-sales";

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
        <GlassCard className="p-3 text-center">
          <TrendingUp size={16} className="text-green-400 mx-auto mb-1" />
          <p className="text-base font-bold text-green-400">{formatM(totalIncome || 0)}</p>
          <p className="text-[10px] text-aviva-secondary mt-0.5">รายรับรวม</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <TrendingDown size={16} className="text-red-400 mx-auto mb-1" />
          <p className="text-base font-bold text-red-400">{formatM(totalExpenses || 0)}</p>
          <p className="text-[10px] text-aviva-secondary mt-0.5">รายจ่ายรวม</p>
        </GlassCard>
        <GlassCard gold className="p-3 text-center">
          <DollarSign size={16} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-base font-bold text-aviva-gold">{formatM(netCashflow || 0)}</p>
          <p className="text-[10px] text-aviva-secondary mt-0.5">Net Cashflow</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <ClipboardCheck size={16} className="text-yellow-400 mx-auto mb-1" />
          <p className="text-base font-bold text-yellow-400">{pendingApprovals}</p>
          <p className="text-[10px] text-aviva-secondary mt-0.5">รออนุมัติ</p>
        </GlassCard>
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
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
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
        <GlassCard className="p-3 text-center">
          <Receipt size={14} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-lg font-bold text-aviva-text">{receipts.length}</p>
          <p className="text-[10px] text-aviva-secondary mt-0.5">ใบเสร็จทั้งหมด</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <TrendingUp size={14} className="text-green-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-green-400">{formatM(totalIncome)}</p>
          <p className="text-[10px] text-aviva-secondary mt-0.5">รายรับทั้งหมด</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <TrendingDown size={14} className="text-red-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-red-400">{formatM(totalExpense)}</p>
          <p className="text-[10px] text-aviva-secondary mt-0.5">รายจ่ายทั้งหมด</p>
        </GlassCard>
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
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto">
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

const emptyCampaignForm = { name: "", platform: "Facebook", budget: "", start_date: "", end_date: "" };

function MarketingContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "Facebook" | "TikTok" | "Google">("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyCampaignForm);
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

  useEffect(() => { fetchCampaigns(); }, [mktStart, mktEnd]);

  const filtered = filter === "all" ? campaigns : campaigns.filter(c => c.platform === filter);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads_generated, 0);
  const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgROI = campaigns.length
    ? Math.round(campaigns.reduce((s, c) => s + roi(c), 0) / campaigns.length)
    : 0;

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
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyCampaignForm);
    fetchCampaigns();
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

      <AIInsightPanel
        type="success"
        priority="medium"
        title="AI: Facebook ROI สูงสุด"
        message="แคมเปญ Facebook มี ROI เฉลี่ยสูงสุด แนะนำเพิ่มงบอีก 20% และทดสอบ Creative ใหม่ในกลุ่มเป้าหมาย 35-50 ปีครับ"
      />

      <PeriodFilter period={mktPeriod} onChange={(p, s, e) => { setMktPeriod(p); setMktStart(s); setMktEnd(e); }} />

      {/* Add button */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm"
      >
        <Plus size={16} /> สร้างแคมเปญ
      </button>

      {/* Platform Filter */}
      <div>
        <SectionHeader title="แคมเปญ" subtitle="กรองตาม Platform" />
        <div className="flex gap-2 mb-4">
          {(["all", "Facebook", "TikTok", "Google"] as const).map(p => (
            <button key={p} onClick={() => setFilter(p)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                filter === p
                  ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                  : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>
              {p === "all" ? "ทั้งหมด" : p}
            </button>
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
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-aviva-text">{c.name}</h3>
                          <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", statusStyle[c.status] ?? "bg-gray-500/20 text-gray-400")}>
                            {statusLabel[c.status] ?? c.status}
                          </span>
                        </div>
                        <span className={clsx("text-xs font-medium", pStyle.color)}>{c.platform}</span>
                      </div>
                      <div className="text-right">
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
                      value={spentPct}
                      color={spentPct > 90 ? "red" : "gold"}
                    />
                  </GlassCard>
                );
              })
          }
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
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
    </div>
  );
}

// ─── HR ───────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
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
        <GlassCard className="p-3 text-center">
          <Users size={14} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-xl font-bold text-aviva-text">{active.length}</p>
          <p className="text-[10px] text-aviva-secondary mt-0.5">พนักงานทั้งหมด</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <Clock size={14} className="text-yellow-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-yellow-400">{probationAlerts.length}</p>
          <p className="text-[10px] text-aviva-secondary mt-0.5">ทดลองงาน</p>
        </GlassCard>
        <GlassCard gold className="p-3 text-center">
          <DollarSign size={14} className="text-aviva-gold mx-auto mb-1" />
          <p className="text-xl font-bold text-aviva-gold">
            {formatM(active.reduce((s, e) => s + Number(e.base_salary), 0))}
          </p>
          <p className="text-[10px] text-aviva-secondary mt-0.5">เงินเดือนรวม</p>
        </GlassCard>
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
                    <div className="flex items-center gap-2 flex-wrap">
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
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto">
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
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto">
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

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS: { key: OfficeTab; label: string }[] = [
  { key: "finance",     label: "การเงิน" },
  { key: "accounting",  label: "บัญชี" },
  { key: "marketing",   label: "การตลาด" },
  { key: "hr",          label: "บุคคล" },
  { key: "after-sales", label: "หลังการขาย" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OfficePage() {
  const user = useCurrentUser();
  const [activeTab, setActiveTab] = useState<OfficeTab>("finance");

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
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-0">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-aviva-text mb-3">ออฟฟิศ</h1>
          <div className="flex gap-2 overflow-x-auto pb-3" style={{ scrollbarWidth: "none" }}>
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={clsx(
                  "flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap",
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
    </div>
  );
}
