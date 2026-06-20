"use client";

import { useState, useEffect } from "react";
import { TrendingUp, AlertCircle, Users, Target } from "lucide-react";
import GlassCard from "./GlassCard";

interface DashboardProps {
  kpis?: any;
  workload?: any[];
  alerts?: any[];
  goals?: any[];
  loading?: boolean;
}

export default function ActivityDashboard({
  kpis,
  workload,
  alerts,
  goals,
  loading,
}: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-aviva-secondary">Total Activities</p>
              <TrendingUp size={18} className="text-aviva-gold" />
            </div>
            <p className="text-3xl font-bold text-aviva-text">
              {kpis?.totalActivities || 0}
            </p>
            <p className="text-xs text-aviva-secondary mt-1">
              Avg: {kpis?.avgPerDay || 0}/day
            </p>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-aviva-secondary">Max Workload</p>
              <Users size={18} className="text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-aviva-text">
              {kpis?.maxWorkload || 0}
            </p>
            <p className="text-xs text-aviva-secondary mt-1">
              {kpis?.topPerformer || "N/A"}
            </p>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-aviva-secondary">Active Alerts</p>
              <AlertCircle size={18} className="text-red-400" />
            </div>
            <p className="text-3xl font-bold text-aviva-text">
              {alerts?.length || 0}
            </p>
            <p className="text-xs text-aviva-secondary mt-1">
              Unread
            </p>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-aviva-secondary">Goals On Track</p>
              <Target size={18} className="text-green-400" />
            </div>
            <p className="text-3xl font-bold text-aviva-text">
              {goals?.filter((g: any) => g.achieved).length || 0}
            </p>
            <p className="text-xs text-aviva-secondary mt-1">
              of {goals?.length || 0}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Distribution Chart */}
      <GlassCard>
        <div className="p-6">
          <h3 className="text-lg font-bold text-aviva-text mb-4">Distribution</h3>
          <div className="space-y-3">
            {kpis?.distribution &&
              Object.entries(kpis.distribution).map(([type, count]: [string, any]) => {
                const total = kpis.totalActivities || 1;
                const percentage = Math.round((count / total) * 100);
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-aviva-text capitalize">{type}</span>
                      <span className="text-aviva-secondary">{count}</span>
                    </div>
                    <div className="w-full bg-aviva-bg/50 rounded-full h-2">
                      <div
                        className="bg-aviva-gold rounded-full h-2 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </GlassCard>

      {/* Top Performers */}
      {workload && workload.length > 0 && (
        <GlassCard>
          <div className="p-6">
            <h3 className="text-lg font-bold text-aviva-text mb-4">
              Top Performers (Last 7 days)
            </h3>
            <div className="space-y-2">
              {workload.slice(0, 5).map((person: any, idx: number) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between p-2 bg-aviva-bg/30 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-aviva-gold">#{idx + 1}</span>
                    <span className="text-aviva-text">{person.name}</span>
                  </div>
                  <span className="font-bold text-aviva-text">
                    {person.total} activities
                  </span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
