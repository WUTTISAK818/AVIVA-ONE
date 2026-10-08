"use client";
// ปฏิทินโครงการ — ทุกอย่างที่มีวันกำหนดไว้ และทุกกิจกรรมที่เกิดขึ้นแล้ว รวมไว้ที่เดียว
// Pom สั่ง 7 ต.ค. 69 ให้ทำปฏิทินรวม · 8 ต.ค. 69 ให้ยุบมารวมกับปฏิทินบนหน้าหลักเป็นตัวเดียว
// ใช้ได้ 2 โหมด: compact (ฝังในหน้าหลัก) และเต็มหน้า (/calendar)
//
// ตอบคำถามเดียว: "วันนั้นมีอะไรที่ต้องทำหรือต้องรู้"
// ต่างจาก "ปฏิทินกิจกรรมประจำวัน" บนหน้าหลัก ซึ่งสรุปสิ่งที่เกิดขึ้นไปแล้ว
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import { thaiDateStr } from "@/lib/thai-date";
import {
  KIND_META, KIND_ORDER, criticalCount,
  type CalendarItem, type CalendarKind, type CalendarView,
} from "@/lib/calendar-sources";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "upcoming", label: "ที่ต้องทำ" },
  { key: "past", label: "ที่ทำไปแล้ว" },
  { key: "all", label: "ทั้งหมด" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const THAI_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export default function ProjectCalendar({ compact = false }: { compact?: boolean }) {
  const today = thaiDateStr();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [selected, setSelected] = useState<string>(today);
  const [hidden, setHidden] = useState<Set<CalendarKind>>(new Set());
  const [scope, setScope] = useState<"all" | "mine">("mine");
  const [view, setView] = useState<CalendarView>("upcoming");

  const monthStart = ymd(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const monthEnd = ymd(cursor.year, cursor.month, daysInMonth);

  const load = useCallback(async () => {
    setItems(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/calendar?from=${monthStart}&to=${monthEnd}&view=${view}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await res.json();
      setItems(res.ok ? (json.items ?? []) : []);
      if (json.scope) setScope(json.scope);
    } catch {
      setItems([]);
    }
  }, [monthStart, monthEnd, view]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => (items ?? []).filter(i => !hidden.has(i.kind)),
    [items, hidden]);

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const i of visible) m.set(i.date, [...(m.get(i.date) ?? []), i]);
    return m;
  }, [visible]);

  // ชนิดที่มีจริงในเดือนนี้เท่านั้น — ไม่ขึ้นตัวกรองที่กดแล้วไม่มีอะไรเปลี่ยน
  const kindsPresent = useMemo(() => {
    const present = new Set((items ?? []).map(i => i.kind));
    return KIND_ORDER.filter(k => present.has(k));
  }, [items]);

  const firstDow = new Date(cursor.year, cursor.month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(Date.UTC(cursor.year, cursor.month, 15))
    .toLocaleDateString("th-TH", { timeZone: "UTC", month: "long", year: "numeric" });

  const move = (n: number) => {
    const d = new Date(cursor.year, cursor.month + n, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const dayItems = byDate.get(selected) ?? [];
  const upcoming = visible.filter(i => i.date >= today && KIND_META[i.kind].weight !== "past").slice(0, 30);

  return (
    <div className={compact ? "" : "min-h-screen bg-aviva-bg pb-24"}>
      {!compact && (
        <div className="sticky top-0 z-10 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-aviva-gold" />
            <h1 className="text-base font-bold text-aviva-text">ปฏิทินโครงการ</h1>
            <span className="ml-auto text-[11px] text-aviva-secondary">
              {scope === "all" ? "ทั้งโครงการ" : "เฉพาะงานของคุณ"}
            </span>
          </div>
        </div>
      )}

      <div className={compact ? "space-y-3" : "p-4 space-y-3"}>
        {compact && (
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-aviva-gold" />
            <span className="text-sm font-semibold text-aviva-text">ปฏิทินโครงการ</span>
            <span className="ml-auto text-[10px] text-aviva-secondary">
              {scope === "all" ? "ทั้งโครงการ" : "เฉพาะงานของคุณ"}
            </span>
          </div>
        )}

        {/* สลับมุมมอง — Pom ขอ 8 ต.ค. 69 ให้เห็นงาน/กิจกรรมทุกอย่าง แต่แยกชั้นไม่ให้ของย้อนหลังกลบนัดสำคัญ */}
        <div className="flex gap-1.5">
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => { setView(v.key); setHidden(new Set()); }}
              className={clsx("flex-1 text-xs font-bold py-2 rounded-xl border transition-all active:scale-[0.98]",
                view === v.key
                  ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                  : "bg-aviva-card text-aviva-secondary border-aviva-gold/20")}>
              {v.label}
            </button>
          ))}
        </div>

        <GlassCard className="p-3">
          <div className="flex items-center gap-2">
            <button onClick={() => move(-1)} className="p-2 rounded-xl hover:bg-aviva-gold/10 text-aviva-secondary">
              <ChevronLeft size={16} />
            </button>
            <p className="flex-1 text-center text-sm font-bold text-aviva-text">{monthLabel}</p>
            <button onClick={() => move(1)} className="p-2 rounded-xl hover:bg-aviva-gold/10 text-aviva-secondary">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mt-3">
            {THAI_DOW.map(d => (
              <div key={d} className="text-center text-[10px] text-aviva-secondary/60 font-semibold py-1">{d}</div>
            ))}
            {cells.map((day, idx) => {
              if (day === null) return <div key={`e${idx}`} />;
              const date = ymd(cursor.year, cursor.month, day);
              const list = byDate.get(date) ?? [];
              const crit = criticalCount(list);
              const isToday = date === today;
              const isSel = date === selected;
              return (
                <button key={date} onClick={() => setSelected(date)}
                  className={clsx(
                    "aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 border transition-all active:scale-95",
                    isSel ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                      : isToday ? "bg-aviva-gold/10 border-aviva-gold/50"
                      : list.length > 0 ? "bg-aviva-card border-aviva-gold/20"
                      : "bg-aviva-bg/40 border-transparent")}>
                  <span className={clsx("text-xs font-bold", isSel ? "text-aviva-bg" : isToday ? "text-aviva-gold" : "text-aviva-text")}>
                    {day}
                  </span>
                  {list.length > 0 && (
                    <span className={clsx("text-[9px] leading-none font-bold",
                      isSel ? "text-aviva-bg" : crit > 0 ? "text-aviva-gold" : "text-aviva-secondary/70")}>
                      {crit > 0 ? "●" : "·"}{list.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </GlassCard>

        {kindsPresent.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {kindsPresent.map(k => {
              const off = hidden.has(k);
              const meta = KIND_META[k];
              return (
                <button key={k}
                  onClick={() => setHidden(prev => {
                    const next = new Set(prev);
                    if (next.has(k)) next.delete(k); else next.add(k);
                    return next;
                  })}
                  className={clsx("text-[11px] px-2 py-1 rounded-lg border transition-all",
                    off ? "bg-aviva-bg/40 border-aviva-gold/10 text-aviva-secondary/40 line-through" : meta.chip)}>
                  {meta.emoji} {meta.label}
                </button>
              );
            })}
          </div>
        )}

        {items === null ? (
          <GlassCard className="p-6 flex items-center justify-center gap-2 text-xs text-aviva-secondary">
            <Loader2 size={14} className="animate-spin" /> กำลังโหลดปฏิทิน...
          </GlassCard>
        ) : (
          <>
            <GlassCard className="p-3.5">
              <p className="text-sm font-bold text-aviva-gold">
                {new Date(selected + "T12:00:00Z").toLocaleDateString("th-TH", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              {dayItems.length === 0 ? (
                <p className="text-xs text-aviva-secondary mt-2">
                  {view === "past" ? "วันนี้ไม่มีกิจกรรมที่บันทึกไว้" : "วันนี้ไม่มีนัดหมายหรือกำหนดส่งอะไร"}
                </p>
              ) : (
                <div className="space-y-2 mt-2.5">
                  {dayItems.filter(i => KIND_META[i.kind].weight !== "past").map(i => <Row key={i.id} item={i} />)}
                  <PastGroups items={dayItems.filter(i => KIND_META[i.kind].weight === "past")} />
                </div>
              )}
            </GlassCard>

            {view !== "past" && upcoming.length > 0 && (
              <GlassCard className="p-3.5">
                <p className="text-sm font-bold text-aviva-text">ถัดไปในเดือนนี้</p>
                <div className="space-y-2 mt-2.5">
                  {upcoming.map(i => (
                    <div key={i.id}>
                      <p className="text-[10px] text-aviva-secondary/70">
                        {new Date(i.date + "T12:00:00Z").toLocaleDateString("th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })}
                        {i.date === today ? " · วันนี้" : ""}
                      </p>
                      <Row item={i} />
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** ของย้อนหลังสรุปเป็นยอดต่อชนิดก่อน แล้วค่อยกางดูรายชื่อ — วันหนึ่งมีได้หลายสิบรายการ */
function PastGroups({ items }: { items: CalendarItem[] }) {
  const [open, setOpen] = useState<Set<CalendarKind>>(new Set());
  if (items.length === 0) return null;

  const groups = new Map<CalendarKind, CalendarItem[]>();
  for (const i of items) groups.set(i.kind, [...(groups.get(i.kind) ?? []), i]);

  return (
    <div className="space-y-1.5">
      {[...groups.entries()].map(([kind, list]) => {
        const meta = KIND_META[kind];
        const isOpen = open.has(kind);
        return (
          <div key={kind}>
            <button
              onClick={() => setOpen(prev => {
                const next = new Set(prev);
                if (next.has(kind)) next.delete(kind); else next.add(kind);
                return next;
              })}
              className="w-full flex items-center justify-between bg-aviva-bg/40 rounded-xl px-3 py-2 active:scale-[0.99] transition-transform">
              <span className={clsx("text-xs font-semibold", meta.text)}>{meta.emoji} {meta.label}</span>
              <span className="text-[11px] text-aviva-secondary">{list.length} รายการ {isOpen ? "▴" : "▾"}</span>
            </button>
            {isOpen && (
              <div className="mt-1 space-y-1 pl-2">
                {list.map(i => (
                  <p key={i.id} className="text-[11px] text-aviva-secondary leading-relaxed">
                    • {i.title}{i.detail ? ` · ${i.detail}` : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Row({ item }: { item: CalendarItem }) {
  const meta = KIND_META[item.kind];
  const body = (
    <div className="bg-aviva-bg/60 rounded-xl px-3 py-2">
      <p className="text-xs">
        <span className={clsx("font-bold", meta.text)}>{meta.emoji} {meta.label}</span>
        <span className="text-aviva-text"> — {item.title}</span>
      </p>
      {(item.detail || item.owner) && (
        <p className="text-[11px] text-aviva-secondary mt-0.5">
          {[item.detail, item.owner].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
  return item.link ? <Link href={item.link} className="block active:scale-[0.99] transition-transform">{body}</Link> : body;
}
