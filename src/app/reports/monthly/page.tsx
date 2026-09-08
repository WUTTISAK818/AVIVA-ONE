"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, ShoppingBag, HardHat, Wallet, Users, FileBarChart, RefreshCw } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";

type Department = "sales" | "construction" | "finance" | "hr";
type ViewMode = "month" | "week" | "custom";

interface ReportContent {
  title: string;
  content: string;
  drive_doc_url: string | null;
}

const DEPT_META: Record<Department, { label: string; icon: typeof ShoppingBag; color: string }> = {
  sales: { label: "ฝ่ายขาย", icon: ShoppingBag, color: "text-blue-400" },
  construction: { label: "ก่อสร้าง", icon: HardHat, color: "text-orange-400" },
  finance: { label: "การเงิน-บัญชี", icon: Wallet, color: "text-green-400" },
  hr: { label: "บุคคล-เงินเดือน", icon: Users, color: "text-purple-400" },
};
const DEPT_ORDER: Department[] = ["sales", "construction", "finance", "hr"];
const TH_OFFSET_MS = 7 * 3_600_000;

function monthLabel(monthStr: string): string {
  return new Date(`${monthStr}-01T12:00:00`).toLocaleDateString("th-TH", { year: "numeric", month: "long" });
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// จันทร์-อาทิตย์ (เวลาไทย) ของสัปดาห์ที่ห่างจากสัปดาห์นี้ไป weeksAgo สัปดาห์
function weekRange(weeksAgo: number): { from: string; toExclusive: string; label: string } {
  const nowTh = new Date(Date.now() + TH_OFFSET_MS);
  const dow = nowTh.getUTCDay();
  const mondayOffset = (dow + 6) % 7;
  const monday = new Date(nowTh);
  monday.setUTCDate(nowTh.getUTCDate() - mondayOffset - weeksAgo * 7);
  const sundayNext = new Date(monday);
  sundayNext.setUTCDate(monday.getUTCDate() + 7);
  const sundayLabel = new Date(monday);
  sundayLabel.setUTCDate(monday.getUTCDate() + 6);
  const label = `สัปดาห์ ${monday.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} - ${sundayLabel.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`;
  return { from: toDateStr(monday), toExclusive: toDateStr(sundayNext), label };
}

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}

