"use client";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

const OA_ID = process.env.NEXT_PUBLIC_LINE_OA_ID;

export default function LineLinkCard() {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function getCode() {
    setBusy(true); setErr(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setBusy(false); setErr("กรุณาเข้าสู่ระบบใหม่"); return; }
    const res = await fetch("/api/line/link-code", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.code) setCode(j.code);
    else setErr(j.error ?? "ขอรหัสไม่สำเร็จ");
  }

  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-3 mb-2">
        <MessageCircle size={18} className="text-green-400" />
        <div className="text-sm font-medium text-aviva-text">ผูกบัญชี LINE เพื่อรับแจ้งเตือน</div>
      </div>
      {!code ? (
        <button onClick={getCode} disabled={busy}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 disabled:opacity-50">
          {busy ? "กำลังขอรหัส..." : "ขอรหัสผูกบัญชี"}
        </button>
      ) : (
        <div className="text-sm text-aviva-secondary">
          1. แอดเพื่อน LINE OA {OA_ID ? <span className="text-aviva-gold">{OA_ID}</span> : "ของบริษัท"}<br />
          2. พิมพ์รหัสนี้ในแชต: <span className="text-aviva-gold font-bold tracking-widest text-base">{code}</span>
        </div>
      )}
      {err && <div className="mt-2 text-xs text-red-400">{err}</div>}
    </GlassCard>
  );
}
