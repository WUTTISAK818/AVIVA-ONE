"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Camera, MapPin, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import QrCameraScanner from "@/components/security/QrCameraScanner";
import { supabase } from "@/lib/supabase";

interface Checkpoint {
  id: string;
  code: string;
  name_th: string;
  qr_token: string | null;
  location_note: string | null;
}
interface Log {
  id: string;
  scanned_at: string;
  checkpoint_id: string;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

export default function PatrolPage() {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [todayLogs, setTodayLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  const load = () => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.from("guard_checkpoints").select("*").eq("active", true).order("name_th"),
      supabase.from("patrol_logs").select("id, scanned_at, checkpoint_id").gte("scanned_at", todayStart.toISOString()),
    ]).then(([cp, lg]) => {
      setCheckpoints((cp.data as Checkpoint[]) ?? []);
      setTodayLogs((lg.data as Log[]) ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const recordScan = async (token: string) => {
    setFeedback(null);
    const cp = checkpoints.find(c => c.qr_token === token);
    if (!cp) {
      setFeedback({ ok: false, msg: "QR ไม่ตรงกับจุดตรวจที่มีในระบบ" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("patrol_logs").insert({
      checkpoint_id: cp.id,
      scanned_by: user?.id ?? null,
    });
    if (error) {
      setFeedback({ ok: false, msg: error.message });
      return;
    }
    setFeedback({ ok: true, msg: `บันทึก ${cp.name_th} แล้ว` });
    load();
  };

  const onCameraScan = async (text: string) => {
    setScanOpen(false);
    await recordScan(text.trim());
  };

  const lastVisited = (cpId: string) => {
    const logs = todayLogs.filter(l => l.checkpoint_id === cpId);
    if (!logs.length) return null;
    return logs.reduce((latest, l) => (new Date(l.scanned_at) > new Date(latest.scanned_at) ? l : latest));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-aviva-text">เดินตรวจตรา</h1>
        <p className="text-sm text-aviva-secondary mt-1">สแกน QR ที่จุดตรวจเพื่อบันทึกการเดินตรวจ</p>
      </div>

      <button onClick={() => setScanOpen(true)}
        className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2">
        <Camera size={18} /> เปิดกล้องสแกน
      </button>

      {feedback && (
        <div className={clsx("text-sm px-4 py-3 rounded-xl flex items-center gap-2",
          feedback.ok ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"
        )}>
          {feedback.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {feedback.msg}
        </div>
      )}

      <SectionHeader title="จุดตรวจ" subtitle={`${checkpoints.length} จุด · บันทึกวันนี้ ${todayLogs.length} ครั้ง`} action={
        <button onClick={load} className="text-xs text-aviva-secondary hover:text-aviva-gold flex items-center gap-1">
          <RefreshCw size={12} /> รีเฟรช
        </button>
      } />

      {loading ? (
        [1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-aviva-card/50 animate-pulse" />)
      ) : (
        <div className="space-y-2">
          {checkpoints.map(cp => {
            const last = lastVisited(cp.id);
            return (
              <GlassCard key={cp.id} className="p-4 min-h-[80px]">
                <div className="flex items-start justify-between gap-3 h-full">
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-aviva-gold mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-aviva-text">{cp.name_th}</p>
                      <p className="text-xs text-aviva-secondary">{cp.location_note ?? "—"}</p>
                      {last && <p className="text-xs text-green-300 mt-1">เดินตรวจล่าสุด {fmt(last.scanned_at)}</p>}
                    </div>
                  </div>
                  <span className={clsx("text-xs px-2.5 py-1 rounded-full border shrink-0",
                    last ? "bg-green-500/15 text-green-300 border-green-500/30" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                  )}>
                    {last ? "เดินแล้ว" : "ยังไม่เดิน"}
                  </span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {scanOpen && <QrCameraScanner onScan={onCameraScan} onClose={() => setScanOpen(false)} />}
    </div>
  );
}
