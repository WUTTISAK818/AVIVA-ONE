"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, CheckCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

interface Poll { id: string; title: string; description: string | null; closes_at: string | null }
interface Option { id: string; label: string; order_no: number }
interface Vote { option_id: string; voter_resident_id: string }

export default function PollVotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [residentId, setResidentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [p, o, v, u] = await Promise.all([
      supabase.from("polls").select("*").eq("id", id).maybeSingle(),
      supabase.from("poll_options").select("*").eq("poll_id", id).order("order_no"),
      supabase.from("poll_votes").select("option_id, voter_resident_id").eq("poll_id", id),
      supabase.auth.getUser(),
    ]);
    setPoll(p.data as Poll | null);
    setOptions((o.data as Option[]) ?? []);
    setVotes((v.data as Vote[]) ?? []);

    if (u.data.user) {
      const { data: resident } = await supabase.from("residents").select("id").eq("auth_user_id", u.data.user.id).maybeSingle();
      if (resident) {
        setResidentId(resident.id);
        const mine = ((v.data as Vote[]) ?? []).find(x => x.voter_resident_id === resident.id);
        setMyVote(mine?.option_id ?? null);
      }
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cast = async (optionId: string) => {
    if (!residentId) return;
    setBusy(true);
    await supabase.from("poll_votes").upsert(
      { poll_id: id, option_id: optionId, voter_resident_id: residentId },
      { onConflict: "poll_id,voter_resident_id" }
    );
    setBusy(false);
    setMyVote(optionId);
    await load();
  };

  if (loading || !poll) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center">
        {loading ? (
          <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" />
        ) : <p className="text-aviva-secondary">ไม่พบโพล</p>}
      </div>
    );
  }

  const total = votes.length;
  const closed = !!poll.closes_at && new Date(poll.closes_at).getTime() < Date.now();

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-1 -ml-2">
          <Link href="/community/polls" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-base font-bold text-aviva-text truncate">{poll.title}</h1>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        {poll.description && (
          <GlassCard className="p-4">
            <p className="text-sm text-aviva-text">{poll.description}</p>
          </GlassCard>
        )}
        <p className="text-sm text-aviva-secondary text-center">
          {closed ? "ปิดแล้ว · ผลโหวต:" : myVote ? "คุณโหวตแล้ว — เปลี่ยนได้ก่อนปิด" : "เลือกคำตอบ"}
        </p>
        <div className="space-y-2">
          {options.map(o => {
            const count = votes.filter(v => v.option_id === o.id).length;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const isMine = myVote === o.id;
            return (
              <button key={o.id} onClick={() => !closed && cast(o.id)} disabled={closed || busy}
                className={clsx("w-full text-left p-4 rounded-2xl border relative overflow-hidden transition-all",
                  isMine
                    ? "bg-aviva-gold/15 border-aviva-gold/60"
                    : "bg-aviva-card border-aviva-gold/20 hover:border-aviva-gold/40 active:scale-[0.99]"
                )}>
                <div className="absolute inset-0 bg-aviva-gold/5"
                  style={{ width: `${pct}%` }} />
                <div className="relative flex items-center justify-between">
                  <span className="text-sm text-aviva-text font-medium flex items-center gap-2">
                    {isMine && <CheckCircle size={14} className="text-aviva-gold" />}
                    {o.label}
                  </span>
                  <span className="text-xs text-aviva-secondary">{count} ({pct}%)</span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-aviva-secondary/70 text-center">รวม {total} เสียง</p>
      </div>
    </div>
  );
}
