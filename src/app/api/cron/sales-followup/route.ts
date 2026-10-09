import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push-notify";
import { sendLineToEmail } from "@/lib/line-log";
import { addDaysStr, thaiDateStr } from "@/lib/thai-date";
import {
  FOLLOWUP_BATCH_SIZE, FOLLOWUP_DONE_STATUSES,
  rankFollowupLeads, splitIntoBatches, type PriorityLead,
} from "@/lib/lead-priority";
import { contactPlan } from "@/lib/contact-channel";

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
      .select("id, customer_name, phone, contact_channel, contact_handle, source, status, budget, ai_score, urgency, probability, plot_number, next_follow_up_date, last_contact_date, visit_date, assigned_to, created_at_default")
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
      // บอกช่องทางจริง ไม่ใช่เบอร์ดิบ — ลูกค้าออนไลน์ 147 รายติดต่อทางแชต ไม่ใช่โทรศัพท์
      // เดิมข้อความสั่งให้ "โทร" พร้อมเบอร์ 099-999-9999 ที่โทรไม่ติด
      const head = `${i + 1}. ${r.lead.customer_name} — ${contactPlan(r.lead).instruction}`;
      return r.reasons.length ? `${head}\n    (${r.reasons.slice(0, 3).join(" · ")})` : head;
    });
    const remaining = ranked.length - batch.length;

    const title = `📣 ชุดติดตามวันนี้ ${batch.length} ราย (เรียงคนสำคัญก่อน)`;
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
      await sendLineToEmail(db, email, `${title}\n\n${body}`, { kind: "sales_followup", title });
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

  // ── เตือนนัดหมายสำคัญล่วงหน้า (Pom แจ้ง 7 ต.ค. 69 ว่านัดโอนบ้าน A7 ไม่มีใครเตือนเลย) ──
  // เตือน 2 จังหวะ: ล่วงหน้า 3 วัน (เตรียมเอกสาร/นัดคน) และเช้าวันนัดเอง
  const apptSent = await remindAppointments(db, today);

  return NextResponse.json({ ok: true, date: today, batchSize: FOLLOWUP_BATCH_SIZE, unassignedTotal, grandTodo, results, apptSent });
}

interface ApptLead {
  id: string; customer_name: string; plot_number: number | null; assigned_to: string | null;
  transfer_appointment_date: string | null; contract_appointment_date: string | null; delivery_date: string | null;
}

const APPT_LABEL: Record<string, string> = {
  transfer_appointment_date: "🔑 นัดโอนกรรมสิทธิ์",
  contract_appointment_date: "📝 นัดทำสัญญา",
  delivery_date: "🏠 นัดส่งมอบบ้าน",
};

/** เตือนนัดโอน/นัดทำสัญญา/นัดส่งมอบ — ถึงพนักงานเจ้าของลูกค้าและผู้บริหาร */
async function remindAppointments(db: SupabaseClient, today: string): Promise<number> {
  const in3 = addDaysStr(today, 3);

  const { data } = await db.from("leads")
    .select("id, customer_name, plot_number, assigned_to, transfer_appointment_date, contract_appointment_date, delivery_date")
    .eq("project_id", PROJECT_ID)
    .or(
      `transfer_appointment_date.in.(${today},${in3}),` +
      `contract_appointment_date.in.(${today},${in3}),` +
      `delivery_date.in.(${today},${in3})`,
    );
  const rows = (data ?? []) as ApptLead[];
  if (rows.length === 0) return 0;

  const hits: { lead: ApptLead; field: keyof typeof APPT_LABEL; date: string }[] = [];
  for (const l of rows) {
    for (const f of Object.keys(APPT_LABEL) as (keyof typeof APPT_LABEL)[]) {
      const d = l[f as keyof ApptLead] as string | null;
      if (d === today || d === in3) hits.push({ lead: l, field: f, date: d });
    }
  }
  if (hits.length === 0) return 0;

  const emailByName = await ownerEmails(db);
  const line = (h: typeof hits[number]) =>
    `${APPT_LABEL[h.field]} — ${h.lead.customer_name}` +
    (h.lead.plot_number ? ` · แปลง ${h.lead.plot_number}` : "") +
    (h.date === today ? " · **วันนี้**" : " · อีก 3 วัน");

  let sent = 0;

  // 1) ถึงพนักงานเจ้าของลูกค้า
  const byOwner = new Map<string, typeof hits>();
  for (const h of hits) {
    const owner = (h.lead.assigned_to ?? "").trim();
    if (!owner) continue;
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), h]);
  }
  for (const [owner, list] of byOwner) {
    const email = emailByName.get(owner.toLowerCase());
    if (!email) continue;
    const title = `📅 นัดหมายที่ต้องเตรียม ${list.length} รายการ`;
    const body = `${list.map(line).join("\n")}\n\nตรวจความพร้อม: เอกสาร · ลูกค้ายืนยัน · ทีมที่เกี่ยวข้อง`;
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "info", to_user_email: email, from_dept: "ระบบขาย",
      title, message: body, is_read: false, link: "/crm",
    }).then(() => {}, () => {});
    await sendLineToEmail(db, email, `${title}\n\n${body}`, { kind: "appointment_reminder", title });
    sent++;
  }

  // 2) ถึงผู้บริหาร — นัดโอน/สัญญา/ส่งมอบเป็นเรื่องที่ผู้บริหารต้องรู้ล่วงหน้าเสมอ
  const eTitle = `📅 นัดหมายสำคัญ ${hits.length} รายการ`;
  await db.from("notifications").insert({
    project_id: PROJECT_ID, type: "info", to_dept: "ผู้บริหาร", from_dept: "ระบบขาย",
    title: eTitle, message: hits.map(line).join("\n"), is_read: false, link: "/crm",
  }).then(() => {}, () => {});

  return sent;
}

/** จับคู่ชื่อพนักงานขาย → อีเมล (leads เก็บเป็นชื่อเล่น) */
async function ownerEmails(db: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await db.from("employees").select("email, full_name, nickname").eq("status", "active");
  const map = new Map<string, string>();
  for (const e of data ?? []) {
    const email = (e.email ?? "").toLowerCase();
    if (!email) continue;
    for (const n of [e.full_name, e.nickname]) {
      if (n) map.set(String(n).trim().toLowerCase(), email);
    }
  }
  return map;
}
