"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Users, Sparkles, RefreshCw, Flag, CalendarDays, CalendarRange,
  AlertTriangle, CheckCircle, Gavel, Send, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { DEPT_LABEL, type CouncilBriefing, type BriefPlanItem, type BriefHighlight } from "@/lib/ai-experts";

const priorityStyle: Record<string, string> = {
  high: "bg-red-500/15 text-red-300 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  low: "bg-green-500/15 text-green-300 border-green-500/30",
};
const priorityLabel: Record<string, string> = { high: "ด่วน", medium: "ปานกลาง", low: "ทั่วไป" };

interface ExecRow {
  id: string;
  title: string;
  summary: string;
  highlights: BriefHighlight[];
  weekly_plan: BriefPlanItem[];
  monthly_plan: BriefPlanItem[];
  raw: CouncilBriefing | null;
  status: string;
  exec_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  model: string | null;
}
interface DeptRow { dept: string; title: string; summary: string; created_at: string; }

export default function AICouncilPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [exec, setExec] = useState<ExecRow | null>(null);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showDepts, setShowDepts] = useState(false);

  const load = useCallback(async () => {
    const [{ data: e }, { data: ds }] = await Promise.all([
      supabase.from("ai_briefings").select("*").eq("scope", "executive").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("ai_briefings").select("dept,title,summary,created_at").eq("scope", "dept").order("created_at", { ascending: false }).limit(40),
    ]);
    if (e) { setExec(e as ExecRow); setNote((e as ExecRow).exec_note ?? ""); }
    const latest: Record<string, DeptRow> = {};
    (ds ?? []).forEach((r: DeptRow) => { if (r.dept && !latest[r.dept]) latest[r.dept] = r; });
    setDepts(Object.values(latest));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!user.isManager) { router.replace("/dashboard"); return; }
    load();
  }, [user, router, load]);

  const runCouncil = async (period: "weekly" | "monthly") => {
    setRunning(true); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/ai-council", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ period }),
      });
      const json = await res.json();
      if (!res.ok || !json.briefing) setError(json.error ?? "ประชุมคณะที่ปรึกษาไม่สำเร็จ");
      else await load();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ");
    }
    setRunning(false);
  };

  const acknowledge = async () => {
    if (!exec) return;
    await supabase.from("ai_briefings").update({
      status: "acknowledged", reviewed_by: user?.full_name ?? user?.email ?? null, reviewed_at: new Date().toISOString(),
    }).eq("id", exec.id);
    setExec({ ...exec, status: "acknowledged" });
  };

  const saveNote = async () => {
    if (!exec) return;
    setSavingNote(true);
    await supabase.from("ai_briefings").update({
      exec_note: note, status: "actioned",
      reviewed_by: user?.full_name ?? user?.email ?? null, reviewed_at: new Date().toISOString(),
    }).eq("id", exec.id);
    await supabase.from("notifications").insert({
      project_id: "aaaaaaaa-0000-0000-0000-000000000001", type: "info", from_dept: "ผู้บริหาร",
      title: "ผู้บริหารสั่งการจากบรีฟคณะที่ปรึกษา AI", message: note.slice(0, 200), is_read: false,
    });
    setExec({ ...exec, exec_note: note, status: "actioned" });
    setSavingNote(false);
  };

  const decisions = exec?.raw?.decisions ?? [];

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-30 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Link href="/dashboard" className="text-aviva-gold hover:text-aviva-gold/80"><ArrowLeft size={20} /></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-aviva-text flex items-center gap-2"><Users size={16} className="text-aviva-gold" /> คณะที่ปรึกษา AI — สรุปเสนอผู้บริหาร</h1>
            <p className="text-[11px] text-aviva-secondary">ผู้เชี่ยวชาญแต่ละฝ่ายปรึกษากัน แล้วสรุปประเด็นที่ต้องตัดสินใจ</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        <div className="flex gap-2">
          <button onClick={() => runCouncil("weekly")} disabled={running}
            className="flex-1 flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
            <RefreshCw size={15} className={running ? "animate-spin" : ""} /> {running ? "กำลังประชุม..." : "เรียกประชุมคณะที่ปรึกษา (สัปดาห์)"}
          </button>
          <button onClick={() => runCouncil("monthly")} disabled={running}
            className="flex items-center gap-1.5 border border-aviva-gold/30 text-aviva-gold px-4 py-3 rounded-2xl text-sm font-medium disabled:opacity-50">
            <CalendarRange size={15} /> รายเดือน
          </button>
        </div>

        {error && (
          <GlassCard className="p-3 border border-red-500/20 bg-red-500/5">
            <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={13} /> {error}</p>
          </GlassCard>
        )}

        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : !exec ? (
          <GlassCard className="p-8 text-center">
            <Sparkles size={28} className="text-aviva-gold/40 mx-auto mb-2" />
            <p className="text-aviva-secondary text-sm">ยังไม่มีบรีฟจากคณะที่ปรึกษา AI — กด “เรียกประชุมคณะที่ปรึกษา” เพื่อให้ผู้เชี่ยวชาญแต่ละฝ่ายสรุปเสนอผู้บริหารค่ะ</p>
          </GlassCard>
        ) : (
          <>
            <GlassCard gold className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-bold text-aviva-gold">{exec.title}</p>
                <span className={clsx("text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0",
                  exec.status === "actioned" ? "bg-green-500/15 text-green-300 border-green-500/30" :
                  exec.status === "acknowledged" ? "bg-blue-500/15 text-blue-300 border-blue-500/30" :
                  "bg-yellow-500/15 text-yellow-300 border-yellow-500/30")}>
                  {exec.status === "actioned" ? "สั่งการแล้ว" : exec.status === "acknowledged" ? "รับทราบแล้ว" : "ใหม่"}
                </span>
              </div>
              <p className="text-xs text-aviva-secondary mt-1 leading-relaxed">{exec.summary}</p>
              <p className="text-[10px] text-aviva-secondary/50 mt-2">{new Date(exec.created_at).toLocaleString("th-TH")} · {exec.model ?? "AI"}</p>
            </GlassCard>

            {decisions.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-aviva-secondary flex items-center gap-1.5"><Gavel size={12} /> ประเด็นที่ต้องตัดสินใจ</p>
                {decisions.map((d, i) => (
                  <GlassCard key={i} className="p-3 border border-aviva-gold/15">
                    <p className="text-sm font-medium text-aviva-text">{d.question}</p>
                    <p className="text-[11px] text-aviva-gold mt-1.5">ข้อเสนอ: {d.recommended}</p>
                    <p className="text-[11px] text-aviva-secondary mt-0.5">ผลกระทบ: {d.impact}</p>
                  </GlassCard>
                ))}
              </div>
            )}

            {exec.highlights?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-aviva-secondary flex items-center gap-1.5"><Flag size={12} /> ประเด็นข้ามฝ่าย</p>
                {exec.highlights.map((h, i) => (
                  <GlassCard key={i} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-aviva-text flex-1">{h.title}</p>
                      <span className={clsx("text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0", priorityStyle[h.priority] ?? priorityStyle.low)}>{priorityLabel[h.priority] ?? h.priority}</span>
                    </div>
                    <p className="text-xs text-aviva-secondary mt-1">{h.detail}</p>
                    {h.action && <p className="text-[11px] text-aviva-gold mt-1.5">→ {h.action}</p>}
                  </GlassCard>
                ))}
              </div>
            )}

            {exec.weekly_plan?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-aviva-secondary flex items-center gap-1.5"><CalendarDays size={12} /> แผนระดับองค์กร — สัปดาห์นี้</p>
                {exec.weekly_plan.map((p, i) => (
                  <GlassCard key={i} className="p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-aviva-bg bg-aviva-gold px-2 py-0.5 rounded-full flex-shrink-0">{p.label}</span>
                      <div className="flex-1 min-w-0"><p className="text-sm text-aviva-text">{p.task}</p>{p.why && <p className="text-[11px] text-aviva-secondary mt-0.5">{p.why}</p>}</div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}

            {/* Manager actions */}
            <GlassCard className="p-4 space-y-3">
              <p className="text-xs font-bold text-aviva-gold flex items-center gap-1.5"><CheckCircle size={13} /> การตัดสินใจของผู้บริหาร</p>
              {exec.status === "new" && (
                <button onClick={acknowledge} className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 text-sm font-medium">
                  รับทราบบรีฟนี้
                </button>
              )}
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="บันทึกคำสั่ง/มอบหมายถึงฝ่ายที่เกี่ยวข้อง..."
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text resize-none placeholder:text-aviva-secondary/40" />
              <button onClick={saveNote} disabled={savingNote || !note.trim()}
                className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
                <Send size={14} /> {savingNote ? "กำลังบันทึก..." : "บันทึกและแจ้งฝ่ายที่เกี่ยวข้อง"}
              </button>
              {exec.reviewed_by && <p className="text-[10px] text-aviva-secondary/60">ล่าสุดโดย {exec.reviewed_by}</p>}
            </GlassCard>

            {/* Per-dept positions */}
            <div>
              <button onClick={() => setShowDepts(s => !s)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-aviva-card border border-aviva-gold/15">
                <span className="text-sm font-bold text-aviva-secondary">ความเห็นรายฝ่าย ({depts.length})</span>
                {showDepts ? <ChevronUp size={16} className="text-aviva-secondary" /> : <ChevronDown size={16} className="text-aviva-secondary" />}
              </button>
              {showDepts && (
                <div className="mt-2 space-y-2">
                  {depts.map(d => (
                    <GlassCard key={d.dept} className="p-3">
                      <p className="text-xs font-bold text-aviva-gold">{DEPT_LABEL[d.dept] ?? d.dept}</p>
                      <p className="text-sm text-aviva-text mt-0.5">{d.title}</p>
                      <p className="text-[11px] text-aviva-secondary mt-0.5">{d.summary}</p>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
