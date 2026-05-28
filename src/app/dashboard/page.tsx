"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LogOut, Settings, X, Sparkles, ChevronRight, TrendingUp,
  HardHat, Users, DollarSign, BarChart3, AlertTriangle,
  CheckCircle2, Clock, Bell, ClipboardList, Megaphone,
  Home, FileText, Wrench, Building2,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { useCurrentUser } from "@/lib/user-context";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import AIInsightPanel from "@/components/AIInsightPanel";
import ProgressBar from "@/components/ProgressBar";
import GlassCard from "@/components/GlassCard";
import CalendarWidget from "@/components/CalendarWidget";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const APP_VERSION = "2.9.0";

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

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
function fmtDate() {
  return new Date().toLocaleDateString("th-TH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

export default function DashboardPage() {
  const user = useCurrentUser();
  const router = useRouter();

  // Residents land here after sign-in but the dashboard is staff-only.
  // Send them to the community announcements feed instead.
  useEffect(() => {
    if (user?.isResident) router.replace("/community/announcements");
  }, [user, router]);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ month: string; income: number; expense: number }[]>([]);
  const [showChart, setShowChart] = useState(false);

  // Stats
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [pendingClaims, setPendingClaims] = useState(0);
  const [pendingDocs, setPendingDocs] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [closedLeads, setClosedLeads] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpense, setMonthExpense] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [campaignLeads, setCampaignLeads] = useState(0);
  const [constructionPending, setConstructionPending] = useState(0);
  const [delayedHouses, setDelayedHouses] = useState(0);
  const [underConstruction, setUnderConstruction] = useState(0);
  const [employees, setEmployees] = useState(0);

  // Modals
  const [alertModal, setAlertModal] = useState<"approvals" | "claims" | "docs" | null>(null);
  const [insightModal, setInsightModal] = useState<string | null>(null);
  const [crmModal, setCrmModal] = useState(false);
  const [mktModal, setMktModal] = useState(false);

  const [approvalItems, setApprovalItems] = useState<Record<string, unknown>[]>([]);
  const [claimItems, setClaimItems] = useState<Record<string, unknown>[]>([]);
  const [leadItems, setLeadItems] = useState<Record<string, unknown>[]>([]);
  const [campaignItems, setCampaignItems] = useState<Record<string, unknown>[]>([]);

  const loadData = useCallback(async () => {
    const year = new Date().getFullYear();
    const month = new Date().getMonth();
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

    const [proj, appr, claims, docs, leads, receipts, campaigns, houses, emps] = await Promise.all([
      supabase.from("projects").select("*").eq("id", PROJECT_ID).single(),
      supabase.from("approvals").select("*").eq("status", "pending"),
      supabase.from("warranty_claims").select("*").eq("status", "pending").eq("project_id", PROJECT_ID),
      supabase.from("documents").select("id", { count: "exact" }).eq("status", "pending").eq("project_id", PROJECT_ID),
      supabase.from("leads").select("id,customer_name,status,source,budget,created_at,notes").eq("project_id", PROJECT_ID),
      supabase.from("receipts").select("amount,receipt_date,receipt_type").eq("project_id", PROJECT_ID),
      supabase.from("campaigns").select("*").eq("project_id", PROJECT_ID),
      supabase.from("houses").select("id,status,progress,delayed_days,house_number,contractor,phase").eq("project_id", PROJECT_ID),
      supabase.from("employees").select("id", { count: "exact" }).eq("status", "active"),
    ]);

    setProject(proj.data);
    setLoading(false);
    setPendingApprovals((appr.data ?? []).length);
    setPendingClaims((claims.data ?? []).length);
    setPendingDocs(docs.count ?? 0);
    setApprovalItems((appr.data ?? []) as Record<string, unknown>[]);
    setClaimItems((claims.data ?? []) as Record<string, unknown>[]);
    setEmployees(emps.count ?? 0);

    const allLeads = leads.data ?? [];
    setTotalLeads(allLeads.length);
    setClosedLeads(allLeads.filter((l) => l.status === "Closed Deal").length);
    setLeadItems(allLeads as Record<string, unknown>[]);

    const allReceipts = (receipts.data ?? []) as { amount: number; receipt_date: string; receipt_type: string }[];
    const thisMonth = allReceipts.filter(r => r.receipt_date?.startsWith(monthStr));
    setMonthIncome(thisMonth.filter(r => r.receipt_type === "income").reduce((s, r) => s + Number(r.amount), 0));
    setMonthExpense(Math.abs(thisMonth.filter(r => r.receipt_type === "expense").reduce((s, r) => s + Number(r.amount), 0)));

    const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const imap: Record<number, number> = {};
    const emap: Record<number, number> = {};
    allReceipts.filter(r => r.receipt_date?.startsWith(String(year))).forEach(r => {
      const m = new Date(r.receipt_date).getMonth();
      if (r.receipt_type === "income") imap[m] = (imap[m] ?? 0) + Number(r.amount) / 1_000_000;
      else emap[m] = (emap[m] ?? 0) + Math.abs(Number(r.amount)) / 1_000_000;
    });
    setChartData(MONTHS.map((mo, i) => ({ month: mo, income: +((imap[i] ?? 0).toFixed(1)), expense: +((emap[i] ?? 0).toFixed(1)) })));

    const allCampaigns = campaigns.data ?? [];
    setActiveCampaigns(allCampaigns.filter(c => c.status === "active").length);
    setCampaignLeads(allCampaigns.reduce((s, c) => s + (c.leads_generated ?? 0), 0));
    setCampaignItems(allCampaigns as Record<string, unknown>[]);

    const allHouses = houses.data ?? [];
    setUnderConstruction(allHouses.filter(h => h.status === "sold" || h.status === "on-track").length);
    setDelayedHouses(allHouses.filter(h => (h.delayed_days ?? 0) > 0).length);
    const instPending = await supabase.from("contractor_installments").select("id", { count: "exact" }).eq("status", "pending");
    setConstructionPending(instPending.count ?? 0);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const p = project;
  const selloutPct = p && p.total_units > 0 ? Math.round((p.sold_units / p.total_units) * 100) : 0;
  const financialNet = monthIncome - monthExpense;
  const totalAlerts = pendingApprovals + pendingClaims + pendingDocs;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-aviva-gold tracking-wide">AVIVA ONE</h1>
              <span className="text-xs font-bold text-aviva-gold/70 bg-aviva-gold/10 px-2 py-0.5 rounded-full border border-aviva-gold/20">v{APP_VERSION}</span>
            </div>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {user ? `${user.full_name} · ${user.department}` : fmtDate()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {user?.isAdmin && (
              <Link href="/settings" className="p-2 rounded-full bg-aviva-gold/10 border border-aviva-gold/30">
                <Settings size={18} className="text-aviva-gold" />
              </Link>
            )}
            <button onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
              className="p-2 rounded-full bg-aviva-card border border-aviva-gold/10">
              <LogOut size={18} className="text-aviva-secondary" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

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

        {/* AI Insights — moved to top */}
        <div className="space-y-2">
          {pendingApprovals > 0 && (
            <button onClick={() => setInsightModal("approvals")} className="w-full text-left">
              <AIInsightPanel type="warning" priority="high"
                title={`มี ${pendingApprovals} รายการรออนุมัติ`}
                message="กรุณาตรวจสอบและอนุมัติรายการที่ค้างอยู่เพื่อไม่ให้กระทบการดำเนินงาน" />
            </button>
          )}
          {pendingClaims > 0 && (
            <button onClick={() => setInsightModal("claims")} className="w-full text-left">
              <AIInsightPanel type="alert" priority="medium"
                title={`มี ${pendingClaims} คลิมหลังการขายรอดำเนินการ`}
                message="ควรติดตามและดำเนินการภายใน 7 วันเพื่อรักษาความพึงพอใจลูกค้า" />
            </button>
          )}
          {constructionPending > 0 && (
            <button onClick={() => setInsightModal("construction")} className="w-full text-left">
              <AIInsightPanel type="info" priority="medium"
                title={`มี ${constructionPending} งวดงานรอตรวจสอบ`}
                message="วิศวกรสามารถเข้าตรวจและส่งเบิกได้ที่หน้าฝ่ายก่อสร้าง" />
            </button>
          )}
          {pendingApprovals === 0 && pendingClaims === 0 && constructionPending === 0 && (
            <AIInsightPanel type="success" priority="low"
              title="ทุกระบบทำงานปกติ" message="ไม่มีรายการค้างดำเนินการในขณะนี้" />
          )}
        </div>

        {/* Alert Banner — clickable */}
        {totalAlerts > 0 && (
          <GlassCard className="p-3 border border-yellow-500/20 bg-yellow-500/5">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-yellow-400 flex-shrink-0" />
              <div className="flex-1 flex flex-wrap gap-2">
                {pendingApprovals > 0 && (
                  <button onClick={() => setAlertModal("approvals")}
                    className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20 active:scale-95">
                    <CheckCircle2 size={10} /> รออนุมัติ: <b>{pendingApprovals}</b>
                  </button>
                )}
                {pendingClaims > 0 && (
                  <button onClick={() => setAlertModal("claims")}
                    className="flex items-center gap-1 text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full border border-orange-400/20 active:scale-95">
                    <Wrench size={10} /> แจ้งซ่อม: <b>{pendingClaims}</b>
                  </button>
                )}
                {pendingDocs > 0 && (
                  <Link href="/documents"
                    className="flex items-center gap-1 text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20 active:scale-95">
                    <FileText size={10} /> เอกสาร: <b>{pendingDocs}</b>
                  </Link>
                )}
              </div>
            </div>
          </GlassCard>
        )}

        {/* รายการรออนุมัติ — รายละเอียดของแต่ละรายการ */}
        {pendingApprovals > 0 && (
          <GlassCard className="p-4 border border-yellow-500/30 bg-yellow-500/[0.03]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center">
                  <ClipboardList size={14} className="text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-aviva-text">รายการรออนุมัติ</p>
                  <p className="text-xs text-aviva-secondary">{pendingApprovals} รายการต้องตัดสินใจ</p>
                </div>
              </div>
              <Link href="/approvals" className="flex items-center gap-0.5 text-xs text-aviva-gold font-medium">
                ดูทั้งหมด <ChevronRight size={12} />
              </Link>
            </div>
            <div className="space-y-2">
              {approvalItems.slice(0, 3).map((item, i) => (
                <button key={i} onClick={() => setAlertModal("approvals")}
                  className="w-full text-left bg-aviva-bg rounded-xl px-3 py-2.5 hover:bg-aviva-bg/70 active:scale-[0.99] transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-aviva-text truncate">{String(item.description ?? "—")}</p>
                      <p className="text-xs text-aviva-secondary mt-0.5">
                        {String(item.module ?? "")}
                        {item.requested_by ? ` · ${String(item.requested_by)}` : ""}
                      </p>
                    </div>
                    {Number(item.amount ?? 0) > 0 && (
                      <span className="text-xs font-bold text-aviva-gold flex-shrink-0">
                        ฿{Number(item.amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {pendingApprovals > 3 && (
                <Link href="/approvals" className="block text-center text-xs text-aviva-secondary hover:text-aviva-gold py-1">
                  + อีก {pendingApprovals - 3} รายการ
                </Link>
              )}
            </div>
          </GlassCard>
        )}

        {/* ===== PROJECT OVERVIEW ===== */}
        <div>
          <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-2">ภาพรวมโครงการ</p>

          {/* Row 1: 3 KPI units in one row */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <GlassCard className="p-3 text-center">
              <Building2 size={14} className="text-aviva-gold mx-auto mb-1" />
              <p className="text-xl font-bold text-aviva-text">{p?.total_units ?? "-"}</p>
              <p className="text-xs text-aviva-secondary">ยูนิตทั้งหมด</p>
            </GlassCard>
            <GlassCard className="p-3 text-center border border-green-400/20">
              <CheckCircle2 size={14} className="text-green-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-green-400">{p?.sold_units ?? "-"}</p>
              <p className="text-xs text-aviva-secondary">ขายแล้ว</p>
            </GlassCard>
            <GlassCard className="p-3 text-center border border-blue-400/20">
              <Home size={14} className="text-blue-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-blue-400">{p?.available_units ?? "-"}</p>
              <p className="text-xs text-aviva-secondary">ว่างอยู่</p>
            </GlassCard>
          </div>

          {/* Row 2: Financial Summary */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-aviva-gold" />
                <p className="text-sm font-semibold text-aviva-text">สถานะการเงิน</p>
              </div>
              <button onClick={() => setShowChart(v => !v)}
                className="text-xs text-aviva-gold bg-aviva-gold/10 px-2 py-0.5 rounded-full border border-aviva-gold/20">
                {showChart ? "ซ่อน" : "ดูกราฟ"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="text-center">
                <p className="text-sm font-bold text-green-400">฿{fmt(monthIncome)}</p>
                <p className="text-xs text-aviva-secondary">รายรับเดือนนี้</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-red-400">฿{fmt(monthExpense)}</p>
                <p className="text-xs text-aviva-secondary">รายจ่ายเดือนนี้</p>
              </div>
              <div className="text-center">
                <p className={`text-sm font-bold ${financialNet >= 0 ? "text-aviva-gold" : "text-red-400"}`}>
                  {financialNet >= 0 ? "+" : ""}฿{fmt(financialNet)}
                </p>
                <p className="text-xs text-aviva-secondary">กำไร(สุทธิ)</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-aviva-secondary">
              <span>รายได้รวมสะสม: <b className="text-aviva-gold">฿{fmt(p?.revenue_actual ?? 0)}</b></span>
              <span>เป้า: <b>฿{fmt(p?.revenue_target ?? 0)}</b></span>
            </div>
            {p && p.revenue_target > 0 && (
              <ProgressBar value={Math.round(((p.revenue_actual ?? 0) / p.revenue_target) * 100)}
                label={`${Math.round(((p.revenue_actual ?? 0) / p.revenue_target) * 100)}% ของเป้าหมาย`} />
            )}
            {showChart && (
              <div className="mt-3 h-36">
                <p className="text-xs text-aviva-secondary mb-1">รายได้-รายจ่ายรายเดือน (ล้านบาท)</p>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fill: "#D1D5DB", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#D1D5DB", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#17332D", border: "1px solid #D4AF37", borderRadius: "8px", color: "#fff", fontSize: "11px" }}
                      formatter={(val, name) => [`฿${val}M`, name === "income" ? "รายรับ" : "รายจ่าย"]} />
                    <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={1.5} fill="url(#incGrad)" />
                    <Area type="monotone" dataKey="expense" stroke="#f87171" strokeWidth={1.5} fill="url(#expGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Construction Summary */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardHat size={14} className="text-orange-400" />
              <p className="text-sm font-semibold text-aviva-text">ภาพรวมก่อสร้าง</p>
            </div>
            <Link href="/construction" className="text-xs text-aviva-gold flex items-center gap-0.5">
              ดูทั้งหมด <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center bg-aviva-bg/50 rounded-lg p-2">
              <p className="text-base font-bold text-orange-400">{underConstruction}</p>
              <p className="text-xs text-aviva-secondary">กำลังก่อสร้าง</p>
            </div>
            <div className="text-center bg-aviva-bg/50 rounded-lg p-2">
              <p className={`text-base font-bold ${constructionPending > 0 ? "text-yellow-400" : "text-green-400"}`}>{constructionPending}</p>
              <p className="text-xs text-aviva-secondary">รอตรวจงวด</p>
            </div>
            <div className="text-center bg-aviva-bg/50 rounded-lg p-2">
              <p className={`text-base font-bold ${delayedHouses > 0 ? "text-red-400" : "text-green-400"}`}>{delayedHouses}</p>
              <p className="text-xs text-aviva-secondary">ล่าช้า</p>
            </div>
          </div>
          <ProgressBar label={`ความคืบหน้าก่อสร้างโดยรวม ${p?.construction_progress ?? 0}%`}
            value={p?.construction_progress ?? 0} />
          <div className="mt-2 flex items-center gap-2 text-xs text-aviva-secondary">
            <Users size={10} /> <span>วิศวกรโครงการ: <b className="text-aviva-text">{employees}</b> คน</span>
            <span className="ml-auto">แบบบ้าน AVA + VIVA</span>
          </div>
        </GlassCard>

        {/* CRM */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-blue-400" />
              <p className="text-sm font-semibold text-aviva-text">CRM — ลูกค้าสัมพันธ์</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCrmModal(true)} className="text-xs text-aviva-gold bg-aviva-gold/10 px-2 py-0.5 rounded-full border border-aviva-gold/20">
                รายละเอียด
              </button>
              <Link href="/crm" className="text-xs text-blue-400 flex items-center gap-0.5">
                ทั้งหมด <ChevronRight size={12} />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center bg-aviva-bg/50 rounded-lg p-2">
              <p className="text-base font-bold text-aviva-text">{totalLeads}</p>
              <p className="text-xs text-aviva-secondary">Leads ทั้งหมด</p>
            </div>
            <div className="text-center bg-aviva-bg/50 rounded-lg p-2">
              <p className="text-base font-bold text-green-400">{closedLeads}</p>
              <p className="text-xs text-aviva-secondary">ปิดการขาย</p>
            </div>
            <div className="text-center bg-aviva-bg/50 rounded-lg p-2">
              <p className="text-base font-bold text-blue-400">{totalLeads - closedLeads}</p>
              <p className="text-xs text-aviva-secondary">กำลังติดตาม</p>
            </div>
          </div>
          <ProgressBar label={`ปิดการขาย ${selloutPct}% — คาดขายหมด: ${p?.sellout_forecast ?? "-"}`}
            value={selloutPct} />
        </GlassCard>

        {/* Marketing */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Megaphone size={14} className="text-pink-400" />
              <p className="text-sm font-semibold text-aviva-text">การตลาด</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setMktModal(true)} className="text-xs text-aviva-gold bg-aviva-gold/10 px-2 py-0.5 rounded-full border border-aviva-gold/20">
                รายละเอียด
              </button>
              <Link href="/office" className="text-xs text-pink-400 flex items-center gap-0.5">
                ทั้งหมด <ChevronRight size={12} />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-aviva-bg/50 rounded-lg p-2">
              <p className="text-base font-bold text-pink-400">{activeCampaigns}</p>
              <p className="text-xs text-aviva-secondary">แคมเปญ Active</p>
            </div>
            <div className="text-center bg-aviva-bg/50 rounded-lg p-2">
              <p className="text-base font-bold text-aviva-text">{campaignLeads}</p>
              <p className="text-xs text-aviva-secondary">Leads จากแคมเปญ</p>
            </div>
            <div className="text-center bg-aviva-bg/50 rounded-lg p-2">
              <p className="text-base font-bold text-aviva-gold">
                {campaignItems.length > 0
                  ? (campaignItems as Array<{platform?: string}>).filter(c => (c as {status?: string}).status === "active").map(c => c.platform).join(", ") || "—"
                  : "—"}
              </p>
              <p className="text-xs text-aviva-secondary">ช่องทาง</p>
            </div>
          </div>
        </GlassCard>

        {/* Calendar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider">ปฏิทินกิจกรรม</p>
            <span className="text-xs text-aviva-secondary">กดวันเพื่อดู/เพิ่มกิจกรรม</span>
          </div>
          <CalendarWidget />
        </div>

      </div>

      {/* ===== MODALS ===== */}

      {/* Alert: Approvals */}
      {alertModal === "approvals" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 max-h-[75vh] flex flex-col mb-14">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-aviva-text">รายการรออนุมัติ ({pendingApprovals})</h2>
              <button onClick={() => setAlertModal(null)} aria-label="ปิด" className="p-2 -mr-2 text-aviva-secondary hover:text-aviva-gold"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {approvalItems.map((item, i) => (
                <div key={i} className="bg-aviva-bg rounded-xl px-4 py-3">
                  <p className="text-sm font-medium text-aviva-text">{String(item.description ?? "—")}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-aviva-secondary">{String(item.module ?? "")} · {String(item.requested_by ?? "")}</span>
                    <span className="text-sm font-bold text-aviva-gold">฿{Number(item.amount ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/approvals" onClick={() => setAlertModal(null)}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-semibold py-2.5 rounded-xl text-sm">
              <CheckCircle2 size={16} /> ไปยังหน้าอนุมัติ
            </Link>
          </div>
        </div>
      )}

      {/* Alert: Claims */}
      {alertModal === "claims" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 max-h-[75vh] flex flex-col mb-14">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-aviva-text">แจ้งซ่อมรอดำเนินการ ({pendingClaims})</h2>
              <button onClick={() => setAlertModal(null)} aria-label="ปิด" className="p-2 -mr-2 text-aviva-secondary hover:text-aviva-gold"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {claimItems.map((item, i) => (
                <div key={i} className="bg-aviva-bg rounded-xl px-4 py-3">
                  <p className="text-sm font-medium text-aviva-text">{String(item.customer_name ?? "—")}</p>
                  <p className="text-xs text-aviva-secondary">{String(item.issue_type ?? "")} — {String(item.description ?? "")}</p>
                  <p className="text-xs text-aviva-secondary/60 mt-1">สร้าง: {item.created_at ? new Date(String(item.created_at)).toLocaleDateString("th-TH") : "—"}</p>
                </div>
              ))}
            </div>
            <Link href="/office" onClick={() => setAlertModal(null)}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-orange-500 text-white font-semibold py-2.5 rounded-xl text-sm">
              <Wrench size={16} /> ไปยังหน้าหลังการขาย
            </Link>
          </div>
        </div>
      )}

      {/* AI Insight Modal */}
      {insightModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 max-h-[75vh] flex flex-col mb-14">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-aviva-text">
                {insightModal === "approvals" ? "รายการรออนุมัติ" : insightModal === "claims" ? "คลิมหลังการขาย" : "งวดงานรอตรวจสอบ"}
              </h2>
              <button onClick={() => setInsightModal(null)} aria-label="ปิด" className="p-2 -mr-2 text-aviva-secondary hover:text-aviva-gold"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {insightModal === "approvals" && approvalItems.map((item, i) => (
                <div key={i} className="bg-aviva-bg rounded-xl px-4 py-3">
                  <p className="text-sm font-medium text-aviva-text">{String(item.description ?? "—")}</p>
                  <p className="text-xs text-aviva-secondary">{String(item.module ?? "")} · {String(item.requested_by ?? "")}</p>
                  <p className="text-sm font-bold text-aviva-gold text-right">฿{Number(item.amount ?? 0).toLocaleString()}</p>
                </div>
              ))}
              {insightModal === "claims" && claimItems.map((item, i) => (
                <div key={i} className="bg-aviva-bg rounded-xl px-4 py-3">
                  <p className="text-sm font-medium text-aviva-text">{String(item.customer_name ?? "—")}</p>
                  <p className="text-xs text-aviva-secondary">{String(item.issue_type ?? "")} — {String(item.description ?? "")}</p>
                </div>
              ))}
              {insightModal === "construction" && (
                <div className="bg-aviva-bg rounded-xl px-4 py-3">
                  <p className="text-sm text-aviva-text">{constructionPending} งวดงานรอตรวจสอบและส่งเบิก</p>
                  <p className="text-xs text-aviva-secondary mt-1">กรุณาเข้าหน้าฝ่ายก่อสร้างเพื่อตรวจงวดงาน</p>
                </div>
              )}
            </div>
            <Link href={insightModal === "construction" ? "/construction" : insightModal === "approvals" ? "/approvals" : "/office"}
              onClick={() => setInsightModal(null)}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-semibold py-2.5 rounded-xl text-sm">
              ไปยังหน้าที่เกี่ยวข้อง <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      )}

      {/* CRM Modal */}
      {crmModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 max-h-[80vh] flex flex-col mb-14">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-aviva-text">CRM — Leads ทั้งหมด ({totalLeads})</h2>
              <button onClick={() => setCrmModal(false)} aria-label="ปิด" className="p-2 -mr-2 text-aviva-secondary hover:text-aviva-gold"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {(leadItems as Array<{customer_name?: string; status?: string; source?: string; budget?: number; notes?: string}>).map((item, i) => (
                <div key={i} className="bg-aviva-bg rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-aviva-text">{item.customer_name ?? "—"}</p>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      item.status === "Closed Deal" ? "bg-green-500/20 text-green-400" :
                      item.status === "Interested" ? "bg-blue-500/20 text-blue-400" :
                      "bg-gray-500/20 text-gray-400"}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-aviva-secondary mt-0.5">{item.source} · ฿{Number(item.budget ?? 0).toLocaleString()}</p>
                  {item.notes && <p className="text-xs text-aviva-secondary/60 mt-1">{item.notes}</p>}
                </div>
              ))}
            </div>
            <Link href="/crm" onClick={() => setCrmModal(false)}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm">
              <Users size={16} /> เปิดหน้า CRM เต็มรูปแบบ
            </Link>
          </div>
        </div>
      )}

      {/* Marketing Modal */}
      {mktModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 max-h-[80vh] flex flex-col mb-14">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-aviva-text">แคมเปญการตลาด</h2>
              <button onClick={() => setMktModal(false)} aria-label="ปิด" className="p-2 -mr-2 text-aviva-secondary hover:text-aviva-gold"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {(campaignItems as Array<{name?: string; platform?: string; status?: string; leads_generated?: number; budget?: number; spent?: number; impressions?: number; clicks?: number}>).map((item, i) => (
                <div key={i} className="bg-aviva-bg rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-aviva-text">{item.name ?? "—"}</p>
                    <span className={`text-xs px-2.5 py-1 rounded-full ${item.status === "active" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                      {item.status === "active" ? "กำลังทำงาน" : "เสร็จแล้ว"}
                    </span>
                  </div>
                  <p className="text-xs text-aviva-secondary mt-0.5">{item.platform} · Leads: {item.leads_generated}</p>
                  <div className="flex justify-between text-xs text-aviva-secondary mt-1">
                    <span>งบ: ฿{Number(item.budget ?? 0).toLocaleString()}</span>
                    <span>ใช้ไป: ฿{Number(item.spent ?? 0).toLocaleString()}</span>
                    <span>Impression: {Number(item.impressions ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/office" onClick={() => setMktModal(false)}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-pink-500 text-white font-semibold py-2.5 rounded-xl text-sm">
              <BarChart3 size={16} /> เปิดหน้าการตลาดเต็มรูปแบบ
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
