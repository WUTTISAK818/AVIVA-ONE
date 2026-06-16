"use client";
// สถิติคำถาม AVIVA Copilot (เฉพาะผู้บริหาร) — รู้ว่าพนักงานถามอะไรบ่อย จุดที่สับสน
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, BarChart3, MessageSquare, TrendingUp } from "lucide-react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

interface Log {
  id: string; user_name: string | null; user_dept: string | null;
  question: string; answer: string | null; created_at: string;
}

export default function AiInsightsPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [rows, setRows] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !user.isManager) router.replace("/settings");
  }, [user, router]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ai_chat_logs")
      .select("id,user_name,user_dept,question,answer,created_at")
      .eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as Log[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = Date.now();
  const last7 = rows.filter((r) => now - new Date(r.created_at).getTime() < 7 * 86400_000).length;

  // นับตามฝ่าย
  const byDept = new Map<string, number>();
  for (const r of rows) { const d = r.user_dept || "ไม่ระบุ"; byDept.set(d, (byDept.get(d) ?? 0) + 1); }
  const deptRows = [...byDept.entries()].sort((a, b) => b[1] - a[1]);

  // คำถามยอดฮิต (จัดกลุ่มข้อความที่เหมือนกัน)
  const byQ = new Map<string, number>();
  for (const r of rows) { const q = r.question.trim().toLowerCase(); byQ.set(q, (byQ.get(q) ?? 0) + 1); }
  const topQ = [...byQ.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/settings" className="text-aviva-secondary"><ChevronLeft size={20} /></Link>
          <BarChart3 size={18} className="text-aviva-gold" />
          <h1 className="text-lg font-bold text-aviva-text">สถิติคำถาม AVIVA Copilot</h1>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {loading ? (
          <p className="text-xs text-aviva-secondary/70 text-center py-4">กำลังโหลด…</p>
        ) : rows.length === 0 ? (
          <GlassCard className="p-6 text-center"><p className="text-sm text-aviva-secondary">ยังไม่มีคำถามจากผู้ใช้</p></GlassCard>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <GlassCard className="p-3">
                <div className="flex items-center gap-1 text-[10px] text-aviva-secondary"><MessageSquare size={11} className="text-aviva-gold" /> คำถามทั้งหมด</div>
                <p className="text-xl font-bold text-aviva-gold">{rows.length}</p>
              </GlassCard>
              <GlassCard className="p-3">
                <div className="flex items-center gap-1 text-[10px] text-aviva-secondary"><TrendingUp size={11} className="text-green-400" /> 7 วันล่าสุด</div>
                <p className="text-xl font-bold text-green-400">{last7}</p>
              </GlassCard>
            </div>

            <GlassCard className="p-4">
              <p className="text-xs font-semibold text-aviva-text mb-2">คำถามยอดฮิต (ถามซ้ำ ≥ 2 ครั้ง)</p>
              {topQ.length === 0 ? (
                <p className="text-[11px] text-aviva-secondary/70">ยังไม่มีคำถามที่ถามซ้ำ</p>
              ) : (
                <div className="space-y-1.5">
                  {topQ.map(([q, c]) => (
                    <div key={q} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-aviva-secondary truncate">{q}</span>
                      <span className="shrink-0 text-aviva-gold font-bold">{c}×</span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-4">
              <p className="text-xs font-semibold text-aviva-text mb-2">แยกตามฝ่าย</p>
              <div className="space-y-1.5">
                {deptRows.map(([d, c]) => {
                  const pct = rows.length > 0 ? (c / rows.length) * 100 : 0;
                  return (
                    <div key={d}>
                      <div className="flex justify-between text-[11px] text-aviva-secondary"><span>{d}</span><span>{c} ({pct.toFixed(0)}%)</span></div>
                      <div className="h-1 bg-aviva-bg rounded-full mt-0.5 overflow-hidden"><div className="h-full bg-aviva-gold/60" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <p className="text-xs font-semibold text-aviva-text mb-2">คำถามล่าสุด</p>
              <div className="space-y-2">
                {rows.slice(0, 30).map((r) => (
                  <div key={r.id} className="border-b border-aviva-gold/5 pb-2 last:border-0">
                    <p className="text-xs text-aviva-text">{r.question}</p>
                    <p className="text-[10px] text-aviva-secondary/60 mt-0.5">
                      {r.user_name ?? "-"}{r.user_dept ? ` · ${r.user_dept}` : ""} · {fmtDateTime(r.created_at)} น.
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </div>
  );
}
