"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Account { id: string; code: string; name_th: string; account_type: string; balance: number }
interface BudgetLine { account_id: string; planned_amount: number }

const buddhistYear = (d = new Date()) => d.getFullYear() + 543;
function fmtBaht(n: number) {
  return `฿${Math.abs(Number(n)).toLocaleString("th-TH", { minimumFractionDigits: 0 })}`;
}

export default function BudgetPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("ledger_balances").select("*").in("account_type", ["revenue", "expense"]).order("code"),
      supabase.from("budget_lines").select("account_id, planned_amount").eq("fiscal_year", year),
    ]).then(([a, b]) => {
      setAccounts((a.data as Account[]) ?? []);
      const map: Record<string, number> = {};
      ((b.data as BudgetLine[]) ?? []).forEach(bl => { map[bl.account_id] = Number(bl.planned_amount); });
      setBudgets(map);
      setLoading(false);
    });
  }, [year]);

  const setBudget = (accountId: string, value: string) => {
    setBudgets(b => ({ ...b, [accountId]: Number(value) || 0 }));
  };

  const save = async (accountId: string) => {
    setSaving(accountId);
    const amt = budgets[accountId] ?? 0;
    await supabase.from("budget_lines").upsert(
      { fiscal_year: year, account_id: accountId, planned_amount: amt },
      { onConflict: "fiscal_year,account_id" }
    );
    setSaving(null);
  };

  const revenues = accounts.filter(a => a.account_type === "revenue");
  const expenses = accounts.filter(a => a.account_type === "expense");

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/security/treasury" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-aviva-text">งบประมาณ {buddhistYear(new Date(year, 0, 1))}</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">ตั้งงบรายปี · เปรียบเทียบกับใช้จริง</p>
            </div>
          </div>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text outline-none">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : (
          <>
            <BudgetGroup title="รายรับ" accounts={revenues} budgets={budgets} setBudget={setBudget} save={save} saving={saving} signFlip />
            <BudgetGroup title="ค่าใช้จ่าย" accounts={expenses} budgets={budgets} setBudget={setBudget} save={save} saving={saving} />
          </>
        )}
      </div>
    </div>
  );
}

function BudgetGroup({ title, accounts, budgets, setBudget, save, saving, signFlip }:
  { title: string; accounts: Account[]; budgets: Record<string, number>;
    setBudget: (id: string, v: string) => void; save: (id: string) => void; saving: string | null; signFlip?: boolean }) {
  return (
    <div>
      <SectionHeader title={title} subtitle="ตัวเลขใช้จริงดึงจากผังบัญชี" />
      <GlassCard className="divide-y divide-aviva-gold/10">
        {accounts.map(a => {
          const actual = signFlip ? -a.balance : a.balance;
          const planned = budgets[a.id] ?? 0;
          const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
          const overrun = planned > 0 && actual > planned;
          return (
            <div key={a.id} className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-aviva-text">{a.name_th}</p>
                  <p className="text-xs text-aviva-secondary font-mono">{a.code}</p>
                </div>
                <p className="text-xs text-aviva-secondary">
                  ใช้จริง <span className="text-aviva-text font-bold ml-1">{fmtBaht(actual)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={budgets[a.id] ?? ""}
                  onChange={e => setBudget(a.id, e.target.value)}
                  placeholder="งบรายปี"
                  className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-xs text-aviva-text outline-none font-mono" />
                <button onClick={() => save(a.id)} disabled={saving === a.id}
                  className="flex items-center gap-1 bg-aviva-gold/15 border border-aviva-gold/40 text-aviva-gold text-xs px-2.5 py-2 rounded-lg disabled:opacity-50">
                  <Save size={11} /> {saving === a.id ? "..." : "บันทึก"}
                </button>
              </div>
              {planned > 0 && (
                <div className="space-y-1">
                  <div className="h-2 bg-aviva-bg rounded-full overflow-hidden">
                    <div className={`h-full ${overrun ? "bg-red-500" : "bg-aviva-gold"}`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                  </div>
                  <p className={`text-xs text-right ${overrun ? "text-red-300" : "text-aviva-secondary"}`}>
                    {pct}% · เหลืองบ {fmtBaht(planned - actual)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </GlassCard>
    </div>
  );
}
