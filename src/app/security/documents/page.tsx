"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, X, FileText, Upload } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Doc {
  id: string;
  category: string;
  title: string;
  description: string | null;
  doc_url: string;
  version: string | null;
  published_at: string;
  is_public: boolean;
}

const CATEGORIES = [
  { v: "regulation",       l: "ข้อบังคับ" },
  { v: "bylaw",            l: "กฎหมาย/ระเบียบ" },
  { v: "contract",         l: "สัญญา" },
  { v: "minutes",          l: "รายงานประชุม" },
  { v: "financial_report", l: "รายงานการเงิน" },
];

const empty = { category: "regulation", title: "", description: "", version: "", is_public: true };

export default function DocumentsPage() {
  const [items, setItems] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    supabase.from("juristic_documents").select("*").order("published_at", { ascending: false })
      .then(({ data }) => { setItems((data as Doc[]) ?? []); setLoading(false); });
  };
  useEffect(load, []);

  const upload = async () => {
    if (!form.title || !file) { setError("กรุณาระบุชื่อและเลือกไฟล์"); return; }
    setUploading(true);
    setError(null);

    const path = `docs/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("aviva-incidents").upload(path, file, { cacheControl: "3600" });
    if (upErr) { setError(upErr.message); setUploading(false); return; }
    const url = supabase.storage.from("aviva-incidents").getPublicUrl(path).data.publicUrl;

    const { data: { user } } = await supabase.auth.getUser();
    const { error: insErr } = await supabase.from("juristic_documents").insert({
      title: form.title,
      description: form.description || null,
      category: form.category,
      version: form.version || null,
      doc_url: url,
      is_public: form.is_public,
      uploaded_by: user?.id ?? null,
    });
    setUploading(false);
    if (insErr) { setError(insErr.message); return; }
    setForm(empty);
    setFile(null);
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
              <h1 className="text-xl font-bold text-aviva-text">คลังเอกสาร</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">{items.length} เอกสาร</p>
            </div>
          </div>
          <button onClick={() => { setForm(empty); setFile(null); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
            <Plus size={14} /> อัปโหลด
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="เอกสารทั้งหมด" />
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : items.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <FileText size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีเอกสาร</p>
          </GlassCard>
        ) : (
          items.map(d => (
            <a key={d.id} href={d.doc_url} target="_blank" rel="noreferrer">
              <GlassCard className="p-4 active:scale-[0.98]">
                <div className="flex items-start gap-3">
                  <FileText size={18} className="text-aviva-gold" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-aviva-text">{d.title}</p>
                    {d.description && <p className="text-xs text-aviva-secondary line-clamp-1">{d.description}</p>}
                    <p className="text-xs text-aviva-secondary/70 mt-0.5">
                      {CATEGORIES.find(c => c.v === d.category)?.l ?? d.category}
                      {d.version ? ` · v${d.version}` : ""}
                      {d.is_public ? " · เปิดให้ลูกบ้านดู" : " · ภายในเท่านั้น"}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </a>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">อัปโหลดเอกสาร</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {error && <div className="text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">{error}</div>}
            <Field label="หมวด">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none">
                {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </Field>
            <Field label="ชื่อเอกสาร *">
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="ระเบียบนิติฯ 2568"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="รายละเอียด">
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="ไฟล์ (PDF/รูปภาพ) *">
              <label className="flex items-center gap-2 text-xs px-3 py-3 rounded-xl border border-aviva-gold/20 bg-aviva-bg cursor-pointer">
                <Upload size={14} className="text-aviva-gold" />
                <span className="flex-1 text-aviva-text">{file ? file.name : "เลือกไฟล์"}</span>
                <input type="file" accept="application/pdf,image/*" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </Field>
            <label className="flex items-center gap-2 text-xs text-aviva-text">
              <input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} />
              เปิดให้ลูกบ้านดูได้
            </label>
            <button onClick={upload} disabled={uploading}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {uploading ? "กำลังอัปโหลด…" : "อัปโหลด"}
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
