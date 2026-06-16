"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

function localIsoNow(offsetHours = 0) {
  const d = new Date(Date.now() + offsetHours * 3600 * 1000);
  // datetime-local needs YYYY-MM-DDTHH:mm in local time
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export default function NewVisitorPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    visitor_name: "",
    visitor_phone: "",
    license_plate: "",
    purpose: "",
    expected_at: localIsoNow(1),
    expires_at: localIsoNow(7),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!form.visitor_name || !form.expected_at) {
      setError("กรุณากรอกชื่อและเวลานัด");
      return;
    }
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/visitor-passes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        visitor_name: form.visitor_name,
        visitor_phone: form.visitor_phone || null,
        license_plate: form.license_plate || null,
        purpose: form.purpose || null,
        expected_at: new Date(form.expected_at).toISOString(),
        expires_at: new Date(form.expires_at).toISOString(),
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (res.ok && json.qr_token) {
      router.push(`/v/${json.qr_token}?fresh=1`);
    } else {
      setError(json.error ?? "เกิดข้อผิดพลาด");
    }
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-1 -ml-2">
          <Link href="/community/visitors" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">ลงทะเบียนผู้มาเยือน</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">ระบบจะออก QR ส่งให้แชร์</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {error && (
          <div className="text-sm px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300">{error}</div>
        )}

        <GlassCard className="p-5 space-y-4">
          <Field label="ชื่อผู้มาเยือน *">
            <input type="text" value={form.visitor_name}
              onChange={e => setForm({ ...form, visitor_name: e.target.value })}
              placeholder="คุณ..."
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
          </Field>
          <Field label="เบอร์โทร">
            <input type="tel" value={form.visitor_phone}
              onChange={e => setForm({ ...form, visitor_phone: e.target.value })}
              placeholder="0XX-XXX-XXXX"
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
          </Field>
          <Field label="ทะเบียนรถ (ถ้ามี)">
            <input type="text" value={form.license_plate}
              onChange={e => setForm({ ...form, license_plate: e.target.value })}
              placeholder="กข 1234"
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            <p className="text-xs text-aviva-secondary/70 mt-1">ใส่ทะเบียนเพื่อให้กล้อง ALPR เปิดประตูให้อัตโนมัติ</p>
          </Field>
          <Field label="วัตถุประสงค์">
            <input type="text" value={form.purpose}
              onChange={e => setForm({ ...form, purpose: e.target.value })}
              placeholder="มาเยี่ยม / ส่งของ / นัดธุระ"
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="เวลานัดมาถึง *">
              <input type="datetime-local" value={form.expected_at}
                onChange={e => setForm({ ...form, expected_at: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
            <Field label="หมดอายุ *">
              <input type="datetime-local" value={form.expires_at}
                onChange={e => setForm({ ...form, expires_at: e.target.value })}
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
            </Field>
          </div>
        </GlassCard>

        <button onClick={onSubmit} disabled={submitting}
          className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
          {submitting ? "กำลังออก QR…" : "สร้างบัตรผ่าน"}
        </button>
      </div>
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
