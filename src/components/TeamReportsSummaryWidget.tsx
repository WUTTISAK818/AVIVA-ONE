"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, TrendingUp } from "lucide-react";

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
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
        <div className="animate-pulse flex flex-col gap-2">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <Link href="/reports/review">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-blue-600" />
            <h3 className="font-semibold text-slate-800">รายงานทีม</h3>
          </div>
          <TrendingUp size={18} className="text-blue-600" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded p-2">
            <div className="text-xs text-slate-600">รวม</div>
            <div className="text-lg font-bold text-slate-800">{stats.total}</div>
          </div>
          <div className="bg-white rounded p-2">
            <div className="text-xs text-slate-600">ส่งแล้ว</div>
            <div className="text-lg font-bold text-green-600">{stats.submitted}</div>
          </div>
          <div className="bg-white rounded p-2">
            <div className="text-xs text-slate-600">ล่าช้า</div>
            <div className="text-lg font-bold text-red-600">{stats.late}</div>
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-3">คลิกเพื่อดูรายละเอียด</p>
      </div>
    </Link>
  );
}
