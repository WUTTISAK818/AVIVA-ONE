"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, FileText, Vote, Gavel, FolderOpen } from "lucide-react";
import KPICard from "@/components/KPICard";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Counts {
  upcoming_meetings: number;
  open_resolutions: number;
  active_committee: number;
  documents: number;
}

const LINKS = [
  { href: "/security/meetings",       label: "ประชุม",          desc: "AGM/EGM · agenda · บันทึก",   icon: Gavel },
  { href: "/security/resolutions",    label: "ลงมติ",          desc: "ออกมติ · ดูผล e-voting",        icon: Vote },
  { href: "/security/committee",      label: "คณะกรรมการนิติฯ", desc: "ตำแหน่ง · วาระ",                icon: Users },
  { href: "/security/documents",      label: "คลังเอกสาร",      desc: "ข้อบังคับ · รายงานประชุม",       icon: FolderOpen },
];

export default function GovernanceHubPage() {
  const [counts, setCounts] = useState<Counts>({ upcoming_meetings: 0, open_resolutions: 0, active_committee: 0, documents: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date().toISOString();
    Promise.all([
      supabase.from("meetings").select("id", { count: "exact", head: true }).gte("scheduled_at", now).neq("status", "cancelled"),
      supabase.from("resolutions").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("committee_members").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("juristic_documents").select("id", { count: "exact", head: true }),
    ]).then(([m, r, c, d]) => {
      setCounts({
        upcoming_meetings: m.count ?? 0,
        open_resolutions: r.count ?? 0,
        active_committee: c.count ?? 0,
        documents: d.count ?? 0,
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/security" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">การบริหารนิติฯ</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">ประชุม · ลงมติ · คณะกรรมการ · เอกสาร</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <KPICard icon={Gavel} label="ประชุมจะถึง" value={loading ? "…" : String(counts.upcoming_meetings)} />
          <KPICard icon={Vote} label="มติที่เปิดอยู่" value={loading ? "…" : String(counts.open_resolutions)} highlight={counts.open_resolutions > 0} />
          <KPICard icon={Users} label="กรรมการที่ active" value={loading ? "…" : String(counts.active_committee)} />
          <KPICard icon={FileText} label="เอกสาร" value={loading ? "…" : String(counts.documents)} />
        </div>

        <div>
          <SectionHeader title="เมนูจัดการ" />
          <div className="grid grid-cols-1 gap-2">
            {LINKS.map(({ href, label, desc, icon: Icon }) => (
              <Link key={href} href={href}>
                <GlassCard className="p-4 active:scale-[0.98]">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-aviva-gold/10">
                      <Icon size={18} className="text-aviva-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-aviva-text">{label}</p>
                      <p className="text-xs text-aviva-secondary mt-0.5">{desc}</p>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
