"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserCheck, Package, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard icon={UserCheck} label="ผู้มาเยือน (วันนี้)" value={loading ? "…" : String(counts.visitorsToday)} />
        <KPICard icon={Package} label="พัสดุค้างรับ" value={loading ? "…" : String(counts.parcelsPending)} />
        <KPICard icon={AlertTriangle} label="เหตุการณ์เปิดอยู่" value={loading ? "…" : String(counts.incidentsOpen)} highlight={counts.incidentsOpen > 0} />
        <KPICard icon={ShieldCheck} label="เหตุการณ์ประตูล่าสุด" value={loading ? "…" : fmtTime(counts.lastGateEvent)} />
      </div>

      <div>
        <SectionHeader title="ลัดเข้างาน" subtitle="แตะเพื่อเริ่มงาน" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { href: "/guard/queue",     title: "รับผู้มาเยือน",  desc: "สแกน QR หรือค้นชื่อ/ทะเบียนเพื่อเช็คอินผู้มาเยือน" },
            { href: "/guard/parcels",   title: "บันทึกพัสดุ",     desc: "รับพัสดุเข้านิติฯ และแจ้งลูกบ้านอัตโนมัติ" },
            { href: "/guard/incidents", title: "แจ้งเหตุการณ์",   desc: "บันทึกเหตุพร้อมภาพถ่าย ส่งให้นิติฯ รับทราบ" },
            { href: "/guard/patrol",    title: "เดินตรวจตรา",     desc: "สแกนจุดตรวจ ระบบจะบันทึกเวลาให้อัตโนมัติ" },
          ].map(({ href, title, desc }) => (
            <Link key={href} href={href} className="block">
              <GlassCard className="p-4 hover:border-aviva-gold/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-aviva-text">{title}</p>
                    <p className="text-xs text-aviva-secondary mt-1">{desc}</p>
                  </div>
                  <ArrowRight size={18} className="text-aviva-gold/70 shrink-0 mt-0.5" />
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
