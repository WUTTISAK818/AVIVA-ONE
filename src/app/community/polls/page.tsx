"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Poll {
  id: string;
  title: string;
  description: string | null;
  opens_at: string;
  closes_at: string | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function CommunityPollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("polls").select("*").eq("is_published", true).order("opens_at", { ascending: false }).limit(30)
      .then(({ data }) => { setPolls((data as Poll[]) ?? []); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-1 -ml-2">
          <Link href="/community/announcements" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">โพล / สำรวจ</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">เสียงของลูกบ้าน</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="โพลที่เปิดอยู่" />
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : polls.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <BarChart3 size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีโพล</p>
          </GlassCard>
        ) : (
          polls.map(p => (
            <Link key={p.id} href={`/community/polls/${p.id}`}>
              <GlassCard className="p-4 active:scale-[0.98]">
                <p className="text-sm font-semibold text-aviva-text">{p.title}</p>
                {p.description && <p className="text-xs text-aviva-secondary mt-1 line-clamp-2">{p.description}</p>}
                <p className="text-xs text-aviva-secondary/70 mt-1">
                  เปิด {fmt(p.opens_at)}{p.closes_at ? ` · ปิด ${fmt(p.closes_at)}` : ""}
                </p>
              </GlassCard>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
