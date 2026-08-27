import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push-notify";
import { sendLine } from "@/lib/line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

interface LeadRow {
  customer_name: string;
  assigned_to: string | null;
  source: string | null;
  budget: string | number | null;
  urgency: string | null;
  probability: string | null;
  financing_type: string | null;
  plot_number: number | null;
}

// สรุปความน่าสนใจตามกฎจากข้อมูลจริง (ไม่ใช้ AI — เร็ว ฟรี ไม่มีทางพัง)
function interestTier(l: LeadRow): { emoji: string; rank: number } {
  const budget = Number(l.budget ?? 0);
  const urgent = l.urgency === "สูง" || l.urgency === "สูงมาก";
  const highProb = (l.probability ?? "").toLowerCase().startsWith("high");
  if (urgent || highProb || budget >= 8_000_000) return { emoji: "🔥", rank: 0 };
  const hasSignal = budget > 0 || !!l.probability || (l.financing_type && l.financing_type !== "ไม่ระบุ");
  if (hasSignal) return { emoji: "🟡", rank: 1 };
  return { emoji: "⚪", rank: 2 };
}

// จัดกลุ่มช่องทางที่มาของลูกค้า (จาก leads.source ที่กรอกจริง) เป็น 4 กลุ่มตามที่ Pom ขอ
const CHANNEL_ORDER = ["วอล์กอิน", "Facebook", "LINE", "อื่นๆ"] as const;
function channelBucket(source: string | null): (typeof CHANNEL_ORDER)[number] {
  const s = (source ?? "").toLowerCase();
  if (!s) return "อื่นๆ";
  if (s.includes("walk-in") || s.includes("walkin") || s.includes("วอล์กอิน") || s.includes("วอล์คอิน")) return "วอล์กอิน";
  if (s.includes("facebook")) return "Facebook";
  if (s.includes("line")) return "LINE";
  return "อื่นๆ";
}
function channelCounts(withTier: RankedLead[]): Map<string, number> {
  const byChannel = new Map<string, number>();
  for (const { l } of withTier) {
    const c = channelBucket(l.source);
    byChannel.set(c, (byChannel.get(c) ?? 0) + 1);
  }
  return byChannel;
}
function channelSummaryLine(byChannel: Map<string, number>): string {
  return CHANNEL_ORDER.filter((c) => byChannel.has(c)).map((c) => `${c} ${byChannel.get(c)}`).join(" · ");
}

async function fetchLeadsSince(db: SupabaseClient, sinceIso: string): Promise<LeadRow[]> {
  const { data, error } = await db
    .from("leads")
    .select("customer_name, assigned_to, source, budget, urgency, probability, financing_type, plot_number, created_at, created_at_default")
    .eq("project_id", PROJECT_ID)
    .or(`created_at_default.gte.${sinceIso},and(created_at_default.is.null,created_at.gte.${sinceIso})`);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadRow[];
}

function rankLeads(leads: LeadRow[]) {
  return leads
    .map((l) => ({ l, tier: interestTier(l) }))
    .sort((a, b) => a.tier.rank - b.tier.rank || Number(b.l.budget ?? 0) - Number(a.l.budget ?? 0));
}

type RankedLead = ReturnType<typeof rankLeads>[number];

// ใบสรุปแบบรายวัน — ลิสต์รายชื่อทุกรายพร้อมความน่าสนใจ + ช่องทางที่มา
function composeDailyMessage(withTier: RankedLead[]): string {
  if (withTier.length === 0) return "วันนี้ยังไม่มีลูกค้าใหม่เข้าระบบค่ะ";
  const lines = withTier.slice(0, 15).map(({ l, tier }) => {
    const budgetText = Number(l.budget ?? 0) > 0 ? baht(Number(l.budget)) : "ไม่ระบุงบ";
    const plot = l.plot_number ? ` · แปลง ${l.plot_number}` : "";
    const financing = l.financing_type && l.financing_type !== "ไม่ระบุ" ? ` · ${l.financing_type}` : "";
    const who = l.assigned_to || "ไม่ระบุผู้ดูแล";
    const channel = channelBucket(l.source);
    return `${tier.emoji} ${l.customer_name} (${who} · ${channel}) — ${budgetText}${l.urgency ? ` · ${l.urgency}` : ""}${financing}${plot}`;
  });
  const more = withTier.length > 15 ? `\n…และอีก ${withTier.length - 15} ราย` : "";
  const hot = withTier.filter((x) => x.tier.rank === 0).length;
  const channelLine = channelSummaryLine(channelCounts(withTier));
  return `รับลูกค้าใหม่ทั้งหมด ${withTier.length} ราย (🔥 น่าสนใจสูง ${hot} ราย)\nช่องทาง: ${channelLine}\n\n${lines.join("\n")}${more}`;
}

