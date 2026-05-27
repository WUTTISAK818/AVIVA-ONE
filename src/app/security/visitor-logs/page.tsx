"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, RefreshCw, UserCheck } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface LogRow {
  id: string;
  status: string;
  qr_token: string;
  created_at: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  visitors: {
    visitor_name: string;
    license_plate: string | null;
    expected_at: string;
    expires_at: string;
    residents: { full_name: string } | null;
  } | null;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const FILTERS: { key: string; label: string }[] = [
  { key: "all",          label: "ทั้งหมด" },
  { key: "checked_in",   label: "อยู่ในโครงการ" },
  { key: "pending",      label: "รออนุมัติ" },
  { key: "checked_out",  label: "ออกแล้ว" },
];

export default function VisitorLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = () => {
    setLoading(true);
    const q = supabase
      .from("visitor_passes")
      .select("id, status, qr_token, created_at, checked_in_at, checked_out_at, visitors:visitor_id(visitor_name, license_plate, expected_at, expires_at, residents:host_resident_id(full_name))")
      .order("created_at", { ascending: false })
      .limit(100);
    (filter === "all" ? q : q.eq("status", filter)).then(({ data }) => {
      setRows((data as unknown as LogRow[]) ?? []);
      setLoading(false);
    });
  };

  useEffect(load, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/security" className="text-aviva-secondary hover:text-aviva-gold">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-aviva-text">บันทึกผู้มาเยือน</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">{rows.length} รายการล่าสุด</p>
            </div>
          </div>
          <button onClick={load} className="text-aviva-secondary hover:text-aviva-gold">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={clsx("py-2 px-3 rounded-xl text-xs font-medium border whitespace-nowrap",
                filter === f.key ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>{f.label}</button>
          ))}
        </div>

        <SectionHeader title="ประวัติบัตรผ่าน" subtitle="เรียงตามเวลาออกบัตร" />

        {loading ? (
          [1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : rows.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <UserCheck size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ไม่มีข้อมูล</p>
          </GlassCard>
        ) : (
          rows.map(r => (
            <GlassCard key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-aviva-text truncate">{r.visitors?.visitor_name ?? "—"}</p>
                  <p className="text-xs text-aviva-secondary">เจ้าบ้าน: {r.visitors?.residents?.full_name ?? "—"}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-aviva-secondary">
                    {r.visitors?.license_plate && <span>ทะเบียน {r.visitors.license_plate}</span>}
                    <span>ออกบัตร {fmt(r.created_at)}</span>
                    {r.checked_in_at && <span>เข้า {fmt(r.checked_in_at)}</span>}
                    {r.checked_out_at && <span>ออก {fmt(r.checked_out_at)}</span>}
                  </div>
                </div>
                <StatusPill status={r.status} />
              </div>
            </GlassCard>
          ))
        )}
      </div>
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
