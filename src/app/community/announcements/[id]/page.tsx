"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Pin } from "lucide-react";
import GlassCard from "@/components/GlassCard";
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

export default function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("announcements").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setItem(data as Announcement | null);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" />
      </div>
    );
  }
  if (!item) {
    return (
      <div className="min-h-screen bg-aviva-bg p-8 text-center">
        <p className="text-aviva-secondary">ไม่พบประกาศ</p>
        <Link href="/community/announcements" className="text-aviva-gold mt-3 block">กลับไปรายการ</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-1 -ml-2">
          <Link href="/community/announcements" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-aviva-text truncate">{item.title}</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {new Date(item.published_at).toLocaleString("th-TH")}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-2">
          {item.pinned && <Pin size={14} className="text-aviva-gold" />}
          <span className={clsx("text-xs px-2.5 py-1 rounded-full", CATEGORY_CLS[item.category ?? "general"] ?? "")}>
            {CATEGORY_TH[item.category ?? "general"] ?? item.category}
          </span>
        </div>
        <GlassCard className="p-5">
          <p className="text-sm text-aviva-text whitespace-pre-wrap leading-relaxed">{item.body_md}</p>
        </GlassCard>
      </div>
    </div>
  );
}
