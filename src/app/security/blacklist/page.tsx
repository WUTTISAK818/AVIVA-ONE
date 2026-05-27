"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, X, Ban } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface BlacklistRow {
  id: string;
  license_plate: string | null;
  person_name: string | null;
  reason: string | null;
  active: boolean;
  added_at: string;
}

const empty = { license_plate: "", person_name: "", reason: "" };

export default function BlacklistPage() {
  const [rows, setRows] = useState<BlacklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    supabase.from("blacklist").select("*").order("added_at", { ascending: false }).then(({ data }) => {
      setRows((data as BlacklistRow[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const add = async () => {
    if (!form.license_plate && !form.person_name) {
      setError("ระบุทะเบียนหรือชื่อบุคคลอย่างน้อย 1 อย่าง");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insErr } = await supabase.from("blacklist").insert({
      license_plate: form.license_plate || null,
      person_name: form.person_name || null,
      reason: form.reason || null,
      active: true,
    });
    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setForm(empty);
    setShowForm(false);
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("blacklist").update({ active: !active }).eq("id", id);
    load();
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/security" className="text-aviva-secondary hover:text-aviva-gold">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-aviva-text">แบล็คลิสต์</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">{rows.length} รายการ</p>
            </div>
          </div>
          <button onClick={() => { setForm(empty); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
            <Plus size={14} /> เพิ่ม
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="รายการบล็อก" subtitle="ระบบจะ deny อัตโนมัติเมื่อกล้องจับเจอ" />

        {loading ? (
          [1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : rows.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Ban size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีรายการบล็อก</p>
          </GlassCard>
        ) : (
          rows.map(r => (
            <GlassCard key={r.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-aviva-text font-mono">{r.license_plate ?? r.person_name ?? "—"}</p>
                  {r.person_name && r.license_plate && (
                    <p className="text-xs text-aviva-secondary">{r.person_name}</p>
                  )}
                  {r.reason && <p className="text-xs text-aviva-secondary/80 mt-1">{r.reason}</p>}
                </div>
                <button onClick={() => toggle(r.id, r.active)}
                  className={`text-[10px] px-2 py-1 rounded-lg border ${
                    r.active
                      ? "bg-red-500/15 text-red-300 border-red-500/30"
                      : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                  }`}>
                  {r.active ? "กำลังบล็อก · ปิด" : "ปิดอยู่ · เปิด"}
                </button>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เพิ่มรายการบล็อก</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {error && <div className="text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">{error}</div>}
            <Field label="ทะเบียนรถ">
              <input type="text" value={form.license_plate}
                onChange={e => setForm({ ...form, license_plate: e.target.value })}
                placeholder="กข 1234"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60 font-mono" />
            </Field>
            <Field label="ชื่อบุคคล">
              <input type="text" value={form.person_name}
                onChange={e => setForm({ ...form, person_name: e.target.value })}
                placeholder="ชื่อ-นามสกุล"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="เหตุผล">
              <input type="text" value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                placeholder="เช่น คดีลักทรัพย์, หมายห้ามเข้า"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <button onClick={add} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก…" : "บันทึก"}
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
      <label className="text-xs text-aviva-secondary mb-1 block">{label}</label>
      {children}
    </div>
  );
}
