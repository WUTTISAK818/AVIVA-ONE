'use client';

import { useState, useEffect } from 'react';
import { Calendar, Users, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import SectionHeader from '@/components/SectionHeader';
import GlassCard from '@/components/GlassCard';
import type { AttendanceRecord, LateAlert } from '@/lib/types/attendance';

interface AttendanceStat {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[]>([]);
  const [lateAlerts, setLateAlerts] = useState<LateAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AttendanceStat[]>([
    { label: 'Total Present', value: 0, icon: <Users className="w-6 h-6" />, color: 'text-green-500' },
    { label: 'Total Absent', value: 0, icon: <Users className="w-6 h-6" />, color: 'text-red-500' },
    { label: 'Late Arrivals', value: 0, icon: <Clock className="w-6 h-6" />, color: 'text-yellow-500' },
    { label: 'Attendance Rate', value: '0%', icon: <TrendingUp className="w-6 h-6" />, color: 'text-blue-500' },
  ]);

  useEffect(() => {
    fetchDailyAttendance();
    fetchLateAlerts();
  }, [selectedDate]);

  const fetchDailyAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/attendance/daily-report?date=${selectedDate}`);
      const data = await response.json();

      if (data.success) {
        setDailyRecords(data.data || []);
        updateStats(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLateAlerts = async () => {
    try {
      const response = await fetch('/api/shifts/late-alerts');
      const data = await response.json();

      if (data.success) {
        setLateAlerts(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch late alerts:', err);
    }
  };

  const updateStats = (records: any[]) => {
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.is_late).length;
    const total = records.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    setStats([
      { label: 'Total Present', value: present, icon: <Users className="w-6 h-6" />, color: 'text-green-500' },
      { label: 'Total Absent', value: absent, icon: <Users className="w-6 h-6" />, color: 'text-red-500' },
      { label: 'Late Arrivals', value: late, icon: <Clock className="w-6 h-6" />, color: 'text-yellow-500' },
      { label: 'Attendance Rate', value: `${rate}%`, icon: <TrendingUp className="w-6 h-6" />, color: 'text-blue-500' },
    ]);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Attendance Management" subtitle="Monitor daily employee attendance and check-ins" />

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

      {/* Late Alerts */}
      {lateAlerts.length > 0 && (
        <GlassCard className="border border-yellow-500/20 bg-yellow-500/5">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold text-yellow-300">Late Arrivals Today</h3>
              <span className="ml-auto bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded text-xs font-medium">
                {lateAlerts.length} late
              </span>
            </div>

            <div className="space-y-2">
              {lateAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-aviva-card/50 rounded border border-yellow-500/10">
                  <div>
                    <p className="font-medium text-yellow-300">{alert.employee_name}</p>
                    <p className="text-xs text-aviva-secondary/60">
                      Checked in at {new Date(alert.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-yellow-400">{alert.late_minutes} min late</p>
                    <p className="text-xs text-aviva-secondary/60">Expected: {alert.expected_start_time.substring(0, 5)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Date Selector & Daily Report */}
      <GlassCard>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-aviva-gold" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white"
            />
          </div>

          {/* Daily Records Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-aviva-gold/20">
                  <th className="text-left py-2 px-3">Employee</th>
                  <th className="text-left py-2 px-3">Check In</th>
                  <th className="text-left py-2 px-3">Check Out</th>
                  <th className="text-left py-2 px-3">Duration</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-aviva-secondary/60">
                      Loading...
                    </td>
                  </tr>
                ) : dailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-aviva-secondary/60">
                      No attendance records for this date
                    </td>
                  </tr>
                ) : (
                  dailyRecords.map((record) => (
                    <tr key={record.id} className="border-b border-aviva-gold/10 hover:bg-aviva-gold/5">
                      <td className="py-3 px-3">{(record as any).employee_name || 'Unknown'}</td>
                      <td className="py-3 px-3">
                        {record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-3 px-3">
                        {record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-3 px-3">{record.duration_minutes ? `${record.duration_minutes}m` : '—'}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                          ${record.status === 'present' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
                        `}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
