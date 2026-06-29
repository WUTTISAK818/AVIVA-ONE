'use client';

import { useState, useEffect } from 'react';
import { Clock, Users, AlertCircle, CheckCircle } from 'lucide-react';
import SectionHeader from '@/components/SectionHeader';
import GlassCard from '@/components/GlassCard';
import type { EmployeeShift } from '@/lib/types/attendance';

interface EmployeeWithShift {
  id: string;
  first_name: string;
  last_name: string;
  shift?: EmployeeShift;
}

export default function ShiftsSettingPage() {
  const [employees, setEmployees] = useState<EmployeeWithShift[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    start_time: '09:00',
    end_time: '17:00',
    shift_name: 'Standard',
    grace_period_minutes: 15,
    break_duration_minutes: 60,
    working_days: 'Mon,Tue,Wed,Thu,Fri',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch shifts
      const shiftsRes = await fetch('/api/shifts');
      const shiftsData = await shiftsRes.json();
      if (shiftsData.success) {
        setShifts(shiftsData.data || []);
      }

      // Fetch employees (placeholder - would need actual endpoint)
      // For now, we'll show shifts
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveShift = async (employeeId: string) => {
    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          ...formData,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setEditingId(null);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to save shift:', err);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Employee Shifts Management"
        subtitle="Set work start/end times for each employee - used for automatic late detection"
      />

      {/* Info Box */}
      <GlassCard className="border border-blue-500/20 bg-blue-500/5">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
          <div className="text-sm text-aviva-secondary/80">
            <p className="font-semibold text-blue-300 mb-1">How It Works</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Set the expected work start time for each employee</li>
              <li>Late arrivals are automatically detected from Hikvision check-ins</li>
              <li>Grace period allows N minutes buffer before flagging as late</li>
              <li>Late records are tracked for payroll deductions</li>
            </ul>
          </div>
        </div>
      </GlassCard>

      {/* Shifts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shifts.map((shift) => {
          const isEditing = editingId === shift.id;
          return (
            <GlassCard key={shift.id}>
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-aviva-secondary/60 mb-1">Employee</p>
                    <p className="font-semibold">{shift.shift_name}</p>
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => {
                        setEditingId(shift.id);
                        setFormData({
                          start_time: shift.start_time.substring(0, 5),
                          end_time: shift.end_time.substring(0, 5),
                          shift_name: shift.shift_name,
                          grace_period_minutes: shift.grace_period_minutes,
                          break_duration_minutes: shift.break_duration_minutes,
                          working_days: shift.working_days,
                          notes: shift.notes || '',
                        });
                      }}
                      className="px-2 py-1 text-xs bg-aviva-gold/20 text-aviva-gold rounded hover:bg-aviva-gold/30 transition"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {/* Display Mode */}
                {!isEditing && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-aviva-gold" />
                      <div>
                        <p className="text-xs text-aviva-secondary/60">Work Hours</p>
                        <p className="text-sm font-medium">{shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-aviva-gold/10">
                      <p className="text-xs text-aviva-secondary/60 mb-1">Grace Period</p>
                      <p className="text-sm">{shift.grace_period_minutes} minutes</p>
                    </div>

                    <div className="pt-2 border-t border-aviva-gold/10">
                      <p className="text-xs text-aviva-secondary/60 mb-1">Working Days</p>
                      <p className="text-xs text-aviva-secondary/80">{shift.working_days}</p>
                    </div>
                  </div>
                )}

                {/* Edit Mode */}
                {isEditing && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-aviva-secondary/60 block mb-1">Shift Name</label>
                      <input
                        type="text"
                        value={formData.shift_name}
                        onChange={(e) => setFormData({ ...formData, shift_name: e.target.value })}
                        className="w-full px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded text-sm text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-aviva-secondary/60 block mb-1">Start Time</label>
                        <input
                          type="time"
                          value={formData.start_time}
                          onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                          className="w-full px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-aviva-secondary/60 block mb-1">End Time</label>
                        <input
                          type="time"
                          value={formData.end_time}
                          onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                          className="w-full px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded text-sm text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-aviva-secondary/60 block mb-1">Grace Period (minutes)</label>
                      <input
                        type="number"
                        value={formData.grace_period_minutes}
                        onChange={(e) => setFormData({ ...formData, grace_period_minutes: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-aviva-secondary/60 block mb-1">Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded text-sm text-white"
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveShift(shift.employee_id)}
                        className="flex-1 px-3 py-2 bg-green-600/30 text-green-400 rounded text-sm font-medium hover:bg-green-600/40 transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 px-3 py-2 bg-aviva-gold/10 text-aviva-gold rounded text-sm hover:bg-aviva-gold/20 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>

      {shifts.length === 0 && !loading && (
        <GlassCard className="text-center py-12">
          <Users className="w-12 h-12 text-aviva-secondary/30 mx-auto mb-3" />
          <p className="text-aviva-secondary/60">No employee shifts configured yet</p>
        </GlassCard>
      )}
    </div>
  );
}
