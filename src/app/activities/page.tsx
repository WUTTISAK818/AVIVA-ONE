"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, TrendingUp, HardHat, BookOpen, DollarSign, Megaphone, Users, FileText, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { Activity, DepartmentType } from "@/lib/types/activities";

interface DeptConfig {
  id: DepartmentType;
  name: string;
  icon: any;
  color: string;
  bg: string;
}

const departments: DeptConfig[] = [
  { id: "sales", name: "ฝ่ายขาย", icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  { id: "construction", name: "ฝ่ายก่อสร้าง", icon: HardHat, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  { id: "accounting", name: "ฝ่ายบัญชี", icon: BookOpen, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  { id: "finance", name: "ฝ่ายการเงิน", icon: DollarSign, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
  { id: "marketing", name: "ฝ่ายการตลาด", icon: Megaphone, color: "text-pink-400", bg: "bg-pink-400/10 border-pink-400/20" },
  { id: "hr", name: "ฝ่าย HR", icon: Users, color: "text-cyan-400", bg: "bg-cyan-400/10 border-cyan-400/20" },
  { id: "office", name: "สำนักเลขานุการ", icon: FileText, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
  { id: "approvals", name: "อนุมัติ", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
];

export default function ActivitiesPage() {
  const [selectedDept, setSelectedDept] = useState<DepartmentType>("sales");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Record<DepartmentType, number>>({
    sales: 0,
    construction: 0,
    accounting: 0,
    finance: 0,
    marketing: 0,
    hr: 0,
    office: 0,
    approvals: 0,
  });

  useEffect(() => {
    fetchActivities();
  }, [selectedDept]);

  async function fetchActivities() {
    setLoading(true);
    try {
      const res = await fetch(`/api/activities/${selectedDept}`);
      const data = await res.json();
      setActivities(data.data || []);
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch("/api/activities");
      const data = await res.json();
      const activities = data.data || [];
      const counts: Record<DepartmentType, number> = {
        sales: 0,
        construction: 0,
        accounting: 0,
        finance: 0,
        marketing: 0,
        hr: 0,
        office: 0,
        approvals: 0,
      };

      activities.forEach((act: Activity) => {
        counts[act.department]++;
      });

      setStats(counts);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  const selectedDeptConfig = departments.find((d) => d.id === selectedDept);
  const Icon = selectedDeptConfig?.icon || TrendingUp;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10">
            <ChevronLeft size={18} className="text-aviva-secondary" />
          </Link>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-aviva-gold" />
            <h1 className="text-lg font-bold text-aviva-text">กิจกรรมประจำวัน</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Department Tabs */}
        <div>
          <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-3">เลือกแผนก</p>
          <div className="grid grid-cols-2 gap-2">
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => setSelectedDept(dept.id)}
                className={`p-3 rounded-xl border transition-all ${
                  selectedDept === dept.id
                    ? `${dept.bg} ring-2 ring-offset-2 ring-offset-aviva-bg ring-${dept.color}`
                    : "bg-aviva-card border-aviva-gold/10 hover:border-aviva-gold/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <dept.icon size={14} className={dept.color} />
                  <span className="text-xs font-semibold text-aviva-text">{dept.name}</span>
                  <span className={`text-xs font-bold ${dept.color}`}>({stats[dept.id]})</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Current Department Info */}
        {selectedDeptConfig && (
          <GlassCard className={`p-4 border ${selectedDeptConfig.bg}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${selectedDeptConfig.bg}`}>
                <Icon size={16} className={selectedDeptConfig.color} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${selectedDeptConfig.color}`}>{selectedDeptConfig.name}</p>
                <p className="text-xs text-aviva-secondary mt-1">
                  {activities.length > 0
                    ? `${activities.length} กิจกรรมในวันนี้`
                    : "ไม่มีกิจกรรมในวันนี้"}
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Activities List */}
        <div>
          <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-3">กิจกรรมประจำวัน</p>
          {loading ? (
            <GlassCard className="p-4 text-center">
              <p className="text-xs text-aviva-secondary">กำลังโหลด...</p>
            </GlassCard>
          ) : activities.length === 0 ? (
            <GlassCard className="p-4 text-center">
              <p className="text-xs text-aviva-secondary">ไม่มีกิจกรรมสำหรับแผนกนี้ในวันนี้</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <GlassCard key={activity.id} className="p-3 border border-aviva-gold/10 hover:border-aviva-gold/30 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="text-lg flex-shrink-0">{activity.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-aviva-text truncate">{activity.title}</p>
                      <p className="text-xs text-aviva-secondary truncate">{activity.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-semibold ${activity.color}`}>{activity.type.toUpperCase()}</span>
                        <span className="text-[10px] text-aviva-secondary/50">{activity.date}</span>
                        {activity.status && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            activity.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            activity.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                            activity.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {activity.status === 'pending' ? 'รอดำเนิน' :
                             activity.status === 'approved' ? 'อนุมัติแล้ว' :
                             activity.status === 'completed' ? 'เสร็จสิ้น' :
                             'ปฏิเสธ'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
