import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push-notify";
import { sendLine } from "@/lib/line";
import { thaiDateStr } from "@/lib/work-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TAKEN_STATUSES = ["Booking", "Contract", "Loan Approved", "Closed Deal"];

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

interface LeadRow {
  customer_name: string;
  phone: string | null;
  assigned_to: string | null;
  plot_number: number | null;
  next_follow_up_date: string | null;
  status: string;
}

// สรุปงานติดตามลูกค้าประจำวัน ส่งถึงพนักงานขายแต่ละคนตอนเช้า (Vercel Cron 08:00 น. ไทย = 01:00 UTC)
// นับเฉพาะลูกค้าที่ยังไม่ปิดการขาย — แยก "เลยนัดแล้ว" / "นัดวันนี้" ให้เห็นชัดว่าต้องโทรใครก่อน
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  const today = thaiDateStr();

  const [{ data: leadRows }, { data: dir }] = await Promise.all([
    db.from("leads")
      .select("customer_name, phone, assigned_to, plot_number, next_follow_up_date, status")
      .not("status", "in", `(${TAKEN_STATUSES.map(s => `"${s}"`).join(",")})`),
    db.from("employees_directory").select("full_name, nickname, email"),
  ]);

  const emailByName = new Map<string, string>();
  for (const e of (dir ?? []) as { full_name: string | null; nickname: string | null; email: string | null }[]) {
    if (!e.email) continue;
    if (e.nickname) emailByName.set(e.nickname.trim().toLowerCase(), e.email);
    if (e.full_name) emailByName.set(e.full_name.trim().toLowerCase(), e.email);
  }

  const byOwner = new Map<string, LeadRow[]>();
  for (const l of (leadRows ?? []) as LeadRow[]) {
    const key = (l.assigned_to ?? "").trim() || "(ไม่มีผู้ดูแล)";
    byOwner.set(key, [...(byOwner.get(key) ?? []), l]);
  }

  const results: { owner: string; overdue: number; dueToday: number; noDate: number; sent: boolean }[] = [];
  let unassignedTotal = 0;

  for (const [owner, list] of byOwner) {
    const overdue = list.filter(l => l.next_follow_up_date && l.next_follow_up_date < today);
    const dueToday = list.filter(l => l.next_follow_up_date === today);
    const noDate = list.filter(l => !l.next_follow_up_date);

    if (owner === "(ไม่มีผู้ดูแล)") {
      unassignedTotal = list.length;
      results.push({ owner, overdue: overdue.length, dueToday: dueToday.length, noDate: noDate.length, sent: false });
      continue;
    }
    if (overdue.length === 0 && dueToday.length === 0) {
      results.push({ owner, overdue: 0, dueToday: 0, noDate: noDate.length, sent: false });
      continue; // ไม่มีงานเร่ง — ไม่กวน
    }

    const line = (l: LeadRow) => `• ${l.customer_name}${l.phone ? ` ${l.phone}` : ""}${l.plot_number ? ` · แปลง ${l.plot_number}` : ""}`;
    const parts = [
      overdue.length > 0 ? `⚠️ เลยนัดแล้ว ${overdue.length} ราย:\n${overdue.slice(0, 8).map(line).join("\n")}${overdue.length > 8 ? `\n… และอีก ${overdue.length - 8} ราย` : ""}` : "",
      dueToday.length > 0 ? `🔔 นัดวันนี้ ${dueToday.length} ราย:\n${dueToday.slice(0, 8).map(line).join("\n")}${dueToday.length > 8 ? `\n… และอีก ${dueToday.length - 8} ราย` : ""}` : "",
      noDate.length > 0 ? `📋 ยังไม่ได้ตั้งวันนัดติดตาม ${noDate.length} ราย` : "",
    ].filter(Boolean);

    const title = `📞 งานติดตามลูกค้าวันนี้ — ${overdue.length + dueToday.length} ราย`;
    const body = parts.join("\n\n");
    const email = emailByName.get(owner.toLowerCase());
    let sent = false;

    if (email) {
      await db.from("notifications").insert({
        project_id: PROJECT_ID, type: "info", to_user_email: email, from_dept: "ระบบขาย",
        title, message: body, is_read: false, link: "/crm",
      });
      await sendPush({ userEmail: email }, { title, body, url: "/crm", tag: "sales-followup" }).catch(() => {});
      try {
        const { data: link } = await db.from("line_links").select("line_user_id")
          .ilike("user_email", email).not("linked_at", "is", null).maybeSingle();
        if (link?.line_user_id) await sendLine(link.line_user_id, `${title}\n\n${body}`);
      } catch { /* best-effort */ }
      sent = true;
    }
    results.push({ owner, overdue: overdue.length, dueToday: dueToday.length, noDate: noDate.length, sent });
  }

  // สรุปภาพรวมถึงผู้บริหาร — เห็นยอดค้างติดตามรวมและลูกค้าที่ยังไม่มีเจ้าของ
  const totalOverdue = results.reduce((s, r) => s + r.overdue, 0);
  const totalNoDate = results.reduce((s, r) => s + r.noDate, 0);
  if (totalOverdue > 0 || unassignedTotal > 0) {
    const perOwner = results.filter(r => r.overdue > 0).map(r => `${r.owner}: เลยนัด ${r.overdue}`).join(" · ");
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร", from_dept: "ระบบขาย",
      title: `📞 ภาพรวมงานติดตามลูกค้า — เลยนัด ${totalOverdue} ราย`,
      message: [
        perOwner || "ไม่มีรายการเลยนัด",
        unassignedTotal > 0 ? `❗ลูกค้ายังไม่มีผู้ดูแล ${unassignedTotal} ราย — ต้องมอบหมายเจ้าของ` : "",
        totalNoDate > 0 ? `📋 ยังไม่ได้ตั้งวันนัดติดตามรวม ${totalNoDate} ราย` : "",
      ].filter(Boolean).join("\n"),
      is_read: false, link: "/crm",
    });
  }

  return NextResponse.json({ ok: true, date: today, unassignedTotal, totalOverdue, totalNoDate, results });
}
