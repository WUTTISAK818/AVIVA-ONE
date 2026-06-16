"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, FileText } from "lucide-react";
import KPICard from "@/components/KPICard";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Account { id: string; code: string; name_th: string; account_type: string; balance: number }

function fmtBaht(n: number) {
  return `฿${Math.abs(Number(n)).toLocaleString("th-TH", { minimumFractionDigits: 0 })}`;
}

const SHOW_ASSETS = ["1010", "1020", "1030", "1040"];

export default function CommunityFinancePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("ledger_balances").select("*").order("code").then(({ data }) => {
      setAccounts((data as Account[]) ?? []);
      setLoading(false);
    });
  }, []);

  const cash = accounts.filter(a => SHOW_ASSETS.includes(a.code)).reduce((s, a) => s + Number(a.balance), 0);
  const sinkingFund = accounts.find(a => a.code === "1040")?.balance ?? 0;
  const ytdRevenue = accounts.filter(a => a.account_type === "revenue").reduce((s, a) => s - Number(a.balance), 0);
  const ytdExpense = accounts.filter(a => a.account_type === "expense").reduce((s, a) => s + Number(a.balance), 0);

  const expenseList = accounts.filter(a => a.account_type === "expense").sort((a, b) => Number(b.balance) - Number(a.balance));
  const revenueList = accounts.filter(a => a.account_type === "revenue").sort((a, b) => Number(a.balance) - Number(b.balance));

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-1 -ml-2">
          <Link href="/community/announcements" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">ความโปร่งใสทางการเงิน</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">ดูเงินกองกลาง · รายรับ-รายจ่าย</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <KPICard icon={Wallet} label="เงินสด + ธนาคาร" value={loading ? "…" : fmtBaht(cash)} />
          <KPICard icon={FileText} label="กองทุนสำรองซ่อมใหญ่" value={loading ? "…" : fmtBaht(sinkingFund)} />
          <KPICard icon={TrendingUp} label="รายรับสะสม (ปีนี้)" value={loading ? "…" : fmtBaht(ytdRevenue)} />
          <KPICard icon={TrendingDown} label="ค่าใช้จ่ายสะสม" value={loading ? "…" : fmtBaht(ytdExpense)} />
        </div>

        <div>
          <SectionHeader title="รายรับนิติฯ" subtitle="ที่มาของเงินกองกลาง" />
          <GlassCard className="divide-y divide-aviva-gold/10">
            {revenueList.length === 0 ? (
              <p className="p-4 text-xs text-aviva-secondary text-center">ยังไม่มีรายรับ</p>
            ) : revenueList.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <p className="text-aviva-text flex-1 min-w-0 truncate">{a.name_th}</p>
                <p className="font-bold font-mono text-green-300 shrink-0">{fmtBaht(-a.balance)}</p>
              </div>
            ))}
          </GlassCard>
        </div>

        <div>
          <SectionHeader title="ค่าใช้จ่ายนิติฯ" subtitle="ใช้เงินกองกลางไปกับอะไรบ้าง" />
          <GlassCard className="divide-y divide-aviva-gold/10">
            {expenseList.length === 0 ? (
              <p className="p-4 text-xs text-aviva-secondary text-center">ยังไม่มีค่าใช้จ่าย</p>
            ) : expenseList.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <p className="text-aviva-text flex-1 min-w-0 truncate">{a.name_th}</p>
                <p className="font-bold font-mono text-red-300 shrink-0">{fmtBaht(a.balance)}</p>
              </div>
            ))}
          </GlassCard>
        </div>

        <p className="text-xs text-aviva-secondary/70 text-center px-3">
          ข้อมูลปรับปรุงทันทีเมื่อนิติฯ ลงบัญชี · เปิดเผยตามกฎหมายอาคารชุด/หมู่บ้านจัดสรร
        </p>
      </div>
    </div>
  );
}
