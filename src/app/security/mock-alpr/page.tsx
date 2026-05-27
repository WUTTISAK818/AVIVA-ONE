"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Camera, Dice5, AlertCircle, CheckCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Gate { id: string; code: string; name_th: string; direction: string }
interface Vehicle { license_plate: string }
interface Visitor { license_plate: string | null; visitor_name: string }
interface Blacklist { license_plate: string | null }

export default function MockAlprPage() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [gateCode, setGateCode] = useState<string>("");
  const [plate, setPlate] = useState("");
  const [confidence, setConfidence] = useState("0.94");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ action: string; match_type: string; reason: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<{ residents: string[]; visitors: string[]; blacklisted: string[] }>({
    residents: [], visitors: [], blacklisted: [],
  });

  useEffect(() => {
    Promise.all([
      supabase.from("gates").select("id, code, name_th, direction").eq("is_active", true).order("direction"),
      supabase.from("resident_vehicles").select("license_plate").limit(5),
      supabase.from("visitors").select("license_plate, visitor_name").not("license_plate", "is", null).gte("expires_at", new Date().toISOString()).limit(5),
      supabase.from("blacklist").select("license_plate").eq("active", true).limit(5),
    ]).then(([g, rv, vi, bl]) => {
      setGates((g.data as Gate[]) ?? []);
      setGateCode((g.data as Gate[])?.[0]?.code ?? "");
      setSamples({
        residents: ((rv.data as Vehicle[]) ?? []).map(r => r.license_plate),
        visitors: ((vi.data as Visitor[]) ?? []).map(v => v.license_plate).filter((p): p is string => !!p),
        blacklisted: ((bl.data as Blacklist[]) ?? []).map(b => b.license_plate).filter((p): p is string => !!p),
      });
    });
  }, []);

  const fire = async (opts?: { plate?: string; confidence?: number }) => {
    setBusy(true);
    setError(null);
    setLast(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/mock-alpr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        gate_code: gateCode,
        plate: opts?.plate ?? plate,
        confidence: opts?.confidence ?? Number(confidence),
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.ok) {
      setLast({ action: json.action, match_type: json.match_type, reason: json.reason });
    } else {
      setError(json.error ?? `error ${res.status}`);
    }
  };

  const randomPlate = () => `กข ${Math.floor(1000 + Math.random() * 9000)}`;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/security" className="text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">ทดสอบ ALPR</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">ยิง event จำลองเข้า /api/gate-events</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        <GlassCard className="p-5 space-y-4">
          <div>
            <label className="text-xs text-aviva-secondary mb-1 block">ประตู</label>
            <select value={gateCode} onChange={e => setGateCode(e.target.value)}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
              {gates.map(g => (
                <option key={g.code} value={g.code}>{g.name_th} ({g.direction === "entry" ? "ขาเข้า" : "ขาออก"})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-aviva-secondary mb-1 block">ทะเบียนรถ</label>
            <input type="text" value={plate} onChange={e => setPlate(e.target.value)}
              placeholder="กข 1234"
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60 font-mono" />
          </div>
          <div>
            <label className="text-xs text-aviva-secondary mb-1 block">Confidence (0.00 - 1.00)</label>
            <input type="number" min="0" max="1" step="0.01" value={confidence}
              onChange={e => setConfidence(e.target.value)}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
          </div>
          <button onClick={() => fire()} disabled={busy || !plate || !gateCode}
            className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            <Camera size={14} /> {busy ? "กำลังยิง…" : "ยิง event"}
          </button>
        </GlassCard>

        <div>
          <SectionHeader title="ลัด" subtitle="คลิกเพื่อยิงด้วย plate ที่มีอยู่ในระบบ" />
          <div className="grid grid-cols-1 gap-2">
            <ChipRow label="ทะเบียนลูกบ้าน" items={samples.residents} onPick={p => { setPlate(p); fire({ plate: p }); }} accent="green" />
            <ChipRow label="ทะเบียนผู้มาเยือน" items={samples.visitors} onPick={p => { setPlate(p); fire({ plate: p }); }} accent="gold" />
            <ChipRow label="ทะเบียนแบล็คลิสต์" items={samples.blacklisted} onPick={p => { setPlate(p); fire({ plate: p }); }} accent="red" />
            <button onClick={() => { const p = randomPlate(); setPlate(p); fire({ plate: p }); }}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border bg-aviva-card border-aviva-gold/10 text-aviva-secondary hover:border-aviva-gold/30">
              <Dice5 size={12} /> สุ่มทะเบียนที่ไม่มีในระบบ
            </button>
          </div>
        </div>

        {error && (
          <div className="text-xs px-3 py-2 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300 flex items-center gap-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}
        {last && (
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 text-sm text-aviva-text">
              <CheckCircle size={14} className="text-green-400" />
              <span className="font-semibold">ผลล่าสุด:</span>
              <span>{last.action}</span>
              <span className="text-aviva-secondary">·</span>
              <span className="text-aviva-secondary">match: {last.match_type}</span>
            </div>
            {last.reason && <p className="text-xs text-aviva-secondary mt-1">เหตุผล: {last.reason}</p>}
            <p className="text-[11px] text-aviva-secondary/70 mt-2">ดู event ใน <Link href="/security/gate-events" className="text-aviva-gold underline">เหตุการณ์ประตู</Link></p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

function ChipRow({ label, items, onPick, accent }: { label: string; items: string[]; onPick: (p: string) => void; accent: "green" | "gold" | "red" }) {
  const cls = {
    green: "border-green-500/30 text-green-300 hover:bg-green-500/10",
    gold:  "border-aviva-gold/30 text-aviva-gold hover:bg-aviva-gold/10",
    red:   "border-red-500/30 text-red-300 hover:bg-red-500/10",
  }[accent];
  return (
    <div>
      <p className="text-[11px] text-aviva-secondary mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.length === 0 ? (
          <span className="text-[11px] text-aviva-secondary/50 italic">ไม่มีในระบบ</span>
        ) : (
          items.map(p => (
            <button key={p} onClick={() => onPick(p)}
              className={clsx("text-[11px] font-mono px-2 py-1 rounded-md border bg-aviva-card", cls)}>
              {p}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
