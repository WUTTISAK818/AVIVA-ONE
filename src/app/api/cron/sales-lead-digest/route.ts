import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

// #16 — สรุปลูกค้าใหม่ประจำวันให้ฝ่ายขาย: วันนี้รับกี่ราย ชื่ออะไร น่าสนใจแค่ไหน (LINE + กระดิ่งในแอป)
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();

  // ขอบเขต "วันนี้" ตามเวลาไทย (UTC+7)
  const nowMs = Date.now();
  const thaiNow = new Date(nowMs + 7 * 3_600_000);
  const startUtcMs = Date.UTC(thaiNow.getUTCFullYear(), thaiNow.getUTCMonth(), thaiNow.getUTCDate()) - 7 * 3_600_000;
  const sinceIso = new Date(startUtcMs).toISOString();
  const dateLabel = thaiNow.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  // ลูกค้าใหม่วันนี้ — ใช้ created_at_default (timestamptz) ก่อน ไม่มีค่อย fallback created_at
  const { data: rows, error } = await db
    .from("leads")
    .select("customer_name, assigned_to, source, budget, urgency, probability, financing_type, plot_number, created_at, created_at_default")
    .eq("project_id", PROJECT_ID)
    .or(`created_at_default.gte.${sinceIso},and(created_at_default.is.null,created_at.gte.${sinceIso})`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leads = (rows ?? []) as LeadRow[];
  const withTier = leads
    .map((l) => ({ l, tier: interestTier(l) }))
    .sort((a, b) => a.tier.rank - b.tier.rank || Number(b.l.budget ?? 0) - Number(a.l.budget ?? 0));

  const title = `📋 สรุปลูกค้าใหม่วันนี้ — ${dateLabel}`;
  let message: string;

  if (withTier.length === 0) {
    message = "วันนี้ยังไม่มีลูกค้าใหม่เข้าระบบค่ะ";
  } else {
    const lines = withTier.slice(0, 15).map(({ l, tier }) => {
      const budgetText = Number(l.budget ?? 0) > 0 ? baht(Number(l.budget)) : "ไม่ระบุงบ";
      const plot = l.plot_number ? ` · แปลง ${l.plot_number}` : "";
      const financing = l.financing_type && l.financing_type !== "ไม่ระบุ" ? ` · ${l.financing_type}` : "";
      const who = l.assigned_to || l.source || "ไม่ระบุผู้ดูแล";
      return `${tier.emoji} ${l.customer_name} (${who}) — ${budgetText}${l.urgency ? ` · ${l.urgency}` : ""}${financing}${plot}`;
    });
    const more = withTier.length > 15 ? `\n…และอีก ${withTier.length - 15} ราย` : "";
    const hot = withTier.filter((x) => x.tier.rank === 0).length;
    message = `รับลูกค้าใหม่ทั้งหมด ${withTier.length} ราย (🔥 น่าสนใจสูง ${hot} ราย)\n\n${lines.join("\n")}${more}`;
  }

  // 1) กระดิ่งในแอป — ฝ่ายขาย + ผู้บริหาร
  await db.from("notifications").insert([
    { project_id: PROJECT_ID, type: "info", to_dept: "ฝ่ายขาย", from_dept: "ระบบรายงาน", title, message, is_read: false, link: "/crm" },
    { project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร", from_dept: "ระบบรายงาน", title, message, is_read: false, link: "/crm" },
  ]);

  // 2) Web push — ฝ่ายขาย + ผู้บริหาร (best-effort, ยังไม่มีคนสมัครรับก็ไม่ error)
  await sendPush({ department: "ฝ่ายขาย" }, { title, body: message, url: "/crm", tag: "sales-lead-digest" }).catch(() => {});
  await sendPush({ department: "ฝ่ายบริหาร" }, { title, body: message, url: "/crm", tag: "sales-lead-digest" }).catch(() => {});

  // 3) LINE ส่วนตัว — ทุกคนที่ผูกบัญชีไว้ (เหมือน evening-report)
  let lineSent = 0;
  try {
    const { data: links } = await db.from("line_links").select("line_user_id").not("linked_at", "is", null);
    const ids = (links ?? []).map((l) => l.line_user_id as string).filter(Boolean);
    const text = `${title}\n${message}\nเปิดดู: /crm`;
    const res = await Promise.allSettled(ids.map((id) => sendLine(id, text)));
    lineSent = res.reduce((n, r) => n + (r.status === "fulfilled" && r.value.ok ? 1 : 0), 0);
  } catch { /* best-effort */ }

  return NextResponse.json({ ok: true, date: dateLabel, totalLeads: withTier.length, lineSent });
}
