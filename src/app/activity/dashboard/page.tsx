"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "@/lib/user-context";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ActivityDashboard from "@/components/ActivityDashboard";
import SmartAlertsWidget from "@/components/SmartAlertsWidget";
import MilestoneTracker from "@/components/MilestoneTracker";
import { calculateKPIs } from "@/lib/activity-helpers";

export default function ActivityDashboardPage() {
  const user = useCurrentUser();
  const [trends, setTrends] = useState<any[]>([]);
  const [workload, setWorkload] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    loadDashboardData();
  }, [days]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [trendsRes, workloadRes, alertsRes, goalsRes] = await Promise.all([
        fetch(`/api/activity/trends?days=${days}`),
        fetch(`/api/activity/workload?days=${days}`),
        fetch(`/api/activity/alerts?is_read=false`),
        fetch(`/api/activity/goals`),
      ]);

      const trendsData = await trendsRes.json();
      const workloadData = await workloadRes.json();
      const alertsData = await alertsRes.json();
      const goalsData = await goalsRes.json();

      if (trendsData.success) setTrends(trendsData.data || []);
      if (workloadData.success) setWorkload(workloadData.data || []);
      if (alertsData.success) setAlerts(alertsData.data || []);
      if (goalsData.success) setGoals(goalsData.data || []);

      // Calculate KPIs
      const calculatedKpis = calculateKPIs(trendsData.data || [], workloadData.data || []);
      setKpis(calculatedKpis);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      await fetch(`/api/activity/alerts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_id: alertId, dismissed: true }),
      });

      setAlerts(alerts.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error("Failed to dismiss alert:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-aviva-dark to-aviva-bg p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          title="📊 Activity Dashboard"
          subtitle="Real-time analytics and performance metrics"
        />

        {/* Time Period Selector */}
        <div className="flex gap-2 mb-6">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg transition ${
                days === d
                  ? "bg-aviva-gold text-aviva-bg"
                  : "bg-aviva-bg/50 text-aviva-text hover:bg-aviva-bg/70"
              }`}
            >
              {d} days
            </button>
          ))}
        </div>

        {/* Main Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActivityDashboard
              kpis={kpis}
              workload={workload}
              alerts={alerts}
              goals={goals}
              loading={loading}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Alerts */}
            <SmartAlertsWidget
              alerts={alerts}
              onDismiss={handleDismissAlert}
              loading={loading}
            />
          </div>
        </div>

        {/* Goals Section */}
        <div className="mt-6">
          <MilestoneTracker goals={goals} loading={loading} />
        </div>
      </div>
    </div>
  );
}
