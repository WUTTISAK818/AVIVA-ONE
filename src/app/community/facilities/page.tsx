"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, CalendarDays, Building, AlertCircle, CheckCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { supabase } from "@/lib/supabase";

interface Facility {
  id: string; name_th: string; description: string | null;
  capacity: number | null; hours_open: string; hours_close: string;
  slot_minutes: number; fee_per_slot: number; is_active: boolean;
}
interface Booking { id: string; slot_start: string; slot_end: string; facility_id: string }

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function CommunityFacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(todayISO());
  const [picked, setPicked] = useState<Facility | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    supabase.from("facilities").select("*").eq("is_active", true).order("name_th")
      .then(({ data }) => setFacilities((data as Facility[]) ?? []));
  }, []);

  useEffect(() => {
    if (!picked) return;
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    supabase.from("facility_bookings")
      .select("id, slot_start, slot_end, facility_id")
      .eq("facility_id", picked.id)
      .neq("status", "cancelled")
      .gte("slot_start", dayStart)
      .lte("slot_start", dayEnd)
      .then(({ data }) => setBookings((data as Booking[]) ?? []));
  }, [picked, date]);

  const generateSlots = (f: Facility): { start: Date; end: Date }[] => {
    const [oh, om] = f.hours_open.split(":").map(Number);
    const [ch, cm] = f.hours_close.split(":").map(Number);
    const slots: { start: Date; end: Date }[] = [];
    const baseDate = new Date(date + "T00:00:00");
    const open = new Date(baseDate); open.setHours(oh, om, 0, 0);
    const close = new Date(baseDate); close.setHours(ch, cm, 0, 0);
    let cur = new Date(open);
    while (cur.getTime() + f.slot_minutes * 60000 <= close.getTime()) {
      const end = new Date(cur.getTime() + f.slot_minutes * 60000);
      slots.push({ start: new Date(cur), end });
      cur = end;
    }
    return slots;
  };

  const isBooked = (s: { start: Date; end: Date }) =>
    bookings.some(b => new Date(b.slot_start).getTime() === s.start.getTime());

  const book = async (s: { start: Date; end: Date }) => {
    if (!picked) return;
    setBusy(true);
    setFeedback(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { data: resident } = await supabase.from("residents").select("id").eq("auth_user_id", user.id).maybeSingle();
    if (!resident) {
      setFeedback({ ok: false, msg: "ไม่พบโปรไฟล์ลูกบ้าน" });
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("facility_bookings").insert({
      facility_id: picked.id,
      resident_id: resident.id,
      slot_start: s.start.toISOString(),
      slot_end: s.end.toISOString(),
      fee: picked.fee_per_slot,
      status: "confirmed",
    });
    setBusy(false);
    if (error) {
      setFeedback({ ok: false, msg: error.message });
    } else {
      setFeedback({ ok: true, msg: "จองสำเร็จ" });
      // refresh bookings
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      const { data } = await supabase.from("facility_bookings")
        .select("id, slot_start, slot_end, facility_id")
        .eq("facility_id", picked.id)
        .neq("status", "cancelled")
        .gte("slot_start", dayStart)
        .lte("slot_start", dayEnd);
      setBookings((data as Booking[]) ?? []);
    }
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-1 -ml-2">
          <Link href="/community/announcements" aria-label="กลับ" className="p-2 text-aviva-secondary hover:text-aviva-gold">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-aviva-text">จองส่วนกลาง</h1>
            <p className="text-xs text-aviva-secondary mt-0.5">คลับเฮ้าส์ · สระ · ฟิตเนส</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {!picked ? (
          <>
            <SectionHeader title="สิ่งอำนวยสะดวก" subtitle="แตะเพื่อเลือก" />
            {facilities.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <Building size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีในระบบ</p>
              </GlassCard>
            ) : (
              facilities.map(f => (
                <button key={f.id} onClick={() => setPicked(f)} className="w-full text-left">
                  <GlassCard className="p-4 active:scale-[0.98] mb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-aviva-text">{f.name_th}</p>
                        <p className="text-xs text-aviva-secondary mt-0.5">{f.description ?? "—"}</p>
                        <p className="text-xs text-aviva-secondary/70 mt-1">
                          เปิด {f.hours_open.slice(0, 5)}–{f.hours_close.slice(0, 5)} · ช่วงละ {f.slot_minutes} นาที
                        </p>
                      </div>
                      {f.fee_per_slot > 0 && (
                        <span className="text-xs text-aviva-gold">฿{Number(f.fee_per_slot).toLocaleString()}</span>
                      )}
                    </div>
                  </GlassCard>
                </button>
              ))
            )}
          </>
        ) : (
          <>
            <button onClick={() => setPicked(null)} className="text-sm text-aviva-gold flex items-center gap-1.5 py-2 -ml-1">
              <ArrowLeft size={14} /> เลือกสถานที่อื่น
            </button>
            <div>
              <p className="text-sm font-semibold text-aviva-text">{picked.name_th}</p>
              <p className="text-xs text-aviva-secondary">ช่วงละ {picked.slot_minutes} นาที</p>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-aviva-gold" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                min={todayISO()}
                className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none" />
            </div>
            {feedback && (
              <div className={clsx("text-sm px-4 py-3 rounded-xl flex items-center gap-2",
                feedback.ok ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"
              )}>
                {feedback.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {feedback.msg}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {generateSlots(picked).map((s, i) => {
                const booked = isBooked(s);
                const past = s.start.getTime() < Date.now();
                return (
                  <button key={i} onClick={() => !booked && !past && book(s)} disabled={booked || past || busy}
                    className={clsx("py-3.5 rounded-xl text-sm font-medium border transition-all",
                      booked
                        ? "bg-red-500/10 border-red-500/20 text-red-300/70 cursor-not-allowed"
                        : past
                          ? "bg-aviva-card border-aviva-gold/5 text-aviva-secondary/40 cursor-not-allowed"
                          : "bg-aviva-card border-aviva-gold/20 text-aviva-text hover:bg-aviva-gold/10 hover:border-aviva-gold/50"
                    )}>
                    {s.start.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                    {booked && <span className="block text-[10px] mt-0.5">มีคนจอง</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
