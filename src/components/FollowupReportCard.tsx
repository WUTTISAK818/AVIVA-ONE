"use client";
// สรุป "ติดตามลูกค้าเก่า รายสัปดาห์/รายเดือน แยกรายพนักงานขาย"
// Pom สั่ง 19 ต.ค. 69 ให้อยู่ในเมนูเดิม (แท็บผลงานทีมของหน้าขาย) ไม่ต้องเปิดหลายที่
//
// อ่านอย่างไร: "ความคืบหน้า" คือสิ่งที่เกิดขึ้นจริงและมีวันที่กำกับ (เยี่ยมชม/จอง/เซ็นสัญญา/สินเชื่อ/โอน)
// ส่วน "ติดต่อจริง" นับจากวันติดต่อล่าสุด โดยตัดวันที่อัปเดตเป็นชุดออกแล้ว
import { useEffect, useState } from "react";
import { PhoneCall } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { FollowupReport, FollowupPeriod } from "@/lib/sales-followup-report";

export default function FollowupReportCard() {
  const [period, setPeriod] = useState<FollowupPeriod>("month");
  // เก็บผลพร้อมช่วงที่ขอไว้ด้วยกัน แล้วคำนวณสถานะกำลังโหลดจากมัน
  // (ถ้า setState("loading") ตรง ๆ ในตัว effect จะผิดกฎ react-hooks/set-state-in-effect)
  const [res, setRes] = useState<{ key: FollowupPeriod; data: FollowupReport | null } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);   // ปุ่ม "ลองใหม่" สั่งให้ effect ทำงานซ้ำ
  const loading = res?.key !== period;
  const failed = !loading && res?.data === null;
  const data = res?.key === period ? res.data : null;

  // ดึงข้อมูลในตัว effect เอง (ไม่เรียกผ่านฟังก์ชันที่ setState ทันที) และตั้งค่าหลัง await เท่านั้น
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch(`/api/sales/followup-report?period=${period}`, {
          cache: "no-store",
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        const json = r.ok ? ((await r.json()) as FollowupReport) : null;
        if (!cancelled) setRes({ key: period, data: json });
      } catch {
        if (!cancelled) setRes({ key: period, data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [period, reloadTick]);

  return (
    <div className="bg-aviva-card border border-aviva-gold/20 rounded-lg p-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center flex-shrink-0">
            <PhoneCall size={15} className="text-aviva-gold" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-aviva-text leading-tight">ติดตามลูกค้าเก่า (รายพนักงาน)</p>
            <p className="text-[11px] text-aviva-secondary">{data?.label ?? "กำลังโหลด…"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {([["week", "สัปดาห์นี้"], ["month", "เดือนนี้"]] as [FollowupPeriod, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                period === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "border-aviva-gold/25 text-aviva-secondary"
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-[12px] text-aviva-secondary py-2">กำลังรวบรวมข้อมูล…</p>}
      {failed && (
        <div className="py-2">
          <p className="text-[12px] text-red-400">โหลดรายงานไม่สำเร็จ</p>
          <button onClick={() => { setRes(null); setReloadTick((t) => t + 1); }} className="text-[12px] text-aviva-gold underline">ลองใหม่</button>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "ความคืบหน้า", value: data.totals.milestoneTotal, color: "text-green-400" },
              { label: "ติดต่อจริง", value: data.totals.contacted, color: "text-aviva-text" },
              { label: "เงียบ>30วัน", value: data.totals.stale30, color: data.totals.stale30 > 0 ? "text-amber-400" : "text-aviva-text" },
              { label: "เลยนัด", value: data.totals.overdue, color: data.totals.overdue > 0 ? "text-red-400" : "text-aviva-text" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center bg-aviva-bg rounded-xl p-2">
                <p className={`text-base font-bold ${color}`}>{value}</p>
                <p className="text-[9px] text-aviva-secondary mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {data.sellers.length === 0 && <p className="text-[12px] text-aviva-secondary">ยังไม่มีข้อมูลในช่วงนี้</p>}

          <div className="space-y-2">
            {data.sellers.map((s) => {
              const done = s.milestones.filter((m) => m.n > 0);
              const risk = [
                s.stale30 > 0 ? `เงียบเกิน 30 วัน ${s.stale30}` : "",
                s.overdue > 0 ? `เลยนัด ${s.overdue}` : "",
                s.unreachable > 0 ? `ติดต่อไม่ได้ ${s.unreachable}` : "",
              ].filter(Boolean);
              return (
                <div key={s.seller} className="bg-aviva-bg rounded-xl p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-bold text-aviva-text">{s.seller}</p>
                    <p className="text-[11px] text-aviva-secondary flex-shrink-0">ลูกค้าในมือ {s.inHand} ราย</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {done.length > 0 ? done.map((m) => (
                      <span key={m.label} className="text-[11px] bg-green-500/10 border border-green-500/25 text-green-300 px-2 py-0.5 rounded-full">
                        {m.icon} {m.label} {m.n}
                      </span>
                    )) : (
                      <span className="text-[11px] text-aviva-secondary">ไม่มีความคืบหน้าในช่วงนี้</span>
                    )}
                  </div>
                  <p className="text-[11px] text-aviva-secondary mt-1.5">
                    ติดต่อจริง {s.contacted} ราย
                    {s.bulkTouched > 0 && <span className="text-amber-400"> · อัปเดตเป็นชุดอีก {s.bulkTouched} ราย (ไม่นับเป็นผลงาน)</span>}
                  </p>
                  {risk.length > 0 && <p className="text-[11px] text-amber-400 mt-0.5">⚠️ {risk.join(" · ")}</p>}
                </div>
              );
            })}
          </div>

          {data.warnings.map((w, i) => (
            <p key={i} className="text-[10px] text-aviva-secondary/70 mt-2 leading-relaxed">หมายเหตุ: {w}</p>
          ))}
        </>
      )}
    </div>
  );
}
