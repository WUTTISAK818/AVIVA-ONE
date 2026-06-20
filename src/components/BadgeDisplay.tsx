"use client";

import { Award } from "lucide-react";
import GlassCard from "./GlassCard";
import { BADGE_DEFINITIONS } from "@/lib/activity-helpers";

interface Badge {
  id: string;
  badge_type: string;
  earned_at: string;
  employee_id?: string;
}

interface BadgeDisplayProps {
  badges: Badge[];
  loading?: boolean;
}

export default function BadgeDisplay({ badges, loading }: BadgeDisplayProps) {
  return (
    <GlassCard>
      <div className="p-6">
        <h3 className="text-lg font-bold text-aviva-text flex items-center gap-2 mb-4">
          <Award size={20} className="text-aviva-gold" />
          Achievements ({badges.length})
        </h3>

        {loading ? (
          <p className="text-sm text-aviva-secondary text-center py-4">
            Loading badges...
          </p>
        ) : badges.length === 0 ? (
          <p className="text-sm text-aviva-secondary/50 text-center py-4">
            No badges earned yet
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {badges.map((badge) => {
              const badgeInfo = BADGE_DEFINITIONS.find(
                (b) => b.type === badge.badge_type
              );

              return (
                <div
                  key={badge.id}
                  className="bg-aviva-bg/30 p-4 rounded-lg text-center space-y-2 hover:bg-aviva-bg/50 transition"
                >
                  <p className="text-3xl">{badgeInfo?.icon || "🏆"}</p>
                  <p className="text-xs font-semibold text-aviva-text">
                    {badgeInfo?.label}
                  </p>
                  <p className="text-xs text-aviva-secondary">
                    {new Date(badge.earned_at).toLocaleDateString("th-TH")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
