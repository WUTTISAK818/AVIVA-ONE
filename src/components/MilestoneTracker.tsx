"use client";

import { Target, TrendingUp, AlertCircle } from "lucide-react";
import GlassCard from "./GlassCard";

interface Goal {
  id: string;
  department: string;
  activity_type: string;
  target_count: number;
  actual_count: number;
  period: string;
  achieved: boolean;
  start_date: string;
  end_date: string;
}

interface MilestoneTrackerProps {
  goals: Goal[];
  loading?: boolean;
}

export default function MilestoneTracker({
  goals,
  loading,
}: MilestoneTrackerProps) {
  const getProgress = (actual: number, target: number) => {
    return Math.min(Math.round((actual / target) * 100), 100);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-aviva-text flex items-center gap-2">
        <Target size={20} className="text-aviva-gold" />
        Goals & Milestones ({goals.length})
      </h3>

      {loading ? (
        <p className="text-sm text-aviva-secondary text-center py-4">
          Loading goals...
        </p>
      ) : goals.length === 0 ? (
        <p className="text-sm text-aviva-secondary/50 text-center py-4">
          No goals set
        </p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const progress = getProgress(goal.actual_count, goal.target_count);
            const isOnTrack = goal.actual_count >= (goal.target_count * 0.8);

            return (
              <GlassCard
                key={goal.id}
                className={goal.achieved ? "border-green-500/50" : isOnTrack ? "border-yellow-500/30" : "border-red-500/30"}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-aviva-text">
                        {goal.activity_type}
                      </p>
                      <p className="text-xs text-aviva-secondary">
                        {goal.department} • {goal.period}
                      </p>
                    </div>
                    {goal.achieved ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded font-semibold">
                        ✓ Achieved
                      </span>
                    ) : isOnTrack ? (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded font-semibold">
                        On Track
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded font-semibold flex items-center gap-1">
                        <AlertCircle size={12} />
                        At Risk
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-aviva-secondary">Progress</span>
                      <span className="text-aviva-text font-semibold">
                        {goal.actual_count} / {goal.target_count}
                      </span>
                    </div>
                    <div className="w-full bg-aviva-bg/50 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          goal.achieved
                            ? "bg-green-500"
                            : isOnTrack
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-aviva-secondary">
                    {new Date(goal.start_date).toLocaleDateString("th-TH")} -{" "}
                    {new Date(goal.end_date).toLocaleDateString("th-TH")}
                  </p>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
