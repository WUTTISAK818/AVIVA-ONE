"use client";
import { useState } from "react";
import clsx from "clsx";

export type Period = "today" | "week" | "month" | "custom";

interface PeriodFilterProps {
  period: Period;
  onChange: (period: Period, start: string, end: string) => void;
}

function getRange(period: Period): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  if (period === "today") return { start: end, end };
  if (period === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { start: start.toISOString().split("T")[0], end };
  }
  if (period === "month") {
    return {
      start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
      end,
    };
  }
  return { start: "", end: "" };
}

const OPTIONS: { key: Period; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "week", label: "สัปดาห์นี้" },
  { key: "month", label: "เดือนนี้" },
  { key: "custom", label: "กำหนดเอง" },
];

export default function PeriodFilter({ period, onChange }: PeriodFilterProps) {
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const handleSelect = (p: Period) => {
    const range = getRange(p);
    onChange(p, range.start, range.end);
  };

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleSelect(key)}
            className={clsx(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              period === key
                ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => {
              setCustomStart(e.target.value);
              onChange("custom", e.target.value, customEnd);
            }}
            className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-1.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/50"
          />
          <span className="text-xs text-aviva-secondary">ถึง</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              onChange("custom", customStart, e.target.value);
            }}
            className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-1.5 text-xs text-aviva-text outline-none focus:border-aviva-gold/50"
          />
        </div>
      )}
    </div>
  );
}
