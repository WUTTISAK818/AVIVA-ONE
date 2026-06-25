"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Download, Calendar, TrendingUp } from "lucide-react";

interface AnalyticsData {
  totalActivities: number;
  totalApproved: number;
  totalRejected: number;
  totalPending: number;
  approvalRate: number;
  activitiesByDepartment: Record<
    string,
    { count: number; approved: number; pending: number; rejected: number }
  >;
  activitiesByWeek: Array<{ week: string; count: number; approved: number }>;
  approverStats: Record<
    string,
    {
      name: string;
      approved: number;
      rejected: number;
      pending: number;
      approvalRate: number;
    }
  >;
  constructionReports: {
    total: number;
    byStatus: Record<string, number>;
  };
}

interface AnalyticsPeriod {
  start: string;
  end: string;
  type: "week" | "month" | "year";
}

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"];

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeType, setRangeType] = useState<"week" | "month" | "year">(
    "month"
  );

  useEffect(() => {
    fetchAnalytics();
  }, [rangeType]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/dashboard?range=${rangeType}`
      );
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.data);
        setPeriod(data.period);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!analytics) return;

    const csv =
      [
        ["Analytics Report", new Date().toLocaleString("th-TH")],
        [],
        ["Summary Statistics"],
        ["Total Activities", analytics.totalActivities],
        ["Approved", analytics.totalApproved],
        ["Rejected", analytics.totalRejected],
        ["Pending", analytics.totalPending],
        ["Approval Rate (%)", analytics.approvalRate],
        [],
        ["Activities by Department"],
        ["Department", "Total", "Approved", "Pending", "Rejected"],
        ...Object.entries(analytics.activitiesByDepartment).map(
          ([dept, data]) => [
            dept,
            data.count,
            data.approved,
            data.pending,
            data.rejected,
          ]
        ),
        [],
        ["Approver Statistics"],
        ["Approver Name", "Approved", "Rejected", "Approval Rate (%)"],
        ...Object.entries(analytics.approverStats).map(([_, stats]) => [
          stats.name,
          stats.approved,
          stats.rejected,
          stats.approvalRate,
        ]),
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-aviva-secondary">กำลังโหลด...</div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6 text-center text-aviva-secondary">
        ไม่สามารถโหลดข้อมูลได้
      </div>
    );
  }

  const departmentChartData = Object.entries(
    analytics.activitiesByDepartment
  ).map(([dept, data]) => ({
    name: dept,
    total: data.count,
    approved: data.approved,
    rejected: data.rejected,
  }));

  const approverChartData = Object.values(analytics.approverStats)
    .sort((a, b) => b.approved - a.approved)
    .slice(0, 10)
    .map((approver) => ({
      name: approver.name,
      approved: approver.approved,
      rejected: approver.rejected,
      rate: approver.approvalRate,
    }));

  const statusData = [
    { name: "Approved", value: analytics.totalApproved, color: COLORS[0] },
    { name: "Rejected", value: analytics.totalRejected, color: COLORS[1] },
    { name: "Pending", value: analytics.totalPending, color: COLORS[2] },
  ];

  const constructionStatusData = Object.entries(
    analytics.constructionReports.byStatus
  ).map(([status, count]) => ({
    name: status,
    value: count,
  }));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-aviva-text">
            📊 Analytics Dashboard
          </h1>
          <p className="text-sm text-aviva-secondary/70 mt-1">
            {period?.start} ถึง {period?.end}
          </p>
        </div>
        <div className="flex gap-2">
          {(["week", "month", "year"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setRangeType(type)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                rangeType === type
                  ? "bg-aviva-gold text-aviva-bg"
                  : "bg-aviva-card text-aviva-secondary hover:bg-aviva-card/80"
              }`}
            >
              {type === "week" && "7 วัน"}
              {type === "month" && "1 เดือน"}
              {type === "year" && "1 ปี"}
            </button>
          ))}
          <button
            onClick={handleExport}
            className="px-3 py-2 rounded-lg bg-aviva-gold/20 text-aviva-gold hover:bg-aviva-gold/30 font-semibold text-xs flex items-center gap-1"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          {
            label: "Total Activities",
            value: analytics.totalActivities,
            icon: "📋",
            color: "bg-blue-500/10 border-blue-500/30",
          },
          {
            label: "Approved",
            value: analytics.totalApproved,
            icon: "✅",
            color: "bg-green-500/10 border-green-500/30",
          },
          {
            label: "Rejected",
            value: analytics.totalRejected,
            icon: "❌",
            color: "bg-red-500/10 border-red-500/30",
          },
          {
            label: "Pending",
            value: analytics.totalPending,
            icon: "⏳",
            color: "bg-yellow-500/10 border-yellow-500/30",
          },
          {
            label: "Approval Rate",
            value: `${analytics.approvalRate}%`,
            icon: "📈",
            color: "bg-purple-500/10 border-purple-500/30",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`p-4 rounded-lg border ${card.color} space-y-2`}
          >
            <div className="text-2xl">{card.icon}</div>
            <div className="text-2xl font-bold text-aviva-text">
              {card.value}
            </div>
            <p className="text-xs text-aviva-secondary">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-aviva-card rounded-lg border border-aviva-gold/10 p-4">
          <h3 className="text-sm font-semibold text-aviva-text mb-4">
            Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Activities by Week */}
        <div className="bg-aviva-card rounded-lg border border-aviva-gold/10 p-4">
          <h3 className="text-sm font-semibold text-aviva-text mb-4">
            Activities Trend
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={analytics.activitiesByWeek.slice(
                Math.max(0, analytics.activitiesByWeek.length - 8)
              )}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="week" stroke="rgba(255,255,255,0.5)" />
              <YAxis stroke="rgba(255,255,255,0.5)" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#10b981"
                name="Total"
              />
              <Line
                type="monotone"
                dataKey="approved"
                stroke="#3b82f6"
                name="Approved"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Activities by Department */}
        <div className="bg-aviva-card rounded-lg border border-aviva-gold/10 p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-aviva-text mb-4">
            Activities by Department
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departmentChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
              <YAxis stroke="rgba(255,255,255,0.5)" />
              <Tooltip />
              <Legend />
              <Bar dataKey="approved" fill="#10b981" name="Approved" />
              <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Approver Performance */}
        {approverChartData.length > 0 && (
          <div className="bg-aviva-card rounded-lg border border-aviva-gold/10 p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-aviva-text mb-4">
              Approver Performance (Top 10)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={approverChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.1)"
                />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip />
                <Legend />
                <Bar dataKey="approved" fill="#10b981" name="Approved" />
                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Construction Reports by Status */}
        {constructionStatusData.length > 0 && (
          <div className="bg-aviva-card rounded-lg border border-aviva-gold/10 p-4">
            <h3 className="text-sm font-semibold text-aviva-text mb-4">
              Construction Reports by Status
            </h3>
            <div className="space-y-2">
              {constructionStatusData.map((item) => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-xs text-aviva-secondary">{item.name}</span>
                  <span className="font-semibold text-aviva-gold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Approver Statistics Table */}
      {Object.keys(analytics.approverStats).length > 0 && (
        <div className="bg-aviva-card rounded-lg border border-aviva-gold/10 p-4">
          <h3 className="text-sm font-semibold text-aviva-text mb-4">
            Detailed Approver Statistics
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-aviva-gold/10">
                  <th className="text-left py-2 px-3 text-aviva-secondary">
                    Approver
                  </th>
                  <th className="text-right py-2 px-3 text-aviva-secondary">
                    Approved
                  </th>
                  <th className="text-right py-2 px-3 text-aviva-secondary">
                    Rejected
                  </th>
                  <th className="text-right py-2 px-3 text-aviva-secondary">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.values(analytics.approverStats)
                  .sort((a, b) => b.approved - a.approved)
                  .map((approver) => (
                    <tr
                      key={approver.name}
                      className="border-b border-aviva-gold/10 hover:bg-aviva-bg/50"
                    >
                      <td className="py-2 px-3 text-aviva-text">
                        {approver.name}
                      </td>
                      <td className="py-2 px-3 text-right text-green-400">
                        {approver.approved}
                      </td>
                      <td className="py-2 px-3 text-right text-red-400">
                        {approver.rejected}
                      </td>
                      <td className="py-2 px-3 text-right text-aviva-gold font-semibold">
                        {approver.approvalRate}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
