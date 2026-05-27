"use client";

import { useEffect, useState } from "react";
import { UserCheck, Package, AlertTriangle, ShieldCheck } from "lucide-react";
import KPICard from "@/components/KPICard";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface DashboardCounts {
  visitorsToday: number;
  parcelsPending: number;
  incidentsOpen: number;
  lastGateEvent: string | null;
}

export default function GuardHomePage() {
  const [counts, setCounts] = useState<DashboardCounts>({
    visitorsToday: 0,
    parcelsPending: 0,
    incidentsOpen: 0,
    lastGateEvent: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    Promise.all([
      supabase.from("visitor_passes").select("id", { count: "exact", head: true })
        .gte("checked_in_at", todayStart.toISOString()),
      supabase.from("parcels").select("id", { count: "exact", head: true })
        .is("picked_up_at", null),
      supabase.from("incidents").select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase.from("gate_events").select("event_at")
        .order("event_at", { ascending: false }).limit(1).maybeSingle(),
    ]).then(([visitors, parcels, incidents, lastEvent]) => {
      setCounts({
        visitorsToday: visitors.count ?? 0,
        parcelsPending: parcels.count ?? 0,
        incidentsOpen: incidents.count ?? 0,
        lastGateEvent: lastEvent.data?.event_at ?? null,
      });
      setLoading(false);
    });
  }, []);

  const fmtTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })
    : "—";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-aviva-text">หน้าหลัก รปภ.</h1>
        <p className="text-sm text-aviva-secondary mt-1">สรุปงานวันนี้</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={UserCheck} label="ผู้มาเยือน (วันนี้)" value={loading ? "…" : String(counts.visitorsToday)} />
        <KPICard icon={Package} label="พัสดุค้างรับ" value={loading ? "…" : String(counts.parcelsPending)} />
        <KPICard icon={AlertTriangle} label="เหตุการณ์เปิดอยู่" value={loading ? "…" : String(counts.incidentsOpen)} highlight={counts.incidentsOpen > 0} />
        <KPICard icon={ShieldCheck} label="เหตุการณ์ประตูล่าสุด" value={loading ? "…" : fmtTime(counts.lastGateEvent)} />
      </div>

      <div>
        <SectionHeader title="ลัดเข้างาน" subtitle="เลือกเมนูด้านบนเพื่อเริ่มงาน" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <GlassCard className="p-4">
            <p className="text-sm font-semibold text-aviva-text">รับผู้มาเยือน</p>
            <p className="text-xs text-aviva-secondary mt-1">สแกน QR หรือค้นชื่อ/ทะเบียนเพื่อเช็คอินผู้มาเยือน</p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-sm font-semibold text-aviva-text">บันทึกพัสดุ</p>
            <p className="text-xs text-aviva-secondary mt-1">รับพัสดุเข้านิติฯ และแจ้งลูกบ้านอัตโนมัติ</p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-sm font-semibold text-aviva-text">แจ้งเหตุการณ์</p>
            <p className="text-xs text-aviva-secondary mt-1">บันทึกเหตุพร้อมภาพถ่าย ส่งให้นิติฯ รับทราบ</p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-sm font-semibold text-aviva-text">เดินตรวจตรา</p>
            <p className="text-xs text-aviva-secondary mt-1">สแกนจุดตรวจ ระบบจะบันทึกเวลาให้อัตโนมัติ</p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
