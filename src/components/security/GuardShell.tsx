"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ShieldCheck, UserPlus, Package, AlertTriangle, MapPin, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

const TABS = [
  { href: "/guard",            label: "หน้าหลัก",   icon: ShieldCheck, exact: true },
  { href: "/guard/queue",      label: "ผู้มาเยือน", icon: UserPlus },
  { href: "/guard/parcels",    label: "พัสดุ",       icon: Package },
  { href: "/guard/incidents",  label: "เหตุการณ์",   icon: AlertTriangle },
  { href: "/guard/patrol",     label: "ตรวจตรา",     icon: MapPin },
];

export default function GuardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-aviva-bg">
      <header className="sticky top-0 z-40 bg-aviva-nav border-b border-aviva-gold/20 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-aviva-gold" />
            <span className="font-bold text-aviva-text">AVIVA Plus · รปภ.</span>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {TABS.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all",
                    active
                      ? "bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/40"
                      : "text-aviva-secondary/70 hover:text-aviva-secondary"
                  )}>
                  <Icon size={14} />
                  {label}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1 text-xs text-aviva-secondary/70 hover:text-aviva-gold">
            <LogOut size={14} /> ออก
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
