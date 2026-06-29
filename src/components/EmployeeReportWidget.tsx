'use client';

import { useEffect, useState } from 'react';
import { FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import GlassCard from '@/components/GlassCard';

interface ReportSchedule {
  id: string;
  report_name: string;
  report_type: string;
  due_time: string;
  submissions_today: {
    total: number;
    submitted: number;
    pending: number;
    approved: number;
    details: any[];
  };
}

export default function EmployeeReportWidget() {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const response = await fetch('/api/dashboard/employee-report-schedule');
        const data = await response.json();
        if (data.success) {
          setSchedules(data.schedules || []);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, []);

  if (loading) {
    return (
      <GlassCard>
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="border border-purple-500/20 bg-purple-500/5">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-lg text-purple-300">กำหนดการส่งรายงาน</h3>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {schedules.length === 0 ? (
          <p className="text-center text-aviva-secondary/60 py-4">ไม่มีกำหนดการส่งรายงาน</p>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => {
              const completionRate = schedule.submissions_today.total > 0
                ? Math.round(
                    ((schedule.submissions_today.submitted + schedule.submissions_today.approved) /
                      schedule.submissions_today.total) *
                      100
                  )
                : 0;

              return (
                <div
                  key={schedule.id}
                  className="p-3 bg-aviva-card/50 rounded border border-aviva-gold/10 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-aviva-gold">{schedule.report_name}</p>
                      <p className="text-xs text-aviva-secondary/60">กำหนด {schedule.due_time} น.</p>
                    </div>
                    <div className="text-right">
                      {schedule.submissions_today.pending > 0 && (
                        <div className="flex items-center gap-1 text-yellow-400 text-xs font-semibold">
                          <Clock className="w-3 h-3" />
                          {schedule.submissions_today.pending} รอส่ง
                        </div>
                      )}
                      {schedule.submissions_today.pending === 0 &&
                        schedule.submissions_today.submitted > 0 && (
                          <div className="flex items-center gap-1 text-green-400 text-xs font-semibold">
                            <CheckCircle className="w-3 h-3" />
                            เสร็จ {completionRate}%
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-aviva-card/50 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        completionRate === 100
                          ? 'bg-green-500'
                          : completionRate >= 50
                          ? 'bg-blue-500'
                          : 'bg-yellow-500'
                      }`}
                      style={{ width: `${completionRate}%` }}
                    ></div>
                  </div>

                  {/* Status details */}
                  <div className="flex justify-between text-xs text-aviva-secondary/60">
                    <span>ส่งแล้ว: {schedule.submissions_today.submitted}</span>
                    <span>อนุมัติ: {schedule.submissions_today.approved}</span>
                    <span>รวม: {schedule.submissions_today.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
