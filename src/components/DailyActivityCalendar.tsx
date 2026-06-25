"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, HardHat, BookOpen, DollarSign, Megaphone, Users, FileText, CheckCircle } from "lucide-react";
import clsx from "clsx";
import { useCurrentUser } from "@/lib/user-context";

interface ActivityData {
  [date: string]: {
    sales: { count: number; items: any[] };
    construction: { count: number; items: any[] };
    accounting: { count: number; items: any[] };
    finance: { count: number; items: any[] };
    marketing: { count: number; items: any[] };
    hr: { count: number; items: any[] };
    approvals: { count: number; items: any[] };
    office: { count: number; items: any[] };
  };
}

type ViewType = "day" | "week" | "month";
type ActivityType = "sales" | "construction" | "accounting" | "finance" | "marketing" | "hr" | "approvals" | "office";

export function DailyActivityCalendar() {
  const [activities, setActivities] = useState<ActivityData>({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>("month");
  const [expandedActivity, setExpandedActivity] = useState<ActivityType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const user = useCurrentUser();

  const activityConfig: Record<ActivityType, { icon: any; color: string; label: string; bgColor: string }> = {
    sales: { icon: TrendingUp, color: "text-green-400", label: "Sales", bgColor: "bg-green-500/10" },
    construction: { icon: HardHat, color: "text-orange-400", label: "Const", bgColor: "bg-orange-500/10" },
    accounting: { icon: BookOpen, color: "text-blue-400", label: "Acct", bgColor: "bg-blue-500/10" },
    finance: { icon: DollarSign, color: "text-yellow-400", label: "Fin", bgColor: "bg-yellow-500/10" },
    marketing: { icon: Megaphone, color: "text-pink-400", label: "Mkt", bgColor: "bg-pink-500/10" },
    hr: { icon: Users, color: "text-cyan-400", label: "HR", bgColor: "bg-cyan-500/10" },
    approvals: { icon: CheckCircle, color: "text-emerald-400", label: "Appr", bgColor: "bg-emerald-500/10" },
    office: { icon: FileText, color: "text-purple-400", label: "Office", bgColor: "bg-purple-500/10" },
  };

  const isManager = user?.role && ["admin", "ceo", "coo", "director", "manager", "project_manager"].includes(user.role);

  useEffect(() => {
    fetchActivities();
  }, [currentDate, viewType, user]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const dateStr = currentDate.toISOString().split("T")[0];
      const params = new URLSearchParams({
        date: dateStr,
        range: viewType,
      });
      if (!isManager && user?.department) {
        params.append("department", user.department);
      }
      const response = await fetch(`/api/dashboard?${params}`);
      const data = await response.json();
      setActivities(data.data || {});
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const renderCalendar = () => {
    if (viewType === "day") {
      return renderDayView();
    } else if (viewType === "week") {
      return renderWeekView();
    } else {
      return renderMonthView();
    }
  };

  const renderDayView = () => {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayData = activities[dateStr];

    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-aviva-secondary mb-3">
          {currentDate.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
        {dayData ? (
          <>
            {/* Activity type buttons */}
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(activityConfig) as ActivityType[]).map((type) => {
                const data = dayData[type];
                if (data.count === 0) return null;
                const config = activityConfig[type];
                const IconComp = config.icon;
                const isExpanded = expandedActivity === type;
                return (
                  <button
                    key={type}
                    onClick={() => setExpandedActivity(isExpanded ? null : type)}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs ${config.bgColor} border-${config.color}/20 hover:border-${config.color}/50 transition-all ${isExpanded ? `border-${config.color}/50 bg-${config.bgColor}` : ""}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <IconComp size={14} className={config.color} />
                      <span className="font-semibold text-aviva-text truncate">{config.label}</span>
                    </div>
                    <span className={`font-bold ${config.color} flex-shrink-0`}>{data.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Expanded details section */}
            {expandedActivity && dayData[expandedActivity]?.items?.length > 0 && (
              <div className="bg-aviva-card rounded-lg border border-aviva-gold/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-aviva-gold uppercase">รายละเอียด</p>
                {dayData[expandedActivity].items.map((item: any, idx: number) => (
                  <div key={`${expandedActivity}-${idx}`} className="bg-aviva-bg/50 rounded-lg p-2.5 border border-aviva-gold/10 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-aviva-text truncate">{item.title}</p>
                        {item.detail && <p className="text-[11px] text-aviva-secondary/80 line-clamp-2">{item.detail}</p>}
                      </div>
                      {item.status && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-aviva-gold/20 text-aviva-gold flex-shrink-0 whitespace-nowrap">
                          {item.status}
                        </span>
                      )}
                    </div>
                    {item.createdBy && (
                      <p className="text-[10px] text-aviva-secondary">โดย {item.createdBy}</p>
                    )}
                    {item.photos && item.photos.length > 0 && (
                      <div className="grid grid-cols-3 gap-1 mt-2">
                        {item.photos.slice(0, 3).map((photo: string, photoIdx: number) => (
                          <div key={photoIdx} className="aspect-square rounded bg-aviva-bg/30 overflow-hidden">
                            <img
                              src={photo}
                              alt={`Photo ${photoIdx + 1}`}
                              className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer"
                            />
                          </div>
                        ))}
                        {item.photos.length > 3 && (
                          <div className="aspect-square rounded bg-aviva-bg/30 flex items-center justify-center text-[11px] font-semibold text-aviva-secondary">
                            +{item.photos.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-aviva-secondary/60 py-4 text-sm">ไม่มี activity วันนี้</p>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const days = [];
    const date = new Date(currentDate);
    const dayOfWeek = date.getDay();
    date.setDate(date.getDate() - dayOfWeek); // Start from Sunday

    for (let i = 0; i < 7; i++) {
      const dateStr = date.toISOString().split("T")[0];
      const dayData = activities[dateStr];
      const hasActivity = dayData && Object.values(dayData).some((d: any) => d.count > 0);

      days.push(
        <div
          key={dateStr}
          className={`flex flex-col items-center p-2 rounded-lg cursor-pointer transition-all ${
            selectedDate === dateStr ? "bg-aviva-gold/20 border-aviva-gold/50" : "bg-aviva-bg/50"
          } border`}
          onClick={() => setSelectedDate(dateStr)}
        >
          <p className="text-xs font-semibold text-aviva-secondary">{date.toLocaleDateString("th-TH", { weekday: "short" })}</p>
          <p className="text-lg font-bold text-aviva-text mt-1">{date.getDate()}</p>
          {hasActivity && <div className="w-2 h-2 bg-aviva-gold rounded-full mt-1" />}
        </div>
      );
      date.setDate(date.getDate() + 1);
    }

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-2">{days}</div>
        {selectedDate && activities[selectedDate] && (
          <div className="bg-aviva-bg rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(activityConfig) as ActivityType[]).map((type) => {
                const data = activities[selectedDate]?.[type];
                if (!data || data.count === 0) return null;
                const config = activityConfig[type];
                const IconComp = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => setExpandedActivity(expandedActivity === type ? null : type)}
                    className={`flex items-center justify-between p-1.5 rounded-lg border text-xs ${config.bgColor} border-${config.color}/20`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <IconComp size={12} className={config.color} />
                      <span className="font-semibold text-aviva-text truncate">{config.label}</span>
                    </div>
                    <span className={`font-bold ${config.color} flex-shrink-0 ml-1`}>{data.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMonthView = () => {
    const days = [];
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-1" />);
    }

    // Days of month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      const dateStr = date.toISOString().split("T")[0];
      const dayData = activities[dateStr];

      let activityCount = 0;
      const activityTypes: ActivityType[] = [];
      if (dayData) {
        (Object.keys(activityConfig) as ActivityType[]).forEach((type) => {
          if (dayData[type].count > 0) {
            activityCount += dayData[type].count;
            activityTypes.push(type);
          }
        });
      }

      days.push(
        <button
          key={i}
          onClick={() => {
            setSelectedDate(dateStr);
            setViewType("day");
            setCurrentDate(date);
          }}
          className={`aspect-square flex flex-col items-center justify-center p-1 rounded-lg text-xs font-semibold transition-all ${
            activityCount > 0 ? "bg-aviva-gold/10 border border-aviva-gold/30" : "bg-aviva-bg/50 border border-aviva-gold/10"
          } hover:border-aviva-gold/50 cursor-pointer`}
        >
          <p className="text-sm text-aviva-text">{i}</p>
          {activityCount > 0 && (
            <div className="flex gap-0.5 mt-0.5">
              {activityTypes.slice(0, 3).map((type) => {
                const config = activityConfig[type];
                return <div key={type} className={`w-1.5 h-1.5 rounded-full ${config.color} bg-current`} />;
              })}
            </div>
          )}
        </button>
      );
    }

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-[10px] font-semibold text-aviva-secondary py-1">
              {day}
            </div>
          ))}
          {days}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newDate = new Date(currentDate);
              if (viewType === "month") newDate.setMonth(newDate.getMonth() - 1);
              else if (viewType === "week") newDate.setDate(newDate.getDate() - 7);
              else newDate.setDate(newDate.getDate() - 1);
              setCurrentDate(newDate);
            }}
            className="p-1.5 rounded-lg bg-aviva-bg border border-aviva-gold/20 hover:border-aviva-gold/50 text-aviva-secondary"
          >
            <ChevronLeft size={14} />
          </button>
          <p className="text-xs font-semibold text-aviva-text min-w-40">
            {currentDate.toLocaleDateString("th-TH", {
              year: "numeric",
              month: "long",
              ...(viewType !== "month" && { day: "numeric" }),
            })}
          </p>
          <button
            onClick={() => {
              const newDate = new Date(currentDate);
              if (viewType === "month") newDate.setMonth(newDate.getMonth() + 1);
              else if (viewType === "week") newDate.setDate(newDate.getDate() + 7);
              else newDate.setDate(newDate.getDate() + 1);
              setCurrentDate(newDate);
            }}
            className="p-1.5 rounded-lg bg-aviva-bg border border-aviva-gold/20 hover:border-aviva-gold/50 text-aviva-secondary"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* View switcher */}
        <div className="flex gap-1 flex-nowrap">
          <button
            onClick={() => {
              const today = new Date();
              setCurrentDate(today);
              setViewType("day");
            }}
            className={clsx(
              "px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all whitespace-nowrap",
              viewType === "day" && Math.abs(currentDate.getTime() - new Date().getTime()) < 86400000
                ? "bg-aviva-gold text-aviva-bg"
                : "bg-aviva-bg border border-aviva-gold/20 text-aviva-secondary hover:border-aviva-gold/50"
            )}
          >
            วันนี้
          </button>
          {(["day", "week", "month"] as ViewType[]).map((view) => (
            <button
              key={view}
              onClick={() => setViewType(view)}
              className={clsx(
                "px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all whitespace-nowrap",
                viewType === view
                  ? "bg-aviva-gold text-aviva-bg"
                  : "bg-aviva-bg border border-aviva-gold/20 text-aviva-secondary hover:border-aviva-gold/50"
              )}
            >
              {view === "day" ? "วัน" : view === "week" ? "สัป" : "เดือน"}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar view */}
      <div className="bg-aviva-bg rounded-2xl p-3 border border-aviva-gold/10">
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-sm text-aviva-secondary">กำลังโหลด...</p>
          </div>
        ) : (
          renderCalendar()
        )}
      </div>

      {/* Legend - Department colors */}
      <div className="bg-aviva-bg/50 rounded-xl p-3 border border-aviva-gold/10">
        <p className="text-[9px] font-bold text-aviva-secondary/70 uppercase tracking-wider mb-2">แผนกงาน</p>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(activityConfig) as ActivityType[]).map((type) => {
            const config = activityConfig[type];
            const IconComp = config.icon;
            return (
              <div key={type} className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg bg-aviva-card border border-aviva-gold/10">
                <IconComp size={12} className={config.color} />
                <span className="text-[9px] font-semibold text-aviva-text">{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded activity details */}
      {expandedActivity && selectedDate && activities[selectedDate]?.[expandedActivity] && (
        <div className="bg-aviva-bg rounded-xl p-3 border border-aviva-gold/10 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-aviva-text">
              {activityConfig[expandedActivity].label} - {new Date(selectedDate).toLocaleDateString("th-TH")}
            </p>
            <button onClick={() => setExpandedActivity(null)} className="text-aviva-secondary text-xs">
              ✕
            </button>
          </div>
          {activities[selectedDate]?.[expandedActivity]?.items?.map((item, idx) => (
            <div key={idx} className="text-[10px] p-2 bg-aviva-card rounded-lg">
              <p className="font-semibold text-aviva-text">{item.description}</p>
              <p className="text-aviva-secondary mt-0.5">👤 {item.performer_name}</p>
              {item.amount && <p className="text-aviva-gold mt-0.5">฿{Number(item.amount).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
