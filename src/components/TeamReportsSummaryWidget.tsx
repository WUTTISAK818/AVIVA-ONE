"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PendingDay {
  date: string;   // YYYY-MM-DD
  count: number;
}

interface ReportStats {
  total: number;      // พนักงานที่ต้องส่งวันนี้
  submitted: number;  // ส่งแล้ว (รวมล่าช้า)
  late: number;       // ส่งล่าช้า
  pendingTotal?: number;      // รายงานที่ยังไม่ได้ตรวจรับ (ทุกวันรวมกัน)
  pendingDays?: PendingDay[]; // แยกเป็นรายวัน ให้กดไปวันนั้นได้เลย
}

/** 5 ต.ค. — สั้นพอให้วางเรียงกันได้หลายวันบนมือถือ */
const shortThai = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });

export default function TeamReportsSummaryWidget() {
  const [stats, setStats] = useState<ReportStats>({ total: 0, submitted: 0, late: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/reports/summary", {
          cache: "no-store",
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
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
      <div className="bg-aviva-card rounded-lg p-2.5 border border-aviva-gold/10 mb-3">
        <div className="animate-pulse h-12 bg-aviva-gold/10 rounded" />
      </div>
    );
  }

  const missing = Math.max(stats.total - stats.submitted, 0);
  const todayDate = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const pendingDays = stats.pendingDays ?? [];
  const pendingTotal = stats.pendingTotal ?? 0;

  return (
    <>
    <Link href="/reports/digest">
      <div className="bg-aviva-card border border-aviva-gold/20 rounded-lg p-3 hover:border-aviva-gold/40 transition-all active:scale-[0.98] cursor-pointer mb-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center flex-shrink-0">
              <ClipboardList size={15} className="text-aviva-gold" />
            </div>
            <span className="text-sm font-semibold text-aviva-text">รายงานทีมวันนี้</span>
          </div>
          <span className="text-[10px] text-aviva-secondary/60">{todayDate}</span>
        </div>
        <div className="flex items-center justify-end gap-3">
          <div className="text-center">
            <div className="text-[11px] text-aviva-secondary/70 font-medium">ต้องส่ง</div>
            <div className="text-base font-bold text-aviva-gold">{stats.total}</div>
          </div>
          <div className="w-px h-8 bg-aviva-gold/20" />
          <div className="text-center">
            <div className="text-[11px] text-aviva-secondary/70 font-medium">ส่งแล้ว</div>
            <div className="text-base font-bold text-green-400">{stats.submitted}</div>
          </div>
          <div className="w-px h-8 bg-aviva-gold/20" />
          <div className="text-center">
            <div className="text-[11px] text-aviva-secondary/70 font-medium">ล่าช้า</div>
            <div className="text-base font-bold text-orange-400">{stats.late}</div>
          </div>
          <div className="w-px h-8 bg-aviva-gold/20" />
          <div className="text-center">
            <div className="text-[11px] text-aviva-secondary/70 font-medium">ยังไม่ส่ง</div>
            <div className={`text-base font-bold ${missing > 0 ? "text-red-400" : "text-aviva-secondary/40"}`}>{missing}</div>
          </div>
        </div>
      </div>
    </Link>

    {/* วันไหนบ้างที่ยังไม่ได้ตรวจรับ — กดวันไหนก็เข้าไปอ่านวันนั้นได้ตรง ๆ (Pom ขอ 6 ต.ค. 69) */}
    {pendingTotal > 0 && (
      <div className="bg-aviva-card border border-aviva-gold/25 rounded-lg p-3 mb-3">
        <p className="text-[12px] font-bold text-aviva-gold">
          📖 รายงานรอคุณตรวจรับ {pendingTotal} ฉบับ · {pendingDays.length} วัน
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {pendingDays.map(d => (
            <Link key={d.date} href={`/reports/review?date=${d.date}`}
              className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg bg-aviva-gold/10 border border-aviva-gold/30 text-aviva-gold active:scale-95 transition-transform">
              {shortThai(d.date)} · {d.count} ฉบับ
            </Link>
          ))}
        </div>
        <p className="text-[10px] text-aviva-secondary/70 mt-2">
          แตะวันที่เพื่อเปิดอ่านรายงานของวันนั้น แล้วกด &ldquo;บันทึกผลการตรวจ&rdquo; ครั้งเดียวจบทั้งวัน
        </p>
      </div>
    )}
    </>
  );
}
