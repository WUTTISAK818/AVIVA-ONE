"use client";

import { useState } from "react";

export default function ApplyMigrationsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApplyMigrations = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/apply-migrations-mobile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to apply migrations");
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-aviva-dark to-aviva-bg p-4 md:p-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-aviva-gold mb-2">
            🚀 Apply Migrations
          </h1>
          <p className="text-aviva-secondary text-sm">
            Install activity logging system
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-aviva-card border border-aviva-gold/20 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold text-aviva-text mb-4">
            Migrations to Apply
          </h2>

          <div className="space-y-3 mb-6">
            {[
              { name: "📋 Prerequisites", desc: "Schema & activity log tables" },
              { name: "🏗️ Construction", desc: "Progress & QC logging" },
              { name: "💰 Finance", desc: "Payment voucher logging" },
              { name: "👥 HR", desc: "Leave request logging" },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-start gap-3 p-3 bg-aviva-bg/50 rounded-lg border border-aviva-gold/10"
              >
                <div className="text-2xl pt-1">{item.name.split(" ")[0]}</div>
                <div>
                  <p className="font-semibold text-aviva-text text-sm">
                    {item.name}
                  </p>
                  <p className="text-xs text-aviva-secondary">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Result or Error Display */}
          {result && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 font-semibold mb-2">✅ Success!</p>
              <p className="text-sm text-aviva-text mb-2">
                {result.message}
              </p>
              <div className="text-xs text-aviva-secondary space-y-1">
                <p>📊 Statements: {result.successCount}</p>
                <p>⏰ {new Date(result.timestamp).toLocaleString("th-TH")}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 font-semibold mb-2">❌ Error</p>
              <p className="text-sm text-aviva-text">{error}</p>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleApplyMigrations}
            disabled={loading}
            className={`w-full py-3 rounded-lg font-bold transition-all ${
              loading
                ? "bg-aviva-gold/50 text-aviva-bg cursor-not-allowed"
                : "bg-aviva-gold text-aviva-bg hover:bg-yellow-500 active:scale-95"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block animate-spin">⏳</span>
                Processing...
              </span>
            ) : (
              <span>🚀 Apply Now</span>
            )}
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-aviva-card/50 border border-aviva-gold/10 rounded-lg p-4">
          <p className="text-xs text-aviva-secondary leading-relaxed">
            ✓ Click the button above to install all 3 activity logging systems
            <br />
            ✓ System will automatically create database functions & triggers
            <br />
            ✓ Takes ~10 seconds to complete
          </p>
        </div>
      </div>
    </div>
  );
}
