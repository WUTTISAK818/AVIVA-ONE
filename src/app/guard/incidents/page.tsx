"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Plus, AlertTriangle } from "lucide-react";
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

export default function GuardIncidentsPage() {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("incidents").select("*").order("occurred_at", { ascending: false }).limit(50)
      .then(({ data }) => { setItems((data as Incident[]) ?? []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-aviva-text">เหตุการณ์</h1>
          <p className="text-sm text-aviva-secondary mt-1">{loading ? "กำลังโหลด…" : `${items.length} เหตุการณ์ที่บันทึก`}</p>
        </div>
        <Link href="/guard/incidents/new"
          className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
          <Plus size={16} /> แจ้งเหตุใหม่
        </Link>
      </div>

      <SectionHeader title="ล่าสุด" />
      {loading ? (
        [1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
      ) : items.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <AlertTriangle size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
          <p className="text-aviva-secondary text-sm">ยังไม่มีเหตุการณ์</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {items.map(i => {
            const sev = SEV_TH[i.severity] ?? SEV_TH.low;
            return (
              <GlassCard key={i.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-aviva-text">{i.title ?? "เหตุการณ์"}</p>
                    {i.description && <p className="text-xs text-aviva-secondary mt-1 line-clamp-2">{i.description}</p>}
                    <p className="text-[11px] text-aviva-secondary/70 mt-1">
                      {i.category ?? "—"} · {fmt(i.occurred_at)} · {STATUS_TH[i.status] ?? i.status}
                    </p>
                  </div>
                  <span className={clsx("text-xs px-2.5 py-1 rounded-full border shrink-0", sev.c)}>{sev.l}</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
