"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { LayoutGrid, Users, HardHat, Briefcase, Settings, ClipboardList, Inbox, FileText } from "lucide-react";
import clsx from "clsx";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import { rolesForUser } from "@/lib/workflow-events";

const OFFICE_DEPTS = ["ฝ่ายการเงิน", "ฝ่ายบัญชี", "ฝ่ายบุคคล", "ฝ่ายการตลาด", "ฝ่ายหลังการขาย"];

export default function BottomNav() {
  const pathname = usePathname();
  const user = useCurrentUser();

  const roles = useMemo(() => (user ? rolesForUser(user) : []), [user]);
  const [inboxCount, setInboxCount] = useState(0);

  const loadCount = useCallback(async () => {
    if (roles.length === 0) { setInboxCount(0); return; }
    const { count } = await supabase
      .from("work_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .in("assigned_role", roles);
    setInboxCount(count ?? 0);
  }, [roles]);

  useEffect(() => { loadCount(); }, [loadCount]);

  useEffect(() => {
    if (roles.length === 0) return;
    const ch = supabase
      .channel("work_queue_badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_queue" }, () => loadCount())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roles, loadCount]);

  if (pathname === "/login") return null;

  const isOfficeUser = user ? OFFICE_DEPTS.includes(user.department) : false;
  // ผู้บริหาร/ผจก.โครงการ: เอกสาร+รายงาน ย้ายไปอยู่ในออฟฟิศแล้ว จึงซ่อนจากแถบล่างเพื่อลดความแออัด
  const isExec = !!user && (user.isManager || user.isAdmin);

  const tabs = [
    { href: "/dashboard",    label: "หน้าหลัก",    icon: LayoutGrid,   show: true,  badge: 0 },
    { href: "/crm",          label: "ขาย",          icon: Users,        show: !user || user.isAdmin || user.isManager || user.department === "ฝ่ายขาย", badge: 0 },
    { href: "/documents/generate", label: "เอกสาร",  icon: FileText,     show: !isExec && user?.department === "ฝ่ายขาย", badge: 0 },
    { href: "/construction", label: "ก่อสร้าง",     icon: HardHat,      show: !user || user.isAdmin || user.isManager || user.department === "ฝ่ายก่อสร้าง", badge: 0 },
    { href: "/inbox",        label: "กล่องงาน",     icon: Inbox,        show: roles.length > 0, badge: inboxCount },
    { href: "/office",       label: "ออฟฟิศ",       icon: Briefcase,    show: !user || user.isAdmin || user.isManager || isOfficeUser, badge: 0 },
    { href: "/reports",      label: "รายงาน",       icon: ClipboardList, show: !isExec, badge: 0 },
    { href: "/settings",     label: "ตั้งค่า",      icon: Settings,     show: true, badge: 0 },
  ].filter(t => t.show);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-aviva-nav border-t border-aviva-gold/20">
      <div className="flex items-center px-1 py-1">
        {tabs.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={clsx(
                "relative flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all active:scale-95",
                active ? "text-aviva-gold" : "text-aviva-secondary/60 hover:text-aviva-secondary"
              )}>
              <div className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-aviva-gold" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
