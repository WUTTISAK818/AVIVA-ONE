"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Incident {
  id: string;
  category: string | null;
  severity: string;
  title: string | null;
  description: string | null;
  status: string;
  occurred_at: string;
  photo_urls: string[] | null;
  location_note: string | null;
}

const SEV_TH: Record<string, { l: string; c: string }> = {
  low:  { l: "ต่ำ",  c: "bg-aviva-card text-aviva-secondary border-aviva-gold/10" },
  med:  { l: "กลาง", c: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  high: { l: "สูง",  c: "bg-red-500/15 text-red-300 border-red-500/30" },
};
const STATUS_TH: Record<string, string> = { open: "เปิด", investigating: "กำลังตรวจ", resolved: "ปิด" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminIncidentsPage() {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = () => {
    supabase.from("incidents").select("*").order("occurred_at", { ascending: false }).limit(100)
      .then(({ data }) => { setItems((data as Incident[]) ?? []); setLoading(false); });
  };
  useEffect(load, []);

  const advance = async (id: string, status: string) => {
    const next = status === "open" ? "investigating" : status === "investigating" ? "resolved" : status;
    if (next === status) return;
    await supabase.from("incidents").update({
      status: next,
      ...(next === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
    }).eq("id", id);
    load();
  };

  const visible = items.filter(i => filter === "all" || i.status !== "resolved");

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/security" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">เหตุการณ์</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">{visible.length} รายการ</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <div className="flex gap-2">
          {([{ k: "open" as const, l: "ที่ยังไม่ปิด" }, { k: "all" as const, l: "ทั้งหมด" }]).map(({ k, l }) => (
            <button key={k} onClick={() => setFilter(k)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border",
                filter === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>{l}</button>
          ))}
        </div>

        <SectionHeader title="รายการ" subtitle="แตะปุ่มเลื่อนสถานะ" />

        {loading ? (
          [1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : visible.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <AlertTriangle size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ไม่มีเหตุการณ์</p>
          </GlassCard>
        ) : (
          visible.map(i => {
            const sev = SEV_TH[i.severity] ?? SEV_TH.low;
            const canAdvance = i.status !== "resolved";
            return (
              <GlassCard key={i.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-aviva-text">{i.title ?? "เหตุการณ์"}</p>
                    {i.description && <p className="text-xs text-aviva-secondary line-clamp-2 mt-1">{i.description}</p>}
                    <p className="text-xs text-aviva-secondary/70 mt-1">
                      {i.category ?? "—"} · {fmt(i.occurred_at)} · {STATUS_TH[i.status] ?? i.status}
                      {i.location_note ? ` · ${i.location_note}` : ""}
                    </p>
                  </div>
                  <span className={clsx("text-xs px-2.5 py-1 rounded-full border", sev.c)}>{sev.l}</span>
                </div>
                {i.photo_urls && i.photo_urls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {i.photo_urls.slice(0, 4).map((u, idx) => (
                      <a key={idx} href={u} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt={`photo ${idx + 1}`} className="w-20 h-20 rounded-xl object-cover border border-aviva-gold/20" />
                      </a>
                    ))}
                  </div>
                )}
                {canAdvance && (
                  <button onClick={() => advance(i.id, i.status)}
                    className="text-sm flex items-center gap-1.5 bg-aviva-card border border-aviva-gold/30 text-aviva-gold font-bold px-3 py-2 rounded-lg">
                    เลื่อนเป็น {STATUS_TH[i.status === "open" ? "investigating" : "resolved"]}
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
