"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, ClipboardList, Sparkles, RefreshCw,
  CheckCircle, AlertTriangle, UserX, Eye,
} from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";

interface PersonRow {
  name: string;
  department: string;
  status: "submitted" | "late" | "missing";
  submittedAt: string | null;
  acknowledged: boolean;
  reportId: string | null;
}

interface DigestData {
  date: string;
  stats: { expected: number; submitted: number; late: number; missing: number; acknowledged: number };
  people: PersonRow[];
  aiSummary: string | null;
  aiCached: boolean;
}

const STATUS_CHIP: Record<PersonRow["status"], { label: string; cls: string }> = {
  submitted: { label: "ส่งแล้ว", cls: "bg-green-500/10 text-green-400 border-green-500/30" },
  late:      { label: "ส่งล่าช้า", cls: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  missing:   { label: "ยังไม่ส่ง", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
};

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReportsDigestPage() {
  const user = useCurrentUser();
  const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;

  const [date, setDate] = useState(today);
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user?.isManager || user?.isAdmin;

  const fetchDigest = useCallback(async (d: string, force = false) => {
    force ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/reports/digest?date=${d}${force ? "&force=true" : ""}`, {
        cache: "no-store",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) setError(json?.error ?? "โหลดข้อมูลไม่สำเร็จ");
      else setData(json);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ");
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (canAccess) fetchDigest(date);
  }, [canAccess, date, fetchDigest]);

  if (user && !canAccess) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center px-4 pb-24">
        <p className="text-aviva-secondary">หน้านี้สำหรับผู้บริหารเท่านั้น</p>
      </div>
    );
  }

  const dateThai = new Date(date + "T12:00:00").toLocaleDateString("th-TH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-aviva-bg px-4 pt-6 pb-28 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center">
            <ClipboardList size={17} className="text-aviva-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-aviva-text leading-tight">สรุปรายงานทีม</h1>
            <p className="text-[11px] text-aviva-secondary/70">อ่านจบหน้าเดียว สำหรับผู้บริหาร</p>
          </div>
        </div>
        <Link href="/reports/review" className="text-xs text-aviva-gold border border-aviva-gold/30 bg-aviva-gold/10 px-3 py-1.5 rounded-xl">
          อ่านรายฉบับ →
        </Link>
      </div>

      {/* Date nav */}
      <div className="flex items-center justify-between bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2">
        <button onClick={() => setDate(addDays(date, -1))} className="p-1.5 rounded-lg bg-aviva-bg border border-aviva-gold/20 text-aviva-secondary">
          <ChevronLeft size={15} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-aviva-text">{dateThai}</p>
          {date !== today && (
            <button onClick={() => setDate(today)} className="text-[10px] text-aviva-gold underline">กลับมาวันนี้</button>
          )}
        </div>
        <button
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today}
          className="p-1.5 rounded-lg bg-aviva-bg border border-aviva-gold/20 text-aviva-secondary disabled:opacity-30"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" />
        </div>
      ) : error ? (
        <GlassCard className="p-4 text-center text-red-400 text-sm">{error}</GlassCard>
      ) : data && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { label: "ต้องส่ง", value: stats?.expected ?? 0, cls: "text-aviva-gold" },
              { label: "ส่งแล้ว", value: stats?.submitted ?? 0, cls: "text-green-400" },
              { label: "ล่าช้า", value: stats?.late ?? 0, cls: "text-orange-400" },
              { label: "ยังไม่ส่ง", value: stats?.missing ?? 0, cls: (stats?.missing ?? 0) > 0 ? "text-red-400" : "text-aviva-secondary/40" },
              { label: "รับทราบ", value: stats?.acknowledged ?? 0, cls: "text-aviva-secondary" },
            ].map(s => (
              <GlassCard key={s.label} className="p-2 text-center">
                <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-[9px] text-aviva-secondary/70">{s.label}</p>
              </GlassCard>
            ))}
          </div>

          {/* AI digest */}
          <GlassCard className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-aviva-gold" />
                <p className="text-sm font-bold text-aviva-text">AI สรุปรวมทุกฝ่าย</p>
                {data.aiCached && <span className="text-[9px] text-aviva-secondary/50">(cache)</span>}
              </div>
              <button
                onClick={() => fetchDigest(date, true)}
                disabled={refreshing}
                className="flex items-center gap-1 text-[11px] text-aviva-gold disabled:opacity-40"
              >
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> สรุปใหม่
              </button>
            </div>
            {data.aiSummary ? (
              <p className="text-[13px] text-aviva-text/90 whitespace-pre-wrap leading-relaxed">{data.aiSummary}</p>
            ) : (
              <p className="text-xs text-aviva-secondary/60">
                {stats?.submitted ? "ยังสรุปไม่ได้ (ตรวจการตั้งค่า AI)" : "ยังไม่มีรายงานส่งเข้ามาในวันนี้"}
              </p>
            )}
          </GlassCard>

          {/* People list */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-aviva-secondary/70 uppercase tracking-wider">สถานะรายคน</p>
            {data.people.map(p => {
              const chip = STATUS_CHIP[p.status];
              return (
                <GlassCard key={p.name} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-aviva-text truncate">{p.name}</p>
                    <p className="text-[10px] text-aviva-secondary/70">
                      {p.department}
                      {p.submittedAt && ` · ส่งเมื่อ ${new Date(p.submittedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {p.acknowledged && <CheckCircle size={13} className="text-green-400" />}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${chip.cls}`}>{chip.label}</span>
                    {p.status === "missing"
                      ? <UserX size={13} className="text-red-400/60" />
                      : (
                        <Link href="/reports/review" className="p-1 rounded-lg bg-aviva-gold/10 border border-aviva-gold/30">
                          <Eye size={12} className="text-aviva-gold" />
                        </Link>
                      )}
                  </div>
                </GlassCard>
              );
            })}
            {data.people.length === 0 && (
              <GlassCard className="p-4 text-center text-xs text-aviva-secondary/60">ไม่มีพนักงานที่ต้องส่งรายงาน</GlassCard>
            )}
          </div>

          {(stats?.missing ?? 0) > 0 && (
            <GlassCard className="p-3 flex items-center gap-2 border border-orange-500/20">
              <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
              <p className="text-[11px] text-aviva-secondary">
                ระบบจะเตือนอัตโนมัติผ่าน Push/LINE เวลา 18:00 น. ถึงคนที่ยังไม่ส่ง (เส้นตาย 19:00 น.)
              </p>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
