"use client";
// ช่องทางไหนทำให้ลูกค้า "มาจองจริง" — ไม่ใช่แค่ช่องทางไหนได้ลีดเยอะ
// Pom ขอ 1 ต.ค. 69: "ลูกค้าที่จองไปทั้งหมดมาจากช่องทางไหน ไว้ประเมินว่าช่องทางไหนทำให้ลูกค้ามาจองได้"
// วางไว้แท็บ "ผลงานทีม" ของหน้า CRM เพราะเป็นข้อมูลไว้ตัดสินใจเรื่องงบ/ช่องทาง ไม่ใช่ข้อมูลรายวัน
// หมายเหตุ: นับจากลูกค้า "ทุกช่วงเวลา" ไม่ผูกกับตัวกรองช่วงวันที่ของหน้า เพราะการจองเกิดน้อย
//           ถ้ากรองตามเดือนจะเหลือ 1-2 รายจนประเมินไม่ได้
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Radio, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { channelBucket, CHANNEL_ORDER, type LeadChannel } from "@/lib/lead-channel";

const BOOKED_PLUS = ["Booking", "Contract", "Loan Approved", "Transfer", "Closed Deal"];
const CLOSED = ["Transfer", "Closed Deal"];
const VISITED_PLUS = ["Site Visit", ...BOOKED_PLUS];

interface Row {
  source: string | null;
  status: string;
  booking_date: string | null;
  contract_price: number | null;
  budget: number | null;
}

interface ChannelStat {
  channel: LeadChannel;
  leads: number;
  visited: number;
  booked: number;
  closed: number;
  value: number;          // มูลค่ารวมของดีลที่จองขึ้นไป
  bookRate: number;       // % ลีด → จอง
}

const baht = (n: number) =>
  n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(2)}M` : `฿${Math.round(n).toLocaleString("th-TH")}`;

export default function ChannelConversionCard() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    supabase.from("leads")
      .select("source, status, booking_date, contract_price, budget")
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);

  const stats = useMemo<ChannelStat[]>(() => {
    if (!rows) return [];
    const map = new Map<LeadChannel, ChannelStat>();
    for (const c of CHANNEL_ORDER) {
      map.set(c, { channel: c, leads: 0, visited: 0, booked: 0, closed: 0, value: 0, bookRate: 0 });
    }
    for (const r of rows) {
      const c = channelBucket(r.source);
      const s = map.get(c)!;
      s.leads++;
      if (VISITED_PLUS.includes(r.status)) s.visited++;
      // "จอง" = เคยไปถึงขั้นจองขึ้นไป หรือมีวันจองบันทึกไว้ (บางรายถูกย้อนสถานะภายหลัง)
      if (BOOKED_PLUS.includes(r.status) || r.booking_date) {
        s.booked++;
        s.value += Number(r.contract_price ?? r.budget ?? 0);
      }
      if (CLOSED.includes(r.status)) s.closed++;
    }
    return Array.from(map.values())
      .map(s => ({ ...s, bookRate: s.leads > 0 ? (s.booked / s.leads) * 100 : 0 }))
      .filter(s => s.leads > 0)
      .sort((a, b) => b.booked - a.booked || b.leads - a.leads);
  }, [rows]);

  if (!rows) {
    return (
      <div className="bg-aviva-card rounded-2xl border border-aviva-gold/15 p-4 flex items-center justify-center gap-2 text-xs text-aviva-secondary">
        <Loader2 size={14} className="animate-spin" /> กำลังรวบรวมข้อมูลช่องทาง...
      </div>
    );
  }

  const totalLeads = stats.reduce((n, s) => n + s.leads, 0);
  const totalBooked = stats.reduce((n, s) => n + s.booked, 0);
  const best = stats.filter(s => s.booked > 0).sort((a, b) => b.bookRate - a.bookRate)[0];
  const maxBooked = Math.max(1, ...stats.map(s => s.booked));

  return (
    <div className="bg-aviva-card rounded-2xl border border-aviva-gold/25 overflow-hidden">
      <div className="px-3.5 py-3 bg-aviva-gold/5 border-b border-aviva-gold/15">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-aviva-gold flex-shrink-0" />
          <h3 className="text-sm font-bold text-aviva-gold">ช่องทางไหนทำให้ลูกค้ามาจองได้</h3>
        </div>
        <p className="text-xs text-aviva-secondary mt-1 leading-relaxed">
          ลูกค้าทั้งหมด {totalLeads} ราย · จองแล้ว {totalBooked} ราย (ทุกช่วงเวลา ไม่ขึ้นกับตัวกรองวันที่)
        </p>
      </div>

      <div className="divide-y divide-aviva-gold/10">
        {stats.map(s => (
          <div key={s.channel} className="px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-aviva-text">{s.channel}</span>
              <span className={clsx("text-xs font-bold", s.booked > 0 ? "text-aviva-gold" : "text-aviva-secondary")}>
                จอง {s.booked} ราย
                {s.leads > 0 && <span className="text-aviva-secondary font-medium"> · {s.bookRate.toFixed(1)}% ของลีด</span>}
              </span>
            </div>

            {/* แท่งเทียบจำนวนการจองระหว่างช่องทาง */}
            <div className="h-1.5 bg-aviva-gold/10 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-aviva-gold rounded-full" style={{ width: `${(s.booked / maxBooked) * 100}%` }} />
            </div>

            <div className="grid grid-cols-4 gap-1.5 mt-2.5 text-center">
              {[
                ["ลีด", String(s.leads)],
                ["เยี่ยมชม", String(s.visited)],
                ["จอง", String(s.booked)],
                ["ปิดการขาย", String(s.closed)],
              ].map(([label, val]) => (
                <div key={label} className="bg-aviva-bg rounded-lg py-1.5">
                  <p className="text-sm font-bold text-aviva-text">{val}</p>
                  <p className="text-[11px] text-aviva-secondary mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {s.booked > 0 && (
              <p className="text-xs text-aviva-secondary mt-2">
                มูลค่าดีลที่จองได้จากช่องทางนี้ <b className="text-aviva-gold">{baht(s.value)}</b>
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="px-3.5 py-2.5 border-t border-aviva-gold/10 bg-aviva-bg/40">
        {best ? (
          <p className="text-xs text-aviva-secondary leading-relaxed">
            <b className="text-aviva-text">อ่านอย่างไร:</b> ช่องทางที่ได้ลีดเยอะที่สุดไม่จำเป็นต้องเป็นช่องทางที่ปิดได้ดีที่สุด —
            ดูที่ <b className="text-aviva-gold">% ของลีดที่กลายเป็นการจอง</b> ตอนนี้ <b className="text-aviva-text">{best.channel}</b> แปลงได้ดีที่สุดที่ {best.bookRate.toFixed(1)}%
          </p>
        ) : (
          <p className="text-xs text-aviva-secondary">ยังไม่มีลูกค้าที่จองในระบบมากพอจะเปรียบเทียบช่องทาง</p>
        )}
        <p className="text-[11px] text-aviva-secondary/70 mt-1.5">
          ข้อมูลมาจากช่อง &ldquo;ที่มา&rdquo; ของลูกค้าแต่ละราย — กรอกให้ครบทุกรายเพื่อให้ตัวเลขนี้เชื่อถือได้
        </p>
      </div>
    </div>
  );
}
