"use client";

import { useState, useEffect } from "react";
import { Search, Star, Phone, Plus } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { pipelineStages, type LeadStatus } from "@/lib/mock-data";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface Lead {
  id: string;
  customer_name: string;
  phone: string;
  budget: number;
  status: LeadStatus;
  source: string;
  ai_score: number;
  notes: string;
  created_at_default: string;
}

const sourceColor: Record<string, string> = {
  Facebook: "bg-blue-500/20 text-blue-400",
  TikTok: "bg-pink-500/20 text-pink-400",
  Google: "bg-green-500/20 text-green-400",
  Referral: "bg-purple-500/20 text-purple-400",
};

function scoreColor(score: number) {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function formatBudget(n: number) {
  return `฿${(n / 1_000_000).toFixed(1)}M`;
}

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<LeadStatus>("New Lead");
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("leads")
      .select("*")
      .eq("project_id", PROJECT_ID)
      .order("created_at_default", { ascending: false })
      .then(({ data }) => {
        setLeads((data as Lead[]) ?? []);
        setLoading(false);
      });
  }, []);

  const stageCounts = Object.fromEntries(
    pipelineStages.map((s) => [s, leads.filter((l) => l.status === s).length])
  ) as Record<LeadStatus, number>;

  const filtered = leads.filter(
    (l) =>
      l.status === activeStage &&
      (search === "" || l.customer_name.includes(search))
  );

  return (
    <div className="min-h-screen bg-aviva-bg">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">CRM</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : `${leads.length} ราย · Real-time Supabase`}
              </p>
            </div>
            <button className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
              <Plus size={14} /> เพิ่ม Lead
            </button>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
            <input
              type="text"
              placeholder="ค้นหาลูกค้า..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/40"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "ทั้งหมด", value: leads.length, color: "text-aviva-text" },
            { label: "Booking", value: stageCounts["Booking"] ?? 0, color: "text-aviva-gold" },
            { label: "Loan", value: stageCounts["Loan Process"] ?? 0, color: "text-blue-400" },
            { label: "โอนแล้ว", value: stageCounts["Closed Deal"] ?? 0, color: "text-green-400" },
          ].map(({ label, value, color }) => (
            <GlassCard key={label} className="p-3 text-center">
              <p className={clsx("text-xl font-bold", color)}>{value}</p>
              <p className="text-[10px] text-aviva-secondary mt-0.5">{label}</p>
            </GlassCard>
          ))}
        </div>

        {/* Pipeline Tabs */}
        <div>
          <SectionHeader title="Pipeline" subtitle="แตะเพื่อกรอง" />
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {pipelineStages.map((stage) => (
              <button
                key={stage}
                onClick={() => setActiveStage(stage)}
                className={clsx(
                  "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  activeStage === stage
                    ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                    : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                )}
              >
                {stage}
                <span className={clsx(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  activeStage === stage ? "bg-aviva-bg/20 text-aviva-bg" : "bg-aviva-gold/10 text-aviva-gold"
                )}>
                  {stageCounts[stage] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Lead Cards */}
        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <p className="text-aviva-secondary text-sm">ไม่พบลูกค้าในขั้นนี้</p>
            </GlassCard>
          ) : (
            filtered.map((lead) => (
              <GlassCard key={lead.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-aviva-text">{lead.customer_name}</h3>
                      <span className={clsx(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        sourceColor[lead.source] ?? "bg-gray-500/20 text-gray-400"
                      )}>
                        {lead.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-aviva-secondary">
                        <Phone size={10} />{lead.phone}
                      </span>
                      <span className="text-xs text-aviva-gold font-medium">
                        {formatBudget(lead.budget)}
                      </span>
                    </div>
                    {lead.notes && (
                      <p className="text-[10px] text-aviva-secondary/70 mt-1 truncate">{lead.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Star size={12} className="text-aviva-gold" />
                    <span className={clsx("text-lg font-bold", scoreColor(lead.ai_score ?? 0))}>
                      {lead.ai_score ?? "—"}
                    </span>
                    <span className="text-[9px] text-aviva-secondary">AI Score</span>
                  </div>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
