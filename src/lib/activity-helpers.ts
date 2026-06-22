export interface ActivityTrend {
  date: string;
  construction: number;
  finance: number;
  hr: number;
  sales: number;
  total: number;
}

export interface WorkloadItem {
  id: string;
  name: string;
  total: number;
  byType: Record<string, number>;
}

export interface Badge {
  type: string;
  icon: string;
  label: string;
  condition: string;
}

// ==================== Trends & Analytics ====================

export function getActivityTrends(data: ActivityTrend[]): {
  busiest: string;
  quietest: string;
  average: number;
} {
  if (!data || data.length === 0) {
    return { busiest: "", quietest: "", average: 0 };
  }

  const sorted = [...data].sort((a, b) => b.total - a.total);
  const average = data.reduce((sum, item) => sum + item.total, 0) / data.length;

  return {
    busiest: sorted[0].date,
    quietest: sorted[sorted.length - 1].date,
    average: Math.round(average),
  };
}

// ==================== Anomaly Detection ====================

export function detectAnomalies(
  data: ActivityTrend[],
  threshold: number = 2
): string[] {
  if (!data || data.length < 2) return [];

  const average = data.reduce((sum, item) => sum + item.total, 0) / data.length;
  const stdDev = Math.sqrt(
    data.reduce((sum, item) => sum + Math.pow(item.total - average, 2), 0) /
      data.length
  );

  return data
    .filter((item) => Math.abs(item.total - average) > threshold * stdDev)
    .map(
      (item) =>
        `${item.date}: ${item.total} activities (avg: ${Math.round(average)})`
    );
}

// ==================== KPI Calculation ====================

export function calculateKPIs(data: ActivityTrend[], workload: WorkloadItem[]) {
  const totalActivities = data.reduce((sum, item) => sum + item.total, 0);
  const avgPerDay = Math.round(totalActivities / data.length);
  const maxWorkload = workload[0]?.total || 0;

  return {
    totalActivities,
    avgPerDay,
    maxWorkload,
    topPerformer: workload[0]?.name || "N/A",
    distribution: {
      construction: data.reduce((sum, item) => sum + item.construction, 0),
      finance: data.reduce((sum, item) => sum + item.finance, 0),
      hr: data.reduce((sum, item) => sum + item.hr, 0),
      sales: data.reduce((sum, item) => sum + item.sales, 0),
    },
  };
}

// ==================== Badge System ====================

export const BADGE_DEFINITIONS: Badge[] = [
  {
    type: "gold",
    icon: "🥇",
    label: "Gold Member",
    condition: "50+ activities in a month",
  },
  {
    type: "silver",
    icon: "🥈",
    label: "Silver Member",
    condition: "30-49 activities in a month",
  },
  {
    type: "bronze",
    icon: "🥉",
    label: "Bronze Member",
    condition: "10-29 activities in a month",
  },
  {
    type: "onfire",
    icon: "🔥",
    label: "On Fire",
    condition: "5+ consecutive days of activity",
  },
  {
    type: "speedemon",
    icon: "⚡",
    label: "Speed Demon",
    condition: "10+ activities in a single day",
  },
  {
    type: "targetmaster",
    icon: "🎯",
    label: "Target Master",
    condition: "Achieved goal 3+ weeks in a row",
  },
];

export function getBadgeInfo(badgeType: string): Badge | undefined {
  return BADGE_DEFINITIONS.find((b) => b.type === badgeType);
}

// ==================== Performance Benchmarking ====================

export function calculateBenchmark(
  employeeWorkload: WorkloadItem,
  allWorkload: WorkloadItem[]
) {
  const avg =
    allWorkload.reduce((sum, item) => sum + item.total, 0) / allWorkload.length;
  const percentAboveAvg = Math.round(((employeeWorkload.total - avg) / avg) * 100);

  return {
    activityCount: employeeWorkload.total,
    teamAverage: Math.round(avg),
    percentDifference: percentAboveAvg,
    ranking: allWorkload.findIndex((w) => w.id === employeeWorkload.id) + 1,
    totalTeamMembers: allWorkload.length,
    byType: employeeWorkload.byType,
  };
}

// ==================== Daily Digest ====================

export function generateDigestHtml(summary: any): string {
  const { construction, finance, hr, sales, total, byDepartment } =
    summary.summary;

  const rows = Object.entries(byDepartment)
    .map(
      ([dept, count]) =>
        `<tr><td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${dept}</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e0e0e0;"><strong>${count}</strong></td></tr>`
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">📊 Daily Activity Digest</h2>

      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Period:</strong> ${summary.period}</p>
        <p><strong>Generated:</strong> ${new Date(summary.generatedAt).toLocaleString("th-TH")}</p>
      </div>

      <h3 style="color: #555;">Activity Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold;">🟢 HR</td>
          <td style="padding: 8px; text-align: right;"><strong>${hr}</strong></td>
        </tr>
        <tr style="background: #fff;">
          <td style="padding: 8px; font-weight: bold;">🔴 Construction</td>
          <td style="padding: 8px; text-align: right;"><strong>${construction}</strong></td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold;">🟠 Finance</td>
          <td style="padding: 8px; text-align: right;"><strong>${finance}</strong></td>
        </tr>
        <tr style="background: #fff;">
          <td style="padding: 8px; font-weight: bold;">💰 Sales</td>
          <td style="padding: 8px; text-align: right;"><strong>${sales}</strong></td>
        </tr>
        <tr style="background: #e8f5e9;">
          <td style="padding: 8px; font-weight: bold;">📈 TOTAL</td>
          <td style="padding: 8px; text-align: right;"><strong>${total}</strong></td>
        </tr>
      </table>

      <h3 style="color: #555; margin-top: 20px;">By Department</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f9f9f9;">
          <td style="padding: 8px; font-weight: bold;">Department</td>
          <td style="padding: 8px; text-align: right; font-weight: bold;">Count</td>
        </tr>
        ${rows}
      </table>

      ${
        summary.topPerformer
          ? `<div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-top: 20px;">
              <p><strong>🌟 Top Performer:</strong> ${summary.topPerformer.id} (${summary.topPerformer.count} activities)</p>
            </div>`
          : ""
      }

      <p style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
        This is an automated digest from AVIVA ONE Activity Tracking System
      </p>
    </div>
  `;
}

// ==================== Date Utilities ====================

export function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getDay()];
}

export function formatThaiDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const days: Date[] = [];

  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month - 1, i));
  }

  return days;
}
