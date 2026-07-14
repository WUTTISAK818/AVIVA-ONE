'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Calendar, CheckCircle, Calculator, TrendingUp } from 'lucide-react';
import SectionHeader from '@/components/SectionHeader';
import GlassCard from '@/components/GlassCard';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/user-context';

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const STATUS_LABEL: Record<string, string> = { draft: 'ร่าง', approved: 'อนุมัติแล้ว', paid: 'จ่ายแล้ว' };
const badgeClass = (s: string) => s === 'paid' ? 'bg-green-500/20 text-green-400' : s === 'approved' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400';
const fmt = (n: number) => `฿${Number(n || 0).toLocaleString('th-TH')}`;

export default function PayrollPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const authHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) };
  }, []);

  const fetchPayroll = useCallback(async (action?: 'calculate') => {
    if (action === 'calculate') setCalculating(true); else setLoading(true);
    try {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ month, year, ...(action ? { action } : {}) }),
      });
      const data = await res.json();
      if (data.success) setRecords(data.details || []);
    } catch (err) {
      console.error('payroll fetch failed:', err);
    } finally { setLoading(false); setCalculating(false); }
  }, [month, year, authHeaders]);

  useEffect(() => {
    if (!user) return;
    if (!user.isManager) { router.replace('/dashboard'); return; }
    fetchPayroll();
  }, [user, router, fetchPayroll]);

  const act = async (url: string, body: object) => {
    const res = await fetch(url, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) fetchPayroll(); else alert(data.error || 'ทำรายการไม่สำเร็จ');
  };

  const totalGross = records.reduce((s, r) => s + Number(r.gross_income || 0), 0);
  const totalDed = records.reduce((s, r) => s + Number(r.total_deductions || 0), 0);
  const totalNet = records.reduce((s, r) => s + Number(r.net_income || 0), 0);
  const paidCount = records.filter(r => r.status === 'paid').length;

  const stats = [
    { label: 'เงินเดือนรวม (ก่อนหัก)', value: fmt(totalGross), icon: <DollarSign className="w-6 h-6" />, color: 'text-green-500' },
    { label: 'รายการหักรวม', value: fmt(totalDed), icon: <TrendingUp className="w-6 h-6" />, color: 'text-red-500' },
    { label: 'จ่ายสุทธิรวม', value: fmt(totalNet), icon: <DollarSign className="w-6 h-6" />, color: 'text-blue-500' },
    { label: 'จ่ายแล้ว (งวด)', value: String(paidCount), icon: <CheckCircle className="w-6 h-6" />, color: 'text-yellow-500' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="เงินเดือน (Payroll)" subtitle="คำนวณและจัดการเงินเดือน หักประกันสังคม/มาสาย/ขาดงาน อัตโนมัติ" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <GlassCard key={i}>
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-aviva-secondary/60">{s.label}</p><p className="text-2xl font-bold mt-2">{s.value}</p></div>
              <div className={s.color}>{s.icon}</div>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Calendar className="w-5 h-5 text-aviva-gold" />
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}
              className="px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white">
              {THAI_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white w-24" />
            <button onClick={() => fetchPayroll('calculate')} disabled={calculating}
              className="ml-auto flex items-center gap-2 bg-aviva-gold text-aviva-bg font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              <Calculator className="w-4 h-4" /> {calculating ? 'กำลังคำนวณ…' : 'คำนวณเงินเดือนเดือนนี้'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-aviva-gold/20 text-aviva-secondary/70">
                  <th className="text-left py-2 px-3">พนักงาน</th>
                  <th className="text-right py-2 px-3">เงินเดือน</th>
                  <th className="text-right py-2 px-3">ประกันสังคม</th>
                  <th className="text-right py-2 px-3">หักสาย/ขาด</th>
                  <th className="text-right py-2 px-3">จ่ายสุทธิ</th>
                  <th className="text-left py-2 px-3">สถานะ</th>
                  <th className="text-center py-2 px-3">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-4 text-center text-aviva-secondary/60">กำลังโหลด…</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="py-4 text-center text-aviva-secondary/60">ยังไม่มีงวดเงินเดือนของเดือนนี้ — กด “คำนวณเงินเดือนเดือนนี้”</td></tr>
                ) : records.map((r) => (
                  <tr key={r.id} className="border-b border-aviva-gold/10 hover:bg-aviva-gold/5">
                    <td className="py-3 px-3">{r.employee_name || '—'}</td>
                    <td className="py-3 px-3 text-right">{fmt(r.base_salary)}</td>
                    <td className="py-3 px-3 text-right text-red-400">{fmt(r.sso_deduction)}</td>
                    <td className="py-3 px-3 text-right text-red-400">{fmt(Number(r.late_deduction || 0) + Number(r.absent_deduction || 0))}</td>
                    <td className="py-3 px-3 text-right font-semibold text-aviva-gold">{fmt(r.net_income)}</td>
                    <td className="py-3 px-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass(r.status)}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                    <td className="py-3 px-3 text-center">
                      {r.status === 'draft' && <button onClick={() => act('/api/payroll/approve', { payroll_id: r.id })} className="text-blue-400 text-xs font-semibold">อนุมัติ</button>}
                      {r.status === 'approved' && <button onClick={() => act('/api/payroll/mark-paid', { payroll_id: r.id, payment_reference: 'MANUAL' })} className="text-green-400 text-xs font-semibold">บันทึกจ่าย</button>}
                      {r.status === 'paid' && <span className="text-green-400/60 text-xs">✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
