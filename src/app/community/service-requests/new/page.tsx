"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

const CATEGORIES = [
  "ไฟฟ้า", "ประปา", "ส่วนกลาง", "ความปลอดภัย", "ขยะ/ทำความสะอาด", "อื่นๆ",
];

export default function NewServiceRequestPage() {
  const router = useRouter();
  const [form, setForm] = useState({ category: "อื่นๆ", title: "", description: "", priority: "med" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!form.title) { setError("กรุณาระบุหัวข้อ"); return; }
    setBusy(true);
    // Look up own resident id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("กรุณาเข้าสู่ระบบ"); setBusy(false); return; }
    const { data: resident } = await supabase.from("residents").select("id").eq("auth_user_id", user.id).maybeSingle();
    if (!resident) { setError("ไม่พบข้อมูลลูกบ้าน"); setBusy(false); return; }

    const { error: insErr } = await supabase.from("service_requests").insert({
      resident_id: resident.id,
      category: form.category,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      status: "new",
    });
    setBusy(false);
    if (insErr) { setError(insErr.message); return; }
    router.push("/community/service-requests");
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-1 -ml-2">
          <Link href="/community/service-requests" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-aviva-text">แจ้งซ่อมใหม่</h1>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {error && (
          <div className="text-sm px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300">{error}</div>
        )}
        <GlassCard className="p-5 space-y-4">
          <Field label="หมวด">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="หัวข้อ *">
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="เช่น ไฟทางเดินดับ"
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
          </Field>
          <Field label="รายละเอียด">
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="อธิบายปัญหา / สถานที่ / เวลา"
              rows={4}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
          </Field>
          <Field label="ระดับความเร่งด่วน">
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
              <option value="low">ไม่เร่ง</option>
              <option value="med">ปกติ</option>
              <option value="high">เร่งด่วน</option>
            </select>
          </Field>
        </GlassCard>
        <button onClick={submit} disabled={busy}
          className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
          {busy ? "กำลังส่ง…" : "ส่งคำร้อง"}
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
