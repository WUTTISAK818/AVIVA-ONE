"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, UserCheck, AlertTriangle, DoorOpen, UserPlus, FileBarChart, Ban, Camera, Megaphone, Receipt, Wrench } from "lucide-react";
import KPICard from "@/components/KPICard";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface OverviewCounts {
  visitorsToday: number;
  gateEvents24h: number;
  incidentsOpen: number;
  residents: number;
}

const QUICK_LINKS = [
  { href: "/security/residents",         label: "ลูกบ้าน",            desc: "เชิญลูกบ้าน · จัดการทะเบียนรถ",       icon: UserPlus },
  { href: "/security/visitor-logs",      label: "บันทึกผู้มาเยือน",   desc: "ค้นย้อนหลัง · กรองตามเจ้าบ้าน",        icon: UserCheck },
  { href: "/security/gate-events",       label: "เหตุการณ์ประตู",     desc: "ฟีดสด ALPR · ดูประวัติเข้า-ออก",       icon: DoorOpen },
  { href: "/security/gates",             label: "ควบคุมประตู",         desc: "เปิดประตูด้วยมือ · มี audit log",      icon: ShieldCheck },
  { href: "/security/announcements",     label: "ประกาศ",              desc: "ออกประกาศแจ้งลูกบ้าน · ปักหมุดได้",   icon: Megaphone },
  { href: "/security/bills",             label: "บิลค่าส่วนกลาง",      desc: "ออกบิล · รับสลิป · ยืนยันชำระ",         icon: Receipt },
  { href: "/security/service-requests",  label: "งานแจ้งซ่อม",         desc: "รับงานจากลูกบ้าน · มอบหมาย",            icon: Wrench },
  { href: "/security/incidents",         label: "เหตุการณ์",           desc: "งานค้าง · งานปิดแล้ว",                  icon: AlertTriangle },
  { href: "/security/blacklist",         label: "แบล็คลิสต์",          desc: "ทะเบียนรถ/ชื่อบุคคลที่ห้ามเข้า",       icon: Ban },
  { href: "/security/reports",           label: "รายงานรายเดือน",     desc: "พิมพ์ส่งผู้บริหาร",                     icon: FileBarChart },
  { href: "/security/mock-alpr",         label: "ทดสอบ ALPR",          desc: "ยิง event จำลองเพื่อ demo",            icon: Camera },
];

export default function SecurityOverviewPage() {
  const [counts, setCounts] = useState<OverviewCounts>({
    visitorsToday: 0, gateEvents24h: 0, incidentsOpen: 0, residents: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    Promise.all([
      supabase.from("visitor_passes").select("id", { count: "exact", head: true })
        .gte("checked_in_at", todayStart.toISOString()),
      supabase.from("gate_events").select("id", { count: "exact", head: true })
        .gte("event_at", yesterday.toISOString()),
      supabase.from("incidents").select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase.from("residents").select("id", { count: "exact", head: true }),
    ]).then(([v, g, i, r]) => {
      setCounts({
        visitorsToday: v.count ?? 0,
        gateEvents24h: g.count ?? 0,
        incidentsOpen: i.count ?? 0,
        residents: r.count ?? 0,
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-aviva-gold" />
            <div>
              <h1 className="text-xl font-bold text-aviva-text">ความปลอดภัย</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">AVIVA Plus · ภาพรวมสำหรับผู้บริหารโครงการ</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <KPICard icon={UserCheck} label="ผู้มาเยือนวันนี้" value={loading ? "…" : String(counts.visitorsToday)} />
          <KPICard icon={DoorOpen} label="ประตู (24 ชม.)" value={loading ? "…" : String(counts.gateEvents24h)} />
          <KPICard icon={AlertTriangle} label="เหตุการณ์เปิดอยู่" value={loading ? "…" : String(counts.incidentsOpen)} highlight={counts.incidentsOpen > 0} />
          <KPICard icon={UserPlus} label="ลูกบ้านในระบบ" value={loading ? "…" : String(counts.residents)} />
        </div>

        <div>
          <SectionHeader title="เมนูจัดการ" subtitle="เลือกหัวข้อเพื่อดูรายละเอียด" />
          <div className="grid grid-cols-1 gap-2">
            {QUICK_LINKS.map(({ href, label, desc, icon: Icon }) => (
              <Link key={href} href={href}>
                <GlassCard className="p-4 active:scale-[0.98] transition-all">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-aviva-gold/10">
                      <Icon size={18} className="text-aviva-gold" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-aviva-text">{label}</p>
                      <p className="text-xs text-aviva-secondary mt-0.5">{desc}</p>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
