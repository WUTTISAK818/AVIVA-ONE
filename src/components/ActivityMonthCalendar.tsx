"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import GlassCard from "./GlassCard";

interface Activity {
  activity_type: "construction" | "finance" | "hr" | "sales";
  performer_name: string;
}

interface ActivityMonthCalendarProps {
  year: number;
  month: number;
  activities: Record<string, Activity[]>;
  onDateClick: (date: string) => void;
  loading?: boolean;
}

export default function ActivityMonthCalendar({
  year,
  month,
  activities,
  onDateClick,
  loading,
}: ActivityMonthCalendarProps) {
  const days = getDaysInMonth(year, month);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const activityTypeColors: Record<string, string> = {
    construction: "bg-red-500",
    finance: "bg-orange-500",
    hr: "bg-green-500",
    sales: "bg-blue-500",
  };

  const typeEmoji: Record<string, string> = {
    construction: "🔴",
    finance: "🟠",
    hr: "🟢",
    sales: "💰",
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-aviva-text mb-1">
          {new Date(year, month - 1).toLocaleDateString("th-TH", {
            month: "long",
            year: "numeric",
          })}
        </h2>
      </div>

      {loading ? (
        <div className="text-center text-aviva-secondary py-8">
          Loading calendar...
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center font-bold text-aviva-gold text-sm py-2">
              {day}
            </div>
          ))}

          {/* Empty cells */}
          {Array(firstDay)
            .fill(0)
            .map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

          {/* Date cells */}
          {days.map((day) => {
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = dateStr === todayStr;
            const dayActivities = activities[dateStr] || [];
            const typeCount: Record<string, number> = {};

            dayActivities.forEach((activity) => {
              typeCount[activity.activity_type] =
                (typeCount[activity.activity_type] || 0) + 1;
            });

            return (
              <GlassCard
                key={day}
                onClick={() => onDateClick(dateStr)}
                className={`aspect-square cursor-pointer hover:border-aviva-gold/60 transition p-2 flex flex-col justify-between ${
                  isToday ? "ring-2 ring-aviva-gold border-aviva-gold/50 bg-aviva-gold/10" : ""
                }`}
              >
                <div className={`text-sm font-bold ${isToday ? "text-aviva-gold" : "text-aviva-text"}`}>{day}</div>

                <div className="space-y-1">
                  {dayActivities.length > 0 ? (
                    <>
                      <div className="text-xs text-aviva-secondary">
                        {dayActivities.length} activity
                        {dayActivities.length > 1 ? "ies" : ""}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {Object.entries(typeCount).map(([type, count]) => (
                          <span
                            key={type}
                            className="text-xs px-1.5 py-0.5 bg-aviva-bg/50 rounded"
                            title={`${type}: ${count}`}
                          >
                            {typeEmoji[type]} {count}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-aviva-secondary/50">-</div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getDaysInMonth(year: number, month: number): number[] {
  const daysCount = new Date(year, month, 0).getDate();
  return Array.from({ length: daysCount }, (_, i) => i + 1);
}
