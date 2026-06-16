"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Plus, Pin, X, AlertCircle } from "lucide-react";
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

const empty = { title: "", body_md: "", category: "general", pinned: false };
const CATEGORIES = [
  { v: "general", l: "ทั่วไป" },
  { v: "maintenance", l: "ซ่อมบำรุง" },
  { v: "event", l: "กิจกรรม" },
  { v: "urgent", l: "ด่วน" },
];

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    supabase.from("announcements").select("*")
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { setItems((data as Announcement[]) ?? []); setLoading(false); });
  };
  useEffect(load, []);

  const create = async () => {
    if (!form.title || !form.body_md) { setError("กรุณากรอกหัวข้อและเนื้อหา"); return; }
    setSaving(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      setForm(empty);
      setShowForm(false);
      load();
    } else {
      setError(json.error ?? `error ${res.status}`);
    }
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await supabase.from("announcements").update({ pinned: !pinned }).eq("id", id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("ลบประกาศนี้?")) return;
    await supabase.from("announcements").delete().eq("id", id);
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
            <div>
              <h1 className="text-xl font-bold text-aviva-text">จัดการประกาศ</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">{items.length} ประกาศ</p>
            </div>
          </div>
          <button onClick={() => { setForm(empty); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
            <Plus size={14} /> ใหม่
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="ประกาศทั้งหมด" subtitle="ปักหมุดด้านบนสุด" />
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : items.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <p className="text-aviva-secondary text-sm">ยังไม่มีประกาศ</p>
          </GlassCard>
        ) : (
          items.map(a => (
            <GlassCard key={a.id} className="p-4" gold={a.pinned}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Pin size={12} className="text-aviva-gold" />}
                    <p className="text-sm font-semibold text-aviva-text">{a.title}</p>
                  </div>
                  {a.body_md && <p className="text-xs text-aviva-secondary line-clamp-2 mt-1">{a.body_md}</p>}
                  <p className="text-xs text-aviva-secondary/70 mt-1">
                    {a.category} · {new Date(a.published_at).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => togglePin(a.id, a.pinned)}
                    className={clsx("text-xs px-2.5 py-1 rounded-lg border",
                      a.pinned ? "bg-aviva-gold/20 text-aviva-gold border-aviva-gold/40" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                    )}>{a.pinned ? "ถอน" : "ปักหมุด"}</button>
                  <button onClick={() => remove(a.id)}
                    className="text-xs px-2.5 py-1 rounded-lg border bg-red-500/10 text-red-300 border-red-500/30">ลบ</button>
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">ประกาศใหม่</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {error && (
              <div className="text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2">
                <AlertCircle size={12} /> {error}
              </div>
            )}
            <Field label="หัวข้อ *">
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="เช่น ตัดน้ำชั่วคราว 25 พ.ค."
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="เนื้อหา *">
              <textarea value={form.body_md} onChange={e => setForm({ ...form, body_md: e.target.value })}
                placeholder="รายละเอียดประกาศ" rows={6}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="หมวด">
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
              </Field>
              <Field label="ปักหมุด">
                <label className="flex items-center gap-2 px-3 py-3 rounded-xl border border-aviva-gold/20 bg-aviva-bg cursor-pointer">
                  <input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} />
                  <span className="text-sm text-aviva-text">ขึ้นบนสุด</span>
                </label>
              </Field>
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
