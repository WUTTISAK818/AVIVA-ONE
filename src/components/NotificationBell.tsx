"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, CheckCheck, AlertCircle, Info, CheckCircle, FileText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  from_dept: string | null;
  to_dept: string | null;
  is_read: boolean;
  created_at: string;
  record_id: string | null;
}

const TYPE_CONFIG: Record<string, { Icon: typeof Bell; color: string; bg: string }> = {
  approval: { Icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  claim:    { Icon: AlertCircle, color: "text-red-400",    bg: "bg-red-500/10" },
  document: { Icon: FileText,    color: "text-blue-400",   bg: "bg-blue-500/10" },
  success:  { Icon: CheckCircle, color: "text-green-400",  bg: "bg-green-500/10" },
  info:     { Icon: Info,        color: "text-blue-400",   bg: "bg-blue-500/10" },
};

function timeAgo(ts: string): string {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
  if (mins < 1) return "เมื่อกี้";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

function getNotifHref(n: Notification): string | null {
  // ลิงก์ไปการ์ดลูกค้าโดยตรงถ้ามี record_id (เรื่องลูกค้า/ขายส่วนใหญ่)
  const lead = n.record_id ? `/crm?lead=${n.record_id}` : null;
  // รายการรออนุมัติ / ผลการอนุมัติ
  if (n.type === "approval" || n.from_dept === "ฝ่ายอนุมัติ" || n.to_dept === "ฝ่ายอนุมัติ") return "/approvals";
  if (n.type === "claim") return "/office";
  if (n.type === "document") return "/office";
  if (n.from_dept === "ฝ่ายขาย" || n.to_dept === "ฝ่ายขาย") return lead ?? "/crm";
  if (n.from_dept === "ฝ่ายก่อสร้าง") return "/construction";
  if (n.from_dept === "ฝ่ายการเงิน" || n.from_dept === "ฝ่ายบัญชี" || n.from_dept === "ฝ่ายออฟฟิศ") return "/office";
  // มี record_id แต่ไม่เข้าเงื่อนไขด้านบน — เปิดการ์ดลูกค้า
  if (lead) return lead;
  return null;
}

export default function NotificationBell() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const currentUserRef = useRef(currentUser);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .limit(50);
    const all = (data as Notification[]) ?? [];
    const user = currentUserRef.current;
    const visible = user && !user.isManager
      ? all.filter(n => !n.to_dept || n.to_dept === user.department || n.from_dept === user.department)
      : all;
    setNotifications(visible.slice(0, 30));
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel("notifications_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        fetchNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    if (error) fetchNotifications(); // เขียนไม่สำเร็จ — sync จาก DB จริง ไม่ค้างสถานะลวง
  };

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) fetchNotifications();
  };

  const handleNotifClick = async (n: Notification) => {
    if (!n.is_read) await markRead(n.id);
    const href = getNotifHref(n);
    if (href) { setOpen(false); router.push(href); }
  };

  const clearRead = async () => {
    const readIds = notifications.filter(n => n.is_read).map(n => n.id);
    if (readIds.length === 0) { setConfirmClear(false); return; }
    setNotifications((prev) => prev.filter((n) => !n.is_read));
    setConfirmClear(false);
    const { error } = await supabase.from("notifications").delete().in("id", readIds);
    if (error) fetchNotifications(); // ลบไม่สำเร็จ — sync กลับมาให้ตรง DB จริง
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        aria-label="การแจ้งเตือน"
        aria-expanded={open}
        className="relative p-2 rounded-full bg-aviva-card border border-aviva-gold/10 transition-all hover:border-aviva-gold/30">
        <Bell size={18} className="text-aviva-secondary" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-80 max-w-[min(320px,calc(100vw-16px))] bg-aviva-card border border-aviva-gold/20 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-aviva-gold/10">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-aviva-text">การแจ้งเตือน</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold">{unreadCount} ใหม่</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-[10px] text-aviva-secondary hover:text-aviva-gold transition-colors">
                  <CheckCheck size={11} /> อ่านทั้งหมด
                </button>
              )}
              {notifications.some(n => n.is_read) && (
                <button onClick={() => setConfirmClear(true)} className="flex items-center gap-1 text-[10px] text-aviva-secondary hover:text-red-400 transition-colors">
                  <Trash2 size={11} /> ลบที่อ่านแล้ว
                </button>
              )}
              <button onClick={() => setOpen(false)}><X size={14} className="text-aviva-secondary" /></button>
            </div>
          </div>
          {confirmClear && (
            <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between gap-2">
              <p className="text-xs text-red-400">ยืนยันลบการแจ้งเตือนที่อ่านแล้วทั้งหมด?</p>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setConfirmClear(false)} className="text-[10px] px-2 py-1 rounded-lg bg-aviva-bg border border-aviva-gold/10 text-aviva-secondary">ยกเลิก</button>
                <button onClick={clearRead} className="text-[10px] px-2 py-1 rounded-lg bg-red-500 text-white font-bold">ลบ</button>
              </div>
            </div>
          )}
          <div className="max-h-[min(384px,60vh)] overflow-y-auto divide-y divide-aviva-gold/5">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="px-4 py-3 flex items-start gap-3 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-aviva-bg/50 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-aviva-bg/50 rounded w-3/4" />
                    <div className="h-2.5 bg-aviva-bg/50 rounded w-full" />
                  </div>
                </div>
              ))
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={24} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-xs text-aviva-secondary">ยังไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              notifications.map(n => {
                const tc = TYPE_CONFIG[n.type] ?? TYPE_CONFIG["info"];
                const { Icon } = tc;
                const hasLink = !!getNotifHref(n);
                return (
                  <button key={n.id} onClick={() => handleNotifClick(n)}
                    className={clsx("w-full text-left px-4 py-3 flex items-start gap-3 transition-all hover:bg-aviva-gold/5",
                      !n.is_read && "bg-aviva-gold/5 border-l-2 border-aviva-gold",
                      hasLink && "cursor-pointer"
                    )}>
                    <div className={clsx("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", tc.bg)}>
                      <Icon size={13} className={tc.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx("text-xs font-semibold truncate", !n.is_read ? "text-aviva-text" : "text-aviva-secondary")}>{n.title}</p>
                      <p className="text-[10px] text-aviva-secondary/70 mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {n.from_dept && <span className="text-[9px] text-aviva-gold bg-aviva-gold/10 px-1.5 py-0.5 rounded-full">{n.from_dept}</span>}
                        <span className="text-[9px] text-aviva-secondary/50">{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                    {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-aviva-gold flex-shrink-0 mt-1.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
