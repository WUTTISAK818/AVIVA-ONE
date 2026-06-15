"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Plus, X, Vote, CheckCircle, XCircle, MinusCircle, AlertCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Resolution {
  id: string;
  title: string;
  proposal: string;
  voting_opens_at: string;
  voting_closes_at: string | null;
  status: string;
  result_for: number;
  result_against: number;
  result_abstain: number;
  created_at: string;
}

const empty = { title: "", proposal: "", voting_closes_at: "" };

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminResolutionsPage() {
  const [items, setItems] = useState<Resolution[]>([]);
  const [residentCount, setResidentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    Promise.all([
      supabase.from("resolutions").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("residents").select("id", { count: "exact", head: true }),
    ]).then(([r, c]) => {
      setItems((r.data as Resolution[]) ?? []);
      setResidentCount(c.count ?? 0);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const create = async () => {
    if (!form.title || !form.proposal) { setError("กรุณาระบุหัวข้อและรายละเอียดมติ"); return; }
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: insErr } = await supabase.from("resolutions").insert({
      title: form.title,
      proposal: form.proposal,
      voting_closes_at: form.voting_closes_at || null,
      status: "open",
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (insErr) { setError(insErr.message); return; }
    setForm(empty);
    setShowForm(false);
    load();
  };

  const close = async (id: string, accept: boolean) => {
    if (!confirm(accept ? "ปิดมตินี้และบันทึกว่าผ่าน?" : "ปิดมตินี้และบันทึกว่าตก?")) return;
    await supabase.from("resolutions").update({ status: accept ? "passed" : "rejected" }).eq("id", id);
    load();
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/security/governance" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-aviva-text">มติลงเสียง</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">{items.length} มติ · ลูกบ้าน {residentCount} ยูนิต</p>
            </div>
          </div>
          <button onClick={() => { setForm(empty); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
            <Plus size={14} /> ออกมติ
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="รายการ" subtitle="ดูคะแนนสด · ปิดเมื่อพร้อม" />
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : items.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Vote size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีมติ</p>
          </GlassCard>
        ) : (
          items.map(r => {
            const total = r.result_for + r.result_against + r.result_abstain;
            const turnout = residentCount > 0 ? Math.round((total / residentCount) * 100) : 0;
            return (
              <GlassCard key={r.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-aviva-text">{r.title}</p>
                    <p className="text-xs text-aviva-secondary mt-1 line-clamp-3">{r.proposal}</p>
                    <p className="text-xs text-aviva-secondary/70 mt-1">
                      ปิดโหวต {fmt(r.voting_closes_at)} · {turnout}% turnout
                    </p>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Tally label="เห็นชอบ" count={r.result_for} icon={CheckCircle} color="text-green-300" />
                  <Tally label="คัดค้าน" count={r.result_against} icon={XCircle} color="text-red-300" />
                  <Tally label="งดออกเสียง" count={r.result_abstain} icon={MinusCircle} color="text-aviva-secondary" />
                </div>
                {r.status === "open" && (
                  <div className="flex gap-2">
                    <button onClick={() => close(r.id, true)}
                      className="flex-1 text-xs bg-green-500/15 text-green-300 border border-green-500/30 px-3 py-2 rounded-lg">
                      ปิด · ผ่านมติ
                    </button>
                    <button onClick={() => close(r.id, false)}
                      className="flex-1 text-xs bg-red-500/15 text-red-300 border border-red-500/30 px-3 py-2 rounded-lg">
                      ปิด · ตก
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">ออกมติใหม่</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {error && (
              <div className="text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2">
                <AlertCircle size={12} /> {error}
              </div>
            )}
            <Field label="หัวข้อ *">
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="เช่น อนุมัติงบประมาณปี 2568"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="รายละเอียดมติ *">
              <textarea value={form.proposal} onChange={e => setForm({ ...form, proposal: e.target.value })}
                placeholder="ระบุข้อเสนอที่ลูกบ้านจะลงมติ" rows={5}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="ปิดโหวตเมื่อ">
              <input type="datetime-local" value={form.voting_closes_at}
                onChange={e => setForm({ ...form, voting_closes_at: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <button onClick={create} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังเผยแพร่…" : "เผยแพร่และเปิดโหวต"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tally({ label, count, icon: Icon, color }: { label: string; count: number; icon: typeof CheckCircle; color: string }) {
  return (
    <div className={clsx("rounded-xl bg-aviva-bg/40 p-2", color)}>
      <Icon size={16} className="mx-auto mb-0.5" />
      <p className="text-base font-bold">{count}</p>
      <p className="text-xs text-aviva-secondary">{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { l: string; c: string }> = {
    open:     { l: "เปิดโหวต", c: "bg-aviva-gold/15 text-aviva-gold border-aviva-gold/30" },
    closed:   { l: "ปิด",      c: "bg-aviva-card text-aviva-secondary border-aviva-gold/10" },
    passed:   { l: "ผ่าน",     c: "bg-green-500/15 text-green-300 border-green-500/30" },
    rejected: { l: "ตก",       c: "bg-red-500/15 text-red-300 border-red-500/30" },
  };
  const m = map[status] ?? map.open;
  return <span className={clsx("text-xs px-2.5 py-1 rounded-full border", m.c)}>{m.l}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-aviva-secondary mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
