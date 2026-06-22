"use client";

import { MessageCircle, Heart } from "lucide-react";
import GlassCard from "./GlassCard";

interface StreamActivity {
  id: string;
  performer_name: string;
  activity_type: string;
  description: string;
  activity_date: string;
  category: string;
}

interface ActivityStreamProps {
  activities: StreamActivity[];
  loading?: boolean;
  onActivityClick?: (activity: StreamActivity) => void;
}

export default function ActivityStream({
  activities,
  loading,
  onActivityClick,
}: ActivityStreamProps) {
  const typeEmoji: Record<string, string> = {
    construction: "🔴",
    finance: "🟠",
    hr: "🟢",
    sales: "💰",
  };

  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto">
      {loading ? (
        <p className="text-sm text-aviva-secondary text-center py-8">
          Loading activity stream...
        </p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-aviva-secondary/50 text-center py-8">
          No activities yet
        </p>
      ) : (
        activities.map((activity) => (
          <GlassCard
            key={activity.id}
            onClick={() => onActivityClick?.(activity)}
            className="cursor-pointer hover:border-aviva-gold/40 transition"
          >
            <div className="p-4 space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-2xl">
                  {typeEmoji[activity.activity_type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-aviva-text">
                    {activity.performer_name}
                  </p>
                  <p className="text-xs text-aviva-secondary">
                    {activity.activity_type.toUpperCase()} • {activity.category}
                  </p>

                  <p className="text-sm text-aviva-text mt-2">
                    {activity.description}
                  </p>

                  <p className="text-xs text-aviva-secondary mt-2">
                    {new Date(activity.activity_date).toLocaleString("th-TH")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-aviva-secondary pl-8">
                <button className="flex items-center gap-1 hover:text-aviva-gold transition">
                  <Heart size={14} />
                  Like
                </button>
                <button className="flex items-center gap-1 hover:text-aviva-gold transition">
                  <MessageCircle size={14} />
                  Comment
                </button>
              </div>
            </div>
          </GlassCard>
        ))
      )}
    </div>
  );
}
