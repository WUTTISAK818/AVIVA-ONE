import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendLineToEmail } from "@/lib/line-log";
import { isSuperRole } from "@/lib/roles";
import { submitEditRequest, diffSnapshot, formatEditValue, type LeadEditRequest } from "@/lib/lead-edit-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function admin(): SupabaseClient {
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

// คำขอแก้ไขข้อมูลลูกค้าที่ "หมดเวลาแก้ไข" แล้ว (v8.12 · Pom สั่ง 16 พ.ย. 69)
//  - มีการแก้ -> ส่งให้ผู้บริหารตรวจแทนพนักงาน (auto_submitted) + แจ้งผู้บริหาร + แจ้งผู้ขอ
//  - ไม่ได้แก้อะไร -> ปิดคำขอ (ไม่รบกวนผู้บริหาร) + แจ้งผู้ขอ
// หน้าอนุมัติ/หน้า CRM ก็ส่งตรวจให้ทันทีที่มีคนเปิดเจอ — cron นี้คือตาข่ายกันค้างเมื่อไม่มีใครเปิดแอป
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();

  const { data, error } = await db.from("lead_edit_requests").select("*")
    .eq("status", "editing").lt("edit_until", new Date().toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as LeadEditRequest[];
  if (rows.length === 0) return NextResponse.json({ ok: true, expired: 0 });

  const { data: leadRows } = await db.from("leads").select("id, lead_code, customer_name")
    .in("id", rows.map((r) => r.lead_id));
  const leadById = new Map((leadRows ?? []).map((l) => [l.id as string, l as { id: string; lead_code: string | null; customer_name: string | null }]));

  const { data: users } = await db.from("users").select("email, role");
  const execEmails = (users ?? []).filter((u) => u.email && isSuperRole(u.role as string | null)).map((u) => u.email as string);

  let submitted = 0, closed = 0;
  const failed: string[] = [];
  for (const r of rows) {
    const res = await submitEditRequest(db, r, { auto: true, by: { name: "ระบบ (หมดเวลาแก้ไข)" } });
    if (!res.ok) { failed.push(`${r.id.slice(0, 8)}: ${res.reason}`); continue; }
    const lead = leadById.get(r.lead_id);
    const who = `${lead?.lead_code ?? ""} ${lead?.customer_name ?? ""}`.trim();
    const link = `/crm?lead=${r.lead_id}`;

    if (res.closedNoChange) {
      closed++;
      const title = `⌛ หมดเวลาแก้ไข — ${who}`;
      const body = "ไม่มีข้อมูลที่ถูกแก้ ระบบปิดคำขอให้แล้ว ถ้ายังต้องแก้ ให้ยื่นคำขอใหม่";
      await db.from("notifications").insert({
        project_id: PROJECT_ID, type: "info", to_user_email: r.requested_by_email, from_dept: "ผู้บริหาร",
        title, message: body, is_read: false, record_id: r.lead_id, link,
      });
      await sendLineToEmail(db, r.requested_by_email, `${title}\n\n${body}`, { kind: "other", refType: "lead", refId: r.lead_id, title });
      continue;
    }

    submitted++;
    const diff = res.diff ?? diffSnapshot(r.snapshot, null);
    const lines = diff.map((d) => `• ${d.label}: ${formatEditValue(d.field, d.before)} → ${formatEditValue(d.field, d.after)}`).join("\n");
    const execTitle = `📝 รอตรวจการแก้ไขข้อมูลลูกค้า — ${who}`;
    const execBody = `${r.requested_by_name ?? r.requested_by_email} หมดเวลาแก้ไข ระบบส่งตรวจให้ (${diff.length} ช่อง)\n${lines}\nตรวจได้ที่หน้าอนุมัติ`;
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "approval", to_dept: "ผู้บริหาร", from_dept: "ฝ่ายขาย",
      title: execTitle, message: execBody, is_read: false, record_id: r.lead_id, link: "/approvals",
    });
    for (const email of execEmails) {
      await sendLineToEmail(db, email, `${execTitle}\n\n${execBody}`, { kind: "other", refType: "lead", refId: r.lead_id, title: execTitle });
    }
    const reqTitle = `📤 หมดเวลาแก้ไข ระบบส่งให้ผู้บริหารตรวจแล้ว — ${who}`;
    const reqBody = `ส่งตรวจ ${diff.length} ช่อง · รอผู้บริหารตรวจ (อนุมัติ / ตีกลับให้แก้ใหม่ / คืนค่าเดิม)`;
    await db.from("notifications").insert({
      project_id: PROJECT_ID, type: "info", to_user_email: r.requested_by_email, from_dept: "ผู้บริหาร",
      title: reqTitle, message: reqBody, is_read: false, record_id: r.lead_id, link,
    });
    await sendLineToEmail(db, r.requested_by_email, `${reqTitle}\n\n${reqBody}`, { kind: "other", refType: "lead", refId: r.lead_id, title: reqTitle });
  }

  return NextResponse.json({ ok: true, expired: rows.length, submitted, closed, failed });
}
