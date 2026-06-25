"use client";

import { useState, useEffect } from "react";
import { Bell, X, AlertCircle, CheckCircle, Info } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";

interface Notification {
  id: string;
  type: "pending_approval" | "new_report" | "status_change";
  title: string;
  message: string;
  severity: "high" | "medium" | "low" | "info";
  timestamp: string;
  read: boolean;
  activityId?: string;
  href?: string;
}

export function NotificationCenter() {
  const user = useCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.id && user?.isManager) {
      fetchNotifications();
      // Refresh every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/notifications?user_id=${user.id}&type=pending_approvals`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data || []);
        setUnreadCount(data.summary?.pendingApprovals || 0);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notification_id: notificationId,
          user_id: user?.id,
        }),
      });
      // Remove from list
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleDismiss = (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "high":
        return { bg: "bg-red-500/10", border: "border-red-500/30", icon: AlertCircle, color: "text-red-400" };
      case "medium":
        return { bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: AlertCircle, color: "text-yellow-400" };
      case "low":
      case "info":
      default:
        return { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: Info, color: "text-blue-400" };
    }
  };

  if (!user?.isManager) return null;

  const config = getSeverityConfig(notifications[0]?.severity || "info");

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2 rounded-lg bg-aviva-bg border border-aviva-gold/20 hover:border-aviva-gold/50 text-aviva-secondary hover:text-aviva-gold transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-xs font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-aviva-bg rounded-lg border border-aviva-gold/20 shadow-xl z-50 max-h-96 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-aviva-bg border-b border-aviva-gold/10 p-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-aviva-text">แจ้งเตือน</h3>
            <button
              onClick={() => setShowPanel(false)}
              className="p-1 rounded-lg hover:bg-aviva-card text-aviva-secondary"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="p-4 text-center text-aviva-secondary text-xs">กำลังโหลด...</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-aviva-secondary/60 text-xs">ไม่มีแจ้งเตือน</div>
          ) : (
            <div className="space-y-2 p-3">
              {notifications.map((notif) => {
                const notifConfig = getSeverityConfig(notif.severity);
                const IconComp = notifConfig.icon;
                return (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-lg border ${notifConfig.bg} ${notifConfig.border} space-y-1.5 group hover:border-aviva-gold/50 transition-colors`}
                  >
                    <div className="flex items-start gap-2">
                      <IconComp size={14} className={`flex-shrink-0 mt-0.5 ${notifConfig.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-aviva-text truncate">{notif.title}</p>
                        <p className="text-[11px] text-aviva-secondary/80 line-clamp-2">{notif.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-between">
                      <p className="text-[10px] text-aviva-secondary/60">
                        {new Date(notif.timestamp).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {notif.type === "pending_approval" && (
                          <button
                            onClick={() => {
                              if (notif.activityId) {
                                // Navigate to activity detail
                                window.location.href = `/activity?id=${notif.activityId}`;
                              }
                            }}
                            className="text-[10px] px-2 py-1 rounded bg-aviva-gold/20 text-aviva-gold hover:bg-aviva-gold/30 font-semibold"
                          >
                            ดู
                          </button>
                        )}
                        <button
                          onClick={() => handleDismiss(notif.id)}
                          className="text-[10px] px-2 py-1 rounded bg-aviva-card/50 text-aviva-secondary hover:bg-aviva-card font-semibold"
                        >
                          ซ่อน
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-aviva-gold/10 p-2 text-center">
              <button
                onClick={() => {
                  setNotifications([]);
                  setUnreadCount(0);
                  setShowPanel(false);
                }}
                className="text-[10px] text-aviva-gold hover:text-aviva-gold/80 font-semibold"
              >
                ล้างทั้งหมด
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
