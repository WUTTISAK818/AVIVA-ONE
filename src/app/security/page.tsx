"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, UserCheck, AlertTriangle, DoorOpen, UserPlus,
  FileBarChart, Ban, Camera, Megaphone, Receipt, Wrench,
  Wallet, Gavel, Building, BarChart3, Building2,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import GateTrafficChart from "@/components/security/GateTrafficChart";
import { supabase } from "@/lib/supabase";

interface OverviewCounts {
  visitorsToday: number;
  gateEvents24h: number;
  incidentsOpen: number;
  residents: number;
}

const SECURITY_LINKS = [
  { href: "/security/residents",         label: "ลูกบ้าน",            desc: "เชิญลูกบ้าน · จัดการทะเบียนรถ",      icon: UserPlus },
  { href: "/security/visitor-logs",      label: "บันทึกผู้มาเยือน",   desc: "ค้นย้อนหลัง · กรองตามเจ้าบ้าน",       icon: UserCheck },
  { href: "/security/gate-events",       label: "เหตุการณ์ประตู",     desc: "ฟีดสด ALPR · ดูประวัติ",              icon: DoorOpen },
  { href: "/security/gates",             label: "ควบคุมประตู",         desc: "เปิดประตู · webhook setup",            icon: ShieldCheck },
  { href: "/security/incidents",         label: "เหตุการณ์",           desc: "งานค้าง · งานปิดแล้ว",                  icon: AlertTriangle },
  { href: "/security/blacklist",         label: "แบล็คลิสต์",          desc: "ทะเบียน/บุคคลห้ามเข้า",                icon: Ban },
  { href: "/security/mock-alpr",         label: "ทดสอบ ALPR",          desc: "ยิง event จำลอง",                      icon: Camera },
];
const FINANCE_LINKS = [
  { href: "/security/treasury",          label: "บัญชีนิติฯ",         desc: "ผังบัญชี · double-entry · งบประมาณ", icon: Wallet },
  { href: "/security/bills",             label: "บิลค่าส่วนกลาง",      desc: "ออกบิล · รับสลิป · ยืนยัน",            icon: Receipt },
];
const GOVERNANCE_LINKS = [
  { href: "/security/governance",        label: "Governance hub",       desc: "ประชุม · มติ · เอกสาร · กรรมการ",      icon: Gavel },
  { href: "/security/polls",             label: "โพล",                   desc: "สำรวจความคิดเห็น",                      icon: BarChart3 },
];
const OPS_LINKS = [
  { href: "/security/announcements",     label: "ประกาศ",              desc: "ออกประกาศ · ปักหมุด",                   icon: Megaphone },
  { href: "/security/service-requests",  label: "งานแจ้งซ่อม",         desc: "รับงานจากลูกบ้าน",                       icon: Wrench },
  { href: "/security/vendors",           label: "Vendor",              desc: "ผู้รับเหมา / ผู้ให้บริการ",              icon: Building },
  { href: "/security/reports",           label: "รายงานรายเดือน",     desc: "พิมพ์ส่งผู้บริหาร",                     icon: FileBarChart },
];

interface Row { hour: string; entry: number; exit: number }

export default function SecurityOverviewPage() {
  const [counts, setCounts] = useState<OverviewCounts>({
    visitorsToday: 0, gateEvents24h: 0, incidentsOpen: 0, residents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [chart, setChart] = useState<Row[]>([]);

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
      supabase.from("gate_events")
        .select("event_at, gates:gate_id(direction)")
        .gte("event_at", yesterday.toISOString())
        .eq("action", "auto_open")
        .limit(500),
    ]).then(([v, g, i, r, events]) => {
      setCounts({
        visitorsToday: v.count ?? 0,
        gateEvents24h: g.count ?? 0,
        incidentsOpen: i.count ?? 0,
        residents: r.count ?? 0,
      });

      const buckets: Record<number, { entry: number; exit: number }> = {};
      for (let h = 0; h < 24; h++) buckets[h] = { entry: 0, exit: 0 };
      type RawEvent = { event_at: string; gates: { direction: string } | null };
      const raw = (events.data as unknown as RawEvent[]) ?? [];
      for (const ev of raw) {
        const h = new Date(ev.event_at).getHours();
        if (!buckets[h]) buckets[h] = { entry: 0, exit: 0 };
        if (ev.gates?.direction === "exit") buckets[h].exit++;
        else buckets[h].entry++;
      }
      setChart(Object.entries(buckets).map(([h, b]) => ({
        hour: `${h.padStart(2, "0")}`,
        entry: b.entry,
        exit: b.exit,
      })));

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
              <h1 className="text-xl font-bold text-aviva-text">ผู้บริหารโครงการ</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">AVIVA Plus · ความปลอดภัย · บัญชี · บริหาร</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <KPICard icon={UserCheck} label="ผู้มาเยือนวันนี้" value={loading ? "…" : String(counts.visitorsToday)} />
          <KPICard icon={DoorOpen} label="ประตู (24 ชม.)" value={loading ? "…" : String(counts.gateEvents24h)} />
          <KPICard icon={AlertTriangle} label="เหตุการณ์เปิดอยู่" value={loading ? "…" : String(counts.incidentsOpen)} highlight={counts.incidentsOpen > 0} />
          <KPICard icon={Building2} label="ลูกบ้านในระบบ" value={loading ? "…" : String(counts.residents)} />
        </div>

        <div>
          <SectionHeader title="ปริมาณรถผ่านประตู (24 ชม.)" subtitle="เฉพาะ event ที่เปิดประตูอัตโนมัติ" />
          <GlassCard className="p-3">
            {loading ? (
              <div className="h-56 animate-pulse" />
            ) : chart.every(c => c.entry === 0 && c.exit === 0) ? (
              <div className="h-56 flex items-center justify-center text-xs text-aviva-secondary text-center px-4">
                ยังไม่มีข้อมูลใน 24 ชม. ลองยิง mock event ที่ /security/mock-alpr
              </div>
            ) : (
              <GateTrafficChart data={chart} />
            )}
          </GlassCard>
        </div>

        <LinksSection title="บัญชี &amp; การเงิน" items={FINANCE_LINKS} />
        <LinksSection title="การบริหารนิติบุคคล" items={GOVERNANCE_LINKS} />
        <LinksSection title="งานปฏิบัติการ" items={OPS_LINKS} />
        <LinksSection title="ความปลอดภัย" items={SECURITY_LINKS} />
      </div>
    </div>
  );
}

interface LinkItem { href: string; label: string; desc: string; icon: typeof ShieldCheck }
function LinksSection({ title, items }: { title: string; items: LinkItem[] }) {
  return (
    <div>
      <SectionHeader title={title} />
      <div className="grid grid-cols-1 gap-2">
        {items.map(({ href, label, desc, icon: Icon }) => (
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
  );
}
