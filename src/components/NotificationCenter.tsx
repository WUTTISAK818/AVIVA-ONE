"use client";

import { useEffect, useState } from "react";
import { Bell, X, ExternalLink } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";

interface Notification {
  id: string;
  title: string;
  message: string;
  channels_sent: string[];
  read_at?: string;
  sent_at: string;
  action_url?: string;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const user = useCurrentUser();

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      // Poll every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`/api/notifications?limit=10`);
      if (!response.ok) return;

      const data = await response.json();
      setNotifications(data.data || []);
      setUnreadCount((data.data || []).filter((n: Notification) => !n.read_at).length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: "POST" });
      fetchNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString("th-TH", { month: "short", day: "numeric" });
  };

  return (
    <>
      {/* Notification Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-aviva-bg/50 rounded-lg transition-all"
      >
        <Bell size={20} className="text-aviva-secondary" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="fixed top-16 right-4 w-80 max-h-96 bg-aviva-card border border-aviva-gold/20 rounded-lg shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-aviva-gold/10">
            <h3 className="font-bold text-aviva-text">Notifications</h3>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-aviva-bg rounded">
              <X size={16} className="text-aviva-secondary" />
            </button>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-aviva-secondary/60">
                <p className="text-sm">ไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 border-b border-aviva-gold/10 hover:bg-aviva-bg/50 transition-all cursor-pointer ${
                    !notif.read_at ? "bg-aviva-gold/5" : ""
                  }`}
                  onClick={() => handleMarkAsRead(notif.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read_at ? "bg-transparent" : "bg-aviva-gold"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-aviva-text">{notif.title}</p>
                      <p className="text-[11px] text-aviva-secondary/70 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-aviva-secondary/50 mt-1">{formatTime(notif.sent_at)}</p>
                    </div>
                    {notif.action_url && (
                      <a
                        href={notif.action_url}
                        className="p-1 hover:bg-aviva-gold/10 rounded flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={12} className="text-aviva-gold" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
