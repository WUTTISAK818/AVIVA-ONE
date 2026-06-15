"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, AlertCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

const CATEGORIES = ["รบกวน/เสียงดัง", "ลักทรัพย์", "อุบัติเหตุ", "บุกรุก", "อื่นๆ"];

export default function NewIncidentPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    category: "อื่นๆ", severity: "low", title: "", description: "", location_note: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!form.title) { setError("กรุณาระบุหัวข้อ"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("กรุณาเข้าสู่ระบบ"); setBusy(false); return; }

    const photoUrls: string[] = [];
    for (const f of files) {
      const path = `${user.id}/${Date.now()}-${f.name}`;
      const { error: upErr } = await supabase.storage.from("aviva-incidents").upload(path, f, { cacheControl: "3600" });
      if (upErr) { setError(upErr.message); setBusy(false); return; }
      photoUrls.push(supabase.storage.from("aviva-incidents").getPublicUrl(path).data.publicUrl);
    }

    const { error: insErr } = await supabase.from("incidents").insert({
      reported_by: user.id,
      category: form.category,
      severity: form.severity,
      title: form.title,
      description: form.description || null,
      location_note: form.location_note || null,
      photo_urls: photoUrls.length ? photoUrls : null,
      status: "open",
    });
    setBusy(false);
    if (insErr) { setError(insErr.message); return; }
    router.push("/guard/incidents");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 -ml-2">
        <Link href="/guard/incidents" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-aviva-text">แจ้งเหตุการณ์ใหม่</h1>
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300 flex items-center gap-2">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <GlassCard className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="หมวด">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="ระดับความรุนแรง">
            <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
              <option value="low">ต่ำ</option>
              <option value="med">กลาง</option>
              <option value="high">สูง</option>
            </select>
          </Field>
        </div>
        <Field label="หัวข้อ *">
          <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="เช่น พบรถจอดผิดที่"
            className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
        </Field>
        <Field label="รายละเอียด">
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="อธิบายเหตุ + เวลา + พยาน (ถ้ามี)"
            rows={6}
            className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
        </Field>
        <Field label="สถานที่">
          <input type="text" value={form.location_note} onChange={e => setForm({ ...form, location_note: e.target.value })}
            placeholder="เช่น ลานจอดบ้าน B12/03"
            className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
        </Field>
        <Field label="ภาพถ่าย">
          <label className="flex items-center gap-2 text-sm px-4 py-3.5 rounded-xl border border-aviva-gold/20 bg-aviva-bg cursor-pointer">
            <Camera size={18} className="text-aviva-gold" />
            <span className="flex-1 text-aviva-text">{files.length ? `เลือก ${files.length} รูป` : "เลือกไฟล์หรือถ่ายเลย"}</span>
            <input type="file" accept="image/*" capture="environment" multiple className="hidden"
              onChange={e => setFiles(Array.from(e.target.files ?? []))} />
          </label>
        </Field>
      </GlassCard>

      <button onClick={submit} disabled={busy}
        className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
        {busy ? "กำลังบันทึก…" : "บันทึก + ส่งให้นิติฯ"}
      </button>
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
