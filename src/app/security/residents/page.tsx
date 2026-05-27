"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Plus, X, Mail, Phone, Car, UserCheck } from "lucide-react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Resident {
  id: string;
  auth_user_id: string | null;
  member_id: string | null;
  full_name: string;
  phone: string | null;
  resident_type: string | null;
  created_at: string;
}

interface CommunityMember {
  member_id: string;
  owner_name: string;
  unit_no: string | null;
}

const emptyForm = { full_name: "", email: "", phone: "", member_id: "", resident_type: "owner" };

export default function SecurityResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = () => {
    Promise.all([
      supabase.from("residents").select("*").order("created_at", { ascending: false }),
      supabase.from("community_members").select("member_id, owner_name, unit_no").order("owner_name"),
    ]).then(([r, m]) => {
      setResidents((r.data as Resident[]) ?? []);
      setMembers((m.data as CommunityMember[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const handleInvite = async () => {
    if (!form.full_name || !form.email) return;
    setSubmitting(true);
    setFeedback(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/residents/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        member_id: form.member_id || null,
        resident_type: form.resident_type,
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setFeedback({ ok: true, msg: "ส่งคำเชิญทาง email แล้ว" });
      setForm(emptyForm);
      setShowInvite(false);
      load();
    } else {
      setFeedback({ ok: false, msg: json.error ?? "เกิดข้อผิดพลาด" });
    }
  };

  const memberLookup = new Map(members.map(m => [m.member_id, m]));

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/security" className="text-aviva-secondary hover:text-aviva-gold">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-aviva-text">ลูกบ้าน</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด…" : `${residents.length} คนในระบบ`}
              </p>
            </div>
          </div>
          <button onClick={() => { setForm(emptyForm); setFeedback(null); setShowInvite(true); }}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
            <Plus size={14} /> เชิญลูกบ้าน
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        {feedback && (
          <div className={`text-xs px-3 py-2 rounded-xl border ${
            feedback.ok ? "bg-green-500/10 border-green-500/30 text-green-300" : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}>{feedback.msg}</div>
        )}

        <SectionHeader title="ทะเบียนลูกบ้าน" subtitle="เชิญผ่าน email · ลูกบ้านจะได้ลิงก์ตั้งรหัสผ่าน" />

        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : residents.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <UserCheck size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีลูกบ้านในระบบ — เชิญคนแรกได้เลย</p>
          </GlassCard>
        ) : (
          residents.map(r => {
            const member = r.member_id ? memberLookup.get(r.member_id) : null;
            return (
              <GlassCard key={r.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-aviva-text">{r.full_name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-aviva-secondary">
                      {r.phone && <span className="flex items-center gap-1"><Phone size={11} />{r.phone}</span>}
                      {member && <span className="flex items-center gap-1"><Car size={11} />ยูนิต {member.unit_no ?? member.owner_name}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/30">
                    {r.resident_type ?? "owner"}
                  </span>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เชิญลูกบ้านใหม่</h2>
              <button onClick={() => setShowInvite(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <Field label="ชื่อ-นามสกุล *">
                <input type="text" value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="คุณสมชาย ใจดี"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </Field>
              <Field label="Email *">
                <div className="relative">
                  <Mail size={14} className="absolute top-1/2 -translate-y-1/2 left-3 text-aviva-secondary/60" />
                  <input type="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="resident@example.com"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl pl-9 pr-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </Field>
              <Field label="เบอร์โทร">
                <input type="tel" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="0XX-XXX-XXXX"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </Field>
              <Field label="ยูนิต / สมาชิกนิติฯ">
                <select value={form.member_id}
                  onChange={e => setForm({ ...form, member_id: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  <option value="">— ไม่ระบุ —</option>
                  {members.map(m => (
                    <option key={m.member_id} value={m.member_id}>
                      {m.owner_name}{m.unit_no ? ` · ${m.unit_no}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ประเภท">
                <select value={form.resident_type}
                  onChange={e => setForm({ ...form, resident_type: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  <option value="owner">เจ้าของบ้าน</option>
                  <option value="tenant">ผู้เช่า</option>
                  <option value="family">สมาชิกครอบครัว</option>
                </select>
              </Field>
            </div>
            <button onClick={handleInvite} disabled={submitting || !form.full_name || !form.email}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {submitting ? "กำลังเชิญ…" : "ส่งคำเชิญ"}
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
