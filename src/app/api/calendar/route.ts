import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAuth } from "@/lib/api-auth";
import { isManagerRole } from "@/lib/roles";
import { expandRange, sortItems, type CalendarItem } from "@/lib/calendar-sources";

export const dynamic = "force-dynamic";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const dateOnly = (v: string | null) => (v ? v.slice(0, 10) : null);

/**
 * ปฏิทินโครงการ — รวมทุกอย่างที่ "มีวันกำหนดไว้" จากทุกส่วนของแอปไว้ที่เดียว
 * (Pom สั่ง 7 ต.ค. 69 ให้จัดการปฏิทินและเชื่อมข้อมูลจากส่วนต่าง ๆ)
 *
 * ขอบเขตการเห็น: ผู้บริหารเห็นทั้งโครงการ · พนักงานเห็นเฉพาะของตัวเอง
 * (ลูกค้าที่ตัวเองดูแล + คำสั่งงานของตัวเอง + วันหยุด/วันลาของตัวเอง)
 */
export async function GET(req: NextRequest) {
  const { user, error } = await verifyAuth(req);
  if (error || !user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) {
    return NextResponse.json({ error: "ต้องระบุ from/to เป็น YYYY-MM-DD" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: dbUser } = await db.from("users").select("role, full_name").eq("id", user.id).maybeSingle();
  const manager = isManagerRole(dbUser?.role);
  const myEmail = (user.email ?? "").toLowerCase();
  const myName = ((dbUser?.full_name as string | null) ?? "").trim();

  // ชื่อเล่นของตัวเอง — leads.assigned_to เก็บเป็นชื่อเล่น ไม่ใช่อีเมล
  const { data: me } = await db.from("employees")
    .select("full_name, nickname").ilike("email", myEmail).maybeSingle();
  const myNames = [myName, me?.full_name, me?.nickname]
    .filter(Boolean).map(n => String(n).trim().toLowerCase());

  const items: CalendarItem[] = [];
  const add = (i: CalendarItem) => { if (i.date >= from && i.date <= to) items.push(i); };

  const [leadsRes, instRes, dirRes, housesRes, apprRes, holRes, leaveRes, evtRes] = await Promise.all([
    db.from("leads")
      .select("id, customer_name, plot_number, assigned_to, status, transfer_appointment_date, contract_appointment_date, delivery_date, next_follow_up_date, visit_date")
      .eq("project_id", PROJECT_ID)
      .or([
        `and(transfer_appointment_date.gte.${from},transfer_appointment_date.lte.${to})`,
        `and(contract_appointment_date.gte.${from},contract_appointment_date.lte.${to})`,
        `and(delivery_date.gte.${from},delivery_date.lte.${to})`,
        `and(next_follow_up_date.gte.${from},next_follow_up_date.lte.${to})`,
        `and(visit_date.gte.${from},visit_date.lte.${to})`,
      ].join(",")),
    db.from("customer_installments")
      .select("id, lead_id, name, amount, due_date, status")
      .gte("due_date", from).lte("due_date", to).neq("status", "paid"),
    db.from("directives")
      .select("id, message, due_date, assigned_to, assigned_to_name, status")
      .not("due_date", "is", null).gte("due_date", from).lte("due_date", to)
      .not("status", "in", '("closed","cancelled")'),
    db.from("houses")
      .select("id, plot_code, planned_completion_date, construction_status, progress")
      .eq("project_id", PROJECT_ID)
      .not("planned_completion_date", "is", null)
      .gte("planned_completion_date", from).lte("planned_completion_date", to),
    db.from("approval_logs")
      .select("approval_id, workflow_type, source_doc_index, sla_due_at, action_taken, assigned_to_name")
      .not("sla_due_at", "is", null)
      .gte("sla_due_at", from + "T00:00:00").lte("sla_due_at", to + "T23:59:59"),
    db.from("company_holidays").select("id, holiday_date, name")
      .gte("holiday_date", from).lte("holiday_date", to),
    db.from("leave_requests")
      .select("id, employee_name, employee_dept, leave_type, date_from, date_to, status")
      .eq("status", "approved").lte("date_from", to).gte("date_to", from),
    db.from("events").select("id, title, event_date, event_type, description, is_done")
      .gte("event_date", from).lte("event_date", to),
  ]);

  const mine = (owner: string | null | undefined) =>
    manager || (!!owner && myNames.includes(owner.trim().toLowerCase()));

  const leadById = new Map<string, { name: string; plot: number | null; owner: string | null }>();
  for (const l of leadsRes.data ?? []) {
    leadById.set(l.id as string, {
      name: l.customer_name as string,
      plot: (l.plot_number as number | null) ?? null,
      owner: (l.assigned_to as string | null) ?? null,
    });
    if (!mine(l.assigned_to as string | null)) continue;
    const base = {
      title: l.customer_name as string,
      detail: l.plot_number ? `แปลง ${l.plot_number}` : null,
      owner: (l.assigned_to as string | null) ?? null,
      link: "/crm",
    };
    const push = (kind: CalendarItem["kind"], d: string | null) =>
      d && add({ id: `${l.id}-${kind}`, kind, date: d, ...base });
    push("transfer", dateOnly(l.transfer_appointment_date as string | null));
    push("contract", dateOnly(l.contract_appointment_date as string | null));
    push("delivery", dateOnly(l.delivery_date as string | null));
    push("visit", dateOnly(l.visit_date as string | null));
    push("followup", dateOnly(l.next_follow_up_date as string | null));
  }

  for (const i of instRes.data ?? []) {
    const lead = leadById.get(i.lead_id as string);
    if (lead && !mine(lead.owner)) continue;
    add({
      id: `inst-${i.id}`, kind: "installment", date: dateOnly(i.due_date as string)!,
      title: lead?.name ?? (i.name as string),
      detail: `${i.name as string} · ${baht(Number(i.amount ?? 0))}`,
      owner: lead?.owner ?? null, link: "/crm",
    });
  }

  for (const d of dirRes.data ?? []) {
    if (!manager && (d.assigned_to as string ?? "").toLowerCase() !== myEmail) continue;
    const msg = (d.message as string).replace(/\s+/g, " ").trim();
    add({
      id: `dir-${d.id}`, kind: "directive", date: dateOnly(d.due_date as string)!,
      title: msg.length > 60 ? `${msg.slice(0, 60)}…` : msg,
      detail: `ผู้รับ: ${(d.assigned_to_name as string | null) ?? "-"}`,
      owner: (d.assigned_to_name as string | null) ?? null, link: "/directives",
    });
  }

  for (const h of housesRes.data ?? []) {
    add({
      id: `house-${h.id}`, kind: "completion", date: dateOnly(h.planned_completion_date as string)!,
      title: `แปลง ${h.plot_code as string}`,
      detail: `ความคืบหน้าตอนนี้ ${Number(h.progress ?? 0)}%`,
      owner: null, link: "/construction",
    });
  }

  if (manager) {
    for (const a of apprRes.data ?? []) {
      if (a.action_taken) continue;   // ตัดสินไปแล้ว ไม่ต้องขึ้นปฏิทิน
      add({
        id: `appr-${a.approval_id}`, kind: "approval",
        date: dateOnly(a.sla_due_at as string)!,
        title: (a.source_doc_index as string | null) ?? (a.workflow_type as string),
        detail: a.assigned_to_name ? `รอ: ${a.assigned_to_name as string}` : null,
        owner: (a.assigned_to_name as string | null) ?? null, link: "/approvals",
      });
    }
  }

  for (const h of holRes.data ?? []) {
    add({
      id: `hol-${h.id}`, kind: "holiday", date: dateOnly(h.holiday_date as string)!,
      title: (h.name as string) || "วันหยุดบริษัท", detail: null, owner: null, link: null,
    });
  }

  for (const l of leaveRes.data ?? []) {
    const name = (l.employee_name as string | null) ?? "";
    if (!manager && !myNames.includes(name.trim().toLowerCase())) continue;
    for (const d of expandRange(dateOnly(l.date_from as string)!, dateOnly(l.date_to as string)!)) {
      add({
        id: `leave-${l.id}-${d}`, kind: "leave", date: d,
        title: name, detail: (l.leave_type as string | null) ?? "ลา",
        owner: name, link: "/hr",
      });
    }
  }

  for (const e of evtRes.data ?? []) {
    if (e.is_done) continue;
    add({
      id: `evt-${e.id}`, kind: "event", date: dateOnly(e.event_date as string)!,
      title: (e.title as string) || "นัดหมาย",
      detail: (e.description as string | null) ?? (e.event_type as string | null),
      owner: null, link: null,
    });
  }

  return NextResponse.json({ from, to, scope: manager ? "all" : "mine", items: sortItems(items) });
}
