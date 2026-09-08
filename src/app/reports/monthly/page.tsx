"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, ShoppingBag, HardHat, Wallet, Users, FileBarChart } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";

type Department = "sales" | "construction" | "finance" | "hr";

interface ReportRow {
  department: Department;
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

function monthLabel(monthStr: string): string {
  return new Date(`${monthStr}-01T12:00:00`).toLocaleDateString("th-TH", { year: "numeric", month: "long" });
}

export default function MonthlyReportsPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [months, setMonths] = useState<string[]>([]);
  const [monthIdx, setMonthIdx] = useState(0);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  }, []);

  useEffect(() => { if (user?.isAdmin) loadMonths(); }, [user, loadMonths]);

  useEffect(() => {
    if (!user?.isAdmin || months.length === 0) return;
    const month = months[monthIdx];
    supabase
      .from("monthly_department_reports")
      .select("department, title, content, drive_doc_url")
      .like("report_month", `${month}%`)
      .then(({ data }) => setRows((data ?? []) as ReportRow[]));
  }, [user, months, monthIdx]);

  if (!user || !user.isAdmin) return null;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-10 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <FileBarChart size={18} className="text-aviva-gold" />
          <h1 className="text-base font-bold text-aviva-text">รายงานประจำเดือน</h1>
        </div>
        <p className="text-xs text-aviva-secondary">สรุปผลการทำงานรายฝ่าย ดึงจากข้อมูลจริงในระบบ ณ สิ้นเดือน</p>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <p className="text-sm text-aviva-secondary text-center py-10">กำลังโหลด...</p>
        ) : months.length === 0 ? (
          <GlassCard className="p-6 text-center">
            <p className="text-sm text-aviva-secondary">
              ยังไม่มีรายงานประจำเดือน — ระบบจะสร้างให้อัตโนมัติทุกวันสุดท้ายของเดือน
            </p>
          </GlassCard>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMonthIdx((i) => Math.min(i + 1, months.length - 1))}
                disabled={monthIdx >= months.length - 1}
                className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10 disabled:opacity-30"
                aria-label="เดือนก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-aviva-text">{monthLabel(months[monthIdx])}</span>
              <button
                onClick={() => setMonthIdx((i) => Math.max(i - 1, 0))}
                disabled={monthIdx <= 0}
                className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10 disabled:opacity-30"
                aria-label="เดือนถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {DEPT_ORDER.map((dept) => {
              const row = rows.find((r) => r.department === dept);
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
                    <p className="text-xs text-aviva-secondary">ยังไม่มีรายงานฝ่ายนี้สำหรับเดือนนี้</p>
                  )}
                </GlassCard>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
