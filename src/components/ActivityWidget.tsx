"use client";

import { Activity, TrendingUp } from "lucide-react";
import GlassCard from "./GlassCard";

interface ActivityWidgetProps {
  totalActivities: number;
  avgPerDay: number;
  byType?: Record<string, number>;
}

export default function ActivityWidget({
  totalActivities,
  avgPerDay,
  byType,
}: ActivityWidgetProps) {
  return (
    <GlassCard>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-aviva-text flex items-center gap-2">
            <Activity size={16} className="text-aviva-gold" />
            Daily Activity
          </p>
          <TrendingUp size={16} className="text-green-500" />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-aviva-secondary mb-1">Total This Week</p>
            <p className="text-2xl font-bold text-aviva-text">
              {totalActivities}
            </p>
          </div>

          <div>
            <p className="text-xs text-aviva-secondary mb-1">Average Per Day</p>
            <p className="text-lg font-semibold text-aviva-gold">
              {avgPerDay}
            </p>
          </div>

          {byType && Object.keys(byType).length > 0 && (
            <div className="pt-3 border-t border-aviva-gold/20 space-y-1">
              {Object.entries(byType).map(([type, count]) => (
                <div
                  key={type}
                  className="flex justify-between text-xs"
                  title={type}
                >
                  <span className="text-aviva-secondary capitalize truncate">
                    {type}
                  </span>
                  <span className="text-aviva-text font-semibold">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
