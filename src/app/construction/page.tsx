"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ProgressBar from "@/components/ProgressBar";
import { supabase } from "@/lib/supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

type HouseStatus = "complete" | "on-track" | "delayed";
type Filter = "all" | HouseStatus;

interface House {
  id: string;
  house_number: string;
  status: HouseStatus;
  progress: number;
  contractor: string;
  phase: string;
  delayed_days: number;
}

const statusConfig = {
  complete: { label: "เสร็จแล้ว", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  "on-track": { label: "ตามแผน", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  delayed: { label: "ล่าช้า", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
};

export default function ConstructionPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    supabase
      .from("houses")
      .select("*")
      .eq("project_id", PROJECT_ID)
      .order("house_number")
      .then(({ data }) => {
        setHouses((data as House[]) ?? []);
        setLoading(false);
      });
  }, []);

  const counts = {
    complete: houses.filter((h) => h.status === "complete").length,
    "on-track": houses.filter((h) => h.status === "on-track").length,
    delayed: houses.filter((h) => h.status === "delayed").length,
  };

  const overallProgress = houses.length
    ? Math.round(houses.reduce((s, h) => s + h.progress, 0) / houses.length)
    : 0;

  const filtered = filter === "all" ? houses : houses.filter((h) => h.status === filter);

  const progressColor = (pct: number): "gold" | "green" | "red" =>
    pct === 100 ? "green" : pct < 50 ? "red" : "gold";

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-aviva-text">การก่อสร้าง</h1>
          <p className="text-xs text-aviva-secondary mt-0.5">
            {loading ? "กำลังโหลด..." : `${houses.length} ยูนิต · Real-time Supabase`}
          </p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <GlassCard gold className="p-4">
          <SectionHeader title="ภาพรวมการก่อสร้าง" />
          <ProgressBar
            label="ความคืบหน้าโดยรวม"
            value={overallProgress}
            sublabel={`${houses.length} ยูนิต`}
          />
        </GlassCard>

        <div className="grid grid-cols-3 gap-3">
          {(["complete", "on-track", "delayed"] as HouseStatus[]).map((s) => {
            const { label, icon: Icon, color, bg } = statusConfig[s];
            return (
              <button
                key={s}
                onClick={() => setFilter(filter === s ? "all" : s)}
                className={clsx("rounded-2xl border p-3 flex flex-col items-center gap-1.5 transition-all", bg, filter === s && "ring-2 ring-aviva-gold/50")}
              >
                <Icon size={18} className={color} />
                <span className={clsx("text-xl font-bold", color)}>{loading ? "—" : counts[s]}</span>
                <span className="text-[10px] text-aviva-secondary">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          {(["all", "complete", "on-track", "delayed"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                filter === f ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}
            >
              {f === "all" ? "ทั้งหมด" : statusConfig[f].label}
            </button>
          ))}
        </div>

        <div>
          <SectionHeader title={`ยูนิต (${filtered.length})`} />
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-aviva-card/50 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((house) => {
                const { label, icon: Icon, color, bg } = statusConfig[house.status] ?? statusConfig["on-track"];
                return (
                  <GlassCard key={house.id} className={clsx("p-3 border", bg)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-aviva-text">{house.house_number}</span>
                      <Icon size={14} className={color} />
                    </div>
                    <ProgressBar label="" value={house.progress} showPercent={false} color={progressColor(house.progress)} />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-aviva-secondary truncate">{house.phase ?? label}</span>
                      <span className={clsx("text-xs font-bold", color)}>{house.progress}%</span>
                    </div>
                    {house.delayed_days > 0 && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <AlertTriangle size={10} className="text-red-400" />
                        <span className="text-[10px] text-red-400">ล่าช้า {house.delayed_days} วัน</span>
                      </div>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
