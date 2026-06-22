"use client";

import { AlertCircle, AlertTriangle, Bell, X } from "lucide-react";
import GlassCard from "./GlassCard";

interface Alert {
  id: string;
  alert_type: string;
  severity: "high" | "medium" | "low";
  message: string;
  is_read: boolean;
  created_at: string;
}

interface SmartAlertsWidgetProps {
  alerts: Alert[];
  onDismiss: (id: string) => Promise<void>;
  loading?: boolean;
}

export default function SmartAlertsWidget({
  alerts,
  onDismiss,
  loading,
}: SmartAlertsWidgetProps) {
  const severityConfig: Record<string, { icon: any; color: string; bg: string }> = {
    high: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
    medium: { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-500/10" },
    low: { icon: Bell, color: "text-blue-500", bg: "bg-blue-500/10" },
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-aviva-text flex items-center gap-2">
        <AlertCircle size={20} className="text-aviva-gold" />
        Smart Alerts ({alerts.length})
      </h3>

      {loading ? (
        <p className="text-sm text-aviva-secondary text-center py-4">
          Loading alerts...
        </p>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-aviva-secondary/50 text-center py-4">
          No alerts at this time
        </p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {alerts.map((alert) => {
            const config = severityConfig[alert.severity];
            const IconComponent = config.icon;

            return (
              <GlassCard key={alert.id} className={`${config.bg} border-l-2 ${
                alert.severity === "high"
                  ? "border-l-red-500"
                  : alert.severity === "medium"
                    ? "border-l-orange-500"
                    : "border-l-blue-500"
              }`}>
                <div className="p-3 flex items-start gap-3">
                  <IconComponent size={18} className={config.color} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-aviva-text mb-1">
                      {alert.alert_type}
                    </p>
                    <p className="text-xs text-aviva-text/80">
                      {alert.message}
                    </p>
                    <p className="text-xs text-aviva-secondary mt-1">
                      {new Date(alert.created_at).toLocaleTimeString("th-TH")}
                    </p>
                  </div>
                  <button
                    onClick={() => onDismiss(alert.id)}
                    className="text-aviva-secondary hover:text-aviva-text transition flex-shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
