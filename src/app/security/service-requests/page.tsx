"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Wrench } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface ServiceRequest {
  id: string;
  resident_id: string;
  category: string | null;
  title: string | null;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  assigned_to: string | null;
}
interface Resident { id: string; full_name: string }

const STATUS_TH: Record<string, { l: string; c: string }> = {
  new:         { l: "ใหม่",     c: "bg-aviva-gold/15 text-aviva-gold border-aviva-gold/30" },
  assigned:    { l: "มอบหมาย", c: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  in_progress: { l: "กำลังทำ", c: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  done:        { l: "เสร็จ",    c: "bg-green-500/15 text-green-300 border-green-500/30" },
  cancelled:   { l: "ยกเลิก",   c: "bg-aviva-secondary/20 text-aviva-secondary border-aviva-secondary/30" },
};
const NEXT: Record<string, string> = { new: "in_progress", assigned: "in_progress", in_progress: "done" };

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function AdminServiceRequestsPage() {
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = () => {
    Promise.all([
      supabase.from("service_requests").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("residents").select("id, full_name").order("full_name"),
    ]).then(([s, r]) => {
      setItems((s.data as ServiceRequest[]) ?? []);
      setResidents((r.data as Resident[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const visible = items.filter(i => filter === "all" || (i.status !== "done" && i.status !== "cancelled"));
  const resName = (id: string) => residents.find(r => r.id === id)?.full_name ?? id.slice(0, 8);

  const advance = async (id: string, current: string) => {
    const next = NEXT[current];
    if (!next) return;
    await supabase.from("service_requests").update({
      status: next,
      ...(next === "done" ? { resolved_at: new Date().toISOString() } : {}),
    }).eq("id", id);
    load();
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/security" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">งานแจ้งซ่อม</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">{visible.length} รายการ</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <div className="flex gap-2">
          {([{ k: "open" as const, l: "เปิดอยู่" }, { k: "all" as const, l: "ทั้งหมด" }]).map(({ k, l }) => (
            <button key={k} onClick={() => setFilter(k)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border",
                filter === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>{l}</button>
          ))}
        </div>

        <SectionHeader title="รายการ" subtitle="แตะปุ่มเพื่อเลื่อนสถานะ" />

        {loading ? (
          [1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : visible.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Wrench size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ไม่มีงาน</p>
          </GlassCard>
        ) : (
          visible.map(r => {
            const s = STATUS_TH[r.status] ?? STATUS_TH.new;
            const next = NEXT[r.status];
            return (
              <GlassCard key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-aviva-text">{r.title ?? "งานแจ้งซ่อม"}</p>
                    <p className="text-xs text-aviva-secondary">{resName(r.resident_id)} · {r.category ?? "—"}</p>
                    {r.description && <p className="text-xs text-aviva-secondary/80 mt-1 line-clamp-2">{r.description}</p>}
                    <p className="text-xs text-aviva-secondary/70 mt-1">แจ้งเมื่อ {fmt(r.created_at)} · ระดับ {r.priority}</p>
                  </div>
                  <span className={clsx("text-xs px-2.5 py-1 rounded-full border", s.c)}>{s.l}</span>
                </div>
                {next && (
                  <button onClick={() => advance(r.id, r.status)}
                    className="text-sm flex items-center gap-1.5 bg-aviva-card border border-aviva-gold/30 text-aviva-gold font-bold px-3 py-2 rounded-lg">
                    เลื่อนเป็น {STATUS_TH[next].l}
                  </button>
                )}
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
