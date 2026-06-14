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

// #10 — รายงานสรุปสิ้นวันอัตโนมัติ (เย็น) ส่งผู้บริหาร + ฝ่ายขายผ่านกระดิ่ง/Push/LINE
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();

  // ขอบเขต "วันนี้" ตามเวลาไทย (UTC+7)
  const nowMs = Date.now();
  const thaiNow = new Date(nowMs + 7 * 3_600_000);
  const startUtcMs = Date.UTC(thaiNow.getUTCFullYear(), thaiNow.getUTCMonth(), thaiNow.getUTCDate()) - 7 * 3_600_000;
  const sinceIso = new Date(startUtcMs).toISOString();
  const todayStr = new Date(startUtcMs + 7 * 3_600_000).toISOString().slice(0, 10);
  const dateLabel = thaiNow.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  const countSince = async (col: string, val: string, gte = true): Promise<number> => {
    const q = db.from("leads").select("id", { count: "exact", head: true }).eq("project_id", PROJECT_ID);
    const { count } = await (gte ? q.gte(col, val) : q.eq(col, val));
    return count ?? 0;
  };

  // หมุดหมายของวัน
  const newLeads = await countSince("created_at", sinceIso, true);
  const bookings = await countSince("booking_date", todayStr, false);
  const contracts = await countSince("contract_signed_date", todayStr, false);
  const loans = await countSince("loan_approved_date", todayStr, false);

  // โอนกรรมสิทธิ์วันนี้ + ยอดขายรวม
  const { data: transfers } = await db
    .from("leads")
    .select("contract_price, budget")
    .eq("project_id", PROJECT_ID)
    .eq("transfer_date", todayStr);
  const transferCount = transfers?.length ?? 0;
  const revenue = (transfers ?? []).reduce((s, l) => s + Number(l.contract_price ?? l.budget ?? 0), 0);

  // งานค้างในระบบ
  const { count: pendingApprovals } = await db
    .from("approval_logs").select("approval_id", { count: "exact", head: true }).eq("action_taken", "Pending");
  const { count: openQueue } = await db
    .from("work_queue").select("id", { count: "exact", head: true }).eq("status", "open");

  const title = `📊 รายงานสรุปสิ้นวัน — ${dateLabel}`;
  const lines = [
    `🆕 ลูกค้าใหม่: ${newLeads} ราย`,
    `📌 จองใหม่: ${bookings} · ทำสัญญา: ${contracts} · อนุมัติสินเชื่อ: ${loans}`,
    `🏆 โอนกรรมสิทธิ์: ${transferCount} หลัง — ยอดขาย ${baht(revenue)}`,
    `⏳ รออนุมัติค้าง: ${pendingApprovals ?? 0} · งานในกล่อง: ${openQueue ?? 0}`,
  ];
  const message = lines.join("\n");

  // 1) กระดิ่งในแอป (ผู้บริหาร)
  await db.from("notifications").insert({
    project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร", from_dept: "ระบบรายงาน",
    title, message, is_read: false,
  });

  // 2) Web push — ผู้บริหาร + ฝ่ายขาย
  await sendPush({ department: "ฝ่ายบริหาร" }, { title, body: message, url: "/reports", tag: "evening-report" }).catch(() => {});
  await sendPush({ department: "ฝ่ายขาย" }, { title, body: message, url: "/reports", tag: "evening-report" }).catch(() => {});

  // 3) LINE ส่วนตัว — ทุกคนที่ผูกบัญชีไว้
  let lineSent = 0;
  try {
    const { data: links } = await db.from("line_links").select("line_user_id").not("linked_at", "is", null);
    const ids = (links ?? []).map((l) => l.line_user_id as string).filter(Boolean);
    const text = `${title}\n${message}\nเปิดดู: /reports`;
    const res = await Promise.allSettled(ids.map((id) => sendLine(id, text)));
    lineSent = res.reduce((n, r) => n + (r.status === "fulfilled" && r.value.ok ? 1 : 0), 0);
  } catch { /* best-effort */ }

  return NextResponse.json({
    ok: true, date: todayStr,
    stats: { newLeads, bookings, contracts, loans, transferCount, revenue, pendingApprovals: pendingApprovals ?? 0, openQueue: openQueue ?? 0 },
    lineSent,
  });
}
