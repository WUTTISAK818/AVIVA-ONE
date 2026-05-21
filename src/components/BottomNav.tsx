"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Building2, TrendingUp,
  Sparkles, BookOpen, UserCheck, FolderOpen, Megaphone, Wrench,
} from "lucide-react";
import clsx from "clsx";
import { useCurrentUser } from "@/lib/user-context";

const ALL_TABS = [
  { href: "/dashboard",    label: "บริหาร",      icon: LayoutDashboard, depts: [] as string[] },
  { href: "/crm",          label: "ขาย",         icon: Users,           depts: ["ฝ่ายขาย"] },
  { href: "/construction", label: "ก่อสร้าง",    icon: Building2,       depts: ["ฝ่ายก่อสร้าง"] },
  { href: "/finance",      label: "การเงิน",     icon: TrendingUp,      depts: ["ฝ่ายการเงิน"] },
  { href: "/accounting",   label: "บัญชี",       icon: BookOpen,        depts: ["ฝ่ายบัญชี"] },
  { href: "/hr",           label: "บุคคล",       icon: UserCheck,       depts: ["ฝ่ายบุคคล"] },
  { href: "/marketing",    label: "การตลาด",     icon: Megaphone,       depts: ["ฝ่ายการตลาด"] },
  { href: "/after-sales",  label: "After Sales", icon: Wrench,          depts: ["ฝ่ายหลังการขาย"] },
  { href: "/documents",    label: "เอกสาร",      icon: FolderOpen,      depts: [] as string[] },
  { href: "/ai",           label: "AI",           icon: Sparkles,        depts: [] as string[] },
];

export default function BottomNav() {
  const pathname = usePathname();
  const user = useCurrentUser();
  if (pathname === "/login") return null;

  const navItems = ALL_TABS.filter((tab) => {
    if (!user) return tab.depts.length === 0;
    if (user.isManager) return true;
    if (tab.depts.length === 0) return true;
    return tab.depts.includes(user.department);
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-aviva-nav border-t border-aviva-gold/20">
      <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={clsx(
                "flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[58px]",
                active ? "text-aviva-gold" : "text-aviva-secondary/60 hover:text-aviva-secondary"
              )}>
              <Icon size={19} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[9px] font-medium whitespace-nowrap">{label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-aviva-gold" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
