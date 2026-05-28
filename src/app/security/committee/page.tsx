"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Plus, X, Users } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Member { id: string; resident_id: string; role: string; term_start: string; term_end: string | null; is_active: boolean }
interface Resident { id: string; full_name: string }

const ROLES = [
  { v: "president", l: "ประธาน" },
  { v: "vice",      l: "รองประธาน" },
  { v: "secretary", l: "เลขานุการ" },
  { v: "treasurer", l: "เหรัญญิก" },
  { v: "member",    l: "กรรมการ" },
];

const empty = { resident_id: "", role: "member", term_start: new Date().toISOString().slice(0, 10), term_end: "" };

export default function CommitteePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      supabase.from("committee_members").select("*").order("term_start", { ascending: false }),
      supabase.from("residents").select("id, full_name").order("full_name"),
    ]).then(([m, r]) => {
      setMembers((m.data as Member[]) ?? []);
      setResidents((r.data as Resident[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const create = async () => {
    if (!form.resident_id || !form.term_start) return;
    setSaving(true);
    await supabase.from("committee_members").insert({
      resident_id: form.resident_id,
      role: form.role,
      term_start: form.term_start,
      term_end: form.term_end || null,
      is_active: true,
    });
    setSaving(false);
    setShowForm(false);
    setForm(empty);
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("committee_members").update({ is_active: !active }).eq("id", id);
    load();
  };

  const residentName = (id: string) => residents.find(r => r.id === id)?.full_name ?? "—";
  const roleLabel = (v: string) => ROLES.find(r => r.v === v)?.l ?? v;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/security/governance" aria-label="กลับ" className="p-2 -ml-2 text-aviva-secondary hover:text-aviva-gold">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-aviva-text">คณะกรรมการนิติฯ</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">{members.filter(m => m.is_active).length} active · {members.length} ทั้งหมด</p>
            </div>
          </div>
          <button onClick={() => { setForm(empty); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-2.5 rounded-xl">
            <Plus size={14} /> เพิ่ม
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <SectionHeader title="กรรมการ" subtitle="ตำแหน่งและวาระ" />
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : members.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Users size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีกรรมการ</p>
          </GlassCard>
        ) : (
          members.map(m => (
            <GlassCard key={m.id} className={clsx("p-4", !m.is_active && "opacity-60")}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-aviva-text">{residentName(m.resident_id)}</p>
                  <p className="text-xs text-aviva-gold">{roleLabel(m.role)}</p>
                  <p className="text-xs text-aviva-secondary mt-1">
                    {m.term_start}{m.term_end ? ` → ${m.term_end}` : " (active)"}
                  </p>
                </div>
                <button onClick={() => toggle(m.id, m.is_active)}
                  className={clsx("text-xs px-2.5 py-1 rounded-lg border",
                    m.is_active ? "bg-green-500/15 text-green-300 border-green-500/30" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                  )}>{m.is_active ? "active · ปิด" : "ปิด · เปิด"}</button>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เพิ่มกรรมการ</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <Field label="ลูกบ้าน *">
              <select value={form.resident_id} onChange={e => setForm({ ...form, resident_id: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none">
                <option value="">— เลือก —</option>
                {residents.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </Field>
            <Field label="ตำแหน่ง">
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none">
                {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="วันเริ่มวาระ *">
                <input type="date" value={form.term_start} onChange={e => setForm({ ...form, term_start: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none" />
              </Field>
              <Field label="สิ้นสุด">
                <input type="date" value={form.term_end} onChange={e => setForm({ ...form, term_end: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none" />
              </Field>
            </div>
            <button onClick={create} disabled={saving}
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
