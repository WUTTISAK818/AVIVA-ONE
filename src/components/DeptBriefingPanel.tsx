"use client";
import { useState } from "react";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Flag, CalendarDays, CalendarRange, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import type { DeptBriefing, BriefHighlight, BriefPlanItem } from "@/lib/ai-experts";

const priorityStyle: Record<string, string> = {
  high: "bg-red-500/15 text-red-300 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  low: "bg-green-500/15 text-green-300 border-green-500/30",
};
const priorityLabel: Record<string, string> = { high: "ด่วน", medium: "ปานกลาง", low: "ทั่วไป" };

interface Props {
  dept: string;
  label?: string;
}

export default function DeptBriefingPanel({ dept, label }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<DeptBriefing | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadLatest = async () => {
    const { data } = await supabase
      .from("ai_briefings")
      .select("title,summary,highlights,weekly_plan,monthly_plan,created_at")
      .eq("dept", dept).eq("scope", "dept")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) {
      setBriefing({
        title: data.title, summary: data.summary,
        highlights: (data.highlights ?? []) as BriefHighlight[],
        weekly_plan: (data.weekly_plan ?? []) as BriefPlanItem[],
        monthly_plan: (data.monthly_plan ?? []) as BriefPlanItem[],
      });
      setCreatedAt(data.created_at);
    }
    setLoaded(true);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) loadLatest();
  };

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/ai-briefing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ dept, periodType: "weekly" }),
      });
      const json = await res.json();
      if (!res.ok || !json.briefing) {
        setError(json.error ?? "สร้างบรีฟไม่สำเร็จ");
      } else {
        setBriefing(json.briefing);
        setCreatedAt(new Date().toISOString());
      }
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ");
    }
    setLoading(false);
  };

  return (
    <div>
      <button
        onClick={toggle}
        className={clsx(
          "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all",
          open ? "bg-aviva-gold/10 border-aviva-gold/40" : "bg-aviva-card border-aviva-gold/20 hover:border-aviva-gold/40",
        )}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-aviva-gold">
          <Sparkles size={15} /> ผู้ช่วยเชิงรุก{label ? ` — ${label}` : ""}
        </span>
        {open ? <ChevronUp size={16} className="text-aviva-secondary" /> : <ChevronDown size={16} className="text-aviva-secondary" />}
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-aviva-secondary">
              {createdAt ? `อัปเดตล่าสุด: ${new Date(createdAt).toLocaleString("th-TH")}` : "ยังไม่มีบรีฟ"}
            </p>
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              {loading ? "AI กำลังวิเคราะห์..." : briefing ? "สร้างใหม่" : "สร้างบรีฟ"}
            </button>
          </div>

          {error && (
            <GlassCard className="p-3 border border-red-500/20 bg-red-500/5">
              <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={13} /> {error}</p>
            </GlassCard>
          )}

          {briefing && (
            <div className="space-y-3">
              <GlassCard gold className="p-3">
                <p className="text-sm font-bold text-aviva-gold">{briefing.title}</p>
                <p className="text-xs text-aviva-secondary mt-1 leading-relaxed">{briefing.summary}</p>
              </GlassCard>

              {briefing.highlights?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-aviva-secondary flex items-center gap-1.5"><Flag size={12} /> เรื่องที่ควรสนใจ</p>
                  {briefing.highlights.map((h, i) => (
                    <GlassCard key={i} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-aviva-text flex-1">{h.title}</p>
                        <span className={clsx("text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0", priorityStyle[h.priority] ?? priorityStyle.low)}>
                          {priorityLabel[h.priority] ?? h.priority}
                        </span>
                      </div>
                      <p className="text-xs text-aviva-secondary mt-1">{h.detail}</p>
                      {h.action && <p className="text-[11px] text-aviva-gold mt-1.5">→ {h.action}</p>}
                    </GlassCard>
                  ))}
                </div>
              )}

              {briefing.weekly_plan?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-aviva-secondary flex items-center gap-1.5"><CalendarDays size={12} /> แผนงานสัปดาห์นี้</p>
                  {briefing.weekly_plan.map((p, i) => (
                    <GlassCard key={i} className="p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-aviva-bg bg-aviva-gold px-2 py-0.5 rounded-full flex-shrink-0">{p.label}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aviva-text">{p.task}</p>
                          {p.why && <p className="text-[11px] text-aviva-secondary mt-0.5">{p.why}</p>}
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}

              {briefing.monthly_plan?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-aviva-secondary flex items-center gap-1.5"><CalendarRange size={12} /> แผนรายเดือน</p>
                  {briefing.monthly_plan.map((p, i) => (
                    <GlassCard key={i} className="p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-aviva-gold border border-aviva-gold/30 px-2 py-0.5 rounded-full flex-shrink-0">{p.label}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aviva-text">{p.task}</p>
                          {p.why && <p className="text-[11px] text-aviva-secondary mt-0.5">{p.why}</p>}
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
