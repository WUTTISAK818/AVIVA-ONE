"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Receipt, ArrowRight, CheckCircle, Clock } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Bill {
  id: string;
  bill_type: string | null;
  period_label: string | null;
  amount: number;
  due_date: string | null;
  status: string;
  paid_at: string | null;
}

function fmtBaht(n: number) {
  return `฿${Number(n).toLocaleString("th-TH")}`;
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function BillsListPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("bills").select("*").order("due_date", { ascending: false, nullsFirst: false }).limit(50)
      .then(({ data }) => { setBills((data as Bill[]) ?? []); setLoading(false); });
  }, []);

  const unpaid = bills.filter(b => b.status === "unpaid" || b.status === "overdue");
  const unpaidTotal = unpaid.reduce((s, b) => s + Number(b.amount), 0);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-aviva-text">บิลค่าส่วนกลาง</h1>
          <p className="text-xs text-aviva-secondary mt-0.5">
            {loading ? "กำลังโหลด…" : `ค้างชำระ ${unpaid.length} บิล · รวม ${fmtBaht(unpaidTotal)}`}
          </p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        <SectionHeader title="ทั้งหมด" subtitle="แตะที่บิลเพื่อชำระด้วย PromptPay" />

        {loading ? (
          [1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : bills.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Receipt size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีบิลในระบบ</p>
          </GlassCard>
        ) : (
          bills.map(b => (
            <Link key={b.id} href={`/community/bills/${b.id}`}>
              <GlassCard className="p-4 active:scale-[0.98] transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-aviva-text">{b.bill_type ?? "ค่าส่วนกลาง"} {b.period_label}</p>
                    <p className="text-lg font-bold text-aviva-gold mt-1">{fmtBaht(b.amount)}</p>
                    <p className="text-xs text-aviva-secondary/80 mt-1">
                      กำหนดชำระ {fmtDate(b.due_date)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusPill status={b.status} />
                    <ArrowRight size={16} className="text-aviva-secondary/60" />
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { l: string; c: string; icon: typeof CheckCircle }> = {
    unpaid:  { l: "ค้างชำระ", c: "bg-red-500/15 text-red-300 border-red-500/30",       icon: Clock },
    overdue: { l: "เกินกำหนด", c: "bg-red-500/25 text-red-400 border-red-500/50",       icon: Clock },
    paid:    { l: "ชำระแล้ว",  c: "bg-green-500/15 text-green-300 border-green-500/30", icon: CheckCircle },
    waived:  { l: "ยกเว้น",    c: "bg-aviva-secondary/20 text-aviva-secondary border-aviva-secondary/30", icon: CheckCircle },
  };
  const m = map[status] ?? map.unpaid;
  const Icon = m.icon;
  return (
    <span className={clsx("text-xs px-2.5 py-1 rounded-full border flex items-center gap-1", m.c)}>
      <Icon size={12} /> {m.l}
    </span>
  );
}
