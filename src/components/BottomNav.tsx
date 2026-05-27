"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Users, HardHat,
  Briefcase, Megaphone, UserCheck, Receipt,
  Package, Wrench, ShieldCheck,
  Settings, MoreHorizontal, X,
} from "lucide-react";
import clsx from "clsx";
import { useCurrentUser } from "@/lib/user-context";

const OFFICE_DEPTS = ["ฝ่ายการเงิน", "ฝ่ายบัญชี", "ฝ่ายบุคคล", "ฝ่ายการตลาด", "ฝ่ายหลังการขาย"];

export default function BottomNav() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [showMore, setShowMore] = useState(false);

  if (pathname === "/login") return null;
  if (pathname.startsWith("/guard")) return null;
  if (pathname.startsWith("/v/")) return null;

  const isOfficeUser = user ? OFFICE_DEPTS.includes(user.department) : false;

  // Resident navigation (4 main tabs + More)
  const residentTabs = [
    { href: "/community/announcements",    label: "ประกาศ",     icon: Megaphone },
    { href: "/community/visitors",         label: "ผู้มาเยือน", icon: UserCheck },
    { href: "/community/parcels",          label: "พัสดุ",      icon: Package },
    { href: "/community/bills",            label: "บิล",        icon: Receipt },
  ];
  const residentMoreItems = [
    { href: "/community/service-requests", label: "แจ้งซ่อม",   icon: Wrench },
    { href: "/settings",                   label: "ตั้งค่า",    icon: Settings },
  ];

  // Staff/admin navigation
  const staffTabs = [
    { href: "/dashboard",    label: "หน้าหลัก",  icon: LayoutGrid, show: true },
    { href: "/crm",          label: "ขาย",        icon: Users,      show: !user || user.isAdmin || user.isManager || user.department === "ฝ่ายขาย" },
    { href: "/construction", label: "ก่อสร้าง",   icon: HardHat,    show: !user || user.isAdmin || user.isManager || user.department === "ฝ่ายก่อสร้าง" },
    { href: "/office",       label: "ออฟฟิศ",     icon: Briefcase,  show: !user || user.isAdmin || user.isManager || isOfficeUser },
  ].filter(t => t.show);
  const staffMoreItems = [
    { href: "/security",     label: "ความปลอดภัย", icon: ShieldCheck, show: !user || user.isAdmin || user.isManager },
    { href: "/settings",     label: "ตั้งค่า",     icon: Settings,    show: true },
  ].filter(t => t.show);

  const isResident = user?.isResident ?? false;
  const mainTabs = isResident ? residentTabs : staffTabs;
  const moreItems = isResident ? residentMoreItems : staffMoreItems;
  const activeMore = moreItems.some(t => pathname.startsWith(t.href));

  return (
    <>
      {showMore && (
        <div
          className="fixed inset-0 z-[45] bg-black/50 backdrop-blur-sm"
          onClick={() => setShowMore(false)}
        />
      )}

      {showMore && (
        <div className="fixed bottom-[56px] left-0 right-0 z-[46] bg-aviva-card border-t border-aviva-gold/20 rounded-t-2xl shadow-2xl px-4 pt-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-aviva-secondary tracking-wide">เมนูเพิ่มเติม</p>
            <button onClick={() => setShowMore(false)}>
              <X size={16} className="text-aviva-secondary" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {moreItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link key={href} href={href} onClick={() => setShowMore(false)}
                  className={clsx(
                    "flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all",
                    active
                      ? "bg-aviva-gold/10 text-aviva-gold"
                      : "text-aviva-secondary/70 hover:bg-aviva-bg active:scale-95"
                  )}>
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                  <span className="text-[11px] font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-aviva-nav border-t border-aviva-gold/20">
        <div className="flex items-center px-1 py-1">
          {mainTabs.map(({ href, label, icon: Icon }) => {
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

          <button
            onClick={() => setShowMore(v => !v)}
            className={clsx(
              "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all active:scale-95",
              showMore || activeMore ? "text-aviva-gold" : "text-aviva-secondary/60"
            )}>
            <MoreHorizontal size={20} strokeWidth={showMore || activeMore ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">เพิ่มเติม</span>
            {activeMore && !showMore && <span className="w-1 h-1 rounded-full bg-aviva-gold" />}
          </button>
        </div>
      </nav>
    </>
  );
}
