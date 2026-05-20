"use client";

import { useEffect, useState } from "react";
import { Bell, Home, DollarSign, Users, Package } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import KPICard from "@/components/KPICard";
import AIInsightPanel from "@/components/AIInsightPanel";
import ProgressBar from "@/components/ProgressBar";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
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

  useEffect(() => {
    supabase
      .from("projects")
      .select("*")
      .eq("id", PROJECT_ID)
      .single()
      .then(({ data }) => {
        setProject(data);
        setLoading(false);
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
            <p className="text-xs text-aviva-secondary mt-0.5">{formatDate()}</p>
          </div>
          <button className="relative p-2 rounded-full bg-aviva-card border border-aviva-gold/10">
            <Bell size={18} className="text-aviva-secondary" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-aviva-gold" />
          </button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* KPI Grid */}
        <div>
          <SectionHeader
            title="ภาพรวมโครงการ"
            subtitle={loading ? "กำลังโหลด..." : "ข้อมูล Real-time จาก Supabase"}
          />
          <div className="grid grid-cols-2 gap-3">
            <KPICard icon={Home} label="ยูนิตทั้งหมด" value={`${totalUnits}`} />
            <KPICard icon={Users} label="ขายแล้ว" value={`${soldUnits}`} change={5} highlight />
            <KPICard icon={Package} label="ว่างอยู่" value={`${available}`} />
            <KPICard
              icon={DollarSign}
              label="รายได้รวม"
              value={`฿${formatMillions(revenue)}`}
              change={8.7}
            />
          </div>
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
