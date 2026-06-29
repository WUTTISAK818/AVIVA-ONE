'use client';

import { useEffect, useState } from 'react';
import { Phone, Users, MessageSquare, Calendar, AlertCircle } from 'lucide-react';
import GlassCard from '@/components/GlassCard';

interface SalesSummary {
  total_customer_contacts: number;
  customer_visits: number;
  customer_calls: number;
  customer_chats: number;
  meetings: number;
  sales_staff_count: number;
}

export default function SalesDailyWidget() {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSalesSummary = async () => {
      try {
        const response = await fetch('/api/dashboard/sales-daily-summary');
        const data = await response.json();
        if (data.success) {
          setSummary(data.summary);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchSalesSummary();
  }, []);

  if (loading) {
    return (
      <GlassCard>
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </GlassCard>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <GlassCard className="border border-blue-500/20 bg-blue-500/5">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-lg text-blue-300">ติดต่อลูกค้า - สรุปประจำวัน</h3>
          <span className="ml-auto bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs font-medium">
            {summary.total_customer_contacts} ติดต่อ
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'เยี่ยมชม', value: summary.customer_visits, icon: Users, color: 'text-green-400' },
            { label: 'โทรศัพท์', value: summary.customer_calls, icon: Phone, color: 'text-blue-400' },
            { label: 'แชท/ข้อความ', value: summary.customer_chats, icon: MessageSquare, color: 'text-purple-400' },
            { label: 'ประชุม', value: summary.meetings, icon: Calendar, color: 'text-orange-400' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="p-3 bg-aviva-card/50 rounded border border-aviva-gold/10">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${item.color}`} />
                  <p className="text-xs text-aviva-secondary/60">{item.label}</p>
                </div>
                <p className="text-xl font-bold text-aviva-gold">{item.value}</p>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-aviva-secondary/60 text-center border-t border-aviva-gold/10 pt-2">
          📊 สรุปที่ 19:00 น. ทุกวัน • ทีม {summary.sales_staff_count} คน
        </div>
      </div>
    </GlassCard>
  );
}
