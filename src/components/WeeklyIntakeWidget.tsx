"use client";
// สรุป "รับลูกค้ารายสัปดาห์ แยกรายพนักงานขาย" — ใช้ร่วมกันทั้ง Dashboard ผู้บริหาร และแท็บผลงานทีมใน CRM
import { useCallback, useEffect, useState } from "react";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Row { name: string; received: number; siteVisit: number; booking: number; closed: number }
interface Data { weekStart: string; weekEnd: string; weeksAgo: number; rows: Row[]; total: Row }

const thDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });

export default function WeeklyIntakeWidget() {
  const [weeksAgo, setWeeksAgo] = useState(0);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (w: number) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/sales/weekly-intake?weeksAgo=${w}`, {
        cache: "no-store",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Failed to fetch weekly intake:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(weeksAgo); }, [weeksAgo, load]);

  const label = weeksAgo === 0 ? "สัปดาห์นี้" : weeksAgo === 1 ? "สัปดาห์ที่แล้ว" : `${weeksAgo} สัปดาห์ก่อน`;

  return (
    <div className="bg-aviva-card border border-aviva-gold/20 rounded-lg p-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center flex-shrink-0">
            <Users size={15} className="text-aviva-gold" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-aviva-text leading-tight">รับลูกค้ารายสัปดาห์ (รายพนักงาน)</p>
            <p className="text-[11px] text-aviva-secondary">
              {label}{data ? ` · ${thDate(data.weekStart)}–${thDate(data.weekEnd)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button aria-label="สัปดาห์ก่อน" onClick={() => setWeeksAgo(w => Math.min(52, w + 1))}
            className="w-7 h-7 rounded-lg border border-aviva-gold/20 text-aviva-secondary flex items-center justify-center active:scale-90">
            <ChevronLeft size={15} />
          </button>
          <button aria-label="สัปดาห์ถัดไป" disabled={weeksAgo === 0} onClick={() => setWeeksAgo(w => Math.max(0, w - 1))}
            className="w-7 h-7 rounded-lg border border-aviva-gold/20 text-aviva-secondary flex items-center justify-center active:scale-90 disabled:opacity-30">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse h-24 bg-aviva-gold/10 rounded" />
      ) : !data || data.rows.length === 0 ? (
        <p className="text-xs text-aviva-secondary/70 text-center py-4">ไม่มีการรับลูกค้าใหม่ในสัปดาห์นี้</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-aviva-secondary/70 text-[10px] border-b border-aviva-gold/10">
                <th className="text-left font-medium py-1.5">พนักงานขาย</th>
                <th className="text-right font-medium py-1.5 px-1">รับลูกค้า</th>
                <th className="text-right font-medium py-1.5 px-1">เยี่ยมชม</th>
                <th className="text-right font-medium py-1.5 px-1">จอง</th>
                <th className="text-right font-medium py-1.5 pl-1">ปิดการขาย</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.name} className="border-b border-aviva-gold/5">
                  <td className="text-left py-1.5 text-aviva-text truncate max-w-[110px]">{r.name}</td>
                  <td className="text-right py-1.5 px-1 font-bold text-aviva-gold font-mono">{r.received}</td>
                  <td className="text-right py-1.5 px-1 text-aviva-secondary font-mono">{r.siteVisit}</td>
                  <td className="text-right py-1.5 px-1 text-aviva-secondary font-mono">{r.booking}</td>
                  <td className="text-right py-1.5 pl-1 text-green-400 font-mono">{r.closed}</td>
                </tr>
              ))}
              <tr className="font-semibold text-aviva-text">
                <td className="text-left py-1.5">รวมทีม</td>
                <td className="text-right py-1.5 px-1 font-bold text-aviva-gold font-mono">{data.total.received}</td>
                <td className="text-right py-1.5 px-1 font-mono">{data.total.siteVisit}</td>
                <td className="text-right py-1.5 px-1 font-mono">{data.total.booking}</td>
                <td className="text-right py-1.5 pl-1 text-green-400 font-mono">{data.total.closed}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
