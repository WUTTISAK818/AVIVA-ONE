"use client";
// เตือนเมื่อ "ผังก่อสร้าง" กับ "รายงานหน้างาน" ไม่ตรงกัน
//
// Pom แจ้ง 6 ต.ค. 69: ผังขึ้นว่า V28/V29 ยังไม่เริ่ม 0% ทั้งที่รายงานประจำวันบอกว่าทาสีรอบสองไปแล้ว
// สาเหตุ: ผังอ่านจากตาราง houses ที่ต้องมีคนกรอก และไม่มีใครแก้มาตั้งแต่ 18-19 มิ.ย. 69
// การ์ดนี้ทำให้ "ความไม่ตรงกัน" โผล่มาเองโดยไม่ต้องรอให้ใครสังเกต
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { plotCodesIn } from "@/lib/plot-codes";
import GlassCard from "@/components/GlassCard";
import { thaiDateStr } from "@/lib/thai-date";

const LOOKBACK_DAYS = 14;

interface Props { projectId: string }

export default function ConstructionSyncAlert({ projectId }: Props) {
  const [stale, setStale] = useState<{ codes: string[]; lastUpdated: string | null; days: number } | null>(null);

  useEffect(() => {
    (async () => {
      const since = (() => {
        const d = new Date(thaiDateStr() + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() - LOOKBACK_DAYS);
        return d.toISOString().slice(0, 10);
      })();

      // รายงานหน้างานของฝ่ายก่อสร้างย้อนหลัง 14 วัน
      const { data: reports } = await supabase
        .from("work_reports")
        .select("id")
        .eq("report_type", "daily")
        .eq("department", "ฝ่ายก่อสร้าง")
        .gte("report_date", since)
        .in("status", ["submitted", "late"]);
      const ids = (reports ?? []).map(r => r.id as string);
      if (ids.length === 0) { setStale(null); return; }

      const { data: items } = await supabase
        .from("work_report_items").select("description").in("report_id", ids);

      const worked = new Set<string>();
      for (const it of items ?? []) for (const c of plotCodesIn(it.description as string)) worked.add(c);
      if (worked.size === 0) { setStale(null); return; }

      const { data: houses } = await supabase
        .from("houses")
        .select("plot_code, construction_status, progress, updated_at")
        .eq("project_id", projectId)
        .in("plot_code", [...worked]);

      // แปลงที่มีรายงานหน้างาน แต่ผังยังขึ้นว่า "ยังไม่เริ่ม"
      const codes = (houses ?? [])
        .filter(h => h.construction_status === "not_started" || Number(h.progress ?? 0) === 0)
        .map(h => h.plot_code as string)
        .sort();

      const lastUpdated = (houses ?? [])
        .map(h => h.updated_at as string | null)
        .filter(Boolean)
        .sort()
        .pop() ?? null;
      const days = lastUpdated
        ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86_400_000)
        : 0;

      setStale(codes.length > 0 || days >= 7 ? { codes, lastUpdated, days } : null);
    })();
  }, [projectId]);

  if (!stale) return null;

  return (
    <GlassCard className="p-3.5 border-orange-500/35 bg-orange-500/5">
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} className="text-orange-400 flex-shrink-0" />
        <h3 className="text-sm font-bold text-orange-400">ผังนี้อาจไม่ตรงกับหน้างานจริง</h3>
      </div>
      {stale.codes.length > 0 && (
        <p className="text-xs text-aviva-text/90 mt-2 leading-relaxed">
          มีรายงานหน้างานใน {LOOKBACK_DAYS} วันล่าสุดที่แปลง{" "}
          <b className="text-orange-300">{stale.codes.join(", ")}</b>{" "}
          แต่ผังยังขึ้นว่า <b>ยังไม่เริ่ม 0%</b>
        </p>
      )}
      {stale.days >= 7 && (
        <p className="text-xs text-aviva-secondary mt-1.5">
          ความคืบหน้าของแปลงเหล่านี้ไม่ได้ถูกอัปเดตมา <b className="text-orange-300">{stale.days} วัน</b>
          {stale.lastUpdated ? ` (ล่าสุด ${new Date(stale.lastUpdated).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })})` : ""}
        </p>
      )}
      <p className="text-[11px] text-aviva-secondary/80 mt-2 leading-relaxed">
        วิศวกรหน้างานอัปเดตได้เองจากหน้า <b className="text-aviva-text">&ldquo;งานรายวัน&rdquo;</b> —
        ระบบจะดึงแปลงที่เขียนไว้ในรายงานขึ้นมาให้ปรับเปอร์เซ็นต์ แล้วผังนี้จะเปลี่ยนตามทันที
      </p>
      <Link href="/reports"
        className="block text-center mt-2.5 text-[12px] font-bold text-orange-300 border border-orange-500/30 rounded-xl py-2 active:scale-[0.98] transition-transform">
        ไปหน้างานรายวันเพื่ออัปเดต
      </Link>
    </GlassCard>
  );
}
