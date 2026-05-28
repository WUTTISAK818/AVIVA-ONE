"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, RefreshCw, ShieldCheck, ArrowDownRight, ArrowUpRight } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface GateEvent {
  id: string;
  event_at: string;
  event_type: string;
  license_plate: string | null;
  confidence: number | null;
  match_type: string | null;
  action: string | null;
  gates: { code: string; name_th: string; direction: string } | null;
}

const ACTION_META: Record<string, { label: string; cls: string }> = {
  auto_open:     { label: "เปิดอัตโนมัติ", cls: "bg-green-500/15 text-green-300 border-green-500/30" },
  manual_open:   { label: "เปิดด้วยมือ",   cls: "bg-aviva-gold/15 text-aviva-gold border-aviva-gold/30" },
  denied:        { label: "ปฏิเสธ",       cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  pending_guard: { label: "รอ รปภ.",      cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};
const MATCH_TH: Record<string, string> = {
  resident: "ลูกบ้าน", visitor: "ผู้มาเยือน", blacklist: "แบล็คลิสต์", unknown: "ไม่รู้จัก", manual: "รปภ.",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function GateEventsPage() {
  const [events, setEvents] = useState<GateEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    supabase
      .from("gate_events")
      .select("id, event_at, event_type, license_plate, confidence, match_type, action, gates:gate_id(code, name_th, direction)")
      .order("event_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setEvents((data as unknown as GateEvent[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("gate_events_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gate_events" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/security" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-aviva-text">เหตุการณ์ประตู</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">ฟีดสด · 50 รายการล่าสุด</p>
            </div>
          </div>
          <button onClick={load} className="text-aviva-secondary hover:text-aviva-gold">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="ALPR Feed" subtitle="อัปเดตอัตโนมัติเมื่อมี event ใหม่" />
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : events.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <ShieldCheck size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มี event เข้ามา · ลองยิง mock ที่ /security/mock-alpr</p>
          </GlassCard>
        ) : (
          events.map(e => {
            const meta = e.action ? ACTION_META[e.action] : null;
            const DirIcon = e.gates?.direction === "exit" ? ArrowUpRight : ArrowDownRight;
            return (
              <GlassCard key={e.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-aviva-text">
                      <DirIcon size={14} className="text-aviva-gold/80" />
                      <span className="font-mono">{e.license_plate ?? "—"}</span>
                      {e.confidence !== null && (
                        <span className="text-xs text-aviva-secondary font-normal">{Math.round(e.confidence * 100)}%</span>
                      )}
                    </div>
                    <p className="text-xs text-aviva-secondary mt-1">
                      {e.gates?.name_th ?? "—"} · {MATCH_TH[e.match_type ?? "unknown"] ?? e.match_type ?? "—"}
                    </p>
                    <p className="text-xs text-aviva-secondary/70 mt-1">{fmt(e.event_at)}</p>
                  </div>
                  {meta && (
                    <span className={clsx("text-xs px-2.5 py-1 rounded-full border", meta.cls)}>{meta.label}</span>
                  )}
                </div>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
