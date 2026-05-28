"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, ShieldCheck } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Summary {
  visitor_total: number;
  visitor_checked_in: number;
  gate_total: number;
  gate_auto_open: number;
  gate_denied: number;
  gate_pending: number;
  incidents_total: number;
  incidents_open: number;
  patrol_total: number;
  bills_paid_total: number;
  bills_unpaid_total: number;
}

function fmtBaht(n: number) {
  return `฿${Number(n).toLocaleString("th-TH")}`;
}
function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
  return { start, end };
}
function monthLabel(d = new Date()) {
  const beYear = d.getFullYear() + 543;
  return d.toLocaleDateString("th-TH", { month: "long" }) + " " + beYear;
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [topVisitors, setTopVisitors] = useState<{ host: string; n: number }[]>([]);

  useEffect(() => {
    const { start, end } = monthRange();
    const head = (q: ReturnType<typeof supabase.from>) => q.select("id", { count: "exact", head: true });

    Promise.all([
      head(supabase.from("visitor_passes")).gte("created_at", start).lt("created_at", end),
      head(supabase.from("visitor_passes")).gte("checked_in_at", start).lt("checked_in_at", end),
      head(supabase.from("gate_events")).gte("event_at", start).lt("event_at", end),
      head(supabase.from("gate_events")).gte("event_at", start).lt("event_at", end).eq("action", "auto_open"),
      head(supabase.from("gate_events")).gte("event_at", start).lt("event_at", end).eq("action", "denied"),
      head(supabase.from("gate_events")).gte("event_at", start).lt("event_at", end).eq("action", "pending_guard"),
      head(supabase.from("incidents")).gte("occurred_at", start).lt("occurred_at", end),
      head(supabase.from("incidents")).eq("status", "open"),
      head(supabase.from("patrol_logs")).gte("scanned_at", start).lt("scanned_at", end),
      supabase.from("bills").select("amount, status").gte("created_at", start).lt("created_at", end),
      supabase.from("visitor_passes")
        .select("visitors:visitor_id(residents:host_resident_id(full_name))")
        .gte("created_at", start).lt("created_at", end)
        .limit(200),
    ]).then(([vt, vci, gt, ga, gd, gp, it, io, pt, bills, vp]) => {
      const billsData = (bills.data as { amount: number; status: string }[]) ?? [];
      type Joined = { visitors: { residents: { full_name: string } | null } | null };
      const passes = (vp.data as unknown as Joined[]) ?? [];
      const tally: Record<string, number> = {};
      for (const row of passes) {
        const name = row.visitors?.residents?.full_name ?? "—";
        tally[name] = (tally[name] ?? 0) + 1;
      }
      const top = Object.entries(tally)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([host, n]) => ({ host, n }));

      setSummary({
        visitor_total: vt.count ?? 0,
        visitor_checked_in: vci.count ?? 0,
        gate_total: gt.count ?? 0,
        gate_auto_open: ga.count ?? 0,
        gate_denied: gd.count ?? 0,
        gate_pending: gp.count ?? 0,
        incidents_total: it.count ?? 0,
        incidents_open: io.count ?? 0,
        patrol_total: pt.count ?? 0,
        bills_paid_total: billsData.filter(b => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0),
        bills_unpaid_total: billsData.filter(b => b.status !== "paid").reduce((s, b) => s + Number(b.amount), 0),
      });
      setTopVisitors(top);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24 print-area">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/security" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-aviva-text">รายงานรายเดือน</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">{monthLabel()}</p>
            </div>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
            <Printer size={14} /> พิมพ์
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="hidden print:block text-center pb-4">
          <p className="text-xs">AVIVA Plus · รายงานความปลอดภัย</p>
          <h1 className="text-2xl font-bold">{monthLabel()}</h1>
          <p className="text-xs">จัดทำ: {new Date().toLocaleString("th-TH")}</p>
        </div>

        {loading || !summary ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : (
          <>
            <ReportSection title="ผู้มาเยือน">
              <Row label="บัตรที่ออก" value={summary.visitor_total} />
              <Row label="เช็คอินจริง" value={summary.visitor_checked_in} />
              <Row label="อัตราใช้งาน" value={`${summary.visitor_total > 0 ? Math.round(summary.visitor_checked_in / summary.visitor_total * 100) : 0}%`} />
            </ReportSection>

            <ReportSection title="เหตุการณ์ประตู (ALPR)">
              <Row label="Event ทั้งหมด" value={summary.gate_total} />
              <Row label="เปิดอัตโนมัติ" value={summary.gate_auto_open} accent="green" />
              <Row label="ถูกปฏิเสธ" value={summary.gate_denied} accent="red" />
              <Row label="รอ รปภ. ตัดสิน" value={summary.gate_pending} accent="amber" />
              <Row label="อัตรา auto-open"
                value={`${summary.gate_total > 0 ? Math.round(summary.gate_auto_open / summary.gate_total * 100) : 0}%`} />
            </ReportSection>

            <ReportSection title="ผู้เยี่ยมต่อเจ้าบ้าน (Top 5)">
              {topVisitors.length === 0 ? (
                <p className="text-xs text-aviva-secondary">ไม่มีข้อมูล</p>
              ) : topVisitors.map(({ host, n }) => (
                <Row key={host} label={host} value={n} />
              ))}
            </ReportSection>

            <ReportSection title="เหตุการณ์ &amp; การตรวจตรา">
              <Row label="เหตุการณ์ที่บันทึก" value={summary.incidents_total} />
              <Row label="ยังเปิดอยู่" value={summary.incidents_open} accent={summary.incidents_open > 0 ? "red" : undefined} />
              <Row label="การเดินตรวจ" value={summary.patrol_total} />
            </ReportSection>

            <ReportSection title="ค่าส่วนกลาง">
              <Row label="ยอดที่ชำระแล้วในเดือน" value={fmtBaht(summary.bills_paid_total)} accent="green" />
              <Row label="ยอดที่ยังค้าง" value={fmtBaht(summary.bills_unpaid_total)} accent="red" />
            </ReportSection>

            <div className="hidden print:block text-center pt-6 text-xs">
              <ShieldCheck className="inline mr-1" size={12} /> AVIVA Plus — ระบบบริหารโครงการ
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionHeader title={title} />
      <GlassCard className="p-4 space-y-2">{children}</GlassCard>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string | number; accent?: "green" | "red" | "amber" }) {
  const c = {
    green: "text-green-300",
    red:   "text-red-300",
    amber: "text-amber-300",
  }[accent ?? "green"];
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-aviva-secondary">{label}</span>
      <span className={`font-bold ${accent ? c : "text-aviva-text"}`}>{value}</span>
    </div>
  );
}
