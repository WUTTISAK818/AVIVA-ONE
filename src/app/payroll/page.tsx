'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Calendar, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import SectionHeader from '@/components/SectionHeader';
import GlassCard from '@/components/GlassCard';
import type { PayrollSummary, PayrollRecord } from '@/lib/types/attendance';

interface PayrollStat {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

export default function PayrollPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PayrollStat[]>([
    { label: 'Total Gross Salary', value: '฿0', icon: <DollarSign className="w-6 h-6" />, color: 'text-green-500' },
    { label: 'Total Deductions', value: '฿0', icon: <TrendingUp className="w-6 h-6" />, color: 'text-red-500' },
    { label: 'Total Net Salary', value: '฿0', icon: <DollarSign className="w-6 h-6" />, color: 'text-blue-500' },
    { label: 'Paid Records', value: '0', icon: <CheckCircle className="w-6 h-6" />, color: 'text-yellow-500' },
  ]);

  useEffect(() => {
    fetchPayroll();
  }, [selectedMonth, selectedYear]);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/payroll/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      const data = await response.json();

      if (data.success) {
        setPayrollRecords(data.details || []);
        updateStats(data.data || {}, data.details || []);
      }
    } catch (err) {
      console.error('Failed to fetch payroll:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (summary: any, records: any[]) => {
    const paidCount = records.filter(r => r.status === 'paid').length;
    const totalGross = records.reduce((sum, r) => sum + (r.gross_salary || 0), 0);
    const totalDeductions = records.reduce((sum, r) => sum + (r.total_deductions || 0), 0);
    const totalNet = records.reduce((sum, r) => sum + (r.net_salary || 0), 0);

    setStats([
      { label: 'Total Gross Salary', value: `฿${totalGross.toLocaleString('th-TH')}`, icon: <DollarSign className="w-6 h-6" />, color: 'text-green-500' },
      { label: 'Total Deductions', value: `฿${totalDeductions.toLocaleString('th-TH')}`, icon: <TrendingUp className="w-6 h-6" />, color: 'text-red-500' },
      { label: 'Total Net Salary', value: `฿${totalNet.toLocaleString('th-TH')}`, icon: <DollarSign className="w-6 h-6" />, color: 'text-blue-500' },
      { label: 'Paid Records', value: paidCount.toString(), icon: <CheckCircle className="w-6 h-6" />, color: 'text-yellow-500' },
    ]);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500/20 text-gray-400';
      case 'pending_approval':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'approved':
        return 'bg-blue-500/20 text-blue-400';
      case 'paid':
        return 'bg-green-500/20 text-green-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const handleApprovePayroll = async (payrollId: string) => {
    try {
      const response = await fetch(`/api/payroll/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payroll_id: payrollId }),
      });
      const data = await response.json();
      if (data.success) {
        fetchPayroll();
      }
    } catch (err) {
      console.error('Failed to approve payroll:', err);
    }
  };

  const handleMarkAsPaid = async (payrollId: string) => {
    try {
      const response = await fetch(`/api/payroll/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payroll_id: payrollId, payment_reference: 'MANUAL_ENTRY' }),
      });
      const data = await response.json();
      if (data.success) {
        fetchPayroll();
      }
    } catch (err) {
      console.error('Failed to mark as paid:', err);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Payroll Management" subtitle="Calculate and manage employee salaries and deductions" />

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

      {/* Month/Year Selector & Payroll Records */}
      <GlassCard>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-aviva-gold" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleDateString('th-TH', { month: 'long' })}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white w-24"
            />
          </div>

          {/* Payroll Records Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-aviva-gold/20">
                  <th className="text-left py-2 px-3">Employee</th>
                  <th className="text-right py-2 px-3">Gross Salary</th>
                  <th className="text-right py-2 px-3">Deductions</th>
                  <th className="text-right py-2 px-3">Net Salary</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-center py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-aviva-secondary/60">
                      Loading...
                    </td>
                  </tr>
                ) : payrollRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-aviva-secondary/60">
                      No payroll records for this period
                    </td>
                  </tr>
                ) : (
                  payrollRecords.map((record) => (
                    <tr key={record.id} className="border-b border-aviva-gold/10 hover:bg-aviva-gold/5">
                      <td className="py-3 px-3">{(record as any).employee_name || 'Unknown'}</td>
                      <td className="py-3 px-3 text-right">฿{(record.gross_salary || 0).toLocaleString('th-TH')}</td>
                      <td className="py-3 px-3 text-right">฿{(record.total_deductions || 0).toLocaleString('th-TH')}</td>
                      <td className="py-3 px-3 text-right font-semibold">฿{(record.net_salary || 0).toLocaleString('th-TH')}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(record.status)}`}>
                          {record.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {record.status === 'draft' && (
                          <button
                            onClick={() => handleApprovePayroll(record.id)}
                            className="text-blue-400 hover:text-blue-300 text-xs font-semibold"
                          >
                            Approve
                          </button>
                        )}
                        {record.status === 'approved' && (
                          <button
                            onClick={() => handleMarkAsPaid(record.id)}
                            className="text-green-400 hover:text-green-300 text-xs font-semibold"
                          >
                            Mark Paid
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
