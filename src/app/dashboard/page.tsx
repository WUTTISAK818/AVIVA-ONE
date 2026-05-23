"use client";

import { useEffect, useState } from "react";
import { Home, DollarSign, Users, Package, LogOut, ClipboardList, Receipt, UserCheck, ShieldAlert, Settings, X, Sparkles, ChevronRight } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { useCurrentUser } from "@/lib/user-context";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import KPICard from "@/components/KPICard";
import AIInsightPanel from "@/components/AIInsightPanel";
import ProgressBar from "@/components/ProgressBar";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import CalendarWidget from "@/components/CalendarWidget";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface Project {
  project_name: string;
  total_units: number;
  sold_units: number;
  available_units: number;
  revenue_actual: number;
  revenue_target: number;
  construction_progress: number;
  sellout_forecast: string;
}

interface CrossModuleStats {
  pendingApprovals: number;
  totalReceipts: number;
  employeeCount: number;
  pendingClaims: number;
  totalLeads: number;
  pendingDocs: number;
}

function formatMillions(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000).toFixed(0)}K`;
}

function formatDate() {
  return new Date().toLocaleDateString("th-TH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

const KPI_LABELS: Record<string, string> = {
  units: "ยูนิตทั้งหมด",
  sold: "ยูนิตที่ขายแล้ว (Closed Deal)",
  available: "ยูนิตว่าง",
  revenue: "รายรับ 20 รายการล่าสุด",
};

export default function DashboardPage() {
  const ctxUser = useCurrentUser();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CrossModuleStats>({
    pendingApprovals: 0, totalReceipts: 0, employeeCount: 0,
    pendingClaims: 0, totalLeads: 0, pendingDocs: 0,
  });
  const [kpiModal, setKpiModal] = useState<string | null>(null);
  const [kpiItems, setKpiItems] = useState<Record<string, unknown>[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [chartData, setChartData] = useState<{ month: string; revenue: number }[]>([]);
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const openKpi = async (type: string) => {
    setKpiModal(type);
    setKpiLoading(true);
    setKpiItems([]);
    if (type === "units") {
      const { data } = await supabase.from("houses").select("house_number,status,progress").eq("project_id", PROJECT_ID).order("house_number");
      setKpiItems((data as Record<string, unknown>[]) ?? []);
    } else if (type === "sold") {
      const { data } = await supabase.from("leads").select("customer_name,phone,budget").eq("project_id", PROJECT_ID).eq("status", "Closed Deal");
      setKpiItems((data as Record<string, unknown>[]) ?? []);
    } else if (type === "available") {
      const { data } = await supabase.from("houses").select("house_number,status,progress").eq("project_id", PROJECT_ID).neq("status", "complete").order("house_number");
      setKpiItems((data as Record<string, unknown>[]) ?? []);
    } else if (type === "revenue") {
      const { data } = await supabase.from("receipts").select("amount,receipt_date,description").eq("project_id", PROJECT_ID).order("receipt_date", { ascending: false }).limit(20);
      setKpiItems((data as Record<string, unknown>[]) ?? []);
    }
    setKpiLoading(false);
  };

  useEffect(() => {
    supabase.from("projects").select("*").eq("id", PROJECT_ID).single()
      .then(({ data }) => { setProject(data); setLoading(false); });

    const year = new Date().getFullYear();
    Promise.all([
      supabase.from("approvals").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("receipts").select("amount,receipt_date,receipt_type").eq("project_id", PROJECT_ID),
      supabase.from("employees").select("id", { count: "exact" }).eq("status", "active"),
      supabase.from("warranty_claims").select("id", { count: "exact" }).eq("status", "pending").eq("project_id", PROJECT_ID),
      supabase.from("leads").select("id", { count: "exact" }).eq("project_id", PROJECT_ID),
      supabase.from("documents").select("id", { count: "exact" }).eq("status", "pending").eq("project_id", PROJECT_ID),
      supabase.from("approval_logs").select("approval_id", { count: "exact", head: true }).eq("action_taken", "Pending"),
    ]).then(([approvals, receipts, employees, claims, leads, docs, v2Approvals]) => {
      const allReceipts = (receipts.data ?? []) as { amount: number; receipt_date: string; receipt_type: string }[];
      const receiptTotal = allReceipts.filter(r => r.receipt_type === "income").reduce((s, r) => s + Number(r.amount), 0);
      setStats({
        pendingApprovals: (approvals.count ?? 0) + (v2Approvals.count ?? 0),
        totalReceipts: receiptTotal,
        employeeCount: employees.count ?? 0,
        pendingClaims: claims.count ?? 0,
        totalLeads: leads.count ?? 0,
        pendingDocs: docs.count ?? 0,
      });
      const MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
      const map: Record<number, number> = {};
      allReceipts.filter(r => r.receipt_type === "income" && r.receipt_date?.startsWith(String(year))).forEach(r => {
        const m = new Date(r.receipt_date).getMonth();
        map[m] = (map[m] ?? 0) + Number(r.amount) / 1_000_000;
      });
      setChartData(MONTHS.map((month, i) => ({ month, revenue: +((map[i] ?? 0).toFixed(1)) })));
    });
  }, []);

  const totalUnits = project?.total_units ?? 0;
  const soldUnits = project?.sold_units ?? 0;
  const available = project?.available_units ?? 0;
  const revenue = project?.revenue_actual ?? 0;
  const constructionProgress = project?.construction_progress ?? 0;
  const selloutForecast = project?.sellout_forecast ?? "-";
  const selloutPct = totalUnits > 0 ? Math.round((soldUnits / totalUnits) * 100) : 0;
  const noProjectData = !loading && project === null;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-aviva-gold tracking-wide">AVIVA ONE</h1>
              <span className="text-[10px] font-bold text-aviva-gold/70 bg-aviva-gold/10 px-2 py-0.5 rounded-full border border-aviva-gold/20">v2.7</span>
            </div>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {ctxUser ? `${ctxUser.full_name} · ${ctxUser.department}` : formatDate()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {ctxUser?.isAdmin && (
              <Link href="/approvals" className="p-2 rounded-full bg-aviva-gold/10 border border-aviva-gold/30">
                <Settings size={18} className="text-aviva-gold" />
              </Link>
            )}
            <button onClick={handleLogout} className="p-2 rounded-full bg-aviva-card border border-aviva-gold/10">
              <LogOut size={18} className="text-aviva-secondary" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* AI Quick Access */}
        <Link href="/ai" className="flex items-center gap-3 bg-aviva-card rounded-2xl p-3 border border-aviva-gold/20 hover:border-aviva-gold/40 transition-all active:scale-[0.98]">
          <div className="w-9 h-9 rounded-xl bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-aviva-gold" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-aviva-text">AVIVA AI Executive</p>
            <p className="text-xs text-aviva-secondary">ถามคำถามหรือวิเคราะห์ข้อมูลโครงการ</p>
          </div>
          <ChevronRight size={16} className="text-aviva-secondary/50" />
        </Link>

        {/* Pending Alert Banner */}
        {(stats.pendingApprovals + stats.pendingClaims + stats.pendingDocs) > 0 && (
          <GlassCard className="p-3 border border-yellow-500/20 bg-yellow-500/5">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-yellow-400 flex-shrink-0" />
              <div className="flex-1 flex flex-wrap gap-3">
                {stats.pendingApprovals > 0 && (
                  <span className="text-xs text-yellow-400">รออนุมัติ: <b>{stats.pendingApprovals}</b></span>
                )}
                {stats.pendingClaims > 0 && (
                  <span className="text-xs text-yellow-400">แจ้งซ่อม: <b>{stats.pendingClaims}</b></span>
                )}
                {stats.pendingDocs > 0 && (
                  <span className="text-xs text-yellow-400">เอกสาร: <b>{stats.pendingDocs}</b></span>
                )}
              </div>
            </div>
          </GlassCard>
        )}

        {noProjectData ? (
          <GlassCard className="p-6 text-center border border-aviva-gold/20">
            <ShieldAlert size={28} className="text-aviva-secondary/40 mx-auto mb-3" />
            <p className="text-sm font-semibold text-aviva-text mb-1">ยังไม่มีข้อมูลโครงการ</p>
            <p className="text-xs text-aviva-secondary mb-4">กรุณากรอกข้อมูลโครงการในหน้าตั้งค่า</p>
            <Link href="/settings" className="inline-flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-4 py-2 rounded-xl">
              <Settings size={12} /> ไปที่ตั้งค่า
            </Link>
          </GlassCard>
        ) : (
          <>
            {/* KPI Grid */}
            <div>
              <SectionHeader title="ภาพรวมโครงการ"
                subtitle={loading ? "กำลังโหลด..." : "กดการ์ดเพื่อดูรายละเอียด"} />
              <div className="grid grid-cols-2 gap-3">
                <KPICard icon={Home} label="ยูนิตทั้งหมด" value={`${totalUnits}`} onClick={() => openKpi("units")} />
                <KPICard icon={Users} label="ขายแล้ว" value={`${soldUnits}`} change={5} highlight onClick={() => openKpi("sold")} />
                <KPICard icon={Package} label="ว่างอยู่" value={`${available}`} onClick={() => openKpi("available")} />
                <KPICard icon={DollarSign} label="รายได้รวม" value={`฿${formatMillions(revenue)}`} change={8.7} onClick={() => openKpi("revenue")} />
              </div>
            </div>

            {/* Sellout Progress */}
            <GlassCard className="p-4">
              <SectionHeader title="ความคืบหน้าการขาย" subtitle={`คาดว่าจะขายหมด: ${selloutForecast}`} />
              <ProgressBar label={`ขายแล้ว ${soldUnits} / ${totalUnits} ยูนิต`} value={selloutPct} />
              <div className="flex items-center justify-between mt-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-aviva-gold">{selloutPct}%</p>
                  <p className="text-xs text-aviva-secondary">ขายแล้ว</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-aviva-text">{available}</p>
                  <p className="text-xs text-aviva-secondary">ยูนิตว่าง</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-aviva-text">{constructionProgress}%</p>
                  <p className="text-xs text-aviva-secondary">ก่อสร้างแล้ว</p>
                </div>
              </div>
            </GlassCard>
          </>
        )}

        {/* Cross-Module Summary */}
        <div>
          <SectionHeader title="สถานะทุกฝ่าย" subtitle="Real-time จาก Supabase" />
          <div className="grid grid-cols-3 gap-2">
            <GlassCard className="p-3 text-center">
              <ClipboardList size={14} className="text-aviva-gold mx-auto mb-1" />
              <p className="text-lg font-bold text-aviva-text">{stats.totalLeads}</p>
              <p className="text-[10px] text-aviva-secondary">Leads ทั้งหมด</p>
            </GlassCard>
            <GlassCard className="p-3 text-center">
              <Receipt size={14} className="text-blue-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-blue-400">฿{formatMillions(stats.totalReceipts)}</p>
              <p className="text-[10px] text-aviva-secondary">บิล/ใบเสร็จ</p>
            </GlassCard>
            <GlassCard className="p-3 text-center">
              <UserCheck size={14} className="text-green-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-green-400">{stats.employeeCount}</p>
              <p className="text-[10px] text-aviva-secondary">พนักงาน</p>
            </GlassCard>
          </div>
        </div>

        <GlassCard className="p-4">
          <SectionHeader title="รายได้รายเดือน" subtitle="หน่วย: ล้านบาท" />
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: "#D1D5DB", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#D1D5DB", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#17332D", border: "1px solid #D4AF37", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                  formatter={(val) => [`฿${val}M`, "รายได้"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2} fill="url(#goldGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* AI Insights */}
        <div>
          <SectionHeader title="AI Executive Insights" subtitle="วิเคราะห์โดย AVIVA AI" />
          <div className="space-y-3">
            {stats.pendingApprovals > 0 && (
              <AIInsightPanel type="warning" priority="high"
                title={`มี ${stats.pendingApprovals} รายการรออนุมัติ`}
                message="กรุณาตรวจสอบและอนุมัติรายการทางการเงินที่ค้างอยู่เพื่อไม่ให้กระทบการดำเนินงาน" />
            )}
            {stats.pendingClaims > 0 && (
              <AIInsightPanel type="alert" priority="medium"
                title={`มี ${stats.pendingClaims} คลิมหลังการขายรอดำเนินการ`}
                message="ควรติดตามและดำเนินการภายใน 7 วันเพื่อรักษาความพึงพอใจของลูกค้า" />
            )}
            {stats.totalLeads > 0 && (
              <AIInsightPanel type="info" priority="low"
                title={`มี Leads ทั้งหมด ${stats.totalLeads} ราย`}
                message="ติดตาม Lead อย่างสม่ำเสมอเพื่อเพิ่มอัตราการปิดการขาย" />
            )}
            {stats.pendingApprovals === 0 && stats.pendingClaims === 0 && stats.totalLeads === 0 && (
              <AIInsightPanel type="success" priority="low"
                title="ทุกระบบทำงานปกติ"
                message="ไม่มีรายการค้างดำเนินการในขณะนี้" />
            )}
          </div>
        </div>

        {/* Calendar */}
        <div>
          <SectionHeader title="ปฏิทินกิจกรรม" subtitle="กดวันเพื่อดู/เพิ่มกิจกรรม" />
          <CalendarWidget />
        </div>
      </div>

      {/* KPI Detail Modal */}
      {kpiModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 max-h-[80vh] flex flex-col mb-14">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-aviva-text">{KPI_LABELS[kpiModal] ?? kpiModal}</h2>
              <button onClick={() => setKpiModal(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {kpiLoading ? (
                [1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-aviva-bg/50 animate-pulse" />)
              ) : kpiItems.length === 0 ? (
                <p className="text-center text-aviva-secondary text-sm py-8">ยังไม่มีข้อมูล</p>
              ) : kpiModal === "revenue" ? (
                kpiItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-aviva-bg rounded-xl px-4 py-3">
                    <div>
                      <p className="text-xs text-aviva-text font-medium">{String(item.description ?? "รับเงิน")}</p>
                      <p className="text-[10px] text-aviva-secondary">
                        {item.receipt_date ? new Date(String(item.receipt_date)).toLocaleDateString("th-TH") : "—"}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-aviva-gold">฿{Number(item.amount ?? 0).toLocaleString()}</p>
                  </div>
                ))
              ) : kpiModal === "sold" ? (
                kpiItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-aviva-bg rounded-xl px-4 py-3">
                    <div>
                      <p className="text-xs text-aviva-text font-medium">{String(item.customer_name ?? "—")}</p>
                      <p className="text-[10px] text-aviva-secondary">{String(item.phone ?? "")}</p>
                    </div>
                    <p className="text-sm font-bold text-green-400">฿{(Number(item.budget ?? 0) / 1_000_000).toFixed(1)}M</p>
                  </div>
                ))
              ) : (
                kpiItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-aviva-bg rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-aviva-text">{String(item.house_number ?? "—")}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-aviva-secondary">{String(item.status ?? "")}</span>
                      <span className="text-xs font-bold text-aviva-gold">{Number(item.progress ?? 0)}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
