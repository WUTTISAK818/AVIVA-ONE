"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Plus, UserCheck, Clock, CheckCircle, Ban, QrCode } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

interface PassRow {
  id: string;
  qr_token: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
  visitors: {
    visitor_name: string;
    visitor_phone: string | null;
    license_plate: string | null;
    expected_at: string;
    expires_at: string;
    purpose: string | null;
  } | null;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
  pending:      { label: "รออนุมัติ",   cls: "bg-aviva-gold/15 text-aviva-gold border-aviva-gold/30",        icon: Clock },
  checked_in:   { label: "อยู่ในโครงการ", cls: "bg-green-500/15 text-green-300 border-green-500/30",          icon: CheckCircle },
  checked_out:  { label: "ออกแล้ว",      cls: "bg-aviva-secondary/20 text-aviva-secondary border-aviva-secondary/30", icon: CheckCircle },
  expired:      { label: "หมดอายุ",      cls: "bg-red-500/15 text-red-300 border-red-500/30",                 icon: Ban },
  blocked:      { label: "ถูกบล็อก",      cls: "bg-red-500/20 text-red-400 border-red-500/40",                 icon: Ban },
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function VisitorsListPage() {
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "history">("active");

  useEffect(() => {
    supabase
      .from("visitor_passes")
      .select("id, qr_token, status, checked_in_at, checked_out_at, created_at, visitors(visitor_name, visitor_phone, license_plate, expected_at, expires_at, purpose)")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        // PostgREST returns the joined row as an object when using FK; cast accordingly
        setPasses((data as unknown as PassRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  const active = passes.filter(p => p.status === "pending" || p.status === "checked_in");
  const history = passes.filter(p => p.status !== "pending" && p.status !== "checked_in");
  const visible = tab === "active" ? active : history;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-aviva-text">ผู้มาเยือนของฉัน</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">
              {loading ? "กำลังโหลด…" : `${active.length} รายการที่ใช้งานได้`}
            </p>
          </div>
          <Link href="/community/visitors/new"
            className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
            <Plus size={14} /> ลงทะเบียนใหม่
          </Link>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        <div className="flex gap-2">
          {[{ k: "active" as const, l: "ใช้งานได้" }, { k: "history" as const, l: "ประวัติ" }].map(({ k, l }) => (
            <button key={k} onClick={() => setTab(k)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                tab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>{l}</button>
          ))}
        </div>

        <SectionHeader title={tab === "active" ? "บัตรที่ใช้ได้" : "ประวัติย้อนหลัง"} subtitle="แตะที่บัตรเพื่อดู QR" />

        {loading ? (
          [1, 2].map(i => <div key={i} className="h-28 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : visible.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <UserCheck size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ไม่มีบัตรในหมวดนี้</p>
          </GlassCard>
        ) : (
          visible.map(p => {
            const meta = STATUS_META[p.status] ?? STATUS_META.pending;
            const Icon = meta.icon;
            const v = p.visitors;
            return (
              <Link key={p.id} href={`/v/${p.qr_token}`}>
                <GlassCard className="p-4 active:scale-[0.98] transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-aviva-text truncate">
                        {v?.visitor_name ?? "—"}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-aviva-secondary">
                        {v?.license_plate && <span>ทะเบียน {v.license_plate}</span>}
                        {v?.purpose && <span>{v.purpose}</span>}
                      </div>
                      <p className="text-xs text-aviva-secondary/70 mt-1">
                        นัด {fmtDateTime(v?.expected_at ?? null)} · หมดอายุ {fmtDateTime(v?.expires_at ?? null)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={clsx("text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1", meta.cls)}>
                        <Icon size={10} /> {meta.label}
                      </span>
                      <QrCode size={20} className="text-aviva-gold/70" />
                    </div>
                  </div>
                </GlassCard>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
