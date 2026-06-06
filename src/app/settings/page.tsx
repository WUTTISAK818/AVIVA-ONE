"use client";
import { useState, useEffect } from "react";
import { Moon, Sun, Monitor, Settings, User, Bell, Shield, ChevronRight, LogOut, Palette, Database, ClipboardList } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import GlassCard from "@/components/GlassCard";

const VERSION = "Version 4.30";

export default function SettingsPage() {
  const user = useCurrentUser();
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");

  const menuSections = [
    {
      title: "บัญชีผู้ใช้",
      items: [
        { icon: User,         label: "โปรไฟล์",              href: "/settings/profile",   color: "text-aviva-gold" },
        { icon: Shield,       label: "ความปลอดภัย",           href: "/settings/security",  color: "text-blue-400" },
        { icon: Bell,         label: "การแจ้งเตือน",          href: "/settings/notifications", color: "text-yellow-400" },
      ],
    },
    {
      title: "แอปพลิเคชัน",
      items: [
        { icon: Palette,      label: "ธีม / หน้าจอ",          href: "/settings/theme",     color: "text-purple-400" },
        { icon: Database,     label: "ข้อมูลและการสำรอง",     href: "/settings/data",      color: "text-green-400" },
        { icon: ClipboardList, label: "แบบฟอร์มมาตรฐาน",    href: "/settings/forms",     color: "text-orange-400" },
      ],
    },
    {
      title: "ระบบ",
      items: [
        { icon: Settings,     label: "การตั้งค่าขั้นสูง",     href: "/settings/advanced",  color: "text-gray-400" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-aviva-gold" />
            <h1 className="text-lg font-bold text-aviva-text">ตั้งค่า</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {/* User Card */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-aviva-gold/20 border border-aviva-gold/30 flex items-center justify-center">
              <User size={20} className="text-aviva-gold" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-aviva-text">{user?.full_name ?? "—"}</p>
              <p className="text-xs text-aviva-secondary">{user?.department ?? ""}</p>
            </div>
            <span className="text-[10px] bg-aviva-gold/10 text-aviva-gold px-2 py-0.5 rounded-full border border-aviva-gold/20 font-mono">
              {user?.isAdmin ? "Admin" : user?.isManager ? "Manager" : "Staff"}
            </span>
          </div>
        </GlassCard>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-2">{section.title}</p>
            <GlassCard className="divide-y divide-aviva-gold/10">
              {section.items.map(({ icon: Icon, label, href, color }) => (
                <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-aviva-gold/5 transition-colors">
                  <Icon size={16} className={color} />
                  <span className="flex-1 text-sm text-aviva-text">{label}</span>
                  <ChevronRight size={14} className="text-aviva-secondary/40" />
                </Link>
              ))}
            </GlassCard>
          </div>
        ))}

        {/* Sign Out */}
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors">
          <LogOut size={16} />
          ออกจากระบบ
        </button>

        {/* Version */}
        <p className="text-center text-[11px] text-aviva-secondary/40">{VERSION} — AVIVA ONE</p>
      </div>
    </div>
  );
}