"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Camera, LogIn, LogOut, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import QrCameraScanner from "@/components/security/QrCameraScanner";
import { supabase } from "@/lib/supabase";

interface PassRow {
  id: string;
  qr_token: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  visitors: {
    visitor_name: string;
    license_plate: string | null;
    expected_at: string;
    expires_at: string;
    purpose: string | null;
    residents: { full_name: string } | null;
  } | null;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

export default function GuardQueuePage() {
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  const load = useCallback(() => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    supabase
      .from("visitor_passes")
      .select("id, qr_token, status, checked_in_at, checked_out_at, visitors:visitor_id(visitor_name, license_plate, expected_at, expires_at, purpose, residents:host_resident_id(full_name))")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setPasses((data as unknown as PassRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  const callApi = async (path: string) => {
    setBusy(true);
    setFeedback(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setFeedback({ ok: true, msg: "สำเร็จ" });
      load();
      return true;
    } else {
      setFeedback({ ok: false, msg: json.error ?? `error ${res.status}` });
      return false;
    }
  };

  const verify = (idOrToken: string) => callApi(`/api/visitor-passes/${encodeURIComponent(idOrToken)}/verify`);
  const checkout = (idOrToken: string) => callApi(`/api/visitor-passes/${encodeURIComponent(idOrToken)}/checkout`);

  const onPasteVerify = async () => {
    if (!token.trim()) return;
    const ok = await verify(token.trim());
    if (ok) setToken("");
  };

  const onScan = async (text: string) => {
    setScanOpen(false);
    // Accept either a raw token or the full URL /v/<token>
    const m = text.match(/\/v\/([^?#/]+)/);
    const t = m ? m[1] : text.trim();
    setToken(t);
    await verify(t);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-aviva-text">คิวผู้มาเยือน</h1>
        <p className="text-sm text-aviva-secondary mt-1">สแกน QR หรือวาง token เพื่อเช็คอิน-เช็คเอ้าท์</p>
      </div>

      <GlassCard className="p-4 space-y-3">
        <div className="flex gap-2">
          <input type="text" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="วาง token หรือ URL"
            className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60 font-mono" />
          <button onClick={onPasteVerify} disabled={busy || !token}
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-sm font-bold px-4 py-3 rounded-xl disabled:opacity-50">
            <LogIn size={14} /> เช็คอิน
          </button>
          <button onClick={() => setScanOpen(true)}
            className="flex items-center gap-1.5 bg-aviva-card border border-aviva-gold/30 text-aviva-gold text-sm font-bold px-4 py-3 rounded-xl">
            <Camera size={14} />
          </button>
        </div>
        {feedback && (
          <div className={clsx("text-xs px-3 py-2 rounded-lg flex items-center gap-1.5",
            feedback.ok ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"
          )}>
            {feedback.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />} {feedback.msg}
          </div>
        )}
      </GlassCard>

      <SectionHeader title="วันนี้" subtitle={`${passes.length} รายการ`} action={
        <button onClick={load} disabled={busy} className="text-xs text-aviva-secondary hover:text-aviva-gold flex items-center gap-1">
          <RefreshCw size={12} /> รีเฟรช
        </button>
      } />

      {loading ? (
        [1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-aviva-card/50 animate-pulse" />)
      ) : passes.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <p className="text-aviva-secondary text-sm">ยังไม่มีบัตรของวันนี้</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {passes.map(p => {
            const v = p.visitors;
            const isActive = p.status === "checked_in";
            const isPending = p.status === "pending";
            return (
              <GlassCard key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-aviva-text">{v?.visitor_name ?? "—"}</p>
                    <p className="text-xs text-aviva-secondary">เจ้าบ้าน: {v?.residents?.full_name ?? "—"}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-aviva-secondary">
                      {v?.license_plate && <span>ทะเบียน {v.license_plate}</span>}
                      <span>นัด {fmt(v?.expected_at ?? null)}</span>
                      {p.checked_in_at && <span>เข้า {fmt(p.checked_in_at)}</span>}
                      {p.checked_out_at && <span>ออก {fmt(p.checked_out_at)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusPill status={p.status} />
                    {isPending && (
                      <button onClick={() => verify(p.id)} disabled={busy}
                        className="text-[11px] flex items-center gap-1 bg-aviva-gold text-aviva-bg font-bold px-3 py-1.5 rounded-lg disabled:opacity-50">
                        <LogIn size={11} /> เช็คอิน
                      </button>
                    )}
                    {isActive && (
                      <button onClick={() => checkout(p.id)} disabled={busy}
                        className="text-[11px] flex items-center gap-1 bg-aviva-card border border-aviva-gold/30 text-aviva-gold font-bold px-3 py-1.5 rounded-lg disabled:opacity-50">
                        <LogOut size={11} /> เช็คเอ้าท์
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {scanOpen && <QrCameraScanner onScan={onScan} onClose={() => setScanOpen(false)} />}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { l: string; c: string }> = {
    pending:     { l: "รออนุมัติ",      c: "bg-aviva-gold/15 text-aviva-gold border-aviva-gold/30" },
    checked_in:  { l: "อยู่ในโครงการ",   c: "bg-green-500/15 text-green-300 border-green-500/30" },
    checked_out: { l: "ออกแล้ว",         c: "bg-aviva-secondary/20 text-aviva-secondary border-aviva-secondary/30" },
    expired:     { l: "หมดอายุ",         c: "bg-red-500/15 text-red-300 border-red-500/30" },
    blocked:     { l: "ถูกบล็อก",         c: "bg-red-500/20 text-red-400 border-red-500/40" },
  };
  const m = map[status] ?? map.pending;
  return <span className={clsx("text-[10px] px-2 py-0.5 rounded-full border", m.c)}>{m.l}</span>;
}
