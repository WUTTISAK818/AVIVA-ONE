"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Users, HardHat, Briefcase, Settings } from "lucide-react";
import clsx from "clsx";
import { useCurrentUser } from "@/lib/user-context";

const OFFICE_DEPTS = ["ฝ่ายการเงิน", "ฝ่ายบัญชี", "ฝ่ายบุคคล", "ฝ่ายการตลาด", "ฝ่ายหลังการขาย"];

export default function BottomNav() {
  const pathname = usePathname();
  const user = useCurrentUser();

  if (pathname === "/login") return null;

  const isOfficeUser = user ? OFFICE_DEPTS.includes(user.department) : false;

  const tabs = [
    { href: "/dashboard",    label: "หน้าหลัก",  icon: LayoutGrid, show: true },
    { href: "/crm",          label: "ขาย",        icon: Users,      show: !user || user.isAdmin || user.isManager || user.department === "ฝ่ายขาย" },
    { href: "/construction", label: "ก่อสร้าง",   icon: HardHat,    show: !user || user.isAdmin || user.isManager || user.department === "ฝ่ายก่อสร้าง" },
    { href: "/office",       label: "ออฟฟิศ",     icon: Briefcase,  show: !user || user.isAdmin || user.isManager || isOfficeUser },
    { href: "/settings",     label: "ตั้งค่า",    icon: Settings,   show: true },
  ].filter(t => t.show);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-aviva-nav border-t border-aviva-gold/20">
      <div className="flex items-center px-1 py-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={clsx(
                "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all active:scale-95",
                active ? "text-aviva-gold" : "text-aviva-secondary/60 hover:text-aviva-secondary"
              )}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-aviva-gold" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
