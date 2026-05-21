"use client";

import { useEffect, useState, useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, Plus, X, Clock, Pencil } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ProgressBar from "@/components/ProgressBar";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/audit";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

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

const CATEGORIES = ["ค่าก่อสร้าง", "ค่าวัสดุ", "ค่าการตลาด", "เงินเดือน", "ค่าดำเนินการ", "รายรับจากการขาย", "อื่นๆ"];
const MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

const emptyForm = { transaction_type: "expense", amount: "", description: "", category: "ค่าก่อสร้าง", needs_approval: false };

function formatM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `฿${(Math.abs(n) / 1_000_000).toFixed(1)}M`;
  return `฿${Math.abs(n).toLocaleString("th-TH")}`;
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"txn" | "approval">("txn");
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);

  const fetchData = () => {
    supabase.from("finance_transactions").select("*").eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => { setTransactions((data as Transaction[]) ?? []); setLoading(false); });
    supabase.from("approvals").select("*").eq("module", "finance")
      .order("created_at", { ascending: false })
      .then(({ data }) => setApprovals((data as Approval[]) ?? []));
  };

  useEffect(() => { fetchData(); }, []);

  const totalIncome = transactions.filter(t => t.transaction_type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.transaction_type === "expense").reduce((a, t) => a + Number(t.amount), 0);
  const netCashflow = totalIncome - totalExpense;
  const totalExpenses = Math.abs(totalExpense);
  const pendingApprovals = approvals.filter(a => a.status === "pending").length;

  const chartData = useMemo(() => {
    const monthly: Record<string, { month: string; income: number; expense: number }> = {};
    transactions.forEach(t => {
      const d = new Date(t.created_at);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthly[k]) monthly[k] = { month: MONTHS[d.getMonth()], income: 0, expense: 0 };
      const amt = Number(t.amount) / 1_000_000;
      if (t.transaction_type === "income") monthly[k].income += amt;
      else monthly[k].expense += Math.abs(amt);
    });
    return Object.values(monthly).slice(-6);
  }, [transactions]);

  const openEdit = (tx: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTxn(tx);
    setForm({ transaction_type: tx.transaction_type, amount: String(Math.abs(Number(tx.amount))), description: tx.description, category: "อื่นๆ", needs_approval: false });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.description) return;
    setSaving(true);
    const amt = Number(form.amount);
    if (editingTxn) {
      await supabase.from("finance_transactions").update({
        transaction_type: form.transaction_type,
        amount: form.transaction_type === "expense" ? -amt : amt,
        description: `[${form.category}] ${form.description}`,
        updated_at: new Date().toISOString(),
      }).eq("id", editingTxn.id);
      await logAction("finance", "edit_transaction", `แก้ไขรายการ ${form.transaction_type} ฿${amt.toLocaleString()} — ${form.description}`, editingTxn.id);
    } else if (amt >= 100000) {
      const { data } = await supabase.from("approvals").insert({ module: "finance", reference_type: "transaction", amount: amt, description: `[${form.category}] ${form.description}`, status: "pending", requested_by: "Admin" }).select().single();
      await logAction("finance", "request_approval", `ขออนุมัติ ฿${amt.toLocaleString()} — ${form.description}`, data?.id);
    } else {
      const { data } = await supabase.from("finance_transactions").insert({ project_id: PROJECT_ID, transaction_type: form.transaction_type, amount: form.transaction_type === "expense" ? -amt : amt, description: `[${form.category}] ${form.description}` }).select().single();
      await logAction("finance", "add_transaction", `เพิ่มรายการ ${form.transaction_type} ฿${amt.toLocaleString()} — ${form.description}`, data?.id);
    }
    setSaving(false); setShowModal(false); setEditingTxn(null); setForm(emptyForm); fetchData();
  };

  const handleApprove = async (id: string, approved: boolean) => {
    const approval = approvals.find(a => a.id === id);
    if (!approval) return;
    await supabase.from("approvals").update({ status: approved ? "approved" : "rejected", approved_by: "Admin", approved_at: new Date().toISOString() }).eq("id", id);
    if (approved) await supabase.from("finance_transactions").insert({ project_id: PROJECT_ID, transaction_type: "expense", amount: -approval.amount, description: approval.description });
    await logAction("finance", approved ? "approve" : "reject", `${approved ? "อนุมัติ" : "ปฏิเสธ"} ฿${approval.amount.toLocaleString()} — ${approval.description}`, id);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">การเงิน</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : "Real-time จาก Supabase"}
                {pendingApprovals > 0 && <span className="ml-2 bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full text-[10px]">รออนุมัติ {pendingApprovals}</span>}
              </p>
            </div>
            <button onClick={() => { setEditingTxn(null); setForm(emptyForm); setShowModal(true); }}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
              <Plus size={14} /> เพิ่มรายการ
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-3 text-center">
            <TrendingUp size={16} className="text-green-400 mx-auto mb-1" />
            <p className="text-base font-bold text-green-400">{formatM(totalIncome)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายรับรวม</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <TrendingDown size={16} className="text-red-400 mx-auto mb-1" />
            <p className="text-base font-bold text-red-400">{formatM(totalExpenses)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายจ่ายรวม</p>
          </GlassCard>
          <GlassCard gold className="p-3 text-center">
            <DollarSign size={16} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-base font-bold text-aviva-gold">{formatM(netCashflow)}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">Net Cashflow</p>
          </GlassCard>
        </div>

        <GlassCard className="p-4">
          <SectionHeader title="Cashflow รายเดือน" subtitle="หน่วย: ล้านบาท" />
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: "#D1D5DB", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#D1D5DB", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#17332D", border: "1px solid #D4AF37", borderRadius: "8px", color: "#fff", fontSize: "12px" }} />
                <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} fill="url(#incomeGrad)" name="รายรับ" />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" name="รายจ่าย" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <SectionHeader title="งบประมาณ" subtitle="การใช้จ่ายต่อหมวด" />
          <div className="space-y-4">
            <ProgressBar label="ค่าก่อสร้าง" value={totalExpenses * 0.5} max={200_000_000} sublabel={`${formatM(totalExpenses * 0.5)} / ${formatM(200_000_000)}`} />
            <ProgressBar label="การตลาด" value={totalExpenses * 0.2} max={50_000_000} sublabel={`${formatM(totalExpenses * 0.2)} / ${formatM(50_000_000)}`} />
            <ProgressBar label="ค่าดำเนินการ" value={totalExpenses * 0.1} max={20_000_000} sublabel={`${formatM(totalExpenses * 0.1)} / ${formatM(20_000_000)}`} />
          </div>
        </GlassCard>

        <div className="flex gap-2">
          {[{ k: "txn", l: "รายการทั้งหมด" }, { k: "approval", l: `รออนุมัติ${pendingApprovals > 0 ? ` (${pendingApprovals})` : ""}` }].map(({ k, l }) => (
            <button key={k} onClick={() => setActiveTab(k as "txn" | "approval")}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                activeTab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>{l}</button>
          ))}
        </div>

        {activeTab === "txn" && (
          <div className="space-y-2">
            <SectionHeader title="รายการล่าสุด" />
            {loading ? [1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-aviva-card/50 animate-pulse" />) : (
              transactions.length === 0
                ? <GlassCard className="p-6 text-center"><p className="text-aviva-secondary text-sm">ยังไม่มีรายการ</p></GlassCard>
                : transactions.map((tx) => (
                  <GlassCard key={tx.id} className="p-3 flex items-center gap-3">
                    <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      tx.transaction_type === "income" ? "bg-green-500/10" : "bg-red-500/10")}>
                      {tx.transaction_type === "income" ? <TrendingUp size={14} className="text-green-400" /> : <TrendingDown size={14} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-aviva-text font-medium truncate">{tx.description}</p>
                      <p className="text-[10px] text-aviva-secondary">{new Date(tx.created_at).toLocaleDateString("th-TH")}</p>
                    </div>
                    <span className={clsx("text-sm font-bold flex-shrink-0", Number(tx.amount) > 0 ? "text-green-400" : "text-red-400")}>
                      {Number(tx.amount) > 0 ? "+" : ""}{formatM(tx.amount)}
                    </span>
                    <button onClick={(e) => openEdit(tx, e)}
                      className="p-1.5 rounded-lg text-aviva-secondary/60 hover:text-aviva-gold hover:bg-aviva-gold/10 transition-colors flex-shrink-0">
                      <Pencil size={13} />
                    </button>
                  </GlassCard>
                ))
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
                        ap.status === "approved" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                        {ap.status === "pending" ? "รออนุมัติ" : ap.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธ"}
                      </span>
                    </div>
                  </div>
                  {ap.status === "pending" && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(ap.id, true)}
                        className="flex-1 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-medium">อนุมัติ</button>
                      <button onClick={() => handleApprove(ap.id, false)}
                        className="flex-1 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-medium">ปฏิเสธ</button>
                    </div>
                  )}
                </GlassCard>
              ))
            }
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">{editingTxn ? "แก้ไขรายการ" : "เพิ่มรายการเงิน"}</h2>
              <button onClick={() => { setShowModal(false); setEditingTxn(null); }}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="flex gap-2">
              {[{ val: "expense", label: "รายจ่าย", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                { val: "income", label: "รายรับ", color: "bg-green-500/20 text-green-400 border-green-500/30" }
              ].map(({ val, label, color }) => (
                <button key={val} onClick={() => setForm({ ...form, transaction_type: val })}
                  className={clsx("flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all",
                    form.transaction_type === val ? color : "bg-aviva-bg text-aviva-secondary border-aviva-gold/10")}>{label}</button>
              ))}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">จำนวนเงิน (บาท) *</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                {!editingTxn && Number(form.amount) >= 100000 && (
                  <p className="text-[11px] text-yellow-400 mt-1 flex items-center gap-1"><Clock size={10} /> ≥ ฿100,000 จะเข้าระบบอนุมัติก่อน</p>
                )}
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด *</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="อธิบายรายการ..."
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.amount || !form.description}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : editingTxn ? "บันทึกการแก้ไข" : Number(form.amount) >= 100000 ? "ส่งขออนุมัติ" : "บันทึก"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
