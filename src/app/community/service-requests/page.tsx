"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Wrench, Plus } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface ServiceRequest {
  id: string;
  category: string | null;
  title: string | null;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  resolved_at: string | null;
}

const STATUS_TH: Record<string, { l: string; c: string }> = {
  new:         { l: "ใหม่",       c: "bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/30" },
  assigned:    { l: "มอบหมาย",   c: "bg-blue-500/15 text-blue-300 border border-blue-500/30" },
  in_progress: { l: "กำลังทำ",   c: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  done:        { l: "เสร็จ",      c: "bg-green-500/15 text-green-300 border border-green-500/30" },
  cancelled:   { l: "ยกเลิก",     c: "bg-aviva-secondary/20 text-aviva-secondary border border-aviva-secondary/30" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function ServiceRequestsPage() {
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("service_requests").select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { setItems((data as ServiceRequest[]) ?? []); setLoading(false); });
  }, []);

  const open = items.filter(i => i.status !== "done" && i.status !== "cancelled");

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-aviva-text">แจ้งซ่อม</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {loading ? "กำลังโหลด…" : `${open.length} งานเปิดอยู่`}
            </p>
          </div>
          <Link href="/community/service-requests/new"
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
            <Plus size={14} /> แจ้งใหม่
          </Link>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="งานทั้งหมด" subtitle="เรียงจากใหม่สุด" />
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : items.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Wrench size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีงานแจ้งซ่อม</p>
          </GlassCard>
        ) : (
          items.map(r => {
            const s = STATUS_TH[r.status] ?? STATUS_TH.new;
            return (
              <GlassCard key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-aviva-text">{r.title ?? "งานแจ้งซ่อม"}</p>
                    {r.description && (
                      <p className="text-xs text-aviva-secondary mt-0.5 line-clamp-2">{r.description}</p>
                    )}
                    <div className="flex gap-x-3 mt-1 text-[11px] text-aviva-secondary/70">
                      {r.category && <span>{r.category}</span>}
                      <span>{fmt(r.created_at)}</span>
                    </div>
                  </div>
                  <span className={clsx("text-[10px] px-2 py-0.5 rounded-full", s.c)}>{s.l}</span>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
