"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

interface ReportStats {
  total: number;
  late: number;
  submitted: number;
}

export default function TeamReportsSummaryWidget() {
  const [stats, setStats] = useState<ReportStats>({ total: 0, late: 0, submitted: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/reports/summary", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch report stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-aviva-card rounded-lg p-2.5 border border-aviva-gold/10">
        <div className="animate-pulse h-12 bg-aviva-gold/10 rounded" />
      </div>
    );
  }

  return (
    <Link href="/reports/review">
      <div className="bg-aviva-card border border-aviva-gold/20 rounded-lg p-2.5 hover:border-aviva-gold/40 transition-all active:scale-[0.98] cursor-pointer">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center flex-shrink-0">
              <ClipboardList size={14} className="text-aviva-gold" />
            </div>
            <span className="text-xs font-semibold text-aviva-text truncate">รายงานทีม</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="text-center">
              <div className="text-[10px] text-aviva-secondary">รวม</div>
              <div className="text-sm font-bold text-aviva-gold">{stats.total}</div>
            </div>
            <div className="w-px h-6 bg-aviva-gold/20" />
            <div className="text-center">
              <div className="text-[10px] text-aviva-secondary">ส่ง</div>
              <div className="text-sm font-bold text-green-400">{stats.submitted}</div>
            </div>
            <div className="w-px h-6 bg-aviva-gold/20" />
            <div className="text-center">
              <div className="text-[10px] text-aviva-secondary">ล่า</div>
              <div className="text-sm font-bold text-red-400">{stats.late}</div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