export default function MonthlyReportsPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>("month");

  // โหมดรายเดือน (จากตาราง monthly_department_reports ที่ Routine สร้างไว้)
  const [months, setMonths] = useState<string[]>([]);
  const [monthIdx, setMonthIdx] = useState(0);
  const [monthLoading, setMonthLoading] = useState(true);

  // โหมดรายสัปดาห์
  const [weeksAgo, setWeeksAgo] = useState(0);

  // โหมดกำหนดเอง
  const today = toDateStr(new Date(Date.now() + TH_OFFSET_MS));
  const [customFrom, setCustomFrom] = useState(addDaysStr(today, -6));
  const [customTo, setCustomTo] = useState(today);

  const [reports, setReports] = useState<Record<Department, ReportContent> | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [rangeLabel, setRangeLabel] = useState("");

  useEffect(() => {
    if (user && !user.isAdmin) { router.replace("/dashboard"); return; }
  }, [user, router]);

  const loadMonths = useCallback(async () => {
    const { data } = await supabase
      .from("monthly_department_reports")
      .select("report_month")
      .order("report_month", { ascending: false });
    const unique = Array.from(new Set((data ?? []).map((r) => (r.report_month as string).slice(0, 7))));
    setMonths(unique);
    setMonthLoading(false);
  }, []);

  useEffect(() => { if (user?.isAdmin) loadMonths(); }, [user, loadMonths]);

  useEffect(() => {
    if (mode !== "month" || !user?.isAdmin || months.length === 0) return;
    const month = months[monthIdx];
    setRangeLabel(monthLabel(month));
    supabase
      .from("monthly_department_reports")
      .select("department, title, content, drive_doc_url")
      .like("report_month", `${month}%`)
      .then(({ data }) => {
        const byDept = {} as Record<Department, ReportContent>;
        for (const r of (data ?? []) as (ReportContent & { department: Department })[]) {
          byDept[r.department] = { title: r.title, content: r.content, drive_doc_url: r.drive_doc_url };
        }
        setReports(byDept);
      });
  }, [mode, user, months, monthIdx]);

  const fetchLive = useCallback(async (from: string, toExclusive: string, label: string) => {
    setLiveLoading(true);
    setRangeLabel(label);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/reports/range?from=${from}&to=${toExclusive}&label=${encodeURIComponent(label)}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        const byDept = {} as Record<Department, ReportContent>;
        for (const dept of DEPT_ORDER) {
          const r = json.reports?.[dept];
          if (r) byDept[dept] = { title: r.title, content: r.content, drive_doc_url: null };
        }
        setReports(byDept);
      }
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "week" || !user?.isAdmin) return;
    const { from, toExclusive, label } = weekRange(weeksAgo);
    fetchLive(from, toExclusive, label);
  }, [mode, user, weeksAgo, fetchLive]);

  const runCustom = () => {
    if (!customFrom || !customTo || customFrom > customTo) return;
    const label = `${new Date(customFrom).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} - ${new Date(customTo).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`;
    fetchLive(customFrom, addDaysStr(customTo, 1), label);
  };

  useEffect(() => {
    if (mode === "custom" && user?.isAdmin) runCustom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (!user || !user.isAdmin) return null;

  const loading = mode === "month" ? monthLoading : liveLoading;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-10 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <FileBarChart size={18} className="text-aviva-gold" />
          <h1 className="text-base font-bold text-aviva-text">รายงานประจำเดือน</h1>
        </div>
        <p className="text-xs text-aviva-secondary mb-3">สรุปผลการทำงานรายฝ่าย ดึงจากข้อมูลจริงในระบบ</p>

        <div className="flex gap-1.5">
          {([["month", "รายเดือน"], ["week", "รายสัปดาห์"], ["custom", "กำหนดเอง"]] as [ViewMode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                mode === m ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-card text-aviva-secondary border border-aviva-gold/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {mode === "month" && months.length > 0 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMonthIdx((i) => Math.min(i + 1, months.length - 1))}
              disabled={monthIdx >= months.length - 1}
              className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10 disabled:opacity-30"
              aria-label="เดือนก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-aviva-text">{rangeLabel}</span>
            <button
              onClick={() => setMonthIdx((i) => Math.max(i - 1, 0))}
              disabled={monthIdx <= 0}
              className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10 disabled:opacity-30"
              aria-label="เดือนถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {mode === "week" && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeeksAgo((w) => w + 1)}
              className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10"
              aria-label="สัปดาห์ก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-aviva-text">{rangeLabel}</span>
            <button
              onClick={() => setWeeksAgo((w) => Math.max(w - 1, 0))}
              disabled={weeksAgo <= 0}
              className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10 disabled:opacity-30"
              aria-label="สัปดาห์ถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {mode === "custom" && (
          <GlassCard className="p-3 flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-aviva-bg border border-aviva-gold/15 rounded-lg px-2 py-1.5 text-xs text-aviva-text"
            />
            <span className="text-xs text-aviva-secondary">ถึง</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={today}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-aviva-bg border border-aviva-gold/15 rounded-lg px-2 py-1.5 text-xs text-aviva-text"
            />
            <button
              onClick={runCustom}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-aviva-gold text-aviva-bg text-xs font-semibold"
            >
              <RefreshCw size={12} /> ดูรายงาน
            </button>
          </GlassCard>
        )}

        {loading ? (
          <p className="text-sm text-aviva-secondary text-center py-10">กำลังโหลด...</p>
        ) : mode === "month" && months.length === 0 ? (
          <GlassCard className="p-6 text-center">
            <p className="text-sm text-aviva-secondary">
              ยังไม่มีรายงานประจำเดือน — ระบบจะสร้างให้อัตโนมัติทุกวันสุดท้ายของเดือน
            </p>
          </GlassCard>
        ) : (
          DEPT_ORDER.map((dept) => {
            const row = reports?.[dept];
            const meta = DEPT_META[dept];
            const Icon = meta.icon;
            return (
              <GlassCard key={dept} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={meta.color} />
                    <span className="text-sm font-semibold text-aviva-text">{meta.label}</span>
                  </div>
                  {row?.drive_doc_url && (
                    <a
                      href={row.drive_doc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-aviva-gold hover:underline"
                    >
                      เปิดใน Drive <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                {row ? (
                  <p className="text-sm text-aviva-text whitespace-pre-wrap leading-relaxed">{row.content}</p>
                ) : (
                  <p className="text-xs text-aviva-secondary">ยังไม่มีรายงานฝ่ายนี้สำหรับช่วงนี้</p>
                )}
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
