"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ProgressBar from "@/components/ProgressBar";
import AIInsightPanel from "@/components/AIInsightPanel";
import { supabase } from "@/lib/supabase";
import { cashflowData, financeSummary as mockSummary } from "@/lib/mock-data";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
}

function formatM(n: number) {
  return `฿${(Math.abs(n) / 1_000_000).toFixed(1)}M`;
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("finance_transactions")
      .select("*")
      .eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setTransactions((data as Transaction[]) ?? []);
        setLoading(false);
      });
  }, []);

  const totalIncome = transactions
    .filter((t) => t.transaction_type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter((t) => t.transaction_type === "expense")
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-aviva-text">การเงิน & บัญชี</h1>
          <p className="text-xs text-aviva-secondary mt-0.5">
            {loading ? "กำลังโหลด..." : "Real-time จาก Supabase"}
          </p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-3 text-center">
            <TrendingUp size={16} className="text-green-400 mx-auto mb-1" />
            <p className="text-base font-bold text-green-400">
              {loading ? "..." : formatM(totalIncome || mockSummary.totalIncome)}
            </p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายรับรวม</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <TrendingDown size={16} className="text-red-400 mx-auto mb-1" />
            <p className="text-base font-bold text-red-400">
              {loading ? "..." : formatM(totalExpenses || mockSummary.totalExpenses)}
            </p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รายจ่ายรวม</p>
          </GlassCard>
          <GlassCard gold className="p-3 text-center">
            <DollarSign size={16} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-base font-bold text-aviva-gold">฿93.0M</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">Net Cashflow</p>
          </GlassCard>
        </div>

        {/* Cashflow Chart */}
        <GlassCard className="p-4">
          <SectionHeader title="Cashflow รายเดือน" subtitle="หน่วย: ล้านบาท" />
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
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
                <Tooltip
                  contentStyle={{ backgroundColor: "#17332D", border: "1px solid #D4AF37", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} fill="url(#incomeGrad)" name="รายรับ" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" name="รายจ่าย" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Budget */}
        <GlassCard className="p-4">
          <SectionHeader title="งบประมาณ" subtitle="การใช้จ่ายต่อหมวด" />
          <div className="space-y-4">
            <ProgressBar label="ค่าก่อสร้าง" value={mockSummary.contractorUsed} max={mockSummary.contractorBudget} sublabel={`${formatM(mockSummary.contractorUsed)} / ${formatM(mockSummary.contractorBudget)}`} />
            <ProgressBar label="การตลาด" value={mockSummary.marketingUsed} max={mockSummary.marketingBudget} sublabel={`${formatM(mockSummary.marketingUsed)} / ${formatM(mockSummary.marketingBudget)}`} />
            <ProgressBar label="ค่าดำเนินการ" value={mockSummary.adminUsed} max={mockSummary.adminBudget} sublabel={`${formatM(mockSummary.adminUsed)} / ${formatM(mockSummary.adminBudget)}`} />
          </div>
        </GlassCard>

        {/* Live Transactions */}
        <div>
          <SectionHeader title="รายการล่าสุด" subtitle="จาก Supabase" />
          <div className="space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-aviva-card/50 animate-pulse" />)
            ) : (
              transactions.map((tx) => (
                <GlassCard key={tx.id} className="p-3 flex items-center gap-3">
                  <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", tx.transaction_type === "income" ? "bg-green-500/10" : "bg-red-500/10")}>
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
            )}
          </div>
        </div>

        <AIInsightPanel
          type="warning"
          priority="high"
          title="AI Financial Alert"
          message="Cashflow อาจติดลบในเดือนตุลาคม จากค่าก่อสร้างที่เพิ่มขึ้น แนะนำให้เร่งปิดการขาย 8 ยูนิตใน pipeline"
        />
      </div>
    </div>
  );
}
