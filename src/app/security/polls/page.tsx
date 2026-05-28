"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, X, BarChart3 } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Poll { id: string; title: string; description: string | null; closes_at: string | null; is_published: boolean }

const empty = { title: "", description: "", closes_at: "", options: ["", ""] };

export default function AdminPollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof empty>({ ...empty, options: ["", ""] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    supabase.from("polls").select("*").order("opens_at", { ascending: false }).limit(50)
      .then(({ data }) => { setPolls((data as Poll[]) ?? []); setLoading(false); });
  };
  useEffect(load, []);

  const create = async () => {
    const cleanedOpts = form.options.map(o => o.trim()).filter(o => o);
    if (!form.title || cleanedOpts.length < 2) { setError("ต้องมีหัวข้อและตัวเลือกอย่างน้อย 2 อัน"); return; }
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: poll, error: insErr } = await supabase.from("polls").insert({
      title: form.title,
      description: form.description || null,
      closes_at: form.closes_at || null,
      is_published: true,
      created_by: user?.id ?? null,
    }).select("id").single();
    if (insErr || !poll) {
      setSaving(false);
      setError(insErr?.message ?? "ไม่สำเร็จ");
      return;
    }
    await supabase.from("poll_options").insert(
      cleanedOpts.map((label, i) => ({ poll_id: poll.id, label, order_no: i }))
    );
    setSaving(false);
    setShowForm(false);
    setForm({ ...empty, options: ["", ""] });
    load();
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/security" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-aviva-text">โพลลูกบ้าน</h1>
          </div>
          <button onClick={() => { setForm({ ...empty, options: ["", ""] }); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
            <Plus size={14} /> โพลใหม่
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="โพลทั้งหมด" />
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
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
                {p.description && <p className="text-xs text-aviva-secondary line-clamp-2 mt-1">{p.description}</p>}
                {p.closes_at && <p className="text-xs text-aviva-secondary/70 mt-1">ปิด {new Date(p.closes_at).toLocaleDateString("th-TH")}</p>}
              </GlassCard>
            </Link>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">โพลใหม่</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {error && <div className="text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">{error}</div>}
            <Field label="หัวข้อ *">
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="เช่น เลือกสีทาบ้านชุดใหม่"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="รายละเอียด">
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="ปิดโหวต">
              <input type="datetime-local" value={form.closes_at} onChange={e => setForm({ ...form, closes_at: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-aviva-secondary">ตัวเลือก</p>
                <button onClick={() => setForm({ ...form, options: [...form.options, ""] })}
                  className="text-xs text-aviva-gold flex items-center gap-1"><Plus size={11} /> เพิ่ม</button>
              </div>
              <div className="space-y-2">
                {form.options.map((o, i) => (
                  <input key={i} type="text" value={o}
                    onChange={e => setForm({ ...form, options: form.options.map((x, j) => j === i ? e.target.value : x) })}
                    placeholder={`ตัวเลือก ${i + 1}`}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                ))}
              </div>
            </div>
            <button onClick={create} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังเผยแพร่…" : "เผยแพร่"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-aviva-secondary mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
