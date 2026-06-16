"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Plus, X, Building, Phone } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Vendor {
  id: string; name: string; service_type: string | null;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  tax_id: string | null; notes: string | null; is_active: boolean;
}
const empty = { name: "", service_type: "", contact_name: "", contact_phone: "", contact_email: "", tax_id: "", notes: "" };

export default function VendorsPage() {
  const [items, setItems] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => {
    supabase.from("vendors").select("*").order("name").then(({ data }) => {
      setItems((data as Vendor[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const create = async () => {
    if (!form.name) return;
    setSaving(true);
    await supabase.from("vendors").insert({
      ...form,
      service_type: form.service_type || null,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      tax_id: form.tax_id || null,
      notes: form.notes || null,
      is_active: true,
    });
    setSaving(false);
    setShowForm(false);
    setForm(empty);
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("vendors").update({ is_active: !active }).eq("id", id);
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
              <h1 className="text-xl font-bold text-aviva-text">ผู้รับเหมา / Vendor</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">{items.length} รายชื่อ</p>
            </div>
          </div>
          <button onClick={() => { setForm(empty); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
            <Plus size={14} /> เพิ่ม
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="ทะเบียน Vendor" />
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : items.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Building size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มี vendor</p>
          </GlassCard>
        ) : (
          items.map(v => (
            <GlassCard key={v.id} className={clsx("p-4", !v.is_active && "opacity-60")}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-aviva-text">{v.name}</p>
                  {v.service_type && <p className="text-xs text-aviva-gold">{v.service_type}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-aviva-secondary">
                    {v.contact_name && <span>{v.contact_name}</span>}
                    {v.contact_phone && <span className="flex items-center gap-1"><Phone size={10} />{v.contact_phone}</span>}
                  </div>
                  {v.notes && <p className="text-xs text-aviva-secondary/80 mt-1">{v.notes}</p>}
                </div>
                <button onClick={() => toggle(v.id, v.is_active)}
                  className={clsx("text-xs px-2.5 py-1 rounded-lg border",
                    v.is_active ? "bg-green-500/15 text-green-300 border-green-500/30" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                  )}>{v.is_active ? "active" : "ปิด"}</button>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เพิ่ม Vendor</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <Field label="ชื่อบริษัท/บุคคล *">
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none" />
            </Field>
            <Field label="ประเภทบริการ">
              <input type="text" value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}
                placeholder="เช่น ไฟฟ้า / ทำความสะอาด / ลิฟต์"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ผู้ติดต่อ">
                <input type="text" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none" />
              </Field>
              <Field label="โทร">
                <input type="tel" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none" />
              </Field>
            </div>
            <Field label="Email">
              <input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none" />
            </Field>
            <Field label="เลขผู้เสียภาษี">
              <input type="text" value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none font-mono" />
            </Field>
            <Field label="หมายเหตุ">
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none" />
            </Field>
            <button onClick={create} disabled={saving || !form.name}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก…" : "เพิ่ม"}
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
