"use client";

import { useEffect, useState } from "react";
import { Bell, Home, DollarSign, Users, Package, LogOut, ClipboardList, Receipt, UserCheck, ShieldAlert } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import KPICard from "@/components/KPICard";
import AIInsightPanel from "@/components/AIInsightPanel";
import ProgressBar from "@/components/ProgressBar";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { revenueData, aiInsights } from "@/lib/mock-data";

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

export default function DashboardPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CrossModuleStats>({
    pendingApprovals: 0, totalReceipts: 0, employeeCount: 0,
    pendingClaims: 0, totalLeads: 0, pendingDocs: 0,
  });
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null);
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  useEffect(() => {
    supabase.from("projects").select("*").eq("id", PROJECT_ID).single()
      .then(({ data }) => { setProject(data); setLoading(false); });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata) {
        setCurrentUser({
          name: user.user_metadata.full_name ?? user.email ?? "ผู้ใช้",
          role: user.user_metadata.department ?? user.user_metadata.role ?? "ผู้ใช้ระบบ",
        });
      }
    });

    Promise.all([
      supabase.from("approvals").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("receipts").select("amount").eq("project_id", PROJECT_ID),
      supabase.from("employees").select("id", { count: "exact" }).eq("status", "active"),
      supabase.from("warranty_claims").select("id", { count: "exact" }).eq("status", "pending").eq("project_id", PROJECT_ID),
      supabase.from("leads").select("id", { count: "exact" }).eq("project_id", PROJECT_ID),
      supabase.from("documents").select("id", { count: "exact" }).eq("status", "pending").eq("project_id", PROJECT_ID),
    ]).then(([approvals, receipts, employees, claims, leads, docs]) => {
      const receiptTotal = (receipts.data ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
      setStats({
        pendingApprovals: approvals.count ?? 0,
        totalReceipts: receiptTotal,
        employeeCount: employees.count ?? 0,
        pendingClaims: claims.count ?? 0,
        totalLeads: leads.count ?? 0,
        pendingDocs: docs.count ?? 0,
      });
    });
  }, []);

  const totalUnits = project?.total_units ?? 120;
  const soldUnits = project?.sold_units ?? 73;
  const available = project?.available_units ?? 47;
  const revenue = project?.revenue_actual ?? 285_000_000;
  const constructionProgress = project?.construction_progress ?? 68;
  const selloutForecast = project?.sellout_forecast ?? "Q3 2026";
  const selloutPct = Math.round((soldUnits / totalUnits) * 100);

  return (
    <div className="min-h-screen bg-aviva-bg">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-bold text-aviva-gold tracking-wide">AVIVA ONE</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {currentUser ? `${currentUser.name} · ${currentUser.role}` : formatDate()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-full bg-aviva-card border border-aviva-gold/10">
              <Bell size={18} className="text-aviva-secondary" />
              {(stats.pendingApprovals + stats.pendingClaims + stats.pendingDocs) > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
            <button onClick={handleLogout} className="p-2 rounded-full bg-aviva-card border border-aviva-gold/10">
              <LogOut size={18} className="text-aviva-secondary" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* KPI Grid */}
        <div>
          <SectionHeader title="ภาพรวมโครงการ"
            subtitle={loading ? "กำลังโหลด..." : "ข้อมูล Real-time จาก Supabase"} />
          <div className="grid grid-cols-2 gap-3">
            <KPICard icon={Home} label="ยูนิตทั้งหมด" value={`${totalUnits}`} />
            <KPICard icon={Users} label="ขายแล้ว" value={`${soldUnits}`} change={5} highlight />
            <KPICard icon={Package} label="ว่างอยู่" value={`${available}`} />
            <KPICard icon={DollarSign} label="รายได้รวม" value={`฿${formatMillions(revenue)}`} change={8.7} />
          </div>
        </div>

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
          {(stats.pendingApprovals + stats.pendingClaims + stats.pendingDocs) > 0 && (
            <GlassCard className="p-3 mt-2 border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-yellow-400 flex-shrink-0" />
                <div className="flex-1 flex flex-wrap gap-3">
                  {stats.pendingApprovals > 0 && (
                    <span className="text-xs text-yellow-400">รออนุมัติการเงิน: <b>{stats.pendingApprovals}</b></span>
                  )}
                  {stats.pendingClaims > 0 && (
                    <span className="text-xs text-yellow-400">แจ้งซ่อมรอดำเนินการ: <b>{stats.pendingClaims}</b></span>
                  )}
                  {stats.pendingDocs > 0 && (
                    <span className="text-xs text-yellow-400">เอกสารรออนุมัติ: <b>{stats.pendingDocs}</b></span>
                  )}
                </div>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Revenue Chart */}
        <GlassCard className="p-4">
          <SectionHeader title="รายได้รายเดือน" subtitle="หน่วย: ล้านบาท" />
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
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
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">+8.7%</p>
              <p className="text-xs text-aviva-secondary">Cashflow</p>
            </div>
          </div>
        </GlassCard>

        {/* AI Insights */}
        <div>
          <SectionHeader title="AI Executive Insights" subtitle="วิเคราะห์โดย AVIVA AI" />
          <div className="space-y-3">
            {aiInsights.slice(0, 3).map((insight) => (
              <AIInsightPanel key={insight.id} {...insight} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
