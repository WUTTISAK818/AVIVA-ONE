import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push-notify";
import { sendLine } from "@/lib/line";
import { thaiDateStr } from "@/lib/thai-date";
import {
  FOLLOWUP_BATCH_SIZE, FOLLOWUP_DONE_STATUSES,
  rankFollowupLeads, splitIntoBatches, type PriorityLead,
} from "@/lib/lead-priority";

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

// สรุปงานติดตามลูกค้าประจำวัน ส่งถึงพนักงานขายแต่ละคนตอนเช้า (Vercel Cron 08:00 น. ไทย = 01:00 UTC)
// ส่งเป็น "ชุดวันนี้ 10 ราย" เรียงตามความสำคัญ ไม่ใช่รายชื่อค้างทั้งกอง
// (Pom 28 ก.ย. 69: ส่งทีเดียวหมด พนักงานทำไม่ทันและไม่รู้จะเริ่มที่ใคร)
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  const today = thaiDateStr();

  const [{ data: leadRows }, { data: dir }] = await Promise.all([
    db.from("leads")
      .select("id, customer_name, phone, status, budget, ai_score, urgency, probability, plot_number, next_follow_up_date, last_contact_date, visit_date, assigned_to, created_at_default")
      .not("status", "in", `(${FOLLOWUP_DONE_STATUSES.map(s => `"${s}"`).join(",")})`),
    db.from("employees_directory").select("full_name, nickname, email"),
  ]);

  const emailByName = new Map<string, string>();
  for (const e of (dir ?? []) as { full_name: string | null; nickname: string | null; email: string | null }[]) {
    if (!e.email) continue;
    if (e.nickname) emailByName.set(e.nickname.trim().toLowerCase(), e.email);
    if (e.full_name) emailByName.set(e.full_name.trim().toLowerCase(), e.email);
  }

  const byOwner = new Map<string, PriorityLead[]>();
  for (const l of (leadRows ?? []) as PriorityLead[]) {
    const key = (l.assigned_to ?? "").trim() || "(ไม่มีผู้ดูแล)";
    byOwner.set(key, [...(byOwner.get(key) ?? []), l]);
  }

  const results: { owner: string; todo: number; batchSize: number; batches: number; sent: boolean }[] = [];
  let unassignedTotal = 0;
  let grandTodo = 0;

  for (const [owner, list] of byOwner) {
    const ranked = rankFollowupLeads(list, today);
    const batches = splitIntoBatches(ranked, FOLLOWUP_BATCH_SIZE);
    const batch = batches[0] ?? [];
    grandTodo += ranked.length;

    if (owner === "(ไม่มีผู้ดูแล)") {
      unassignedTotal = list.length;
      results.push({ owner, todo: ranked.length, batchSize: batch.length, batches: batches.length, sent: false });
      continue;
    }
    if (batch.length === 0) {
      results.push({ owner, todo: 0, batchSize: 0, batches: 0, sent: false });
      continue; // ไม่มีงานติดตาม — ไม่กวน
    }

    const lines = batch.map((r, i) => {
      const head = `${i + 1}. ${r.lead.customer_name}${r.lead.phone ? ` ${r.lead.phone}` : ""}`;
      return r.reasons.length ? `${head}\n    (${r.reasons.slice(0, 3).join(" · ")})` : head;
    });
    const remaining = ranked.length - batch.length;

    const title = `📞 ชุดติดตามวันนี้ ${batch.length} ราย (เรียงคนสำคัญก่อน)`;
    const body = [
      lines.join("\n"),
      remaining > 0
        ? `เหลืออีก ${remaining} ราย (อีก ${Math.max(batches.length - 1, 0)} ชุด) — เคลียร์ชุดนี้ก่อน เดี๋ยวชุดถัดไปขึ้นมาเอง`
        : "นี่คือชุดสุดท้ายแล้ว เคลียร์ครบวันนี้ได้เลย",
      "เปิดเมนู CRM → การ์ด \"คิวติดตามลูกค้า\" กดโทรและตั้งวันนัดถัดไปได้ในที่เดียว",
    ].join("\n\n");

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
    results.push({ owner, todo: ranked.length, batchSize: batch.length, batches: batches.length, sent });
  }

  // สรุปภาพรวมถึงผู้บริหาร — เห็นยอดค้างติดตามรวมและลูกค้าที่ยังไม่มีเจ้าของ
  if (grandTodo > 0 || unassignedTotal > 0) {
    const perOwner = results.filter(r => r.todo > 0)
      .map(r => `${r.owner}: ต้องติดตาม ${r.todo} ราย (${r.batches} ชุด)`).join("\n");
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร", from_dept: "ระบบขาย",
      title: `📞 ภาพรวมงานติดตามลูกค้า — ค้าง ${grandTodo} ราย`,
      message: [
        perOwner || "ไม่มีรายการค้างติดตาม",
        unassignedTotal > 0 ? `❗ลูกค้ายังไม่มีผู้ดูแล ${unassignedTotal} ราย — ต้องมอบหมายเจ้าของ` : "",
        `ระบบส่งให้พนักงานวันละ ${FOLLOWUP_BATCH_SIZE} รายแรกที่สำคัญที่สุด`,
      ].filter(Boolean).join("\n"),
      is_read: false, link: "/crm",
    });
  }

  return NextResponse.json({ ok: true, date: today, batchSize: FOLLOWUP_BATCH_SIZE, unassignedTotal, grandTodo, results });
}
