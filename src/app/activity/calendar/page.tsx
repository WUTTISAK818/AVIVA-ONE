"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  BarChart3,
  List,
} from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ActivityMonthCalendar from "@/components/ActivityMonthCalendar";
import ActivityDetail from "@/components/ActivityDetail";

export default function ActivityCalendarPage() {
  const user = useCurrentUser();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [view, setView] = useState<"month" | "week" | "timeline">("month");
  const [activities, setActivities] = useState<Record<string, any[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    employee: "",
    department: "",
    activityType: "",
  });

  useEffect(() => {
    loadActivities();
  }, [year, month, filters]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        year: year.toString(),
        month: month.toString(),
        ...(filters.employee && { employee_id: filters.employee }),
        ...(filters.department && { department: filters.department }),
        ...(filters.activityType && { activity_type: filters.activityType }),
      });

      const response = await fetch(`/api/activity/calendar?${params}`);
      const result = await response.json();

      if (result.success) {
        setActivities(result.data || {});
      }
    } catch (err) {
      console.error("Failed to load activities:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (activityId: string) => {
    try {
      const response = await fetch(
        `/api/activity/${activityId}/comment`
      );
      const result = await response.json();

      if (result.success) {
        setComments(result.data || []);
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
    }
  };

  const handleDateClick = async (date: string) => {
    setSelectedDate(date);
    const dayActivities = activities[date] || [];
    if (dayActivities.length > 0) {
      setSelectedActivity(dayActivities[0]);
      await loadComments(dayActivities[0].id);
    }
  };

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-aviva-dark to-aviva-bg p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          title="📅 Activity Calendar"
          subtitle="Track all employee activities and performance"
        />

        {/* Filters */}
        <GlassCard className="mb-6">
          <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Filter by employee..."
              value={filters.employee}
              onChange={(e) =>
                setFilters({ ...filters, employee: e.target.value })
              }
              className="px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text placeholder-aviva-secondary"
            />
            <select
              value={filters.department}
              onChange={(e) =>
                setFilters({ ...filters, department: e.target.value })
              }
              className="px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
            >
              <option value="">All Departments</option>
              <option value="construction">Construction</option>
              <option value="sales">Sales</option>
              <option value="finance">Finance</option>
              <option value="hr">HR</option>
            </select>
            <select
              value={filters.activityType}
              onChange={(e) =>
                setFilters({ ...filters, activityType: e.target.value })
              }
              className="px-3 py-2 bg-aviva-bg/50 border border-aviva-gold/20 rounded-lg text-aviva-text"
            >
              <option value="">All Types</option>
              <option value="construction">🔴 Construction</option>
              <option value="finance">🟠 Finance</option>
              <option value="hr">🟢 HR</option>
              <option value="sales">💰 Sales</option>
            </select>
            <button
              onClick={() =>
                setFilters({ employee: "", department: "", activityType: "" })
              }
              className="px-3 py-2 bg-aviva-secondary/20 text-aviva-secondary hover:bg-aviva-secondary/30 rounded-lg transition"
            >
              Clear Filters
            </button>
          </div>
        </GlassCard>

        {/* View Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView("month")}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              view === "month"
                ? "bg-aviva-gold text-aviva-bg"
                : "bg-aviva-bg/50 text-aviva-text hover:bg-aviva-bg/70"
            }`}
          >
            <Calendar size={18} />
            Month
          </button>
          <button
            onClick={() => setView("week")}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              view === "week"
                ? "bg-aviva-gold text-aviva-bg"
                : "bg-aviva-bg/50 text-aviva-text hover:bg-aviva-bg/70"
            }`}
          >
            <BarChart3 size={18} />
            Week
          </button>
          <button
            onClick={() => setView("timeline")}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              view === "timeline"
                ? "bg-aviva-gold text-aviva-bg"
                : "bg-aviva-bg/50 text-aviva-text hover:bg-aviva-bg/70"
            }`}
          >
            <List size={18} />
            Timeline
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePrevMonth}
            className="p-2 bg-aviva-bg/50 hover:bg-aviva-bg/70 rounded-lg transition"
          >
            <ChevronLeft size={20} className="text-aviva-gold" />
          </button>
          <h2 className="text-2xl font-bold text-aviva-text">
            {new Date(year, month - 1).toLocaleDateString("th-TH", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-2 bg-aviva-bg/50 hover:bg-aviva-bg/70 rounded-lg transition"
          >
            <ChevronRight size={20} className="text-aviva-gold" />
          </button>
        </div>

        {/* Calendar View */}
        <GlassCard>
          <div className="p-6">
            {view === "month" && (
              <ActivityMonthCalendar
                year={year}
                month={month}
                activities={activities}
                onDateClick={handleDateClick}
                loading={loading}
              />
            )}
            {view === "week" && (
              <div className="text-center text-aviva-secondary py-8">
                Week View Coming Soon
              </div>
            )}
            {view === "timeline" && (
              <div className="text-center text-aviva-secondary py-8">
                Timeline View Coming Soon
              </div>
            )}
          </div>
        </GlassCard>

        {/* Detail Modal */}
        {selectedActivity && (
          <ActivityDetail
            activity={selectedActivity}
            comments={comments}
            onClose={() => {
              setSelectedActivity(null);
              setSelectedDate(null);
            }}
            onAddComment={async (text: string) => {
              // Add comment implementation
              console.log("Add comment:", text);
            }}
          />
        )}
      </div>
    </div>
  );
}
