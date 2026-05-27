"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Plus, X, Package, Camera, AlertCircle, CheckCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Parcel {
  id: string;
  resident_id: string;
  tracking_no: string | null;
  courier: string | null;
  received_at: string;
  picked_up_at: string | null;
  picked_up_by_name: string | null;
  photo_url: string | null;
}
interface Resident { id: string; full_name: string }

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const emptyForm = { resident_id: "", courier: "", tracking_no: "", photoFile: null as File | null };

export default function GuardParcelsPage() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickupOpen, setPickupOpen] = useState<string | null>(null);
  const [pickupBy, setPickupBy] = useState("");

  const load = () => {
    Promise.all([
      supabase.from("parcels").select("*").order("received_at", { ascending: false }).limit(80),
      supabase.from("residents").select("id, full_name").order("full_name"),
    ]).then(([p, r]) => {
      setParcels((p.data as Parcel[]) ?? []);
      setResidents((r.data as Resident[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const visible = parcels.filter(p => tab === "all" || !p.picked_up_at);
  const resName = (id: string) => residents.find(r => r.id === id)?.full_name ?? id.slice(0, 8);

  const log = async () => {
    if (!form.resident_id) { setError("กรุณาเลือกลูกบ้าน"); return; }
    setSaving(true);
    setError(null);

    let photoUrl: string | null = null;
    if (form.photoFile) {
      const path = `${form.resident_id}/${Date.now()}-${form.photoFile.name}`;
      const { error: upErr } = await supabase.storage.from("aviva-parcels").upload(path, form.photoFile, { cacheControl: "3600" });
      if (upErr) { setError(upErr.message); setSaving(false); return; }
      photoUrl = supabase.storage.from("aviva-parcels").getPublicUrl(path).data.publicUrl;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error: insErr } = await supabase.from("parcels").insert({
      resident_id: form.resident_id,
      courier: form.courier || null,
      tracking_no: form.tracking_no || null,
      photo_url: photoUrl,
      received_by: user?.id ?? null,
    }).select("id").single();
    if (insErr || !inserted) { setError(insErr?.message ?? "ไม่สำเร็จ"); setSaving(false); return; }

    await supabase.from("notifications").insert({
      type: "info",
      title: "มีพัสดุใหม่",
      message: `${resName(form.resident_id)} · ${form.courier || "พัสดุ"}`,
      record_id: inserted.id,
    });

    await supabase.from("parcels").update({ notification_sent_at: new Date().toISOString() }).eq("id", inserted.id);

    setSaving(false);
    setForm(emptyForm);
    setShowForm(false);
    load();
  };

  const pickup = async (id: string) => {
    if (!pickupBy) return;
    await supabase.from("parcels").update({
      picked_up_at: new Date().toISOString(),
      picked_up_by_name: pickupBy,
    }).eq("id", id);
    setPickupOpen(null);
    setPickupBy("");
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-aviva-text">พัสดุ</h1>
          <p className="text-sm text-aviva-secondary mt-1">รับเข้านิติฯ · ส่งคืนเจ้าของ</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
          <Plus size={14} /> ลงพัสดุใหม่
        </button>
      </div>

      <div className="flex gap-2">
        {([{ k: "pending" as const, l: "รอรับ" }, { k: "all" as const, l: "ทั้งหมด" }]).map(({ k, l }) => (
          <button key={k} onClick={() => setTab(k)}
            className={clsx("py-2 px-4 rounded-xl text-xs font-medium border",
              tab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
            )}>{l}</button>
        ))}
      </div>

      <SectionHeader title="รายการพัสดุ" subtitle={`${visible.length} รายการ`} />

      {loading ? (
        [1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />)
      ) : visible.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Package size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
          <p className="text-aviva-secondary text-sm">ไม่มีพัสดุค้าง</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {visible.map(p => {
            const picked = !!p.picked_up_at;
            return (
              <GlassCard key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  {p.photo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.photo_url} alt="parcel" className="w-16 h-16 rounded-xl object-cover border border-aviva-gold/20" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-aviva-bg flex items-center justify-center border border-aviva-gold/10">
                      <Package size={20} className="text-aviva-secondary/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-aviva-text">{resName(p.resident_id)}</p>
                    <p className="text-xs text-aviva-secondary">
                      {p.courier ?? "พัสดุ"}{p.tracking_no ? ` · ${p.tracking_no}` : ""}
                    </p>
                    <p className="text-[11px] text-aviva-secondary/70 mt-0.5">
                      รับเข้า {fmt(p.received_at)}{picked ? ` · ส่งให้ ${p.picked_up_by_name} ${fmt(p.picked_up_at)}` : ""}
                    </p>
                  </div>
                  {!picked && (
                    <button onClick={() => { setPickupOpen(p.id); setPickupBy(""); }}
                      className="text-[11px] flex items-center gap-1 bg-aviva-gold text-aviva-bg font-bold px-3 py-1.5 rounded-lg">
                      <CheckCircle size={11} /> ส่งคืน
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">ลงพัสดุใหม่</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            {error && (
              <div className="text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2">
                <AlertCircle size={12} /> {error}
              </div>
            )}
            <Field label="ลูกบ้าน *">
              <select value={form.resident_id} onChange={e => setForm({ ...form, resident_id: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                <option value="">— เลือก —</option>
                {residents.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ขนส่ง">
                <input type="text" value={form.courier} onChange={e => setForm({ ...form, courier: e.target.value })}
                  placeholder="เช่น Kerry"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </Field>
              <Field label="Tracking">
                <input type="text" value={form.tracking_no} onChange={e => setForm({ ...form, tracking_no: e.target.value })}
                  placeholder="TH123456"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </Field>
            </div>
            <Field label="รูปพัสดุ (ถ่ายเลย)">
              <label className="flex items-center gap-2 text-xs px-3 py-3 rounded-xl border border-aviva-gold/20 bg-aviva-bg cursor-pointer">
                <Camera size={14} className="text-aviva-gold" />
                <span className="flex-1 text-aviva-text">{form.photoFile ? form.photoFile.name : "เลือก/ถ่ายรูป"}</span>
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => setForm({ ...form, photoFile: e.target.files?.[0] ?? null })} />
              </label>
            </Field>
            <button onClick={log} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก…" : "บันทึกพัสดุ + แจ้งลูกบ้าน"}
            </button>
          </div>
        </div>
      )}

      {pickupOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <h2 className="text-lg font-bold text-aviva-text">ส่งคืนพัสดุ</h2>
            <Field label="ผู้รับ (ชื่อ-นามสกุล) *">
              <input type="text" value={pickupBy} onChange={e => setPickupBy(e.target.value)}
                placeholder="ผู้มารับ"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <div className="flex gap-2">
              <button onClick={() => setPickupOpen(null)}
                className="flex-1 bg-aviva-card border border-aviva-gold/30 text-aviva-text font-medium py-3 rounded-2xl text-sm">ยกเลิก</button>
              <button onClick={() => pickup(pickupOpen)} disabled={!pickupBy}
                className="flex-1 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm disabled:opacity-50">บันทึก</button>
            </div>
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
