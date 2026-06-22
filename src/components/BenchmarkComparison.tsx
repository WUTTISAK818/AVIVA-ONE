"use client";

import { TrendingUp, Award } from "lucide-react";
import GlassCard from "./GlassCard";

interface BenchmarkData {
  activityCount: number;
  teamAverage: number;
  percentDifference: number;
  ranking: number;
  totalTeamMembers: number;
  byType: Record<string, number>;
}

interface BenchmarkComparisonProps {
  employeeName: string;
  benchmark?: BenchmarkData;
  loading?: boolean;
}

export default function BenchmarkComparison({
  employeeName,
  benchmark,
  loading,
}: BenchmarkComparisonProps) {
  if (!benchmark || loading) {
    return (
      <GlassCard>
        <div className="p-6 text-center text-aviva-secondary">
          Loading benchmark data...
        </div>
      </GlassCard>
    );
  }

  const isAboveAverage = benchmark.percentDifference > 0;

  return (
    <GlassCard>
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-bold text-aviva-text mb-1">
            {employeeName}
          </h3>
          <div className="flex items-center justify-center gap-2">
            <Award size={20} className="text-yellow-500" />
            <p className="text-sm text-aviva-secondary">
              Rank #{benchmark.ranking} of {benchmark.totalTeamMembers}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-aviva-bg/30 p-4 rounded-lg">
            <p className="text-xs text-aviva-secondary mb-1">Your Count</p>
            <p className="text-2xl font-bold text-aviva-gold">
              {benchmark.activityCount}
            </p>
          </div>

          <div className="bg-aviva-bg/30 p-4 rounded-lg">
            <p className="text-xs text-aviva-secondary mb-1">Team Average</p>
            <p className="text-2xl font-bold text-aviva-text">
              {benchmark.teamAverage}
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp
              size={16}
              className={isAboveAverage ? "text-green-500" : "text-red-500"}
            />
            <p className="text-sm font-semibold text-aviva-text">
              {isAboveAverage ? "Above" : "Below"} Average
            </p>
            <span
              className={`text-sm font-bold ${
                isAboveAverage ? "text-green-500" : "text-red-500"
              }`}
            >
              {isAboveAverage ? "+" : ""}
              {benchmark.percentDifference}%
            </span>
          </div>

          <div className="w-full bg-aviva-bg/50 rounded-full h-3">
            <div
              className={`h-3 rounded-full ${
                isAboveAverage ? "bg-green-500" : "bg-red-500"
              }`}
              style={{
                width: `${Math.min(
                  (benchmark.activityCount / benchmark.teamAverage) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-aviva-text mb-3">
            By Activity Type
          </p>
          <div className="space-y-2">
            {Object.entries(benchmark.byType).map(([type, count]) => (
              <div key={type} className="flex justify-between text-xs">
                <span className="text-aviva-secondary capitalize">{type}</span>
                <span className="text-aviva-text font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
