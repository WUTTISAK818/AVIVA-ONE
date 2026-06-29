'use client';

import { useEffect, useState } from 'react';
import { Users, TrendingUp, AlertCircle } from 'lucide-react';
import GlassCard from '@/components/GlassCard';

interface ActivitySummary {
  performer_id: string;
  performer_name: string;
  performer_department: string;
  activity_count: number;
  total_value: number;
  activities: any[];
}

export default function DailyActivityWidget() {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch('/api/dashboard/daily-activity-summary');
        const data = await response.json();
        if (data.success) {
          setActivities(data.data || []);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  if (loading) {
    return (
      <GlassCard>
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aviva-gold"></div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-aviva-gold" />
          <h3 className="font-semibold text-lg">กิจกรรมประจำวันนี้</h3>
          <span className="ml-auto bg-aviva-gold/20 text-aviva-gold px-2 py-1 rounded text-xs font-medium">
            {activities.length} ผู้บังคับบัญชา
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {activities.length === 0 ? (
          <p className="text-center text-aviva-secondary/60 py-4">ยังไม่มีกิจกรรมในวันนี้</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.performer_id}
                className="flex items-center justify-between p-3 bg-aviva-card/50 rounded border border-aviva-gold/10 hover:bg-aviva-card/80 transition"
              >
                <div>
                  <p className="font-medium text-aviva-gold">{activity.performer_name}</p>
                  <p className="text-xs text-aviva-secondary/60">{activity.performer_department}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <p className="font-semibold text-green-300">{activity.activity_count} งาน</p>
                  </div>
                  {activity.total_value > 0 && (
                    <p className="text-xs text-aviva-secondary/60">
                      มูลค่า: ฿{(activity.total_value / 1_000_000).toFixed(1)}M
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
