"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import QRCodeDisplay from "@/components/security/QRCodeDisplay";
import { supabase } from "@/lib/supabase";

interface Resident { id: string; full_name: string }

export default function GuardWalkInPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [form, setForm] = useState({
    visitor_name: "", visitor_phone: "", license_plate: "", purpose: "",
    host_resident_id: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ qr_token: string; pass_id: string } | null>(null);

  useEffect(() => {
    supabase.from("residents").select("id, full_name").order("full_name").then(({ data }) => {
      setResidents((data as Resident[]) ?? []);
    });
  }, []);

  const submit = async () => {
    setError(null);
    if (!form.visitor_name || !form.host_resident_id) {
      setError("กรุณาระบุชื่อผู้มาเยือนและเลือกเจ้าบ้าน");
      return;
    }
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 6 * 3600 * 1000);
    const res = await fetch("/api/visitor-passes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({
        host_resident_id: form.host_resident_id,
        visitor_name: form.visitor_name,
        visitor_phone: form.visitor_phone || null,
        license_plate: form.license_plate || null,
        purpose: form.purpose || null,
        expected_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.ok && json.qr_token) {
      setResult({ qr_token: json.qr_token, pass_id: json.pass_id });
    } else {
      setError(json.error ?? `error ${res.status}`);
    }
  };

  const checkIn = async () => {
    if (!result) return;
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`/api/visitor-passes/${result.pass_id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({}),
    });
    setBusy(false);
    setResult(null);
    setForm({ visitor_name: "", visitor_phone: "", license_plate: "", purpose: "", host_resident_id: "" });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 -ml-2">
        <Link href="/guard" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-aviva-text">Walk-in</h1>
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300 flex items-center gap-2">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {result ? (
        <GlassCard className="p-6 text-center space-y-4">
          <div className="inline-block">
            <QRCodeDisplay value={result.qr_token} size={280} caption={`#${result.qr_token.slice(0, 8)}`} />
          </div>
          <p className="text-sm text-aviva-text">บัตรผ่านพร้อมแล้ว · เก็บ token ไว้สำหรับติดตาม</p>
          <div className="flex gap-2 justify-center">
            <button onClick={checkIn} disabled={busy}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg font-bold px-4 py-2.5 rounded-xl text-sm disabled:opacity-50">
              <CheckCircle size={14} /> เช็คอินเลย
            </button>
            <button onClick={() => setResult(null)}
              className="text-aviva-secondary text-sm px-3 py-2.5 rounded-xl border border-aviva-gold/30 hover:bg-aviva-card">
              สร้างบัตรอื่น
            </button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="p-5 space-y-4">
          <Field label="เจ้าบ้าน *">
            <select value={form.host_resident_id} onChange={e => setForm({ ...form, host_resident_id: e.target.value })}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
              <option value="">— เลือก —</option>
              {residents.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
          </Field>
          <Field label="ชื่อผู้มาเยือน *">
            <input type="text" value={form.visitor_name} onChange={e => setForm({ ...form, visitor_name: e.target.value })}
              placeholder="คุณ..."
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="เบอร์โทร">
              <input type="tel" value={form.visitor_phone} onChange={e => setForm({ ...form, visitor_phone: e.target.value })}
                placeholder="0XX-XXX-XXXX"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="ทะเบียนรถ">
              <input type="text" value={form.license_plate} onChange={e => setForm({ ...form, license_plate: e.target.value })}
                placeholder="กข 1234"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60 font-mono" />
            </Field>
          </div>
          <Field label="วัตถุประสงค์">
            <input type="text" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}
              placeholder="เช่น เยี่ยมญาติ"
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
          </Field>
          <button onClick={submit} disabled={busy}
            className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
            {busy ? "กำลังสร้าง…" : "ออกบัตรผ่าน"}
          </button>
        </GlassCard>
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
