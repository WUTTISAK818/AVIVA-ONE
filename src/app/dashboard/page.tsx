"use client";

import { useEffect, useState, useRef } from "react";
import { Home, Users, Package, LogOut, Receipt, ShieldAlert, BadgeCheck, Settings, X, Sparkles, Bot, Send, CheckCircle, HardHat, FileText, Briefcase, TrendingUp, TrendingDown } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { useCurrentUser } from "@/lib/user-context";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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

interface AiMsg { role: "user" | "assistant"; text: string; }

interface CrossModuleStats {
  pendingApprovals: number;
  totalReceipts: number;
  expenseTotal: number;
  employeeCount: number;
  pendingClaims: number;
  totalLeads: number;
  pendingDocs: number;
}

interface ConstructionStats {
  total: number;
  inReview: number;
  approved: number;
  paid: number;
}

interface PendingBreakdown {
  workflow_type: string;
  count: number;
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
  revenue: "รายได้ 20 รายการล่าสุด",
};

export default function DashboardPage() {
  const ctxUser = useCurrentUser();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CrossModuleStats>({
    pendingApprovals: 0, totalReceipts: 0, expenseTotal: 0, employeeCount: 0,
    pendingClaims: 0, totalLeads: 0, pendingDocs: 0,
  });
  const [constructionStats, setConstructionStats] = useState<ConstructionStats>({ total: 0, inReview: 0, approved: 0, paid: 0 });
  const [kpiModal, setKpiModal] = useState<string | null>(null);
  const [kpiItems, setKpiItems] = useState<Record<string, unknown>[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [chartData, setChartData] = useState<{ month: string; revenue: number }[]>([]);
  const [showAI, setShowAI] = useState(false);
  const [pendingBreakdown, setPendingBreakdown] = useState<PendingBreakdown[]>([]);
  const [aiMsgs, setAiMsgs] = useState<AiMsg[]>([{ role: "assistant", text: "สวัสดีค่ะ AVIVA AI Executive พร้อมวิเคราะห์ข้อมูลโครงการ AVIVA ONE ถามได้เลยค่ะ" }]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMsgs]);

  const sendAiMsg = async () => {
    const msg = aiInput.trim();
    if (!msg || aiLoading) return;
    setAiInput("");
    setAiMsgs(p => [...p, { role: "user", text: msg }]);
    setAiLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/ai-chat", { method: "POST", headers: { "Content-Type": "application/json", ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ message: msg }) });
      const data = await res.json();
      setAiMsgs(p => [...p, { role: "assistant", text: data.response ?? "ขออภัย ไม่สามารถตอบได้ค่ะ" }]);
    } catch {
      setAiMsgs(p => [...p, { role: "assistant", text: "ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ" }]);
    }
    setAiLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const openKpi = async (type: string) => {
    setKpiModal(type);
    setKpiLoading(true);
    setKpiItems([]);
    if (type === "units") {
      const { data } = await supabase.from("houses").select("house_number,status,progress").eq("project_id", PROJECT_ID).order("plot_number");
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

  const fetchPendingBreakdown = async () => {
    const { data } = await supabase.from("approval_logs").select("workflow_type").eq("action_taken", "Pending");
    if (!data) return;
    const counts: Record<string, number> = {};
    data.forEach((r: { workflow_type: string }) => { counts[r.workflow_type] = (counts[r.workflow_type] ?? 0) + 1; });
    setPendingBreakdown(Object.entries(counts).map(([workflow_type, count]) => ({ workflow_type, count })));
    const total = data.length;
    setStats(prev => ({ ...prev, pendingApprovals: total }));
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
      supabase.from("contractor_installments").select("status,amount").eq("project_id", PROJECT_ID),
    ]).then(([approvals, receipts, employees, claims, leads, docs, installments]) => {
      const allReceipts = (receipts.data ?? []) as { amount: number; receipt_date: string; receipt_type: string }[];
      const receiptTotal = allReceipts.filter(r => r.receipt_type === "income").reduce((s, r) => s + Number(r.amount), 0);
      const expTotal = allReceipts.filter(r => r.receipt_type === "expense").reduce((s, r) => s + Number(r.amount), 0);
      setStats(prev => ({
        ...prev,
        pendingApprovals: approvals.count ?? 0,
        totalReceipts: receiptTotal,
        expenseTotal: expTotal,
        employeeCount: employees.count ?? 0,
        pendingClaims: claims.count ?? 0,
        totalLeads: leads.count ?? 0,
        pendingDocs: docs.count ?? 0,
      }));
      const insts = (installments.data ?? []) as { status: string }[];
      setConstructionStats({
        total: insts.length,
        inReview: insts.filter(i => i.status === "in_review").length,
        approved: insts.filter(i => i.status === "approved").length,
        paid: insts.filter(i => i.status === "paid").length,
      });
      const MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
      const map: Record<number, number> = {};
      allReceipts.filter(r => r.receipt_type === "income" && r.receipt_date?.startsWith(String(year))).forEach(r => {
        const m = new Date(r.receipt_date).getMonth();
        map[m] = (map[m] ?? 0) + Number(r.amount) / 1_000_000;
      });
      setChartData(MONTHS.map((month, i) => ({ month, revenue: +((map[i] ?? 0).toFixed(1)) })));
    });

    fetchPendingBreakdown();

    const channel = supabase.channel("dashboard_approvals_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_logs" }, fetchPendingBreakdown)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
              <span className="text-[10px] font-bold text-aviva-gold/70 bg-aviva-gold/10 px-2 py-0.5 rounded-full border border-aviva-gold/20">v2.9.5</span>
            </div>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {ctxUser ? `${ctxUser.full_name} · ${ctxUser.department}` : formatDate()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {ctxUser?.isAdmin && (
              <Link href="/approvals" className="p-2 rounded-full bg-aviva-gold/10 border border-aviva-gold/30">
                <BadgeCheck size={18} className="text-aviva-gold" />
              </Link>
            )}
            <button onClick={handleLogout} className="p-2 rounded-full bg-aviva-card border border-aviva-gold/10">
              <LogOut size={18} className="text-aviva-secondary" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* AI Executive Panel */}
        <div className="bg-aviva-card rounded-2xl border border-aviva-gold/20 overflow-hidden">
          <button onClick={() => setShowAI(a => !a)}
            className="w-full flex items-center gap-3 p-3 hover:bg-aviva-gold/5 transition-all active:scale-[0.99]">
            <div className="w-9 h-9 rounded-xl bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-aviva-gold" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-aviva-text">AVIVA AI Executive</p>
              <p className="text-xs text-aviva-secondary">วิเคราะห์ข้อมูลโครงการ Real-time</p>
            </div>
            <Bot size={16} className={showAI ? "text-aviva-gold" : "text-aviva-secondary/50"} />
          </button>
          {showAI && (
            <div className="border-t border-aviva-gold/10">
              <div className="h-52 overflow-y-auto p-3 space-y-2 bg-aviva-bg/30">
                {aiMsgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] rounded-xl px-3 py-2 text-xs ${m.role === "user" ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-card text-aviva-text border border-aviva-gold/10"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-aviva-card text-aviva-secondary text-xs rounded-xl px-3 py-2 border border-aviva-gold/10">กำลังวิเคราะห์...</div>
                  </div>
                )}
                <div ref={aiEndRef} />
              </div>
              <div className="flex items-center gap-2 p-2 border-t border-aviva-gold/10 bg-aviva-card">
                <input value={aiInput} onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendAiMsg()}
                  placeholder="ถามเกี่ยวกับโครงการ AVIVA ONE..."
                  className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/50 placeholder:text-aviva-secondary/40" />
                <button onClick={sendAiMsg} disabled={!aiInput.trim() || aiLoading}
                  className="p-2 rounded-xl bg-aviva-gold text-aviva-bg disabled:opacity-40 flex-shrink-0">
                  <Send size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Approval Inbox */}
        {ctxUser?.isManager && (
          <GlassCard className="p-4 border border-aviva-gold/15">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BadgeCheck size={15} className="text-aviva-gold" />
                <span className="text-sm font-semibold text-aviva-text">คำขออนุมัติ</span>
                {pendingBreakdown.reduce((s, b) => s + b.count, 0) > 0 && (
                  <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                    {pendingBreakdown.reduce((s, b) => s + b.count, 0)} รายการ
                  </span>
                )}
              </div>
              <Link href="/approvals" className="text-[11px] text-aviva-gold font-medium hover:underline">
                ดูทั้งหมด →
              </Link>
            </div>
            {pendingBreakdown.length === 0 ? (
              <div className="flex items-center gap-2 py-1">
                <CheckCircle size={13} className="text-green-400" />
                <p className="text-xs text-aviva-secondary">ไม่มีรายการรออนุมัติ</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {pendingBreakdown.map(({ workflow_type, count }) => {
                  const cfg: Record<string, { label: string; Icon: typeof BadgeCheck; color: string; bg: string }> = {
                    Installment_Review: { label: "ตรวจสอบงวดงาน", Icon: HardHat, color: "text-orange-400", bg: "bg-orange-500/10" },
                    Material_Purchase:  { label: "ขออนุมัติจัดซื้อ", Icon: Package, color: "text-blue-400", bg: "bg-blue-500/10" },
                    Document_Approval:  { label: "ขออนุมัติเอกสาร", Icon: FileText, color: "text-purple-400", bg: "bg-purple-500/10" },
                    Finance_Approval:   { label: "ขออนุมัติรายจ่าย", Icon: Receipt, color: "text-yellow-400", bg: "bg-yellow-500/10" },
                    Leave_Request:      { label: "ขออนุมัติการลา", Icon: Briefcase, color: "text-teal-400", bg: "bg-teal-500/10" },
                  };
                  const c = cfg[workflow_type] ?? { label: workflow_type, Icon: ShieldAlert, color: "text-aviva-secondary", bg: "bg-aviva-bg/50" };
                  return (
                    <Link key={workflow_type} href="/approvals"
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-aviva-bg/50 hover:bg-aviva-gold/5 transition-all active:scale-[0.98]">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${c.bg}`}>
                          <c.Icon size={11} className={c.color} />
                        </div>
                        <span className="text-xs text-aviva-text">{c.label}</span>
                      </div>
                      <span className={`text-xs font-bold ${c.color}`}>{count} รายการ</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </GlassCard>
        )}

        {/* AI Insights */}
        <div>
          <SectionHeader title="AI Executive Insights" subtitle="วิเคราะห์โดย AVIVA AI" />
          <div className="space-y-3">
            {stats.pendingApprovals > 0 && (
              <Link href="/approvals">
                <AIInsightPanel type="warning" priority="high"
                  title={`มี ${stats.pendingApprovals} รายการรออนุมัติ`}
                  message="กรุณาตรวจสอบและอนุมัติรายการที่ค้างอยู่เพื่อไม่ให้กระทบการดำเนินงาน" />
              </Link>
            )}
            {stats.pendingClaims > 0 && (
              <AIInsightPanel type="alert" priority="medium"
                title={`มี ${stats.pendingClaims} คลิมหลังการขายรอดำเนินการ`}
                message="ควรติดตามและดำเนินการภายใน 7 วันเพื่อรักษาความพึงพอใจของลูกค้า" />
            )}
            {stats.totalLeads > 0 && (
              <Link href="/crm">
                <AIInsightPanel type="info" priority="low"
                  title={`มี Leads ทั้งหมด ${stats.totalLeads} ราย`}
                  message="ติดตาม Lead อย่างสม่ำเสมอเพื่อเพิ่มอัตราการปิดการขาย" />
              </Link>
            )}
            {stats.pendingApprovals === 0 && stats.pendingClaims === 0 && stats.totalLeads === 0 && (
              <AIInsightPanel type="success" priority="low"
                title="ทุกระบบทำงานปกติ"
                message="ไม่มีรายการค้างดำเนินการในขณะนี้" />
            )}
          </div>
        </div>

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
            {/* ภาพรวมโครงการ — 3-col KPI */}
            <div>
              <SectionHeader title="ภาพรวมโครงการ"
                subtitle={loading ? "กำลังโหลด..." : "กดการ์ดเพื่อดูรายละเอียด"} />
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => openKpi("units")}
                  className="bg-aviva-card rounded-2xl border border-aviva-gold/15 p-3 text-center active:scale-95 transition-all">
                  <Home size={15} className="text-aviva-gold mx-auto mb-1.5" />
                  <p className="text-xl font-bold text-aviva-text">{totalUnits}</p>
                  <p className="text-[10px] text-aviva-secondary leading-tight">ยูนิตทั้งหมด</p>
                </button>
                <button onClick={() => openKpi("sold")}
                  className="bg-aviva-gold/10 rounded-2xl border border-aviva-gold/30 p-3 text-center active:scale-95 transition-all">
                  <Users size={15} className="text-aviva-gold mx-auto mb-1.5" />
                  <p className="text-xl font-bold text-aviva-gold">{soldUnits}</p>
                  <p className="text-[10px] text-aviva-secondary leading-tight">ขายแล้ว</p>
                </button>
                <button onClick={() => openKpi("available")}
                  className="bg-aviva-card rounded-2xl border border-aviva-gold/15 p-3 text-center active:scale-95 transition-all">
                  <Package size={15} className="text-green-400 mx-auto mb-1.5" />
                  <p className="text-xl font-bold text-green-400">{available}</p>
                  <p className="text-[10px] text-aviva-secondary leading-tight">ว่างอยู่</p>
                </button>
              </div>
            </div>

            {/* Financial Overview with chart */}
            <GlassCard className="p-4">
              <SectionHeader title="ภาพรวมการเงิน" subtitle="รายรับ-รายจ่าย ปีปัจจุบัน" />
              {project && project.revenue_target > 0 && (
                <div className="mb-4 bg-aviva-bg/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-aviva-secondary">รายรับจริง vs เป้าหมาย</span>
                    <span className="text-[10px] font-bold text-aviva-gold">
                      {Math.min(100, Math.round((stats.totalReceipts / project.revenue_target) * 100))}%
                    </span>
                  </div>
                  <div className="h-2 bg-aviva-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-aviva-gold rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round((stats.totalReceipts / project.revenue_target) * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-aviva-secondary">฿{formatMillions(stats.totalReceipts)}</span>
                    <span className="text-[10px] text-aviva-secondary">เป้า ฿{formatMillions(project.revenue_target)}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => openKpi("revenue")}
                  className="bg-aviva-bg/50 rounded-xl p-3 text-center active:scale-95 transition-all">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp size={12} className="text-green-400" />
                    <span className="text-[10px] text-aviva-secondary">รายรับ</span>
                  </div>
                  <p className="text-base font-bold text-green-400">฿{formatMillions(stats.totalReceipts)}</p>
                </button>
                <div className="bg-aviva-bg/50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingDown size={12} className="text-red-400" />
                    <span className="text-[10px] text-aviva-secondary">รายจ่าย</span>
                  </div>
                  <p className="text-base font-bold text-red-400">฿{formatMillions(stats.expenseTotal)}</p>
                </div>
              </div>
              <p className="text-[10px] text-aviva-secondary mb-2">รายได้รายเดือน (ล้านบาท)</p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fill: "#D1D5DB", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#D1D5DB", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#17332D", border: "1px solid #D4AF37", borderRadius: "8px", color: "#fff", fontSize: "11px" }}
                      formatter={(val) => [`฿${val}M`, "รายได้"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2} fill="url(#goldGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Construction Info Box */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <SectionHeader title="ก่อสร้าง" subtitle="สถานะงวดงาน" />
                <Link href="/construction" className="text-[11px] text-aviva-gold font-medium">ดูเพิ่มเติม →</Link>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-aviva-bg/50 rounded-xl p-2.5 text-center">
                  <p className="text-base font-bold text-aviva-text">{constructionStats.total}</p>
                  <p className="text-[10px] text-aviva-secondary">งวดทั้งหมด</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-xl p-2.5 text-center">
                  <p className="text-base font-bold text-yellow-400">{constructionStats.inReview}</p>
                  <p className="text-[10px] text-aviva-secondary">รออนุมัติ</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-xl p-2.5 text-center">
                  <p className="text-base font-bold text-green-400">{constructionStats.approved}</p>
                  <p className="text-[10px] text-aviva-secondary">อนุมัติแล้ว</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-xl p-2.5 text-center">
                  <p className="text-base font-bold text-blue-400">{constructionStats.paid}</p>
                  <p className="text-[10px] text-aviva-secondary">เบิกแล้ว</p>
                </div>
              </div>
              <ProgressBar label={`ความคืบหน้าก่อสร้าง ${constructionProgress}%`} value={constructionProgress} />
            </GlassCard>

            {/* CRM */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <SectionHeader title="CRM — ฝ่ายขาย" subtitle={`คาดว่าจะขายหมด: ${selloutForecast}`} />
                <Link href="/crm" className="text-[11px] text-aviva-gold font-medium">ดูเพิ่มเติม →</Link>
              </div>
              <ProgressBar label={`ขายแล้ว ${soldUnits} / ${totalUnits} ยูนิต`} value={selloutPct} />
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-aviva-bg/50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-aviva-gold">{selloutPct}%</p>
                  <p className="text-[10px] text-aviva-secondary">ปิดการขาย</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-aviva-text">{stats.totalLeads}</p>
                  <p className="text-[10px] text-aviva-secondary">Leads ทั้งหมด</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-aviva-text">{available}</p>
                  <p className="text-[10px] text-aviva-secondary">ยูนิตว่าง</p>
                </div>
              </div>
            </GlassCard>
          </>
        )}

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
