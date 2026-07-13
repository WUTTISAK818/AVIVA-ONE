import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// สรุป "รับลูกค้ารายสัปดาห์ แยกรายพนักงานขาย" สำหรับผู้บริหาร/ผจก.
// received = lead ที่ถูกสร้างในสัปดาห์นั้น (จันทร์–อาทิตย์ เวลาไทย UTC+7) แยกตามผู้ดูแล
// siteVisit/booking/closed = จำนวนของ lead ชุดนั้นที่สถานะปัจจุบันถึงขั้นนั้น
const TH_OFFSET_MS = 7 * 3_600_000;

// วันจันทร์ของสัปดาห์ (เวลาไทย) ที่ห่างจากสัปดาห์นี้ไป weeksAgo สัปดาห์ → คืน [start, end] เป็น ISO date
function weekRange(weeksAgo: number): { start: string; end: string } {
  const nowTh = new Date(Date.now() + TH_OFFSET_MS);
  const dow = nowTh.getUTCDay(); // 0=อา..6=ส
  const mondayOffset = (dow + 6) % 7; // ระยะจากจันทร์
  const monday = new Date(nowTh);
  monday.setUTCDate(nowTh.getUTCDate() - mondayOffset - weeksAgo * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

// วันที่ (เวลาไทย) ที่ lead ถูกสร้าง — ใช้ created_at_default ก่อน (timestamptz) ไม่มีค่อยใช้ created_at
function thaiCreateDate(row: { created_at_default: string | null; created_at: string | null }): string | null {
  const raw = row.created_at_default ?? (row.created_at ? row.created_at + "Z" : null);
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + TH_OFFSET_MS).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { user, error } = await verifyAuth(req, ["manager"]);
  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const weeksAgo = Math.max(0, Math.min(52, Number(req.nextUrl.searchParams.get("weeksAgo") ?? 0) || 0));
    const { start, end } = weekRange(weeksAgo);
    const db = getSupabaseAdmin();

    const { data, error: qErr } = await db
      .from("leads")
      .select("assigned_to, source, status, created_at, created_at_default");
    if (qErr) throw qErr;

    type Row = { received: number; siteVisit: number; booking: number; closed: number };
    const groups = new Map<string, Row>();
    const add = (name: string): Row => {
      if (!groups.has(name)) groups.set(name, { received: 0, siteVisit: 0, booking: 0, closed: 0 });
      return groups.get(name)!;
    };

    for (const l of (data ?? []) as Record<string, string | null>[]) {
      const d = thaiCreateDate({ created_at_default: l.created_at_default, created_at: l.created_at });
      if (!d || d < start || d > end) continue;
      const key = (l.assigned_to || l.source || "ไม่ระบุ").trim() || "ไม่ระบุ";
      const g = add(key);
      g.received += 1;
      if (l.status === "Site Visit") g.siteVisit += 1;
      else if (l.status === "Booking") g.booking += 1;
      else if (l.status === "Closed Deal") g.closed += 1;
    }

    const rows = Array.from(groups.entries())
      .map(([name, r]) => ({ name, ...r }))
      .sort((a, b) => b.received - a.received || b.closed - a.closed);
    const total = rows.reduce(
      (s, r) => ({ received: s.received + r.received, siteVisit: s.siteVisit + r.siteVisit, booking: s.booking + r.booking, closed: s.closed + r.closed }),
      { received: 0, siteVisit: 0, booking: 0, closed: 0 },
    );

    return NextResponse.json({ weekStart: start, weekEnd: end, weeksAgo, rows, total });
  } catch (err) {
    console.error("Error fetching weekly intake:", err);
    return NextResponse.json({ error: "Failed to fetch weekly intake" }, { status: 500 });
  }
}
