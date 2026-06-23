'use client';

import { useState, useEffect } from 'react';
import { Camera, Eye, Users, AlertCircle } from 'lucide-react';
import SectionHeader from '@/components/SectionHeader';
import GlassCard from '@/components/GlassCard';
import type { CCTVEvent, CCTVDailySummary } from '@/lib/types/cctv';

interface CCTVStat {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

export default function CCTVPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCamera, setSelectedCamera] = useState('all');
  const [cctvEvents, setCCTVEvents] = useState<any[]>([]);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<CCTVStat[]>([
    { label: 'Total Events', value: 0, icon: <Eye className="w-6 h-6" />, color: 'text-blue-500' },
    { label: 'Unique Employees', value: 0, icon: <Users className="w-6 h-6" />, color: 'text-green-500' },
    { label: 'Visitors', value: 0, icon: <Users className="w-6 h-6" />, color: 'text-purple-500' },
    { label: 'Alerts', value: 0, icon: <AlertCircle className="w-6 h-6" />, color: 'text-red-500' },
  ]);

  useEffect(() => {
    fetchCCTVData();
  }, [selectedDate, selectedCamera]);

  const fetchCCTVData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cctv/daily-summary?date=${selectedDate}`);
      const data = await response.json();

      if (data.success) {
        setDailySummary(data.data || {});
        setCCTVEvents(data.events || []);
        updateStats(data.data || {});
      }
    } catch (err) {
      console.error('Failed to fetch CCTV data:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (summary: any) => {
    setStats([
      { label: 'Total Events', value: summary.total_events || 0, icon: <Eye className="w-6 h-6" />, color: 'text-blue-500' },
      { label: 'Unique Employees', value: summary.unique_employees || 0, icon: <Users className="w-6 h-6" />, color: 'text-green-500' },
      { label: 'Visitors', value: summary.visitor_count || 0, icon: <Users className="w-6 h-6" />, color: 'text-purple-500' },
      { label: 'Alerts', value: summary.alerts_count || 0, icon: <AlertCircle className="w-6 h-6" />, color: 'text-red-500' },
    ]);
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'face_recognition':
        return 'bg-blue-500/20 text-blue-400';
      case 'person_detection':
        return 'bg-green-500/20 text-green-400';
      case 'visitor_detection':
        return 'bg-purple-500/20 text-purple-400';
      case 'alert':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="CCTV Monitoring" subtitle="Real-time surveillance and visitor tracking" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <GlassCard key={idx}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-aviva-secondary/60">{stat.label}</p>
                <p className="text-2xl font-bold mt-2">{stat.value}</p>
              </div>
              <div className={stat.color}>{stat.icon}</div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Date & Camera Selector */}
      <GlassCard>
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-aviva-gold" />
              <label className="text-sm text-aviva-secondary/80">Date:</label>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white"
            />
            <label className="text-sm text-aviva-secondary/80">Camera:</label>
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white"
            >
              <option value="all">All Cameras</option>
              <option value="entrance">Entrance</option>
              <option value="main_floor">Main Floor</option>
              <option value="parking">Parking</option>
              <option value="office">Office</option>
            </select>
          </div>

          {/* CCTV Events Timeline */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-4 text-center text-aviva-secondary/60">Loading...</div>
            ) : cctvEvents.length === 0 ? (
              <div className="py-4 text-center text-aviva-secondary/60">No events recorded today</div>
            ) : (
              cctvEvents.map((event, idx) => (
                <div key={idx} className="p-3 bg-aviva-card/50 rounded-lg border border-aviva-gold/10 flex items-start justify-between hover:border-aviva-gold/20 transition">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getEventTypeColor(event.event_type)}`}>
                        {event.event_type.replace('_', ' ')}
                      </span>
                      {event.confidence_score && (
                        <span className="text-xs text-aviva-secondary/60">
                          Confidence: {(event.confidence_score * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-aviva-secondary">
                      {event.detected_person_id ? `Person: ${event.detected_person_id}` : 'Unknown person'}
                    </p>
                    <p className="text-xs text-aviva-secondary/60 mt-1">
                      {event.camera_id ? `Camera: ${event.camera_id}` : 'Unknown camera'}
                    </p>
                  </div>
                  <div className="text-xs text-aviva-secondary/60 text-right">
                    {event.created_at ? new Date(event.created_at).toLocaleTimeString() : 'N/A'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </GlassCard>

      {/* Daily Summary */}
      {dailySummary && (
        <GlassCard>
          <h3 className="text-lg font-semibold mb-4">Daily Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-aviva-secondary/60">Peak Time</p>
              <p className="text-xl font-bold mt-1">{dailySummary.peak_hour || '—'}:00</p>
            </div>
            <div>
              <p className="text-sm text-aviva-secondary/60">Avg Presence</p>
              <p className="text-xl font-bold mt-1">{dailySummary.avg_presence_duration || 0}m</p>
            </div>
            <div>
              <p className="text-sm text-aviva-secondary/60">Events/Min</p>
              <p className="text-xl font-bold mt-1">{dailySummary.events_per_minute?.toFixed(2) || 0}</p>
            </div>
            <div>
              <p className="text-sm text-aviva-secondary/60">Coverage</p>
              <p className="text-xl font-bold mt-1">100%</p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
