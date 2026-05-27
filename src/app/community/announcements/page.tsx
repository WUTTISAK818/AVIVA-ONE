"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Pin, Megaphone, ArrowRight } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Announcement {
  id: string;
  title: string;
  body_md: string | null;
  category: string | null;
  pinned: boolean;
  published_at: string;
  expires_at: string | null;
}

const CATEGORY_TH: Record<string, string> = {
  general: "ทั่วไป", maintenance: "ซ่อมบำรุง", event: "กิจกรรม", urgent: "ด่วน",
};
const CATEGORY_CLS: Record<string, string> = {
  general: "bg-aviva-card text-aviva-secondary",
  maintenance: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  event: "bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/30",
  urgent: "bg-red-500/15 text-red-300 border border-red-500/30",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("announcements")
      .select("*")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(50)
      .then(({ data }) => { setItems((data as Announcement[]) ?? []); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-aviva-text">ประกาศจากนิติฯ</h1>
          <p className="text-xs text-aviva-secondary mt-0.5">
            {loading ? "กำลังโหลด…" : `${items.length} ประกาศ`}
          </p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        <SectionHeader title="อ่านล่าสุด" subtitle="ปักหมุดจะอยู่บนสุด" />

        {loading ? (
          [1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : items.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Megaphone size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีประกาศ</p>
          </GlassCard>
        ) : (
          items.map(a => (
            <Link key={a.id} href={`/community/announcements/${a.id}`}>
              <GlassCard gold={a.pinned} className="p-4 active:scale-[0.98] transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.pinned && <Pin size={12} className="text-aviva-gold" />}
                      <p className="text-sm font-semibold text-aviva-text">{a.title}</p>
                      <span className={clsx("text-[10px] px-2 py-0.5 rounded-full", CATEGORY_CLS[a.category ?? "general"] ?? "")}>
                        {CATEGORY_TH[a.category ?? "general"] ?? a.category}
                      </span>
                    </div>
                    {a.body_md && (
                      <p className="text-xs text-aviva-secondary mt-1 line-clamp-2">{a.body_md}</p>
                    )}
                    <p className="text-[10px] text-aviva-secondary/70 mt-1">{fmt(a.published_at)}</p>
                  </div>
                  <ArrowRight size={14} className="text-aviva-secondary/50" />
                </div>
              </GlassCard>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
