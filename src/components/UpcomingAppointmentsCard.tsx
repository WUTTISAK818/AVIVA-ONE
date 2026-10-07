"use client";
// นัดหมายข้างหน้า — สิ่งที่ "จะเกิด" ไม่ใช่สิ่งที่ "เกิดไปแล้ว"
//
// Pom แจ้ง 7 ต.ค. 69: มีนัดโอนบ้าน A7 วันที่ 15 ต.ค. แต่ปฏิทินหน้าหลักไม่ขึ้นอะไรเลย
// สาเหตุ: ปฏิทินบนหน้าหลักคือ "ปฏิทินกิจกรรมประจำวัน" ซึ่งรวมเฉพาะสิ่งที่บันทึกไว้แล้ว
// (รายงาน · กิจกรรมขาย · งวดงาน · ใบสั่งซื้อ) — ไม่มีแนวคิดเรื่องนัดหมายล่วงหน้าเลยแม้แต่น้อย
// การ์ดนี้จึงมองไปข้างหน้าอย่างเดียว และดึงจากทุกช่องวันที่ที่เป็น "นัด" จริง ๆ
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { thaiDateStr } from "@/lib/thai-date";

const DAYS_AHEAD = 14;

type Kind = "transfer" | "contract" | "delivery" | "followup";

const KIND: Record<Kind, { label: string; emoji: string; tone: string }> = {
  transfer: { label: "นัดโอนกรรมสิทธิ์", emoji: "🔑", tone: "text-aviva-gold" },
  contract: { label: "นัดทำสัญญา", emoji: "📝", tone: "text-green-400" },
  delivery: { label: "นัดส่งมอบบ้าน", emoji: "🏠", tone: "text-blue-400" },
  followup: { label: "นัดติดตามลูกค้า", emoji: "📞", tone: "text-aviva-secondary" },
};

interface Appt {
  id: string;
  kind: Kind;
  date: string;
  customer: string;
  plot: number | null;
  owner: string | null;
}

interface LeadRow {
  id: string; customer_name: string; plot_number: number | null; assigned_to: string | null;
  transfer_appointment_date: string | null; contract_appointment_date: string | null;
  delivery_date: string | null; next_follow_up_date: string | null;
}

const addDays = (d: string, n: number) => {
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

const thaiDay = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

export default function UpcomingAppointmentsCard() {
  const [appts, setAppts] = useState<Appt[] | null>(null);

  useEffect(() => {
    const today = thaiDateStr();
    const until = addDays(today, DAYS_AHEAD);
    supabase.from("leads")
      .select("id, customer_name, plot_number, assigned_to, transfer_appointment_date, contract_appointment_date, delivery_date, next_follow_up_date")
      .or([
        `and(transfer_appointment_date.gte.${today},transfer_appointment_date.lte.${until})`,
        `and(contract_appointment_date.gte.${today},contract_appointment_date.lte.${until})`,
        `and(delivery_date.gte.${today},delivery_date.lte.${until})`,
        `and(next_follow_up_date.gte.${today},next_follow_up_date.lte.${until})`,
      ].join(","))
      .then(({ data }) => {
        const rows = (data ?? []) as LeadRow[];
        const out: Appt[] = [];
        const push = (kind: Kind, date: string | null, l: LeadRow) => {
          if (!date || date < today || date > until) return;
          out.push({ id: `${l.id}-${kind}`, kind, date, customer: l.customer_name, plot: l.plot_number, owner: l.assigned_to });
        };
        for (const l of rows) {
          push("transfer", l.transfer_appointment_date, l);
          push("contract", l.contract_appointment_date, l);
          push("delivery", l.delivery_date, l);
          push("followup", l.next_follow_up_date, l);
        }
        out.sort((a, b) => (a.date === b.date ? a.kind.localeCompare(b.kind) : a.date < b.date ? -1 : 1));
        setAppts(out);
      });
  }, []);

  if (!appts || appts.length === 0) return null;

  // นัดติดตามมีเยอะทุกวันจนกลบนัดสำคัญ — แยกให้นัดโอน/สัญญา/ส่งมอบเด่นก่อน
  const important = appts.filter(a => a.kind !== "followup");
  const followups = appts.filter(a => a.kind === "followup");
  const byDate = new Map<string, Appt[]>();
  for (const a of important) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);

  return (
    <div className="bg-aviva-card border border-aviva-gold/25 rounded-lg p-3 mb-3">
      <div className="flex items-center gap-2">
        <CalendarClock size={15} className="text-aviva-gold" />
        <span className="text-sm font-semibold text-aviva-text">นัดหมายข้างหน้า {DAYS_AHEAD} วัน</span>
      </div>

      {important.length === 0 ? (
        <p className="text-xs text-aviva-secondary mt-2">ไม่มีนัดโอน / นัดทำสัญญา / นัดส่งมอบในช่วงนี้</p>
      ) : (
        <div className="mt-2 space-y-2">
          {[...byDate.entries()].map(([date, list]) => (
            <div key={date} className="bg-aviva-bg/60 rounded-xl px-3 py-2">
              <p className="text-[11px] font-bold text-aviva-gold">{thaiDay(date)}</p>
              {list.map(a => (
                <p key={a.id} className="text-xs text-aviva-text mt-1 leading-relaxed">
                  {KIND[a.kind].emoji} <span className={`font-semibold ${KIND[a.kind].tone}`}>{KIND[a.kind].label}</span>
                  {" — "}{a.customer}
                  {a.plot ? <span className="text-aviva-secondary"> · แปลง {a.plot}</span> : null}
                  {a.owner ? <span className="text-aviva-secondary"> · {a.owner}</span> : null}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {followups.length > 0 && (
        <p className="text-[11px] text-aviva-secondary mt-2">
          + นัดติดตามลูกค้าอีก {followups.length} ราย ใน {DAYS_AHEAD} วันนี้
        </p>
      )}

      <Link href="/crm" className="block text-center mt-2.5 text-[12px] font-semibold text-aviva-gold border border-aviva-gold/30 rounded-xl py-1.5 active:scale-[0.98] transition-transform">
        เปิดหน้าลูกค้าเพื่อแก้วันนัด
      </Link>
    </div>
  );
}
