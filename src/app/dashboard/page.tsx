"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Home, Users, Package, LogOut, Receipt, ShieldAlert, BadgeCheck, Settings, X, Sparkles, Bot, Send, CheckCircle, HardHat, FileText, Briefcase, TrendingUp, TrendingDown, Activity, Target, Zap, AlertTriangle, Clock, ClipboardList } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { useCurrentUser } from "@/lib/user-context";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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

interface SalesFunnelMonth {
  totalNew: number;
  visitCount: number;
  bookedCount: number;
  loanCount: number;
  loanApprovedCount: number;
  transferCount: number;
  hot: number;
  warm: number;
  cool: number;
}

interface ActiveHouseInfo {
  house_number: string;
  plot_number: number | null;
  house_model: string | null;
  land_size: number | null;
  progress: number;
  status: string;
  contractor: string;
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

interface InsightItem {
  type: "success" | "warning" | "alert" | "info";
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
  href?: string;
  icon: typeof TrendingUp;
  iconColor: string;
  bg: string;
  border: string;
  titleColor: string;
}

export default function DashboardPage() {
  const ctxUser = useCurrentUser();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CrossModuleStats>({
    pendingApprovals: 0, totalReceipts: 0, expenseTotal: 0, employeeCount: 0,
    pendingClaims: 0, totalLeads: 0, pendingDocs: 0,
  });
  const [constructionStats, setConstructionStats] = useState<ConstructionStats>({ total: 0, inReview: 0, approved: 0, paid: 0 });
  const [delayedHouseStats, setDelayedHouseStats] = useState({ count: 0, maxDays: 0, worstHouse: "" });
  const [kpiModal, setKpiModal] = useState<string | null>(null);
  const [kpiItems, setKpiItems] = useState<Record<string, unknown>[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState(false);
  const [chartData, setChartData] = useState<{ month: string; revenue: number; expense: number; profit: number }[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [pendingBreakdown, setPendingBreakdown] = useState<PendingBreakdown[]>([]);
  const [salesFunnel, setSalesFunnel] = useState<SalesFunnelMonth | null>(null);
  const [activeHouses, setActiveHouses] = useState<ActiveHouseInfo[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState(0);
  const [salesFunnelRange, setSalesFunnelRange] = useState<{ from: string; to: string } | null>(null);
  const [aiMsgs, setAiMsgs] = useState<AiMsg[]>([{ role: "assistant", text: "สวัสดีค่ะ AVIVA AI พร้อมช่วยตอบคำถามเกี่ยวกับโครงการ AVIVA ONE ถามได้เลยค่ะ" }]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const aiMsgsRef = useRef<AiMsg[]>(aiMsgs);
  const aiAbortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  useEffect(() => { aiMsgsRef.current = aiMsgs; }, [aiMsgs]);
  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMsgs]);

  useEffect(() => {
    if (!ctxUser) return;
    const welcome = ctxUser.isManager
      ? "สวัสดีค่ะ AVIVA AI Executive พร้อมวิเคราะห์ข้อมูลโครงการ AVIVA ONE ถามได้เลยค่ะ"
      : `สวัสดีค่ะ AVIVA AI ผู้ช่วยฝ่าย${ctxUser.department} ถามเกี่ยวกับงานของฝ่ายได้เลยค่ะ`;
    setAiMsgs([{ role: "assistant", text: welcome }]);
  }, [ctxUser?.id]);

  const sendAiMsg = async () => {
    const msg = aiInput.trim();
    if (!msg || aiLoading) return;
    setAiInput("");
    setAiMsgs(p => [...p, { role: "user", text: msg }]);
    setAiLoading(true);
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAiMsgs(p => [...p, { role: "assistant", text: "กรุณาเข้าสู่ระบบก่อนค่ะ" }]);
        setAiLoading(false);
        return;
      }
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({
          message: msg,
          history: aiMsgsRef.current.slice(-5).map(m => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await res.json();
      setAiMsgs(p => [...p, { role: "assistant", text: data.response ?? "ขออภัย ไม่สามารถตอบได้ค่ะ" }]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
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
    setKpiError(false);
    try {
      if (type === "units") {
        const { data, error } = await supabase.from("houses").select("house_number,status,progress").eq("project_id", PROJECT_ID).order("plot_number");
        if (error) throw error;
        setKpiItems((data as Record<string, unknown>[]) ?? []);
      } else if (type === "sold") {
        const { data, error } = await supabase.from("leads").select("customer_name,phone,budget,created_at").eq("project_id", PROJECT_ID).eq("status", "Closed Deal");
        if (error) throw error;
        setKpiItems((data as Record<string, unknown>[]) ?? []);
      } else if (type === "available") {
        const { data, error } = await supabase.from("houses").select("house_number,status,progress").eq("project_id", PROJECT_ID).neq("status", "complete").order("plot_number");
        if (error) throw error;
        setKpiItems((data as Record<string, unknown>[]) ?? []);
      } else if (type === "revenue") {
        const { data, error } = await supabase.from("finance_transactions").select("amount,created_at,description,transaction_type").eq("project_id", PROJECT_ID).eq("transaction_type", "income").order("created_at", { ascending: false }).limit(20);
        if (error) throw error;
        setKpiItems((data as Record<string, unknown>[]) ?? []);
      }
    } catch {
      setKpiError(true);
    }
    setKpiLoading(false);
  };

  const fetchPendingBreakdown = async () => {
    const { data } = await supabase.from("approval_logs").select("workflow_type").eq("action_taken", "Pending");
    if (!data) return;
    const counts: Record<string, number> = {};
    data.forEach((r: { workflow_type: string }) => { counts[r.workflow_type] = (counts[r.workflow_type] ?? 0) + 1; });
    setPendingBreakdown(Object.entries(counts).map(([workflow_type, count]) => ({ workflow_type, count })));
  };

  useEffect(() => {
    supabase.from("projects").select("*").eq("id", PROJECT_ID).single()
      .then(({ data }) => { setProject(data); setLoading(false); }, () => setLoading(false));

    const year = new Date().getFullYear();
    const yearStr = String(year);

    Promise.allSettled([
      supabase.from("approvals").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("finance_transactions").select("amount,created_at,transaction_type")
        .eq("project_id", PROJECT_ID)
        .gte("created_at", `${yearStr}-01-01`)
        .lt("created_at", `${year + 1}-01-01`),
      supabase.from("employees").select("id", { count: "exact" }).eq("status", "active"),
      supabase.from("warranty_claims").select("id", { count: "exact" }).eq("status", "pending").eq("project_id", PROJECT_ID),
      supabase.from("leads").select("id", { count: "exact" }).eq("project_id", PROJECT_ID),
      supabase.from("documents").select("id", { count: "exact" }).eq("status", "pending").eq("project_id", PROJECT_ID),
      supabase.from("contractor_installments").select("status,amount").eq("project_id", PROJECT_ID),
    ]).then(([approvalsR, txnsR, employeesR, claimsR, leadsR, docsR, instsR]) => {
      const allTxns = txnsR.status === "fulfilled"
        ? (txnsR.value.data ?? []) as { amount: number; created_at: string; transaction_type: string }[]
        : [];
      const yearTxns = allTxns.filter(r => r.created_at?.startsWith(yearStr));
      const receiptTotal = yearTxns.filter(r => r.transaction_type === "income").reduce((s, r) => s + Number(r.amount), 0);
      const expTotal = yearTxns.filter(r => r.transaction_type === "expense").reduce((s, r) => s + Number(r.amount), 0);
      setStats(prev => ({
        ...prev,
        pendingApprovals: approvalsR.status === "fulfilled" ? (approvalsR.value.count ?? 0) : prev.pendingApprovals,
        totalReceipts: receiptTotal,
        expenseTotal: expTotal,
        employeeCount: employeesR.status === "fulfilled" ? (employeesR.value.count ?? 0) : prev.employeeCount,
        pendingClaims: claimsR.status === "fulfilled" ? (claimsR.value.count ?? 0) : prev.pendingClaims,
        totalLeads: leadsR.status === "fulfilled" ? (leadsR.value.count ?? 0) : prev.totalLeads,
        pendingDocs: docsR.status === "fulfilled" ? (docsR.value.count ?? 0) : prev.pendingDocs,
      }));
      const insts = instsR.status === "fulfilled"
        ? (instsR.value.data ?? []) as { status: string }[]
        : [];
      setConstructionStats({
        total: insts.length,
        inReview: insts.filter(i => i.status === "in_review").length,
        approved: insts.filter(i => i.status === "approved").length,
        paid: insts.filter(i => i.status === "paid").length,
      });
      const MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
      const incMap: Record<number, number> = {};
      const expMap: Record<number, number> = {};
      yearTxns.forEach(r => {
        const m = new Date(r.created_at).getMonth();
        if (r.transaction_type === "income") incMap[m] = (incMap[m] ?? 0) + Number(r.amount) / 1_000_000;
        else expMap[m] = (expMap[m] ?? 0) + Number(r.amount) / 1_000_000;
      });
      setChartData(MONTHS.map((month, i) => ({
        month,
        revenue: +((incMap[i] ?? 0).toFixed(1)),
        expense: +((expMap[i] ?? 0).toFixed(1)),
        profit: +(((incMap[i] ?? 0) - (expMap[i] ?? 0)).toFixed(1)),
      })));
      if (txnsR.status === "rejected" || approvalsR.status === "rejected") setLoadError(true);
    });

    fetchPendingBreakdown();

    supabase.from("houses")
      .select("house_number, delayed_days, plot_number")
      .eq("project_id", PROJECT_ID)
      .eq("status", "delayed")
      .order("delayed_days", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const delayed = (data ?? []) as { house_number: string; delayed_days: number }[];
        if (delayed.length > 0) {
          setDelayedHouseStats({
            count: delayed.length,
            maxDays: delayed[0].delayed_days ?? 0,
            worstHouse: delayed[0].house_number ?? "",
          });
        }
      });

    const refreshInsts = () => {
      supabase.from("contractor_installments").select("status,amount").eq("project_id", PROJECT_ID)
        .then(({ data }) => {
          const insts = (data ?? []) as { status: string }[];
          setConstructionStats({
            total: insts.length,
            inReview: insts.filter(i => i.status === "in_review").length,
            approved: insts.filter(i => i.status === "approved").length,
            paid: insts.filter(i => i.status === "paid").length,
          });
        });
    };

    const channel = supabase.channel("dashboard_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_logs" }, fetchPendingBreakdown)
      .on("postgres_changes", { event: "*", schema: "public", table: "contractor_installments" }, refreshInsts)
      .subscribe();
    return () => { channel.unsubscribe(); supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    let mounted = true;
    const ORDER_MAP: Record<string, number> = {
      "New Lead": 0, "Contacted": 1, "Site Visit": 2,
      "Booking": 3, "Contract": 4, "Loan Approved": 5, "Transfer": 6, "Closed Deal": 7,
    };
    const rank = (s: string) => ORDER_MAP[s] ?? 0;
    const emptyFunnel = { totalNew: 0, visitCount: 0, bookedCount: 0, loanCount: 0, loanApprovedCount: 0, transferCount: 0, hot: 0, warm: 0, cool: 0 };

    supabase.from("leads")
      .select("id,status,ai_score,loan_approved_date,created_at")
      .eq("project_id", PROJECT_ID)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) { setSalesFunnel(emptyFunnel); return; }
        const leads = (data ?? []) as { id: string; status: string; ai_score: number; loan_approved_date: string | null; created_at: string }[];
        setSalesFunnel({
          totalNew: leads.length,
          visitCount: leads.filter(l => rank(l.status) >= 2).length,
          bookedCount: leads.filter(l => rank(l.status) >= 3).length,
          loanCount: leads.filter(l => rank(l.status) >= 4).length,
          loanApprovedCount: leads.filter(l => l.loan_approved_date != null).length,
          transferCount: leads.filter(l => rank(l.status) >= 5).length,
          hot: leads.filter(l => (l.ai_score ?? 0) >= 80).length,
          warm: leads.filter(l => (l.ai_score ?? 0) >= 50 && (l.ai_score ?? 0) < 80).length,
          cool: leads.filter(l => (l.ai_score ?? 0) < 50).length,
        });
        const dates = leads.map(l => l.created_at).filter(Boolean).sort();
        if (dates.length > 0) {
          const fmt = { day: "numeric" as const, month: "short" as const };
          setSalesFunnelRange({
            from: new Date(dates[0]).toLocaleDateString("th-TH", fmt),
            to: new Date(dates[dates.length - 1]).toLocaleDateString("th-TH", fmt),
          });
        }
      });

    supabase.from("houses")
      .select("house_number,plot_number,progress,status,contractor,house_model,land_size")
      .eq("project_id", PROJECT_ID)
      .neq("status", "complete")
      .order("plot_number")
      .limit(15)
      .then(({ data, error }) => {
        if (!mounted || error) return;
        setActiveHouses((data ?? []) as ActiveHouseInfo[]);
      });

    supabase.from("contractor_installments")
      .select("amount,status")
      .eq("project_id", PROJECT_ID)
      .eq("status", "approved")
      .then(({ data, error }) => {
        if (!mounted || error) return;
        const total = ((data ?? []) as { amount: number }[]).reduce((s, i) => s + Number(i.amount), 0);
        setPendingPayouts(total);
      });

    return () => { mounted = false; };
  }, []);

  const {
    totalUnits, soldUnits, available, constructionProgress, selloutForecast,
    selloutPct, noProjectData, salesVelocity, monthsToSellout, netPL, revenuePct,
  } = useMemo(() => {
    const totalUnits = project?.total_units ?? 0;
    const soldUnits = salesFunnel?.transferCount ?? (project?.sold_units ?? 0);
    const bookedActive = Math.max((salesFunnel?.bookedCount ?? 0) - soldUnits, 0);
    const available = totalUnits > 0 ? Math.max(totalUnits - soldUnits - bookedActive, 0) : (project?.available_units ?? 0);
    const constructionProgress = project?.construction_progress ?? 0;
    const selloutForecast = project?.sellout_forecast ?? "-";
    const selloutPct = totalUnits > 0 ? Math.round((soldUnits / totalUnits) * 100) : 0;
    const noProjectData = !loading && project === null;
    const projStart = new Date(2026, 3, 1);
    const now = new Date();
    const monthsElapsed = Math.max((now.getFullYear() - projStart.getFullYear()) * 12 + (now.getMonth() - projStart.getMonth()) + 1, 1);
    const salesVelocity = monthsElapsed > 0 ? soldUnits / monthsElapsed : 0;
    const monthsToSellout = salesVelocity > 0 ? Math.ceil(available / salesVelocity) : null;
    const netPL = stats.totalReceipts - stats.expenseTotal;
    const revenuePct = project && project.revenue_target > 0
      ? Math.round((stats.totalReceipts / project.revenue_target) * 100)
      : null;
    return { totalUnits, soldUnits, available, constructionProgress, selloutForecast, selloutPct, noProjectData, salesVelocity, monthsToSellout, netPL, revenuePct };
  }, [project, loading, stats, salesFunnel]);

  const canSeeAll = ctxUser?.isManager || ctxUser?.isAdmin || false;
  const canSeeFinance = canSeeAll || ctxUser?.department === "ฝ่ายการเงิน" || ctxUser?.department === "ฝ่ายบัญชี";
  const canSeeConstruction = canSeeAll || ctxUser?.department === "ฝ่ายก่อสร้าง";
  const canSeeCRM = canSeeAll || ctxUser?.department === "ฝ่ายขาย";

  const isEmployee = !!ctxUser && !ctxUser.isManager && !ctxUser.isAdmin;

  const insights: InsightItem[] = [];

  if (canSeeFinance && revenuePct !== null) {
    const gap = (project?.revenue_target ?? 0) - stats.totalReceipts;
    insights.push({
      type: revenuePct >= 80 ? "success" : revenuePct >= 50 ? "warning" : "alert",
      priority: revenuePct >= 80 ? "low" : revenuePct >= 50 ? "medium" : "high",
      title: `รายรับสะสม ${revenuePct}% ของเป้าหมายปีนี้`,
      message: revenuePct >= 80
        ? `รายรับ ฿${formatMillions(stats.totalReceipts)} — ใกล้ถึงเป้า ฿${formatMillions(project!.revenue_target)} แล้ว`
        : `ยังต้องรับเพิ่มอีก ฿${formatMillions(gap)} เพื่อให้ถึงเป้า ฿${formatMillions(project!.revenue_target)}`,
      href: undefined,
      icon: Target,
      iconColor: revenuePct >= 80 ? "text-green-400" : revenuePct >= 50 ? "text-yellow-400" : "text-red-400",
      bg: revenuePct >= 80 ? "bg-green-500/10" : revenuePct >= 50 ? "bg-yellow-500/10" : "bg-red-500/10",
      border: revenuePct >= 80 ? "border-green-500/20" : revenuePct >= 50 ? "border-yellow-500/20" : "border-red-500/20",
      titleColor: revenuePct >= 80 ? "text-green-400" : revenuePct >= 50 ? "text-yellow-300" : "text-red-400",
    });
  }

  if (canSeeCRM && project && totalUnits > 0) {
    insights.push({
      type: selloutPct >= 80 ? "success" : selloutPct >= 50 ? "info" : "warning",
      priority: "medium",
      title: `ความเร็วขาย ${salesVelocity.toFixed(1)} ยูนิต/เดือน — ปิดแล้ว ${soldUnits}/${totalUnits}`,
      message: monthsToSellout
        ? `คาดขายหมดใน ~${monthsToSellout} เดือน (เหลือว่าง ${available} ยูนิต)`
        : available === 0 ? "ขายหมดทุกยูนิตแล้ว !" : `เหลือยูนิตว่าง ${available} ยูนิต`,
      href: "/crm",
      icon: Activity,
      iconColor: selloutPct >= 80 ? "text-green-400" : "text-blue-400",
      bg: selloutPct >= 80 ? "bg-green-500/10" : "bg-blue-500/10",
      border: selloutPct >= 80 ? "border-green-500/20" : "border-blue-500/20",
      titleColor: selloutPct >= 80 ? "text-green-400" : "text-blue-300",
    });
  }

  if (canSeeFinance && (stats.totalReceipts > 0 || stats.expenseTotal > 0)) {
    const isProfit = netPL >= 0;
    insights.push({
      type: isProfit ? "success" : "alert",
      priority: isProfit ? "low" : "high",
      title: `กำไร-ขาดทุนสุทธิ: ${isProfit ? "+" : "-"}฿${formatMillions(Math.abs(netPL))}`,
      message: `รายรับ ฿${formatMillions(stats.totalReceipts)} — รายจ่าย ฿${formatMillions(stats.expenseTotal)}`,
      icon: isProfit ? TrendingUp : TrendingDown,
      iconColor: isProfit ? "text-green-400" : "text-red-400",
      bg: isProfit ? "bg-green-500/10" : "bg-red-500/10",
      border: isProfit ? "border-green-500/20" : "border-red-500/20",
      titleColor: isProfit ? "text-green-400" : "text-red-400",
    });
  }

  if (canSeeAll && stats.pendingApprovals > 0) {
    insights.push({
      type: "warning",
      priority: "high",
      title: `${stats.pendingApprovals} รายการรออนุมัติ`,
      message: `งวดงานรอตรวจ ${constructionStats.inReview} งวด — ดำเนินการเพื่อไม่ให้กระทบกระแสเงินสด`,
      href: "/approvals",
      icon: Zap,
      iconColor: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      titleColor: "text-yellow-300",
    });
  }

  if (canSeeAll && stats.pendingClaims > 0) {
    insights.push({
      type: "alert",
      priority: "medium",
      title: `${stats.pendingClaims} คลิมหลังการขายรอดำเนินการ`,
      message: "ควรติดตามและดำเนินการภายใน 7 วันเพื่อรักษาความพึงพอใจของลูกค้า",
      icon: ShieldAlert,
      iconColor: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      titleColor: "text-orange-400",
    });
  }

  if (isEmployee) {
    const hour = new Date().getHours();
    insights.push({
      type: hour >= 17 ? "warning" : "info",
      priority: hour >= 17 ? "high" : "low",
      title: hour >= 17 ? "อย่าลืมส่งรายงานประจำวัน !" : "รายงานประจำวัน",
      message: hour >= 17
        ? "กำหนดส่งคือ 18:00 น. — กดเพื่อไปกรอกรายงาน"
        : "บันทึกกิจกรรมและส่งรายงานก่อน 18:00 น.",
      href: "/reports",
      icon: ClipboardList,
      iconColor: hour >= 17 ? "text-yellow-400" : "text-blue-400",
      bg: hour >= 17 ? "bg-yellow-500/10" : "bg-blue-500/10",
      border: hour >= 17 ? "border-yellow-500/20" : "border-blue-500/20",
      titleColor: hour >= 17 ? "text-yellow-300" : "text-blue-300",
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "success",
      priority: "low",
      title: "ทุกระบบทำงานปกติ",
      message: "ไม่มีรายการค้างดำเนินการในขณะนี้",
      icon: CheckCircle,
      iconColor: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
      titleColor: "text-green-400",
    });
  }

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-aviva-gold tracking-wide">AVIVA ONE</h1>
              <span className="text-[10px] font-bold text-aviva-gold/70 bg-aviva-gold/10 px-2 py-0.5 rounded-full border border-aviva-gold/20">v5.33</span>
            </div>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {ctxUser ? `${ctxUser.full_name} · ${ctxUser.department}` : formatDate()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {ctxUser?.isManager && (
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
        <div className="bg-aviva-card rounded-2xl border border-aviva-gold/20 overflow-hidden">
          <button onClick={() => setShowAI(a => !a)}
            className="w-full flex items-center gap-3 p-3 hover:bg-aviva-gold/5 transition-all active:scale-[0.99]">
            <div className="w-9 h-9 rounded-xl bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-aviva-gold" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-aviva-text">{ctxUser?.isManager ? "AVIVA AI Executive" : "AVIVA AI"}</p>
              <p className="text-xs text-aviva-secondary">{ctxUser?.isManager ? "วิเคราะห์ข้อมูลโครงการ Real-time" : `ผู้ช่วยฝ่าย${ctxUser?.department ?? ""}`}</p>
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

        {ctxUser?.isManager && (
          <Link href="/ai-council" className="block">
            <GlassCard gold className="p-4 active:scale-[0.99] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-aviva-gold/15 border border-aviva-gold/30 flex items-center justify-center flex-shrink-0">
                  <Users size={16} className="text-aviva-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-aviva-text flex items-center gap-1.5">คณะที่ปรึกษา AI — สรุปเสนอผู้บริหาร <Sparkles size={12} className="text-aviva-gold" /></p>
                  <p className="text-[11px] text-aviva-secondary">ผู้เชี่ยวชาญแต่ละฝ่ายปรึกษากัน + ประเด็นที่ต้องตัดสินใจ</p>
                </div>
                <span className="text-aviva-gold/60 text-lg">→</span>
              </div>
            </GlassCard>
          </Link>
        )}

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

        <div>
          <SectionHeader title={canSeeAll ? "AI Executive Insights" : "สรุปงานของคุณ"} subtitle={canSeeAll ? "วิเคราะห์ภาพรวมโครงการ Real-time" : "ข้อมูลสำคัญสำหรับวันนี้"} />
          <div className="space-y-2.5">
            {insights.map((ins, idx) => {
              const IconComp = ins.icon;
              const card = (
                <div key={idx} className={`flex items-start gap-3 p-3.5 rounded-2xl border ${ins.bg} ${ins.border} transition-all active:scale-[0.98]`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${ins.bg} border ${ins.border}`}>
                    <IconComp size={15} className={ins.iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold leading-snug ${ins.titleColor}`}>{ins.title}</p>
                    <p className="text-[11px] text-aviva-secondary/80 mt-0.5 leading-relaxed">{ins.message}</p>
                  </div>
                </div>
              );
              return ins.href ? <Link key={idx} href={ins.href}>{card}</Link> : card;
            })}
          </div>
        </div>

        {loadError && (
          <GlassCard className="p-5 text-center border border-red-500/20">
            <ShieldAlert size={22} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-aviva-text mb-1">โหลดข้อมูลไม่สำเร็จ</p>
            <p className="text-xs text-aviva-secondary mb-3">กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่</p>
            <button onClick={() => { setLoadError(false); setLoading(true); window.location.reload(); }}
              className="text-xs font-bold text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/30 px-4 py-2 rounded-xl">
              ลองใหม่
            </button>
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

            {canSeeCRM && <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <SectionHeader title="ฝ่ายขาย — ภาพรวม"
                    subtitle="ข้อมูล Leads ทั้งหมดตั้งแต่เริ่มโครงการ" />
                </div>
                <Link href="/crm" className="text-[11px] text-aviva-gold font-medium flex-shrink-0">ดูเพิ่มเติม →</Link>
              </div>
              <ProgressBar label={`ขายแล้ว ${soldUnits} / ${totalUnits} ยูนิต (คาดขายหมด: ${selloutForecast})`} value={selloutPct} />
              {salesFunnel ? (
                <>
                  <div className="grid grid-cols-5 gap-1 mt-3">
                    {([
                      { label: "เยี่ยมชม", count: salesFunnel.visitCount, color: "text-blue-400" },
                      { label: "จอง", count: salesFunnel.bookedCount, color: "text-yellow-400" },
                      { label: "ยื่นกู้", count: salesFunnel.loanCount, color: "text-orange-400" },
                      { label: "อนุมัติกู้", count: salesFunnel.loanApprovedCount, color: "text-green-400" },
                      { label: "โอน", count: salesFunnel.transferCount, color: "text-aviva-gold" },
                    ] as const).map(({ label, count, color }) => (
                      <div key={label} className="bg-aviva-bg/60 rounded-xl p-2 text-center">
                        <p className={`text-lg font-bold ${color}`}>{count}</p>
                        <p className="text-[9px] text-aviva-secondary leading-tight mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-aviva-bg/40 rounded-xl p-3 mt-2">
                    <p className="text-[10px] text-aviva-secondary/70 mb-2">ระดับความสนใจ ({salesFunnel.totalNew} ราย ทั้งหมด)</p>
                    <div className="space-y-1.5">
                      {([
                        { label: "Hot", count: salesFunnel.hot, bar: "bg-red-400", text: "text-red-400" },
                        { label: "Warm", count: salesFunnel.warm, bar: "bg-yellow-400", text: "text-yellow-400" },
                        { label: "Cool", count: salesFunnel.cool, bar: "bg-blue-400", text: "text-blue-400" },
                      ] as const).map(({ label, count, bar, text }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold ${text} w-7`}>{label}</span>
                          <div className="flex-1 h-1.5 bg-aviva-bg rounded-full overflow-hidden">
                            <div className={`h-full ${bar} rounded-full transition-all`}
                              style={{ width: salesFunnel.totalNew > 0 ? `${Math.round((count / salesFunnel.totalNew) * 100)}%` : "0%" }} />
                          </div>
                          <span className={`text-[10px] font-bold ${text} w-4 text-right`}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2 mt-3">
                  <div className="h-14 rounded-xl bg-aviva-bg/40 animate-pulse" />
                  <div className="h-20 rounded-xl bg-aviva-bg/40 animate-pulse" />
                </div>
              )}
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
              {salesVelocity > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-aviva-bg/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-aviva-gold">{salesVelocity.toFixed(1)}</p>
                    <p className="text-[10px] text-aviva-secondary">ยูนิต/เดือน (ความเร็วขาย)</p>
                  </div>
                  <div className="bg-aviva-bg/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-blue-400">
                      {available === 0 ? "ขายหมดแล้ว !" : monthsToSellout ? `~${monthsToSellout} เดือน` : "—"}
                    </p>
                    <p className="text-[10px] text-aviva-secondary">คาดขายหมด</p>
                  </div>
                </div>
              )}
            </GlassCard>}

            {canSeeFinance && <GlassCard className="p-4">
              <SectionHeader title="ภาพรวมการเงิน" subtitle={`รายรับ-รายจ่าย ปี ${new Date().getFullYear() + 543}`} />
              {project && project.revenue_target > 0 && (
                <div className="mb-4 bg-aviva-bg/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-aviva-secondary">รายรับจริง vs เป้าหมาย</span>
                    <span className="text-[10px] font-bold text-aviva-gold">
                      {Math.min(100, Math.round((stats.totalReceipts / project.revenue_target) * 100))}%
                    </span>
                  </div>
                  <div className="h-2 bg-aviva-bg rounded-full overflow-hidden">
                    <div className="h-full bg-aviva-gold rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round((stats.totalReceipts / project.revenue_target) * 100))}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-aviva-secondary">฿{formatMillions(stats.totalReceipts)}</span>
                    <span className="text-[10px] text-aviva-secondary">เป้า ฿{formatMillions(project.revenue_target)}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button onClick={() => openKpi("revenue")}
                  className="bg-aviva-bg/50 rounded-xl p-3 text-center active:scale-95 transition-all">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp size={11} className="text-green-400" />
                    <span className="text-[10px] text-aviva-secondary">รายรับ</span>
                  </div>
                  <p className="text-sm font-bold text-green-400">฿{formatMillions(stats.totalReceipts)}</p>
                </button>
                <div className="bg-aviva-bg/50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingDown size={11} className="text-red-400" />
                    <span className="text-[10px] text-aviva-secondary">รายจ่าย</span>
                  </div>
                  <p className="text-sm font-bold text-red-400">฿{formatMillions(stats.expenseTotal)}</p>
                </div>
                <div className="bg-aviva-bg/50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Activity size={11} className={netPL >= 0 ? "text-aviva-gold" : "text-red-400"} />
                    <span className="text-[10px] text-aviva-secondary">กำไรสุทธิ</span>
                  </div>
                  <p className={`text-sm font-bold ${netPL >= 0 ? "text-aviva-gold" : "text-red-400"}`}>
                    {netPL >= 0 ? "+" : ""}฿{formatMillions(Math.abs(netPL))}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-green-400 rounded inline-block" />
                  <span className="text-[9px] text-aviva-secondary">รายรับ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-red-400 rounded inline-block" />
                  <span className="text-[9px] text-aviva-secondary">รายจ่าย</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-aviva-gold rounded inline-block" />
                  <span className="text-[9px] text-aviva-secondary">กำไรสุทธิ</span>
                </div>
                <span className="text-[9px] text-aviva-secondary/50 ml-auto">ล้านบาท / เดือน</span>
              </div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4ADE80" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F87171" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fill: "#D1D5DB", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#D1D5DB", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#17332D", border: "1px solid #D4AF37", borderRadius: "8px", color: "#fff", fontSize: "11px" }}
                      formatter={(val, name) => [`฿${val}M`, name === "revenue" ? "รายรับ" : name === "expense" ? "รายจ่าย" : "กำไรสุทธิ"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#4ADE80" strokeWidth={2} fill="url(#greenGrad)" dot={false} />
                    <Area type="monotone" dataKey="expense" stroke="#F87171" strokeWidth={1.5} fill="url(#redGrad)" dot={false} />
                    <Area type="monotone" dataKey="profit" stroke="#D4AF37" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 bg-aviva-bg/50 rounded-xl p-3">
                <p className="text-[10px] text-aviva-secondary font-semibold uppercase tracking-wide mb-2">กระแสเงินสด &amp; ภาระผูกพัน</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Link href="/office" className="bg-aviva-bg rounded-xl p-2.5 active:scale-95 transition-all block">
                    <p className="text-[10px] text-aviva-secondary">คงเหลือสุทธิ <span className="text-aviva-gold/50">→</span></p>
                    <p className={`text-sm font-bold mt-0.5 ${netPL >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {netPL >= 0 ? "+" : ""}฿{formatMillions(Math.abs(netPL))}
                    </p>
                  </Link>
                  <Link href="/approvals" className="bg-aviva-bg rounded-xl p-2.5 active:scale-95 transition-all block">
                    <p className="text-[10px] text-aviva-secondary">งวดงานค้างจ่าย <span className="text-aviva-gold/50">→</span></p>
                    <p className="text-sm font-bold text-orange-400 mt-0.5">฿{formatMillions(pendingPayouts)}</p>
                  </Link>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold ${netPL >= pendingPayouts ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                  {netPL >= pendingPayouts ? "✓ กระแสเงินสดเพียงพอสำหรับงวดค้าง" : "⚠ กระแสเงินสดอาจไม่เพียงพอสำหรับงวดค้าง"}
                  <span className="ml-auto text-aviva-secondary/60 font-normal">
                    {netPL >= pendingPayouts
                      ? `เหลือ ฿${formatMillions(netPL - pendingPayouts)}`
                      : `ขาด ฿${formatMillions(pendingPayouts - netPL)}`}
                  </span>
                </div>
              </div>
            </GlassCard>}

            {canSeeConstruction && <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <SectionHeader title="ก่อสร้าง" subtitle="ประเด็นสำคัญสำหรับผู้บริหาร" />
                <Link href="/construction" className="text-[11px] text-aviva-gold font-medium">รายละเอียด →</Link>
              </div>
              <ProgressBar label={`ความคืบหน้าก่อสร้างโดยรวม ${constructionProgress}%`} value={constructionProgress} />
              <div className="mt-3 space-y-2">
                {delayedHouseStats.count > 0 ? (
                  <Link href="/construction" className="flex items-start gap-2.5 p-3 bg-red-500/10 rounded-xl border border-red-500/20 active:scale-[0.98] transition-transform">
                    <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-red-400">บ้านล่าช้า {delayedHouseStats.count} หลัง — กระทบกำหนดส่งมอบ</p>
                      <p className="text-[10px] text-aviva-secondary/80 mt-0.5">
                        ล่าช้ามากที่สุด: {delayedHouseStats.worstHouse} (+{delayedHouseStats.maxDays} วัน)
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                    <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                    <p className="text-xs text-green-400 font-medium">ทุกหลังดำเนินการตามแผน ไม่มีความล่าช้า</p>
                  </div>
                )}
                {constructionStats.inReview > 0 && (
                  <Link href="/approvals" className="flex items-start gap-2.5 p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20 active:scale-[0.98] transition-transform">
                    <Clock size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
<div>
                      <p className="text-xs font-bold text-yellow-400">งวดงานรออนุมัติ {constructionStats.inReview} งวด — กระทบกระแสเงินสดผู้รับเหมา</p>
                      <p className="text-[10px] text-aviva-secondary/80 mt-0.5">กดเพื่อไปอนุมัติ</p>
                    </div>
                  </Link>
                )}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="bg-aviva-bg/50 rounded-xl p-2.5 text-center">
                    <p className="text-sm font-bold text-aviva-text">{constructionStats.total}</p>
                    <p className="text-[10px] text-aviva-secondary">งวดทั้งหมด</p>
                  </div>
                  <div className="bg-aviva-bg/50 rounded-xl p-2.5 text-center">
                    <p className="text-sm font-bold text-green-400">{constructionStats.approved}</p>
                    <p className="text-[10px] text-aviva-secondary">อนุมัติแล้ว</p>
                  </div>
                  <div className="bg-aviva-bg/50 rounded-xl p-2.5 text-center">
                    <p className="text-sm font-bold text-blue-400">{constructionStats.paid}</p>
                    <p className="text-[10px] text-aviva-secondary">เบิกจ่ายแล้ว</p>
                  </div>
                </div>
                {activeHouses.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] text-aviva-secondary/70 font-semibold uppercase tracking-wider mb-2">
                      กำลังก่อสร้าง {activeHouses.length} หลัง
                    </p>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                      {activeHouses.map(h => (
                        <div key={h.house_number} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl ${h.status === "delayed" ? "bg-red-500/10 border border-red-500/15" : "bg-aviva-bg/50"}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[11px] font-bold text-aviva-text truncate">
                                {h.plot_number ? `แปลงที่ ${h.plot_number}${h.land_size ? ` / ${h.land_size} ตร.วา` : ""}${h.house_model ? ` / ${h.house_model}` : ""}` : h.house_number}
                              </p>
                              {h.status === "delayed" && <span className="text-[9px] text-red-400 flex-shrink-0 font-medium">ล่าช้า</span>}
                            </div>
                            <p className="text-[9px] text-aviva-secondary/60 truncate">{h.contractor || "ไม่ระบุผู้รับเหมา"}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="w-14 h-1.5 bg-aviva-bg rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${h.progress >= 80 ? "bg-green-400" : h.progress >= 40 ? "bg-yellow-400" : "bg-orange-400"}`}
                                style={{ width: `${h.progress}%` }} />
                            </div>
                            <span className="text-[9px] text-aviva-secondary w-6 text-right">{h.progress}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>}
          </>
        )}

        <div>
          <SectionHeader title="ปฏิทินกิจกรรม" subtitle="กดวันเพื่อดู/เพิ่มกิจกรรม" />
          <CalendarWidget />
        </div>
      </div>

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
              ) : kpiError ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-400 mb-2">โหลดข้อมูลไม่สำเร็จ</p>
                  <button onClick={() => openKpi(kpiModal!)} className="text-xs text-aviva-gold bg-aviva-gold/10 border border-aviva-gold/30 px-3 py-1.5 rounded-lg">ลองใหม่</button>
                </div>
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
                      {item.created_at ? (
                        <p className="text-[10px] text-blue-400">📅 เยี่ยมชม {new Date(String(item.created_at)).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
                      ) : null}
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