// ใบสรุปแบบช่วง (สัปดาห์/เดือน) — แยกตามผู้ดูแล + ลิสต์เฉพาะรายที่น่าสนใจสูง (กันข้อความยาวเกิน)
function composeRangeMessage(withTier: RankedLead[]): string {
  if (withTier.length === 0) return "ช่วงนี้ยังไม่มีลูกค้าใหม่เข้าระบบค่ะ";

  const hot = withTier.filter((x) => x.tier.rank === 0).length;
  const warm = withTier.filter((x) => x.tier.rank === 1).length;
  const cold = withTier.filter((x) => x.tier.rank === 2).length;

  const byOwner = new Map<string, number>();
  for (const { l } of withTier) {
    const who = l.assigned_to || "ไม่ระบุผู้ดูแล";
    byOwner.set(who, (byOwner.get(who) ?? 0) + 1);
  }
  const ownerLines = [...byOwner.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([who, n]) => `- ${who}: ${n} ราย`);

  const byChannel = channelCounts(withTier);
  const channelLines = CHANNEL_ORDER.filter((c) => byChannel.has(c)).map((c) => `- ${c}: ${byChannel.get(c)} ราย`);

  const hotLeads = withTier.filter((x) => x.tier.rank === 0).slice(0, 15);
  const hotLines = hotLeads.map(({ l, tier }) => {
    const budgetText = Number(l.budget ?? 0) > 0 ? baht(Number(l.budget)) : "ไม่ระบุงบ";
    const who = l.assigned_to || "ไม่ระบุผู้ดูแล";
    const channel = channelBucket(l.source);
    return `${tier.emoji} ${l.customer_name} (${who} · ${channel}) — ${budgetText}${l.urgency ? ` · ${l.urgency}` : ""}`;
  });
  const hotMore = hot > hotLines.length ? `\n…และอีก ${hot - hotLines.length} ราย` : "";
  const hotSection = hotLeads.length > 0 ? `\n\nลูกค้าน่าสนใจสูงในช่วงนี้:\n${hotLines.join("\n")}${hotMore}` : "";

  return `รับลูกค้าใหม่รวม ${withTier.length} ราย (🔥 ${hot} · 🟡 ${warm} · ⚪ ${cold})\n\nแยกตามช่องทาง:\n${channelLines.join("\n")}\n\nแยกตามผู้ดูแล:\n${ownerLines.join("\n")}${hotSection}`;
}

