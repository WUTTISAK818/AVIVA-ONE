"use client";
import { useEffect, useState } from "react";
import { Bell, Home, DollarSign, Users, Package, LogOut, Settings, ShieldAlert, UserCheck, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import KPICard from "@/components/KPICard";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/lib/user-context";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function fmt(n: number) {
  if (n >= 1_000_000) return `฿${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n/1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

interface MonthlyBar { month: string; income: number; expense: number; }

export default function DashboardPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState({ leads:0, activeLeads:0, houses:0, soldHouses:0, delayed:0, employees:0, income:0, expense:0, pendingApprovals:0 });
  const [chart, setChart] = useState<MonthlyBar[]>([]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace("/login"); };

  useEffect(() => {
    Promise.all([
      supabase.from("leads").select("status").eq("project_id", PROJECT_ID),
      supabase.from("houses").select("status").eq("project_id", PROJECT_ID),
      supabase.from("employees").select("id", { count: "exact" }).eq("status", "active"),
      supabase.from("receipts").select("amount,receipt_type,created_at").eq("project_id", PROJECT_ID),
      supabase.from("approvals").select("id", { count: "exact" }).eq("status", "pending"),
    ]).then(([leadsRes, housesRes, empRes, recRes, appRes]) => {
      const leads = leadsRes.data ?? [];
      const houses = housesRes.data ?? [];
      const recs = recRes.data ?? [];
      const income = recs.filter(r=>r.receipt_type==="income").reduce((a,r)=>a+Number(r.amount),0);
      const expense = recs.filter(r=>r.receipt_type==="expense").reduce((a,r)=>a+Number(r.amount),0);

      const monthly: Record<string,MonthlyBar> = {};
      recs.forEach(r => {
        const d = new Date(r.created_at);
        const k = `${d.getFullYear()}-${d.getMonth()}`;
        if (!monthly[k]) monthly[k] = { month: MONTHS[d.getMonth()], income:0, expense:0 };
        if (r.receipt_type==="income") monthly[k].income += Number(r.amount)/1_000_000;
        else monthly[k].expense += Number(r.amount)/1_000_000;
      });

      setS({
        leads: leads.length,
        activeLeads: leads.filter(l=>l.status!=="Closed Deal").length,
        houses: houses.length,
        soldHouses: houses.filter(h=>h.status==="complete").length,
        delayed: houses.filter(h=>h.status==="delayed").length,
        employees: empRes.count??0,
        income, expense,
        pendingApprovals: appRes.count??0,
      });
      setChart(Object.values(monthly).slice(-8));
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-bold text-aviva-gold tracking-wide">AVIVA PRIVATE</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {user ? `${user.full_name} · ${user.department}` : "กำลังโหลด..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-full bg-aviva-card border border-aviva-gold/10">
              <Bell size={18} className="text-aviva-secondary" />
              {s.pendingApprovals > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />}
            </button>
            {user?.isAdmin && (
              <Link href="/admin" className="p-2 rounded-full bg-aviva-gold/10 border border-aviva-gold/30">
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
        <div>
          <SectionHeader title="ภาพรวมโครงการ" subtitle={loading ? "กำลังโหลด..." : "ข้อมูล Real-time"} />
          <div className="grid grid-cols-2 gap-3">
            <KPICard icon={Users} label="Lead ทั้งหมด" value={`${s.leads}`} />
            <KPICard icon={Home} label="ยูนิตทั้งหมด" value={`${s.houses}`} highlight />
            <KPICard icon={DollarSign} label="รายรับรวม" value={s.income>0?fmt(s.income):"ยังไม่มี"} />
            <KPICard icon={UserCheck} label="พนักงาน" value={`${s.employees} คน`} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <GlassCard className="p-3 text-center">
            <p className="text-lg font-bold text-aviva-text">{s.activeLeads}</p>
            <p className="text-[10px] text-aviva-secondary">Lead กำลังดูแล</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <p className="text-lg font-bold text-green-400">{s.soldHouses}</p>
            <p className="text-[10px] text-aviva-secondary">ยูนิตเสร็จ</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <p className="text-lg font-bold text-red-400">{s.delayed}</p>
            <p className="text-[10px] text-aviva-secondary">ล่าช้า</p>
          </GlassCard>
        </div>

        {s.pendingApprovals > 0 && (
          <GlassCard className="p-3 border border-yellow-500/20 bg-yellow-500/5">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-yellow-400 flex-shrink-0" />
              <span className="text-xs text-yellow-400">รออนุมัติ <b>{s.pendingApprovals}</b> รายการ</span>
            </div>
          </GlassCard>
        )}

        <GlassCard className="p-4">
          <SectionHeader title="รายรับ-รายจ่าย (ล้านบาท)" subtitle="รายเดือนจากข้อมูลจริง" />
          {chart.length === 0 ? (
            <div className="h-32 flex items-center justify-center">
              <p className="text-aviva-secondary text-sm text-center">ยังไม่มีข้อมูลรายรับ-รายจ่าย<br/>เริ่มบันทึกที่หน้าบัญชี</p>
            </div>
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top:4,right:4,left:-24,bottom:0 }}>
                  <XAxis dataKey="month" tick={{ fill:"#D1D5DB",fontSize:10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:"#D1D5DB",fontSize:10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor:"#17332D",border:"1px solid #D4AF37",borderRadius:"8px",color:"#fff",fontSize:"12px" }} />
                  <Bar dataKey="income" fill="#D4AF37" name="รายรับ" radius={[2,2,0,0]} />
                  <Bar dataKey="expense" fill="#ef4444" name="รายจ่าย" radius={[2,2,0,0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div><p className="text-sm font-bold text-aviva-gold">{fmt(s.income)}</p><p className="text-[10px] text-aviva-secondary">รายรับรวม</p></div>
            <div><p className="text-sm font-bold text-red-400">{fmt(s.expense)}</p><p className="text-[10px] text-aviva-secondary">รายจ่ายรวม</p></div>
            <div>
              <p className={`text-sm font-bold ${(s.income-s.expense)>=0?"text-green-400":"text-red-400"}`}>{fmt(Math.abs(s.income-s.expense))}</p>
              <p className="text-[10px] text-aviva-secondary">Net</p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
