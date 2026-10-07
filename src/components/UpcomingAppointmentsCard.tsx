"use client";
// นัดหมายข้างหน้า (การ์ดสรุปบนหน้าหลัก) — ดึงจาก /api/calendar ตัวเดียวกับหน้าปฏิทินโครงการ
//
// Pom แจ้ง 7 ต.ค. 69: นัดโอนบ้าน A7 ไม่ขึ้นที่ไหนเลย เพราะปฏิทินบนหน้าหลักรวมเฉพาะกิจกรรมย้อนหลัง
// การ์ดนี้มองไปข้างหน้าอย่างเดียว และโชว์เฉพาะเรื่องที่พลาดไม่ได้ ส่วนที่เหลือสรุปเป็นยอด
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { thaiDateStr } from "@/lib/thai-date";
import { KIND_META, type CalendarItem } from "@/lib/calendar-sources";

const DAYS_AHEAD = 14;

const addDays = (d: string, n: number) => {
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

const thaiDay = (d: string, today: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
  + (d === today ? " · วันนี้" : "");

export default function UpcomingAppointmentsCard() {
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [today] = useState(() => thaiDateStr());

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/calendar?from=${today}&to=${addDays(today, DAYS_AHEAD)}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        const json = await res.json();
        setItems(res.ok ? (json.items ?? []) : []);
      } catch {
        setItems([]);
      }
    })();
  }, [today]);

  if (!items || items.length === 0) return null;

  // โชว์เฉพาะเรื่องที่ต้องเตรียมตัว — ที่เหลือ (นัดติดตาม/วันลา/วันหยุด) สรุปเป็นยอดท้ายการ์ด
  const important = items.filter(i => KIND_META[i.kind].weight === "critical");
  const others = items.length - important.length;
  const byDate = new Map<string, CalendarItem[]>();
  for (const i of important) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]);

  return (
    <div className="bg-aviva-card border border-aviva-gold/25 rounded-lg p-3 mb-3">
      <div className="flex items-center gap-2">
        <CalendarClock size={15} className="text-aviva-gold" />
        <span className="text-sm font-semibold text-aviva-text">นัดหมายข้างหน้า {DAYS_AHEAD} วัน</span>
      </div>

      {important.length === 0 ? (
        <p className="text-xs text-aviva-secondary mt-2">ไม่มีนัดโอน · นัดทำสัญญา · นัดส่งมอบ · งวดผ่อนครบกำหนด ในช่วงนี้</p>
      ) : (
        <div className="mt-2 space-y-2">
          {[...byDate.entries()].map(([date, list]) => (
            <div key={date} className="bg-aviva-bg/60 rounded-xl px-3 py-2">
              <p className="text-[11px] font-bold text-aviva-gold">{thaiDay(date, today)}</p>
              {list.map(i => (
                <p key={i.id} className="text-xs text-aviva-text mt-1 leading-relaxed">
                  {KIND_META[i.kind].emoji}{" "}
                  <span className={`font-semibold ${KIND_META[i.kind].text}`}>{KIND_META[i.kind].label}</span>
                  {" — "}{i.title}
                  {i.detail ? <span className="text-aviva-secondary"> · {i.detail}</span> : null}
                  {i.owner ? <span className="text-aviva-secondary"> · {i.owner}</span> : null}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {others > 0 && (
        <p className="text-[11px] text-aviva-secondary mt-2">
          + อีก {others} รายการ (นัดติดตามลูกค้า · เยี่ยมชม · คำสั่งงาน · วันลา/วันหยุด)
        </p>
      )}

      <Link href="/calendar" className="block text-center mt-2.5 text-[12px] font-semibold text-aviva-gold border border-aviva-gold/30 rounded-xl py-1.5 active:scale-[0.98] transition-transform">
        เปิดปฏิทินโครงการ
      </Link>
    </div>
  );
}
