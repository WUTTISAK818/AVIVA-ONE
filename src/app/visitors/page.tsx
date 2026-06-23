'use client';

import { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle, Plus } from 'lucide-react';
import SectionHeader from '@/components/SectionHeader';
import GlassCard from '@/components/GlassCard';
import type { VisitorTracking } from '@/lib/types/cctv';

interface VisitorStat {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

export default function VisitorsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewVisitorForm, setShowNewVisitorForm] = useState(false);
  const [stats, setStats] = useState<VisitorStat[]>([
    { label: 'Total Visitors Today', value: 0, icon: <Users className="w-6 h-6" />, color: 'text-blue-500' },
    { label: 'Checked In', value: 0, icon: <CheckCircle className="w-6 h-6" />, color: 'text-green-500' },
    { label: 'Still Present', value: 0, icon: <Users className="w-6 h-6" />, color: 'text-yellow-500' },
    { label: 'Checked Out', value: 0, icon: <Clock className="w-6 h-6" />, color: 'text-purple-500' },
  ]);

  const [formData, setFormData] = useState({
    visitor_name: '',
    purpose: '',
    host_employee_id: '',
    camera_frame: '',
  });

  useEffect(() => {
    fetchVisitors();
  }, [selectedDate]);

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/visitors/daily?date=${selectedDate}`);
      const data = await response.json();

      if (data.success) {
        setVisitors(data.data || []);
        updateStats(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch visitors:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (visitorsList: any[]) => {
    const total = visitorsList.length;
    const checkedIn = visitorsList.filter(v => v.check_in_time).length;
    const presentCount = visitorsList.filter(v => v.check_in_time && !v.check_out_time).length;
    const checkedOut = visitorsList.filter(v => v.check_out_time).length;

    setStats([
      { label: 'Total Visitors Today', value: total, icon: <Users className="w-6 h-6" />, color: 'text-blue-500' },
      { label: 'Checked In', value: checkedIn, icon: <CheckCircle className="w-6 h-6" />, color: 'text-green-500' },
      { label: 'Still Present', value: presentCount, icon: <Users className="w-6 h-6" />, color: 'text-yellow-500' },
      { label: 'Checked Out', value: checkedOut, icon: <Clock className="w-6 h-6" />, color: 'text-purple-500' },
    ]);
  };

  const handleCheckIn = async () => {
    if (!formData.visitor_name || !formData.host_employee_id) {
      alert('Please fill in required fields');
      return;
    }

    try {
      const response = await fetch('/api/cctv/visitor-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (data.success) {
        setFormData({ visitor_name: '', purpose: '', host_employee_id: '', camera_frame: '' });
        setShowNewVisitorForm(false);
        fetchVisitors();
      }
    } catch (err) {
      console.error('Failed to check in visitor:', err);
    }
  };

  const handleCheckOut = async (visitorId: string) => {
    try {
      const response = await fetch(`/api/visitors/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: visitorId }),
      });
      const data = await response.json();

      if (data.success) {
        fetchVisitors();
      }
    } catch (err) {
      console.error('Failed to check out visitor:', err);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Visitor Management" subtitle="Track visitor check-ins and check-outs" />

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

      {/* New Visitor Form */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Check In Visitor</h3>
          <button
            onClick={() => setShowNewVisitorForm(!showNewVisitorForm)}
            className="flex items-center gap-2 px-4 py-2 bg-aviva-gold/20 hover:bg-aviva-gold/30 rounded-lg text-aviva-gold transition"
          >
            <Plus className="w-4 h-4" />
            New Visitor
          </button>
        </div>

        {showNewVisitorForm && (
          <div className="space-y-4 p-4 bg-aviva-card/50 rounded-lg">
            <input
              type="text"
              placeholder="Visitor Name"
              value={formData.visitor_name}
              onChange={(e) => setFormData({ ...formData, visitor_name: e.target.value })}
              className="w-full px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white placeholder-aviva-secondary/60"
            />
            <input
              type="text"
              placeholder="Purpose of Visit"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white placeholder-aviva-secondary/60"
            />
            <input
              type="text"
              placeholder="Host Employee ID"
              value={formData.host_employee_id}
              onChange={(e) => setFormData({ ...formData, host_employee_id: e.target.value })}
              className="w-full px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white placeholder-aviva-secondary/60"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCheckIn}
                className="flex-1 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg font-semibold transition"
              >
                Check In
              </button>
              <button
                onClick={() => setShowNewVisitorForm(false)}
                className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Visitors List */}
      <GlassCard>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Clock className="w-5 h-5 text-aviva-gold" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white"
            />
          </div>

          {/* Visitors Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-aviva-gold/20">
                  <th className="text-left py-2 px-3">Visitor Name</th>
                  <th className="text-left py-2 px-3">Purpose</th>
                  <th className="text-left py-2 px-3">Host</th>
                  <th className="text-left py-2 px-3">Check In</th>
                  <th className="text-left py-2 px-3">Check Out</th>
                  <th className="text-center py-2 px-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-aviva-secondary/60">
                      Loading...
                    </td>
                  </tr>
                ) : visitors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-aviva-secondary/60">
                      No visitors today
                    </td>
                  </tr>
                ) : (
                  visitors.map((visitor) => (
                    <tr key={visitor.id} className="border-b border-aviva-gold/10 hover:bg-aviva-gold/5">
                      <td className="py-3 px-3">{visitor.visitor_name}</td>
                      <td className="py-3 px-3 text-aviva-secondary/80">{visitor.purpose || '—'}</td>
                      <td className="py-3 px-3">{visitor.host_employee_id}</td>
                      <td className="py-3 px-3">
                        {visitor.check_in_time ? new Date(visitor.check_in_time).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-3 px-3">
                        {visitor.check_out_time ? new Date(visitor.check_out_time).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {!visitor.check_out_time && (
                          <button
                            onClick={() => handleCheckOut(visitor.id)}
                            className="text-green-400 hover:text-green-300 text-xs font-semibold"
                          >
                            Check Out
                          </button>
                        )}
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
