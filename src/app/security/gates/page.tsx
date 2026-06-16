"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, DoorOpen, Copy, Check, ArrowDownRight, ArrowUpRight, AlertCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Gate { id: string; code: string; name_th: string; direction: string; webhook_secret: string | null; is_active: boolean }

export default function GatesPage() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => {
    supabase.from("gates").select("*").order("direction").then(({ data }) => {
      setGates((data as Gate[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const openGate = async (id: string) => {
    setBusy(id);
    setFeedback(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/gates/${id}/open`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ reason: "เปิดจากหน้า /security/gates" }),
    });
    const json = await res.json();
    setBusy(null);
    setFeedback(res.ok
      ? { ok: true, msg: "เปิดประตูแล้ว · ดูใน เหตุการณ์ประตู" }
      : { ok: false, msg: json.error ?? `error ${res.status}` });
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/security" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">ควบคุมประตู</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">เปิดด้วยมือ · ตั้งค่า webhook</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {feedback && (
          <div className={clsx("text-xs px-3 py-2 rounded-xl border flex items-center gap-2",
            feedback.ok ? "bg-green-500/10 border-green-500/30 text-green-300" : "bg-red-500/10 border-red-500/30 text-red-300"
          )}>
            {feedback.ok ? <Check size={12} /> : <AlertCircle size={12} />} {feedback.msg}
          </div>
        )}

        <SectionHeader title="ประตูทั้งหมด" subtitle={`${gates.length} ประตู`} />

        {loading ? (
          [1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : (
          gates.map(g => {
            const DirIcon = g.direction === "exit" ? ArrowUpRight : ArrowDownRight;
            const webhookUrl = `${origin}/api/gate-events`;
            return (
              <GlassCard key={g.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <DirIcon size={16} className="text-aviva-gold" />
                      <p className="text-sm font-semibold text-aviva-text">{g.name_th}</p>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-aviva-bg/50 text-aviva-secondary font-mono">{g.code}</span>
                    </div>
                    <p className="text-xs text-aviva-secondary mt-0.5">{g.direction === "entry" ? "ขาเข้า" : "ขาออก"}</p>
                  </div>
                  <button onClick={() => openGate(g.id)} disabled={busy === g.id}
                    className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-50">
                    <DoorOpen size={14} /> {busy === g.id ? "กำลังเปิด…" : "เปิดประตู"}
                  </button>
                </div>

                <div className="rounded-xl border border-aviva-gold/10 bg-aviva-bg/30 p-3 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-aviva-secondary/70">การตั้งค่ากล้อง ALPR</p>
                  <CopyRow label="Webhook URL" value={webhookUrl} k={`url-${g.id}`} onCopy={copy} copied={copied} />
                  <CopyRow label="X-Gate-Secret" value={g.webhook_secret ?? "—"} k={`sec-${g.id}`} onCopy={copy} copied={copied} mask />
                  <CopyRow label="gate_id (body)" value={g.code} k={`gid-${g.id}`} onCopy={copy} copied={copied} />
                </div>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}

function CopyRow({ label, value, k, onCopy, copied, mask }:
  { label: string; value: string; k: string; onCopy: (v: string, k: string) => void; copied: string | null; mask?: boolean }) {
  const shown = mask ? value.replace(/.(?=.{4})/g, "•") : value;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-aviva-secondary">{label}</p>
        <p className="text-xs font-mono text-aviva-text/90 truncate">{shown}</p>
      </div>
      <button onClick={() => onCopy(value, k)}
        className="text-aviva-secondary/70 hover:text-aviva-gold p-1">
        {copied === k ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      </button>
    </div>
  );
}
