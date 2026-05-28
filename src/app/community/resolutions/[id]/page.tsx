"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, CheckCircle, XCircle, MinusCircle, AlertCircle, Vote } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

interface Resolution {
  id: string; title: string; proposal: string;
  voting_opens_at: string; voting_closes_at: string | null;
  status: string;
  result_for: number; result_against: number; result_abstain: number;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ResolutionVotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data: r } = await supabase.from("resolutions").select("*").eq("id", id).maybeSingle();
    setResolution(r as Resolution | null);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: resident } = await supabase.from("residents").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (resident) {
        const { data: v } = await supabase.from("resolution_votes")
          .select("choice")
          .eq("resolution_id", id)
          .eq("voter_resident_id", resident.id)
          .maybeSingle();
        setMyVote(v?.choice ?? null);
      }
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const castVote = async (choice: "for" | "against" | "abstain") => {
    setBusy(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/resolutions/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ choice }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.ok) {
      setMyVote(choice);
      await load();
    } else {
      setError(json.error ?? `error ${res.status}`);
    }
  };

  if (loading || !resolution) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center">
        {loading ? (
          <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" />
        ) : (
          <div className="p-8 text-center">
            <p className="text-aviva-secondary">ไม่พบมติ</p>
            <Link href="/community/governance" className="text-aviva-gold mt-3 block">กลับ</Link>
          </div>
        )}
      </div>
    );
  }

  const total = resolution.result_for + resolution.result_against + resolution.result_abstain;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
  const canVote = resolution.status === "open" &&
    (!resolution.voting_closes_at || new Date(resolution.voting_closes_at).getTime() > Date.now());

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-1 -ml-2">
          <Link href="/community/governance" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-aviva-text truncate">{resolution.title}</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {canVote ? `ปิดโหวต ${fmt(resolution.voting_closes_at)}` : `สถานะ: ${resolution.status}`}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        <GlassCard className="p-5">
          <Vote size={20} className="text-aviva-gold mb-2" />
          <p className="text-sm text-aviva-text whitespace-pre-wrap leading-relaxed">{resolution.proposal}</p>
        </GlassCard>

        <GlassCard className="p-4 space-y-2">
          <p className="text-xs text-aviva-secondary">คะแนนสด</p>
          <BarRow label="เห็นชอบ" pct={pct(resolution.result_for)} count={resolution.result_for} color="bg-green-500" />
          <BarRow label="คัดค้าน" pct={pct(resolution.result_against)} count={resolution.result_against} color="bg-red-500" />
          <BarRow label="งดออกเสียง" pct={pct(resolution.result_abstain)} count={resolution.result_abstain} color="bg-aviva-secondary" />
          <p className="text-xs text-aviva-secondary text-right pt-1">รวม {total} เสียง</p>
        </GlassCard>

        {error && (
          <div className="text-sm px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {canVote ? (
          <div className="space-y-2">
            <p className="text-sm text-aviva-secondary text-center">{myVote ? "คุณโหวตแล้ว — เปลี่ยนได้ก่อนปิด" : "เลือกคำตอบของคุณ"}</p>
            <ChoiceButton label="เห็นชอบ" icon={CheckCircle} active={myVote === "for"}
              onClick={() => castVote("for")} disabled={busy} accent="green" />
            <ChoiceButton label="คัดค้าน" icon={XCircle} active={myVote === "against"}
              onClick={() => castVote("against")} disabled={busy} accent="red" />
            <ChoiceButton label="งดออกเสียง" icon={MinusCircle} active={myVote === "abstain"}
              onClick={() => castVote("abstain")} disabled={busy} accent="gray" />
          </div>
        ) : (
          <GlassCard className="p-4 text-center">
            <p className="text-sm text-aviva-secondary">ปิดการโหวตแล้ว</p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

function BarRow({ label, pct, count, color }: { label: string; pct: number; count: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="text-aviva-text">{label}</span>
        <span className="text-aviva-secondary">{count} เสียง · {pct}%</span>
      </div>
      <div className="h-2 bg-aviva-bg rounded-full overflow-hidden">
        <div className={color} style={{ width: `${pct}%`, height: "100%" }} />
      </div>
    </div>
  );
}

function ChoiceButton({ label, icon: Icon, active, onClick, disabled, accent }:
  { label: string; icon: typeof CheckCircle; active: boolean; onClick: () => void; disabled: boolean; accent: "green" | "red" | "gray" }) {
  const colors = {
    green: active ? "bg-green-500/20 border-green-500/60 text-green-200" : "bg-aviva-card border-aviva-gold/20 text-aviva-text hover:border-green-500/40",
    red:   active ? "bg-red-500/20 border-red-500/60 text-red-200"     : "bg-aviva-card border-aviva-gold/20 text-aviva-text hover:border-red-500/40",
    gray:  active ? "bg-aviva-secondary/20 border-aviva-secondary/60 text-aviva-text" : "bg-aviva-card border-aviva-gold/20 text-aviva-text hover:border-aviva-secondary/40",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={clsx("w-full flex items-center justify-between border rounded-2xl px-4 py-3.5 transition-all disabled:opacity-50", colors[accent])}>
      <span className="flex items-center gap-2 font-medium">
        <Icon size={18} /> {label}
      </span>
      {active && <span className="text-xs">เลือกแล้ว</span>}
    </button>
  );
}
