"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Vote, CalendarDays, FileText, ArrowLeft, ArrowRight, FolderOpen } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Resolution {
  id: string; title: string; proposal: string;
  voting_closes_at: string | null; status: string;
  result_for: number; result_against: number; result_abstain: number;
}
interface Meeting { id: string; meeting_type: string; title: string; scheduled_at: string; location: string | null }
interface Doc { id: string; title: string; category: string; doc_url: string; published_at: string }

function fmt(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function CommunityGovernancePage() {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date().toISOString();
    Promise.all([
      supabase.from("resolutions").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(10),
      supabase.from("meetings").select("*").gte("scheduled_at", now).order("scheduled_at").limit(5),
      supabase.from("juristic_documents").select("*").eq("is_public", true).order("published_at", { ascending: false }).limit(8),
    ]).then(([r, m, d]) => {
      setResolutions((r.data as Resolution[]) ?? []);
      setMeetings((m.data as Meeting[]) ?? []);
      setDocs((d.data as Doc[]) ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-1 -ml-2">
          <Link href="/community/announcements" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">การบริหารนิติฯ</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">โหวต · ประชุม · เอกสาร</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div>
          <SectionHeader title="มติที่เปิดให้โหวต" subtitle="เสียงของคุณสำคัญ" />
          {loading ? (
            <div className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />
          ) : resolutions.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <Vote size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
              <p className="text-aviva-secondary text-sm">ไม่มีมติเปิดอยู่</p>
            </GlassCard>
          ) : (
            resolutions.map(r => {
              const total = r.result_for + r.result_against + r.result_abstain;
              const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
              return (
                <Link key={r.id} href={`/community/resolutions/${r.id}`}>
                  <GlassCard className="p-4 active:scale-[0.98] mb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-aviva-text">{r.title}</p>
                        <p className="text-xs text-aviva-secondary line-clamp-2 mt-1">{r.proposal}</p>
                        {r.voting_closes_at && <p className="text-xs text-aviva-gold mt-1">ปิดโหวต {fmt(r.voting_closes_at)}</p>}
                      </div>
                      <ArrowRight size={16} className="text-aviva-secondary/60 ml-2 shrink-0" />
                    </div>
                    {total > 0 && (
                      <div className="flex items-center gap-3 mt-3 text-xs">
                        <span className="text-green-300">เห็นชอบ {pct(r.result_for)}%</span>
                        <span className="text-red-300">คัดค้าน {pct(r.result_against)}%</span>
                        <span className="text-aviva-secondary">งด {pct(r.result_abstain)}%</span>
                      </div>
                    )}
                  </GlassCard>
                </Link>
              );
            })
          )}
        </div>

        <div>
          <SectionHeader title="ประชุมจะถึง" />
          {loading ? (
            <div className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />
          ) : meetings.length === 0 ? (
            <GlassCard className="p-6 text-center">
              <p className="text-aviva-secondary text-sm">ไม่มีประชุมจะถึง</p>
            </GlassCard>
          ) : meetings.map(m => (
            <GlassCard key={m.id} className="p-4 mb-2">
              <div className="flex items-start gap-3">
                <CalendarDays size={18} className="text-aviva-gold mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-aviva-text">
                    {m.meeting_type === "AGM" ? "ประชุมใหญ่สามัญ" : m.meeting_type === "EGM" ? "ประชุมใหญ่วิสามัญ" : "ประชุมกรรมการ"}: {m.title}
                  </p>
                  <p className="text-xs text-aviva-secondary mt-0.5">{fmt(m.scheduled_at)} · {m.location ?? "—"}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <div>
          <SectionHeader title="เอกสารนิติฯ" />
          {loading ? (
            <div className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />
          ) : docs.length === 0 ? (
            <GlassCard className="p-6 text-center">
              <FolderOpen size={20} className="text-aviva-secondary/30 mx-auto mb-2" />
              <p className="text-aviva-secondary text-sm">ยังไม่มีเอกสารเผยแพร่</p>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {docs.map(d => (
                <a key={d.id} href={d.doc_url} target="_blank" rel="noreferrer">
                  <GlassCard className="p-3 active:scale-[0.98]">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-aviva-gold" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-aviva-text truncate">{d.title}</p>
                        <p className="text-xs text-aviva-secondary">{d.category} · {new Date(d.published_at).toLocaleDateString("th-TH")}</p>
                      </div>
                    </div>
                  </GlassCard>
                </a>
              ))}
            </div>
          )}
        </div>

        <Link href="/community/finance">
          <GlassCard className="p-4 active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-aviva-text">ความโปร่งใสทางการเงิน</p>
                <p className="text-xs text-aviva-secondary mt-0.5">ดูบัญชีกองทุน รายรับ-รายจ่าย</p>
              </div>
              <ArrowRight size={16} className="text-aviva-secondary/60" />
            </div>
          </GlassCard>
        </Link>
      </div>
    </div>
  );
}

