"use client";

import { useEffect, useState, useRef } from "react";
import { Home, Users, Package, LogOut, Bell, ChevronRight, TrendingUp, BarChart2, ClipboardList, HardHat, Briefcase, Wrench } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import GlassCard from "@/components/GlassCard";

const VERSION = "v4.30";

export default function DashboardPage() {
  const user = useCurrentUser();
  const [stats, setStats] = useState({ leads: 0, projects: 0, tasks: 0, repairs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [leadsRes, projectsRes, tasksRes, repairsRes] = await Promise.all([
          supabase.from("leads").select("id", { count: "exact", head: true }),
          supabase.from("projects").select("id", { count: "exact", head: true }),
          supabase.from("tasks").select("id", { count: "exact", head: true }),
          supabase.from("repairs").select("id", { count: "exact", head: true }),
        ]);
        setStats({
          leads: leadsRes.count ?? 0,
          projects: projectsRes.count ?? 0,
          tasks: tasksRes.count ?? 0,
          repairs: repairsRes.count ?? 0,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const quickLinks = [
    { href: "/crm",          label: "CRM ขาย",       icon: Users,        color: "text-aviva-gold",    bg: "bg-aviva-gold/10 border-aviva-gold/20" },
    { href: "/construction", label: "ก่อสร้าง",      icon: HardHat,      color: "text-blue-400",     bg: "bg-blue-400/10 border-blue-400/20" },
    { href: "/office",       label: "ออฟฟิศ",        icon: Briefcase,    color: "text-purple-400",   bg: "bg-purple-400/10 border-purple-400/20" },
    { href: "/reports",      label: "รายงาน",        icon: BarChart2,    color: "text-green-400",    bg: "bg-green-400/10 border-green-400/20" },
    { href: "/settings/forms", label: "แบบฟอร์ม",   icon: ClipboardList, color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/20" },
    { href: "/settings",     label: "ตั้งค่า",       icon: Package,      color: "text-gray-400",     bg: "bg-gray-400/10 border-gray-400/20" },
  ];

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-aviva-text">AVIVA ONE</h1>
              <span className="text-[10px] bg-aviva-gold/20 text-aviva-gold px-2 py-0.5 rounded-full font-mono border border-aviva-gold/30">{VERSION}</span>
            </div>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {user ? `สวัสดี, ${user.full_name}` : "กำลังโหลด..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-xl bg-aviva-card border border-aviva-gold/20 flex items-center justify-center">
              <Bell size={16} className="text-aviva-secondary" />
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
              className="w-9 h-9 rounded-xl bg-aviva-card border border-aviva-gold/20 flex items-center justify-center">
              <LogOut size={16} className="text-aviva-secondary" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "ลูกค้า / ลีด",   value: stats.leads,    icon: Users,        color: "text-aviva-gold" },
            { label: "โปรเจกต์",       value: stats.projects, icon: HardHat,      color: "text-blue-400" },
            { label: "งานที่รอดำเนินการ", value: stats.tasks,  icon: ClipboardList, color: "text-purple-400" },
            { label: "แจ้งซ่อม",       value: stats.repairs,  icon: Wrench,       color: "text-red-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <GlassCard key={label} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-aviva-bg/50 flex items-center justify-center">
                  <Icon size={16} className={color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-aviva-text">{loading ? "—" : value.toLocaleString()}</p>
                  <p className="text-[11px] text-aviva-secondary">{label}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Quick Links */}
        <div>
          <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-3">เมนูหลัก</p>
          <div className="grid grid-cols-3 gap-3">
            {quickLinks.map(({ href, label, icon: Icon, color, bg }) => (
              <Link key={href} href={href}>
                <GlassCard className="p-3 flex flex-col items-center gap-2 active:scale-95 transition-all">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bg}`}>
                    <Icon size={18} className={color} />
                  </div>
                  <span className="text-[11px] text-aviva-secondary text-center leading-tight">{label}</span>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity placeholder */}
        <div>
          <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-3">กิจกรรมล่าสุด</p>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp size={16} className="text-aviva-gold" />
              <p className="text-sm text-aviva-secondary">ระบบพร้อมใช้งาน — {VERSION}</p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}