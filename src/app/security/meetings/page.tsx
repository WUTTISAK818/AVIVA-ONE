"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Plus, X, Gavel, AlertCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Meeting {
  id: string;
  meeting_type: string;
  title: string;
  scheduled_at: string;
  location: string | null;
  status: string;
  notice_sent_at: string | null;
}

const TYPE_TH: Record<string, string> = { AGM: "ประชุมใหญ่สามัญ", EGM: "วิสามัญ", committee: "กรรมการ" };
const STATUS_TH: Record<string, { l: string; c: string }> = {
  scheduled:   { l: "กำหนดแล้ว", c: "bg-aviva-gold/15 text-aviva-gold border-aviva-gold/30" },
  in_progress: { l: "กำลังประชุม", c: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  closed:      { l: "ปิด",        c: "bg-aviva-card text-aviva-secondary border-aviva-gold/10" },
  cancelled:   { l: "ยกเลิก",     c: "bg-red-500/15 text-red-300 border-red-500/30" },
};
const empty = { meeting_type: "AGM", title: "", scheduled_at: "", location: "" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminMeetingsPage() {
  const [items, setItems] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    supabase.from("meetings").select("*").order("scheduled_at", { ascending: false }).limit(50)
      .then(({ data }) => { setItems((data as Meeting[]) ?? []); setLoading(false); });
  };
  useEffect(load, []);

  const create = async () => {
    if (!form.title || !form.scheduled_at) { setError("กรุณาระบุหัวข้อและเวลา"); return; }
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: insErr } = await supabase.from("meetings").insert({
      meeting_type: form.meeting_type,
      title: form.title,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      location: form.location || null,
      status: "scheduled",
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (insErr) { setError(insErr.message); return; }
    setForm(empty);
    setShowForm(false);
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
              <h1 className="text-xl font-bold text-aviva-text">ประชุมนิติฯ</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">{items.length} ประชุม</p>
            </div>
          </div>
          <button onClick={() => { setForm(empty); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
            <Plus size={14} /> นัดประชุม
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="รายการ" />
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : items.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Gavel size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีประชุม</p>
          </GlassCard>
        ) : (
          items.map(m => {
            const st = STATUS_TH[m.status] ?? STATUS_TH.scheduled;
            return (
              <GlassCard key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-aviva-gold/80 font-medium">{TYPE_TH[m.meeting_type] ?? m.meeting_type}</p>
                    <p className="text-sm font-semibold text-aviva-text">{m.title}</p>
                    <p className="text-xs text-aviva-secondary mt-0.5">{fmt(m.scheduled_at)} · {m.location ?? "—"}</p>
                  </div>
                  <span className={clsx("text-xs px-2.5 py-1 rounded-full border", st.c)}>{st.l}</span>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">นัดประชุมใหม่</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {error && (
              <div className="text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2">
                <AlertCircle size={12} /> {error}
              </div>
            )}
            <Field label="ประเภท">
              <select value={form.meeting_type} onChange={e => setForm({ ...form, meeting_type: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none">
                <option value="AGM">ประชุมใหญ่สามัญ (AGM)</option>
                <option value="EGM">ประชุมใหญ่วิสามัญ (EGM)</option>
                <option value="committee">ประชุมคณะกรรมการ</option>
              </select>
            </Field>
            <Field label="หัวข้อ *">
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="หัวข้อประชุม"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="วันเวลา *">
              <input type="datetime-local" value={form.scheduled_at}
                onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="สถานที่">
              <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="เช่น คลับเฮ้าส์"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <button onClick={create} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก…" : "นัดประชุม"}
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
