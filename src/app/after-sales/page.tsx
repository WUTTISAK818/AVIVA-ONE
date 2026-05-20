"use client";

import { useEffect, useState } from "react";
import { Wrench, CheckCircle, Clock, AlertCircle, Star } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface Claim {
  id: string;
  customer_name: string;
  issue_type: string;
  description: string;
  status: "pending" | "in_progress" | "resolved";
  assigned_to: string;
  scheduled_date: string;
  satisfaction_score: number | null;
  created_at: string;
}

type FilterStatus = "all" | "pending" | "in_progress" | "resolved";

const statusConfig = {
  pending:     { label: "รอดำเนินการ", icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  in_progress: { label: "กำลังดำเนินการ", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  resolved:    { label: "เสร็จสิ้น", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
};

const issueColor: Record<string, string> = {
  Plumbing:   "bg-blue-500/20 text-blue-400",
  Electrical: "bg-yellow-500/20 text-yellow-400",
  Structure:  "bg-red-500/20 text-red-400",
  Paint:      "bg-purple-500/20 text-purple-400",
  Other:      "bg-gray-500/20 text-gray-400",
};

const issueTh: Record<string, string> = {
  Plumbing:   "ท่อน้ำ",
  Electrical: "ไฟฟ้า",
  Structure:  "โครงสร้าง",
  Paint:      "สีและทาสี",
  Other:      "อื่นๆ",
};

export default function AfterSalesPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    supabase
      .from("warranty_claims")
      .select("*")
      .eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setClaims((data as Claim[]) ?? []);
        setLoading(false);
      });
  }, []);

  const counts = {
    pending:     claims.filter((c) => c.status === "pending").length,
    in_progress: claims.filter((c) => c.status === "in_progress").length,
    resolved:    claims.filter((c) => c.status === "resolved").length,
  };

  const avgSatisfaction = (() => {
    const scored = claims.filter((c) => c.satisfaction_score !== null);
    if (!scored.length) return null;
    return (scored.reduce((s, c) => s + (c.satisfaction_score ?? 0), 0) / scored.length).toFixed(1);
  })();

  const filtered = filter === "all" ? claims : claims.filter((c) => c.status === filter);

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-aviva-text">After Sales & Warranty</h1>
          <p className="text-xs text-aviva-secondary mt-0.5">
            {loading ? "กำลังโหลด..." : `${claims.length} เคส · Real-time Supabase`}
          </p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <GlassCard className="p-3 text-center">
            <p className="text-xl font-bold text-aviva-text">{loading ? "—" : claims.length}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">ทั้งหมด</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <p className="text-xl font-bold text-yellow-400">{loading ? "—" : counts.pending}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">รอดำเนินการ</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{loading ? "—" : counts.in_progress}</p>
            <p className="text-[10px] text-aviva-secondary mt-0.5">กำลังทำ</p>
          </GlassCard>
          <GlassCard gold className="p-3 text-center">
            <div className="flex items-center justify-center gap-0.5 mb-0.5">
              <Star size={12} className="text-aviva-gold" />
              <p className="text-xl font-bold text-aviva-gold">{avgSatisfaction ?? "—"}</p>
            </div>
            <p className="text-[10px] text-aviva-secondary">Satisfaction</p>
          </GlassCard>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {(["all", "pending", "in_progress", "resolved"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                filter === f
                  ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                  : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}
            >
              {f === "all" ? "ทั้งหมด" : statusConfig[f].label.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Claims */}
        <div>
          <SectionHeader title={`เคส (${filtered.length})`} />
          <div className="space-y-3">
            {loading
              ? [1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-aviva-card/50 animate-pulse" />)
              : filtered.length === 0
              ? (
                <GlassCard className="p-8 text-center">
                  <p className="text-aviva-secondary text-sm">ไม่มีเคสในสถานะนี้</p>
                </GlassCard>
              )
              : filtered.map((claim) => {
                  const sConf = statusConfig[claim.status];
                  const Icon = sConf.icon;
                  return (
                    <GlassCard key={claim.id} className={clsx("p-4 border", sConf.bg)}>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <Icon size={16} className={sConf.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-semibold text-aviva-text">{claim.customer_name}</h3>
                            <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", issueColor[claim.issue_type])}>
                              {issueTh[claim.issue_type] ?? claim.issue_type}
                            </span>
                          </div>
                          <p className="text-xs text-aviva-secondary mb-2">{claim.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Wrench size={10} className="text-aviva-secondary" />
                              <span className="text-[10px] text-aviva-secondary">{claim.assigned_to}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {claim.satisfaction_score && (
                                <div className="flex items-center gap-0.5">
                                  <Star size={10} className="text-aviva-gold" />
                                  <span className="text-[10px] text-aviva-gold font-bold">{claim.satisfaction_score}/5</span>
                                </div>
                              )}
                              {claim.scheduled_date && (
                                <span className="text-[10px] text-aviva-secondary">{claim.scheduled_date}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
          </div>
        </div>
      </div>
    </div>
  );
}
