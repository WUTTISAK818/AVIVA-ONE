// รวบรวมข้อมูลจริงต่อฝ่าย แล้วให้ Claude สร้างบรีฟเชิงรุก (ผู้ช่วยประจำฝ่าย)
// ใช้ร่วมกันระหว่าง /api/ai-briefing (กดเอง) และ /api/cron/ai-briefing (อัตโนมัติ)

import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaudeJSON } from "@/lib/claude";
import {
  DEFAULT_EXPERTS,
  EXPERT_DEPTS,
  DEPT_LABEL,
  type DeptExpert,
  type DeptBriefing,
  type CouncilBriefing,
} from "@/lib/ai-experts";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const thb = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const daysAgo = (iso?: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : 0;

// ── โหลด persona ของผู้เชี่ยวชาญ (จาก settings หรือใช้ค่าเริ่มต้น) ──────────────
export async function loadExpert(admin: SupabaseClient, dept: string): Promise<DeptExpert> {
  const fallback = DEFAULT_EXPERTS[dept];
  const { data } = await admin
    .from("ai_experts")
    .select("dept,expert_name,focus,persona,model,is_active")
    .eq("dept", dept)
    .maybeSingle();
  if (!data) return fallback;
  return {
    dept,
    expert_name: data.expert_name || fallback?.expert_name || "ผู้เชี่ยวชาญ AI",
    focus: data.focus || fallback?.focus || "",
    persona: data.persona || fallback?.persona || "",
    model: data.model || fallback?.model || "claude-opus-4-8",
    is_active: data.is_active ?? true,
  };
}

// ── รวบรวมข้อมูลจริงต่อฝ่ายเป็นข้อความสำหรับ prompt ─────────────────────────────
export async function gatherDeptContext(admin: SupabaseClient, dept: string): Promise<string> {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (dept === "sales") {
    const [{ data: leads }, { data: project }] = await Promise.all([
      admin.from("leads").select("full_name,status,source,budget,assigned_to,created_at,updated_at")
        .eq("project_id", PROJECT_ID).order("updated_at", { ascending: false }).limit(80),
      admin.from("projects").select("total_units,sold_units").eq("id", PROJECT_ID).single(),
    ]);
    const L = leads ?? [];
    const byStatus = L.reduce((a: Record<string, number>, l) => { a[l.status] = (a[l.status] ?? 0) + 1; return a; }, {});
    const hot = L.filter(l => ["Booking", "Loan Process"].includes(l.status));
    const stale = L.filter(l => l.status === "New Lead" && daysAgo(l.updated_at) >= 14);
    return [
      `ยูนิตว่าง ${((project?.total_units ?? 0) - (project?.sold_units ?? 0))}/${project?.total_units ?? 0}`,
      `Lead ตามสถานะ: ${Object.entries(byStatus).map(([k, v]) => `${k}:${v}`).join(", ") || "ไม่มี"}`,
      `ลูกค้าใกล้ปิด (Booking/Loan) ${hot.length} ราย: ${hot.slice(0, 10).map(l => `${l.full_name}(งบ ${thb(Number(l.budget) || 0)}, ผู้ดูแล ${l.assigned_to ?? "-"})`).join(" | ") || "-"}`,
      `New Lead ที่เงียบเกิน 14 วัน ${stale.length} ราย: ${stale.slice(0, 10).map(l => `${l.full_name}(${daysAgo(l.updated_at)} วัน, ${l.source ?? "-"})`).join(" | ") || "-"}`,
    ].join("\n");
  }

  if (dept === "construction") {
    const [{ data: houses }, { data: insts }, { data: claims }] = await Promise.all([
      admin.from("houses").select("house_number,status,progress,delayed_days").eq("project_id", PROJECT_ID).order("plot_number").limit(40),
      admin.from("contractor_installments").select("name,status,house_id").eq("status", "in_review").limit(40),
      admin.from("warranty_claims").select("id").eq("status", "pending").eq("project_id", PROJECT_ID),
    ]);
    const H = houses ?? [];
    const delayed = H.filter(h => (h.delayed_days ?? 0) > 0);
    return [
      `ยูนิตทั้งหมด ${H.length} | เสร็จ ${H.filter(h => h.status === "complete").length} | ตามแผน ${H.filter(h => h.status === "on-track").length} | ล่าช้า ${delayed.length}`,
      `ยูนิตล่าช้า: ${delayed.map(h => `${h.house_number}(${h.delayed_days}วัน, ${h.progress ?? 0}%)`).join(" | ") || "ไม่มี"}`,
      `งวดงานรอตรวจ ${(insts ?? []).length}: ${(insts ?? []).slice(0, 12).map(i => i.name).join(", ") || "-"}`,
      `แจ้งซ่อมค้าง ${(claims ?? []).length} เรื่อง`,
    ].join("\n");
  }

  if (dept === "finance") {
    const [{ data: txns }, { data: appr }] = await Promise.all([
      admin.from("finance_transactions").select("amount,transaction_type,description,created_at").eq("project_id", PROJECT_ID).order("created_at", { ascending: false }).limit(200),
      admin.from("approvals").select("description,amount,status,requested_by").eq("module", "finance").eq("status", "pending").limit(30),
    ]);
    const T = (txns ?? []).filter(t => t.created_at?.startsWith(monthStr));
    const inc = T.filter(t => t.transaction_type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = T.filter(t => t.transaction_type === "expense").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const A = appr ?? [];
    return [
      `เดือนนี้: รายรับ ${thb(inc)} | รายจ่าย ${thb(exp)} | สุทธิ ${thb(inc - exp)}`,
      `รออนุมัติ ${A.length} รายการ รวม ${thb(A.reduce((s, a) => s + Number(a.amount), 0))}: ${A.slice(0, 10).map(a => `${a.description}(${thb(Number(a.amount))})`).join(" | ") || "-"}`,
    ].join("\n");
  }

  if (dept === "accounting") {
    const [{ data: ar }, { data: ap }, { data: jv }, { data: vat }, { data: wht }] = await Promise.all([
      admin.from("ar_invoices").select("customer_name,total_amount,paid_amount,due_date,status").eq("project_id", PROJECT_ID).in("status", ["pending", "partial", "overdue"]).limit(50),
      admin.from("ap_bills").select("vendor_name,total_amount,paid_amount,due_date,status").eq("project_id", PROJECT_ID).in("status", ["pending", "partial"]).limit(50),
      admin.from("jv_entries").select("id", { count: "exact", head: true }).eq("project_id", PROJECT_ID).eq("status", "draft"),
      admin.from("vat_register").select("vat_amount").eq("project_id", PROJECT_ID).eq("etax_status", "pending"),
      admin.from("wht_certificates").select("wht_amount").eq("project_id", PROJECT_ID).is("period", null),
    ]);
    const today = now.toISOString().split("T")[0];
    const arOut = (ar ?? []).reduce((s, r) => s + (Number(r.total_amount) - Number(r.paid_amount)), 0);
    const apOvd = (ap ?? []).filter(b => b.due_date < today);
    return [
      `ลูกหนี้คงค้าง ${thb(arOut)} (${(ar ?? []).length} ใบ) — เกินกำหนด: ${(ar ?? []).filter(r => r.due_date < today).map(r => `${r.customer_name}(${thb(Number(r.total_amount) - Number(r.paid_amount))})`).slice(0, 8).join(" | ") || "ไม่มี"}`,
      `เจ้าหนี้เกินกำหนด ${apOvd.length}: ${apOvd.map(b => `${b.vendor_name}(${thb(Number(b.total_amount) - Number(b.paid_amount))})`).slice(0, 8).join(" | ") || "ไม่มี"}`,
      `JV รอ post ${(jv as unknown as { count?: number })?.count ?? 0} รายการ`,
      `VAT รอส่ง ${thb((vat ?? []).reduce((s, v) => s + Number(v.vat_amount), 0))} | WHT รอออกหนังสือ ${thb((wht ?? []).reduce((s, w) => s + Number(w.wht_amount), 0))}`,
    ].join("\n");
  }

  if (dept === "marketing") {
    const { data: camps } = await admin.from("campaigns").select("name,platform,status,budget,spent,leads_generated").eq("project_id", PROJECT_ID).limit(40);
    const C = camps ?? [];
    return [
      `แคมเปญทั้งหมด ${C.length} | active ${C.filter(c => c.status === "active").length}`,
      ...C.slice(0, 12).map(c => `${c.name}(${c.platform}, งบ ${thb(Number(c.budget) || 0)}, ใช้ ${thb(Number(c.spent) || 0)}, lead ${c.leads_generated ?? 0}, CPL ${(c.leads_generated ? thb((Number(c.spent) || 0) / c.leads_generated) : "-")})`),
    ].join("\n");
  }

  if (dept === "hr") {
    const { data: emps } = await admin.from("employees").select("department,status").eq("status", "active");
    const byDept = (emps ?? []).reduce((a: Record<string, number>, e) => { a[e.department] = (a[e.department] ?? 0) + 1; return a; }, {});
    return [
      `พนักงาน active ${(emps ?? []).length} คน`,
      `แบ่งตามแผนก: ${Object.entries(byDept).map(([k, v]) => `${k}:${v}`).join(", ") || "-"}`,
    ].join("\n");
  }

  if (dept === "after-sales") {
    const { data: claims } = await admin.from("warranty_claims").select("description,status,created_at,priority").eq("project_id", PROJECT_ID).eq("status", "pending").order("created_at", { ascending: false }).limit(40);
    const C = claims ?? [];
    return [
      `แจ้งซ่อมรอดำเนินการ ${C.length} เรื่อง`,
      ...C.slice(0, 12).map(c => `${c.description ?? "งานซ่อม"}(${daysAgo(c.created_at)} วัน, ${c.priority ?? "-"})`),
    ].join("\n");
  }

  return "ไม่มีข้อมูลเฉพาะฝ่ายนี้";
}

// ── prompt สร้างบรีฟ ───────────────────────────────────────────────────────────
const JSON_SHAPE = `{
  "title": "หัวข้อบรีฟสั้น ๆ",
  "summary": "สรุปภาพรวม 2-3 ประโยค",
  "highlights": [{ "title": "เรื่องน่าสนใจ", "detail": "รายละเอียดอ้างอิงข้อมูลจริง", "priority": "high|medium|low", "action": "สิ่งที่ควรทำ" }],
  "weekly_plan": [{ "label": "จันทร์/โฟกัส", "task": "งานที่ต้องทำ", "why": "เหตุผลจากข้อมูล" }],
  "monthly_plan": [{ "label": "สัปดาห์ที่ 1/ธีม", "task": "เป้าหมาย", "why": "ตัวชี้วัด/เหตุผล" }]
}`;

// ── สร้างบรีฟ 1 ฝ่าย (gather → Claude → บันทึก ai_briefings) ────────────────────
export async function generateDeptBriefing(
  admin: SupabaseClient,
  dept: string,
  periodType: "adhoc" | "weekly" | "monthly" = "adhoc",
  generatedBy = "system",
): Promise<{ briefing: DeptBriefing | null; model: string; error?: string }> {
  const expert = await loadExpert(admin, dept);
  const context = await gatherDeptContext(admin, dept);
  const label = DEPT_LABEL[dept] ?? dept;
  const today = new Date().toLocaleDateString("th-TH");

  const system =
    `คุณคือ "${expert.expert_name}" — ${expert.persona}\n` +
    `หน้าที่หลัก: ${expert.focus}\n` +
    `คุณเป็นผู้ช่วยเชิงรุกของพนักงาน${label} โครงการอสังหาฯ AVIVA ONE ` +
    `วิเคราะห์ข้อมูลจริงที่ได้รับ แล้วชี้ "เรื่องที่ควรสนใจที่สุด" และ "วางแผนงานสัปดาห์/เดือน" ที่นำไปทำได้ทันที ` +
    `อ้างอิงตัวเลข/ชื่อจากข้อมูลจริงเสมอ ห้ามแต่งข้อมูลที่ไม่มี ตอบเป็นภาษาไทย กระชับ เป็นรูปธรรม\n` +
    `ตอบตามรูปแบบ JSON นี้เป๊ะ ๆ (3-5 highlights, 3-5 weekly_plan, 2-4 monthly_plan):\n${JSON_SHAPE}`;

  const user = `ข้อมูลล่าสุดของ${label} (ณ ${today}):\n${context}\n\nสร้างบรีฟประจำ${periodType === "monthly" ? "เดือน" : periodType === "weekly" ? "สัปดาห์" : "วันนี้"}ให้พนักงาน${label}`;

  const { data, model, error } = await callClaudeJSON<DeptBriefing>({ system, user, model: expert.model });

  if (data) {
    await admin.from("ai_briefings").insert({
      project_id: PROJECT_ID,
      scope: "dept",
      dept,
      period_type: periodType,
      title: data.title ?? `บรีฟ${label}`,
      summary: data.summary ?? "",
      highlights: data.highlights ?? [],
      weekly_plan: data.weekly_plan ?? [],
      monthly_plan: data.monthly_plan ?? [],
      raw: data,
      model,
      generated_by: generatedBy,
    });
  }
  return { briefing: data, model, error };
}

// ── สภา AI: รวมบรีฟทุกฝ่าย → สังเคราะห์เป็นบรีฟผู้บริหาร (Phase 2) ───────────────
const COUNCIL_SHAPE = `{
  "title": "หัวข้อ", "summary": "ภาพรวมเชิงกลยุทธ์ 2-3 ประโยค",
  "cross_issues": [{ "title": "ประเด็นข้ามฝ่าย", "detail": "อ้างอิงข้อมูลจริง", "depts": ["sales","construction"], "priority": "high|medium|low", "recommendation": "ข้อเสนอแนะ" }],
  "decisions": [{ "question": "เรื่องที่ผู้บริหารต้องตัดสินใจ", "recommended": "ข้อเสนอ", "impact": "ผลกระทบ" }],
  "weekly_plan": [{ "label": "โฟกัส", "task": "งานระดับองค์กร", "why": "เหตุผล" }],
  "monthly_plan": [{ "label": "ธีม", "task": "เป้าหมาย", "why": "ตัวชี้วัด" }]
}`;

export async function generateExecutiveBriefing(
  admin: SupabaseClient,
  period: "weekly" | "monthly" = "weekly",
  generatedBy = "system",
): Promise<{ briefing: CouncilBriefing | null; model: string; id?: string; error?: string }> {
  const experts = await Promise.all(EXPERT_DEPTS.map(d => loadExpert(admin, d)));
  const active = experts.filter(e => e.is_active);

  // บรีฟล่าสุดของแต่ละฝ่าย (ใช้ที่มีอยู่ ถ้าไม่มีค่อยสร้างใหม่แบบขนาน)
  const { data: recent } = await admin
    .from("ai_briefings")
    .select("dept,title,summary,created_at")
    .eq("scope", "dept").order("created_at", { ascending: false }).limit(60);
  const latest: Record<string, { dept: string; title: string; summary: string }> = {};
  (recent ?? []).forEach((r: { dept: string; title: string; summary: string }) => {
    if (r.dept && !latest[r.dept]) latest[r.dept] = r;
  });

  await Promise.all(
    active.filter(e => !latest[e.dept]).map(async e => {
      const { briefing } = await generateDeptBriefing(admin, e.dept, period, generatedBy);
      if (briefing) latest[e.dept] = { dept: e.dept, title: briefing.title, summary: briefing.summary };
    }),
  );

  const summaries = active
    .map(e => latest[e.dept])
    .filter(Boolean)
    .map(b => `[${DEPT_LABEL[b.dept] ?? b.dept}] ${b.title}: ${b.summary}`);
  if (summaries.length === 0) return { briefing: null, model: "", error: "NO_DEPT_DATA" };

  const system =
    `คุณคือผู้ดำเนินการ "สภา AI" ของโครงการอสังหาฯ AVIVA ONE ` +
    `นำบรีฟจากผู้เชี่ยวชาญแต่ละฝ่ายมาประชุมร่วมกัน วิเคราะห์ประเด็นที่เชื่อมโยงข้ามฝ่าย ` +
    `(เช่น จังหวะการขาย vs ความพร้อมก่อสร้าง vs กระแสเงินสด) ชี้ความเสี่ยงและโอกาส ` +
    `แล้วสรุป "ประเด็นที่ผู้บริหารต้องตัดสินใจ" พร้อมข้อเสนอแนะที่ลงมือได้จริง ` +
    `อ้างอิงข้อมูลจากบรีฟที่ได้รับเท่านั้น ตอบภาษาไทย กระชับ เป็นรูปธรรม\n` +
    `ตอบ JSON ตามรูปแบบนี้ (3-5 cross_issues, 2-4 decisions):\n${COUNCIL_SHAPE}`;
  const user = `บรีฟจากผู้เชี่ยวชาญแต่ละฝ่าย (${period === "monthly" ? "รายเดือน" : "รายสัปดาห์"}):\n${summaries.join("\n")}\n\nจัดประชุมสภา AI แล้วสรุปเสนอผู้บริหาร`;

  const { data, model, error } = await callClaudeJSON<CouncilBriefing>({ system, user, maxTokens: 2500 });
  if (!data) return { briefing: null, model, error };

  const highlights = (data.cross_issues ?? []).map(c => ({
    title: c.title,
    detail: `${c.detail}${c.depts?.length ? ` [${c.depts.map(d => DEPT_LABEL[d] ?? d).join(", ")}]` : ""}`,
    priority: c.priority,
    action: c.recommendation,
  }));
  const { data: inserted } = await admin
    .from("ai_briefings")
    .insert({
      project_id: PROJECT_ID, scope: "executive", dept: null, period_type: period,
      title: data.title ?? "สรุปเสนอผู้บริหาร", summary: data.summary ?? "",
      highlights, weekly_plan: data.weekly_plan ?? [], monthly_plan: data.monthly_plan ?? [],
      raw: data, model, generated_by: generatedBy, status: "new",
    })
    .select("id").single();

  return { briefing: data, model, id: inserted?.id };
}
