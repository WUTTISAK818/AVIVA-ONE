"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "@/lib/user-context";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ActivityStream from "@/components/ActivityStream";
import ActivityDetail from "@/components/ActivityDetail";

export default function ActivityStreamPage() {
  const user = useCurrentUser();
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    loadActivities();
  }, [days]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      const response = await fetch(
        `/api/activity/by-date?date=${startDateStr}`
      );
      const result = await response.json();

      if (result.success) {
        const today = new Date().toISOString().split("T")[0];
        const { data: todayActivities } = await (
          await fetch(`/api/activity/by-date?date=${today}`)
        ).json();

        setActivities([...(todayActivities || []), ...(result.data || [])]);
      }
    } catch (err) {
      console.error("Failed to load activities:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (activityId: string) => {
    try {
      const response = await fetch(`/api/activity/${activityId}/comment`);
      const result = await response.json();

      if (result.success) {
        setComments(result.data || []);
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
    }
  };

  const handleActivityClick = async (activity: any) => {
    setSelectedActivity(activity);
    await loadComments(activity.id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-aviva-dark to-aviva-bg p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <SectionHeader
          title="📡 Activity Stream"
          subtitle="See what your team is working on"
        />

        {/* Time Period Selector */}
        <div className="flex gap-2 mb-6">
          {[1, 7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg transition ${
                days === d
                  ? "bg-aviva-gold text-aviva-bg"
                  : "bg-aviva-bg/50 text-aviva-text hover:bg-aviva-bg/70"
              }`}
            >
              {d} {d === 1 ? "day" : "days"}
            </button>
          ))}
        </div>

        {/* Activity Feed */}
        <GlassCard>
          <div className="p-6">
            <ActivityStream
              activities={activities}
              loading={loading}
              onActivityClick={handleActivityClick}
            />
          </div>
        </GlassCard>

        {/* Detail Modal */}
        {selectedActivity && (
          <ActivityDetail
            activity={selectedActivity}
            comments={comments}
            onClose={() => {
              setSelectedActivity(null);
              setComments([]);
            }}
            onAddComment={async (text: string) => {
              try {
                const response = await fetch(
                  `/api/activity/${selectedActivity.id}/comment`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      user_id: user?.id,
                      user_name: user?.full_name,
                      comment_text: text,
                    }),
                  }
                );

                const result = await response.json();
                if (result.success) {
                  setComments([...comments, result.data]);
                }
              } catch (err) {
                console.error("Failed to add comment:", err);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