async function deliver(db: SupabaseClient, title: string, message: string) {
  // 1) กระดิ่งในแอป — ฝ่ายขาย + ผู้บริหาร
  await db.from("notifications").insert([
    { project_id: PROJECT_ID, type: "info", to_dept: "ฝ่ายขาย", from_dept: "ระบบรายงาน", title, message, is_read: false, link: "/crm" },
    { project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร", from_dept: "ระบบรายงาน", title, message, is_read: false, link: "/crm" },
  ]);

  // 2) Web push — ฝ่ายขาย + ผู้บริหาร (best-effort, ยังไม่มีคนสมัครรับก็ไม่ error)
  await sendPush({ department: "ฝ่ายขาย" }, { title, body: message, url: "/crm", tag: "sales-lead-digest" }).catch(() => {});
  await sendPush({ department: "ฝ่ายบริหาร" }, { title, body: message, url: "/crm", tag: "sales-lead-digest" }).catch(() => {});

  // 3) LINE ส่วนตัว — ทุกคนที่ผูกบัญชีไว้ (ช่องทางหลักตามที่ Pom เลือก)
  let lineSent = 0;
  try {
    const { data: links } = await db.from("line_links").select("line_user_id").not("linked_at", "is", null);
    const ids = (links ?? []).map((l) => l.line_user_id as string).filter(Boolean);
    const text = `${title}\n${message}\nเปิดดู: /crm`;
    const res = await Promise.allSettled(ids.map((id) => sendLine(id, text)));
    lineSent = res.reduce((n, r) => n + (r.status === "fulfilled" && r.value.ok ? 1 : 0), 0);
  } catch { /* best-effort */ }

  return lineSent;
}

// #16 — สรุปลูกค้าใหม่ประจำวันให้ฝ่ายขาย ทุกวัน + สรุปรายสัปดาห์ทุกวันอาทิตย์ + สรุปรายเดือนวันสุดท้ายของเดือน (LINE + กระดิ่งในแอป)
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();

  // ขอบเขต "วันนี้" ตามเวลาไทย (UTC+7)
  const nowMs = Date.now();
  const thaiNow = new Date(nowMs + 7 * 3_600_000);
  const startOfTodayUtcMs = Date.UTC(thaiNow.getUTCFullYear(), thaiNow.getUTCMonth(), thaiNow.getUTCDate()) - 7 * 3_600_000;
  const dateLabel = thaiNow.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  const result: Record<string, unknown> = { ok: true, date: dateLabel };

  // 1) รายวัน — ส่งทุกวัน
  try {
    const dailyLeads = rankLeads(await fetchLeadsSince(db, new Date(startOfTodayUtcMs).toISOString()));
    const title = `📋 สรุปลูกค้าใหม่วันนี้ — ${dateLabel}`;
    const message = composeDailyMessage(dailyLeads);
    const lineSent = await deliver(db, title, message);
    result.daily = { totalLeads: dailyLeads.length, lineSent };
  } catch (e) {
    result.daily = { error: (e as Error).message };
  }

  // 2) รายสัปดาห์ — เฉพาะวันอาทิตย์ (สัปดาห์ จันทร์–อาทิตย์ ตามเวลาไทย)
  const isSundayThai = thaiNow.getUTCDay() === 0;
  if (isSundayThai) {
    try {
      const mondayUtcMs = startOfTodayUtcMs - 6 * 86_400_000;
      const weekStartLabel = new Date(mondayUtcMs + 7 * 3_600_000).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
      const weekLeads = rankLeads(await fetchLeadsSince(db, new Date(mondayUtcMs).toISOString()));
      const title = `📅 สรุปลูกค้าใหม่รายสัปดาห์ — ${weekStartLabel} ถึง ${dateLabel}`;
      const message = composeRangeMessage(weekLeads);
      const lineSent = await deliver(db, title, message);
      result.weekly = { totalLeads: weekLeads.length, lineSent };
    } catch (e) {
      result.weekly = { error: (e as Error).message };
    }
  }

  // 3) รายเดือน — เฉพาะวันสุดท้ายของเดือน (ตามเวลาไทย)
  const nextDayMonthThai = new Date(Date.UTC(thaiNow.getUTCFullYear(), thaiNow.getUTCMonth(), thaiNow.getUTCDate() + 1)).getUTCMonth();
  const isLastDayOfMonthThai = nextDayMonthThai !== thaiNow.getUTCMonth();
  if (isLastDayOfMonthThai) {
    try {
      const monthStartUtcMs = Date.UTC(thaiNow.getUTCFullYear(), thaiNow.getUTCMonth(), 1) - 7 * 3_600_000;
      const monthLabel = thaiNow.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
      const monthLeads = rankLeads(await fetchLeadsSince(db, new Date(monthStartUtcMs).toISOString()));
      const title = `🗓️ สรุปลูกค้าใหม่ประจำเดือน — ${monthLabel}`;
      const message = composeRangeMessage(monthLeads);
      const lineSent = await deliver(db, title, message);
      result.monthly = { totalLeads: monthLeads.length, lineSent };
    } catch (e) {
      result.monthly = { error: (e as Error).message };
    }
  }

  return NextResponse.json(result);
}
