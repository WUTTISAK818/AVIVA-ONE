import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { compressContextForAPI, compressChatHistory } from "@/lib/prompt-compression";
import { callClaudeText, anthropicEnabled } from "@/lib/claude";
import { serverDb } from "@/lib/server-db";
import { loadExpert } from "@/lib/dept-data";
import { isManagerRole } from "@/lib/roles";
import { buildDeptKnowledge, MENTOR_STYLE } from "@/lib/company-knowledge";
import type { AIResponseBody } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Placeholder fallbacks keep `createClient` from throwing during `next build`
// page-data collection when secrets are absent (local/CI). Real env vars are
// present at runtime in production, so live requests use the real credentials.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

// แมปฝ่ายของผู้ใช้ (ไทย/อังกฤษ) → คีย์ผู้เชี่ยวชาญ เพื่อให้แชตคุยกับ persona เดียวกับบรีฟ
function deptToExpertKey(dept: string): string | null {
  const d = (dept || "").toLowerCase();
  if (d.includes("ขาย") || d.includes("sale") || d.includes("crm")) return "sales";
  if (d.includes("ก่อสร้าง") || d.includes("construction")) return "construction";
  if (d.includes("การเงิน") || d.includes("finance")) return "finance";
  if (d.includes("บัญชี") || d.includes("account")) return "accounting";
  if (d.includes("ตลาด") || d.includes("marketing")) return "marketing";
  if (d.includes("บุคคล") || d.includes("hr")) return "hr";
  if (d.includes("หลังการขาย") || d.includes("after") || d.includes("ซ่อม") || d.includes("warranty")) return "after-sales";
  if (d.includes("เอกสาร") || d.includes("document")) return "document";
  return null;
}

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (rateLimitMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return false;
  rateLimitMap.set(ip, [...recent, now]);
  if (rateLimitMap.size > 5_000) {
    for (const [key, ts] of rateLimitMap) {
      if (ts.every(t => now - t >= RATE_WINDOW)) rateLimitMap.delete(key);
    }
  }
  return true;
}

// SEC-01: rate limit แบบ persistent (ข้าม serverless cold start / หลาย instance)
// fail-open: ถ้า DB error ปล่อยผ่าน (ไม่บล็อกผู้ใช้จริงจากปัญหา infra)
async function checkRateLimitDb(ip: string): Promise<boolean> {
  try {
    const db = serverDb(); // service role ถ้ามี ไม่งั้น anon (fail-open อยู่แล้ว)
    const since = new Date(Date.now() - RATE_WINDOW).toISOString();
    const { count } = await db
      .from("ai_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT) return false;
    await db.from("ai_rate_limits").insert({ ip });
    if (Math.random() < 0.02) {
      await db.from("ai_rate_limits").delete().lt("created_at", new Date(Date.now() - 10 * RATE_WINDOW).toISOString());
    }
    return true;
  } catch {
    return true;
  }
}

type HouseRow = { house_number: string; status: string; delayed_days?: number };
type CampaignRow = { name: string; platform: string; status: string; leads_generated: number };
type ProjectRow = { total_units: number; sold_units: number; construction_progress: number; sellout_forecast: string; revenue_target: number };

// Build limited context for regular employees — no financial data
function buildStaffContext(
  userName: string,
  userDept: string,
  d: {
    project: ProjectRow;
    houses: HouseRow[];
    leads: { status: string }[];
    installments: unknown[];
    pendingClaims: unknown[];
    campaigns: CampaignRow[];
    employees: { department: string }[];
    empByDept: Record<string, number>;
    newLeads: unknown[];
    bookingLeads: unknown[];
    closedLeads: unknown[];
    delayedHouses: HouseRow[];
    activeCampaigns: CampaignRow[];
    totalLeadsCampaign: number;
  },
  now: Date
): string {
  const dept = userDept.toLowerCase();
  const totalUnits = d.project.total_units ?? 0;
  const soldUnits = d.project.sold_units ?? 0;

  let deptSection = "";

  if (dept.includes("ขาย") || dept.includes("sale") || dept.includes("crm")) {
    const closeRate = d.leads.length > 0 ? Math.round((d.closedLeads.length / d.leads.length) * 100) : 0;
    deptSection = `
👥 ข้อมูล CRM (ฝ่ายขาย):
- Leads ทั้งหมด: ${d.leads.length} ราย | New: ${d.newLeads.length} | Booking/Loan: ${d.bookingLeads.length} | ปิดแล้ว: ${d.closedLeads.length}
- ยูนิตว่าง: ${totalUnits - soldUnits} / ทั้งหมด ${totalUnits}
- อัตราปิดการขาย: ${closeRate}%`;
  } else if (dept.includes("ก่อสร้าง") || dept.includes("construction")) {
    const complete = d.houses.filter(h => h.status === "complete").length;
    const onTrack = d.houses.filter(h => h.status === "on-track").length;
    deptSection = `
🏠 ข้อมูลก่อสร้าง:
- ยูนิตทั้งหมด: ${totalUnits} | เสร็จแล้ว: ${complete} | ตามแผน: ${onTrack} | ล่าช้า: ${d.delayedHouses.length}
- ยูนิตล่าช้า: ${d.delayedHouses.length > 0 ? d.delayedHouses.map(h => h.house_number).join(", ") : "ไม่มี"}
- งวดงานรอตรวจสอบ: ${d.installments.length} งวด
- แจ้งซ่อมรอดำเนินการ: ${d.pendingClaims.length} เรื่อง`;
  } else if (dept.includes("ออฟฟิศ") || dept.includes("office") || dept.includes("hr") || dept.includes("บุคคล")) {
    deptSection = `
📋 ข้อมูลบุคลากร:
- พนักงาน Active: ${d.employees.length} คน
- แบ่งตามแผนก: ${Object.entries(d.empByDept).map(([k, v]) => `${k}: ${v}`).join(", ")}`;
  } else if (dept.includes("หลังการขาย") || dept.includes("after") || dept.includes("warranty") || dept.includes("ซ่อม")) {
    deptSection = `
🔧 ข้อมูลหลังการขาย:
- แจ้งซ่อมรอดำเนินการ: ${d.pendingClaims.length} เรื่อง`;
  } else if (dept.includes("การตลาด") || dept.includes("marketing")) {
    deptSection = `
📣 ข้อมูลการตลาด:
- แคมเปญ Active: ${d.activeCampaigns.length} แคมเปญ
- แคมเปญ: ${d.activeCampaigns.map(c => `${c.name} (${c.platform})`).join(", ") || "ไม่มี"}
- Leads จากแคมเปญ: ${d.totalLeadsCampaign} ราย`;
  } else {
    deptSection = `
📊 ข้อมูลโครงการ:
- ยูนิตทั้งหมด: ${totalUnits} | ขายแล้ว: ${soldUnits} | ว่าง: ${totalUnits - soldUnits}
- ความคืบหน้าก่อสร้าง: ${d.project.construction_progress ?? 0}%`;
  }

  return `คุณคือ AVIVA AI ผู้ช่วยสำหรับพนักงาน AVIVA ONE
ผู้ใช้: ${userName} | ฝ่าย: ${userDept}
วันนี้: ${now.toLocaleDateString("th-TH")}
${deptSection}

⚠️ ข้อจำกัด: คุณไม่มีข้อมูลทางการเงิน รายรับ รายจ่าย งบประมาณ หรือข้อมูลระดับผู้บริหาร
หากถูกถามเรื่องการเงินหรือข้อมูลเชิงกลยุทธ์ ให้ตอบว่า "ข้อมูลนี้สงวนสำหรับผู้บริหาร กรุณาติดต่อผู้จัดการโครงการ"
ตอบเป็นภาษาไทย กระชับ เป็นประโยชน์`;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip) || !(await checkRateLimitDb(ip))) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ใช้ service role ถ้ามี ไม่งั้นใช้สิทธิ์ผู้ใช้ที่ล็อกอิน (RLS v473) — ไม่ต้องพึ่ง ENV ใน Vercel
  const db = serverDb(token);
  const { data: dbUser } = await db
    .from("users")
    .select("role, department, full_name")
    .eq("id", user.id)
    .single();
  const userRole: string = dbUser?.role ?? "user";
  const userDept: string = dbUser?.department ?? "";
  const userName: string = dbUser?.full_name ?? "พนักงาน";
  const isManager = isManagerRole(userRole);

  let message: string;
  let history: { role: string; content: string }[] = [];
  try {
    const body = await req.json();
    message = body.message;
    if (Array.isArray(body.history)) history = body.history.slice(-5);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!message || typeof message !== "string" || message.trim().length === 0 || message.length > 2000) {
    return NextResponse.json({ error: "No message provided" }, { status: 400 });
  }

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const results = await Promise.all([
    db.from("projects").select("*").eq("id", PROJECT_ID).single().then(r => r.data),
    db.from("leads").select("id,status,source,budget,assigned_to").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
    db.from("houses").select("id,house_number,status,progress,delayed_days,house_model").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
    db.from("finance_transactions").select("amount,created_at,transaction_type").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
    db.from("campaigns").select("name,platform,status,leads_generated,budget,spent").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
    db.from("employees").select("id,department,status").eq("status", "active").then(r => r.data ?? []),
    db.from("approval_logs").select("approval_id,workflow_type,amount,current_approver_role").eq("action_taken", "Pending").limit(20).then(r => r.data ?? []),
    db.from("warranty_claims").select("id").eq("status", "pending").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
    db.from("contractor_installments").select("id,status").eq("status", "in_review").then(r => r.data ?? []),
    db.from("loan_applications").select("status").then(r => r.data ?? []),
  ]).catch(() => null);

  if (!results) {
    return NextResponse.json({ response: "ไม่สามารถดึงข้อมูลโครงการได้ในขณะนี้ กรุณาลองใหม่ค่ะ" });
  }

  const [project, leads, houses, txns, campaigns, employees, pendingApprovals, pendingClaims, installments, loanApps] = results;
  const loans = (loanApps as { status: string }[]) ?? [];
  const loanStat = {
    submitted: loans.filter(l => l.status === "submitted").length,
    approved: loans.filter(l => l.status === "approved").length,
    rejected: loans.filter(l => l.status === "rejected").length,
  };

  if (!project) {
    return NextResponse.json({ response: "ไม่พบข้อมูลโครงการ กรุณาตรวจสอบการตั้งค่าค่ะ" });
  }

  type HouseRow = { house_number: string; status: string; delayed_days?: number };
  type CampaignRow = { name: string; platform: string; status: string; leads_generated: number };

  const delayedHouses = (houses as HouseRow[]).filter(h => (h.delayed_days ?? 0) > 0);
  const bookingLeads = (leads as {status:string}[]).filter(l => ["Booking","Contract","Loan Approved","Closed Deal"].includes(l.status));
  const closedLeads  = (leads as {status:string}[]).filter(l => l.status === "Closed Deal");
  const newLeads     = (leads as {status:string}[]).filter(l => l.status === "New Lead");

  const allTxns = txns as {amount:number;created_at:string;transaction_type:string}[];
  const thisMonthTxns = allTxns.filter(r => r.created_at?.startsWith(monthStr));
  const monthIncome  = thisMonthTxns.filter(r => r.transaction_type === "income").reduce((s,r) => s + Number(r.amount), 0);
  const monthExpense = thisMonthTxns.filter(r => r.transaction_type === "expense").reduce((s,r) => s + Math.abs(Number(r.amount)), 0);
  const totalRevenue = allTxns.filter(r => r.transaction_type === "income").reduce((s,r) => s + Number(r.amount), 0);

  const activeCampaigns = (campaigns as CampaignRow[]).filter(c => c.status === "active");
  const totalLeadsCampaign = (campaigns as CampaignRow[]).reduce((s,c) => s + (c.leads_generated ?? 0), 0);
  const empByDept = (employees as {department:string}[]).reduce((acc: Record<string,number>, e) => {
    acc[e.department] = (acc[e.department] ?? 0) + 1; return acc;
  }, {});

  const systemContext = isManager
    ? `คุณคือ AVIVA AI Executive Assistant ผู้ช่วยวิเคราะห์ธุรกิจอสังหาริมทรัพย์โครงการ AVIVA ONE
ข้อมูล Real-time ณ วันนี้ (${now.toLocaleDateString("th-TH")}):

📊 ภาพรวมโครงการ:
- ยูนิตทั้งหมด: ${project?.total_units ?? 0} | ขายแล้ว: ${project?.sold_units ?? 0} | ว่าง: ${(project?.total_units ?? 0) - (project?.sold_units ?? 0)}
- ความคืบหน้าก่อสร้าง: ${project?.construction_progress ?? 0}%
- คาดขายหมด: ${project?.sellout_forecast ?? "ไม่ระบุ"}

💰 การเงิน (จาก finance_transactions):
- รายรับสะสม: ฿${totalRevenue.toLocaleString()} / เป้า ฿${(project?.revenue_target ?? 0).toLocaleString()}
- รายรับเดือนนี้: ฿${monthIncome.toLocaleString()} | รายจ่ายเดือนนี้: ฿${monthExpense.toLocaleString()}
- กำไรสุทธิเดือนนี้: ฿${(monthIncome - monthExpense).toLocaleString()}

🏠 ก่อสร้าง:
- ยูนิตล่าช้า: ${delayedHouses.length} หน่วย (${delayedHouses.map(h => h.house_number).join(", ") || "ไม่มี"})
- งวดงานรออนุมัติ: ${Array.isArray(installments) ? installments.length : installments} งวด
- แจ้งซ่อมรอดำเนินการ: ${pendingClaims.length} เรื่อง

👥 CRM:
- Leads ทั้งหมด: ${leads.length} ราย | New Lead: ${newLeads.length} | Booking+Loan: ${bookingLeads.length} | ปิดการขาย: ${closedLeads.length}
- อัตราปิดการขาย: ${leads.length > 0 ? Math.round((closedLeads.length / leads.length) * 100) : 0}%
- สินเชื่อ (การยื่นกู้): ยื่นแล้วรอผล ${loanStat.submitted} | อนุมัติ ${loanStat.approved} | ไม่อนุมัติ ${loanStat.rejected}

📣 การตลาด:
- แคมเปญ Active: ${activeCampaigns.length} แคมเปญ (${activeCampaigns.map(c => c.platform).join(", ") || "ไม่มี"})
- Leads จากแคมเปญรวม: ${totalLeadsCampaign} ราย

👔 พนักงาน:
- พนักงาน Active: ${employees.length} คน · รออนุมัติทั้งระบบ: ${pendingApprovals.length} รายการ
- แบ่งตามแผนก: ${Object.entries(empByDept).map(([k,v]) => `${k}: ${v}`).join(", ")}

ตอบเป็นภาษาไทย กระชับ มืออาชีพ ให้คำแนะนำเชิงกลยุทธ์ที่นำไปใช้ได้จริง`
    : buildStaffContext(userName, userDept, {
        project: project as any,
        houses: houses as HouseRow[],
        leads: leads as {status:string}[],
        installments: installments as unknown[],
        pendingClaims: pendingClaims as unknown[],
        campaigns: campaigns as CampaignRow[],
        employees: employees as {department:string}[],
        empByDept,
        newLeads,
        bookingLeads,
        closedLeads,
        delayedHouses,
        activeCampaigns,
        totalLeadsCampaign,
      }, now);

  const fallbackData = { soldUnits: project?.sold_units ?? 0, totalUnits: project?.total_units ?? 0, delayedHouses, bookingLeads, monthIncome, monthExpense, pendingApprovals: pendingApprovals.length, employees: employees.length, empByDept, pendingClaims: pendingClaims.length, pendingInstallments: (installments as unknown[]).length };

  // ยังไม่ได้ตั้ง Claude key → ใช้ข้อความสำรองจากข้อมูลจริง (ไม่ให้ผู้ใช้เจอ error)
  if (!(await anthropicEnabled(token))) {
    return NextResponse.json({ response: generateFallback(message, fallbackData, isManager) });
  }

  // ผูกแชตกับผู้เชี่ยวชาญฝ่ายเดียวกับบรีฟ (เช่น ฝ่ายขาย = คุณขายดี) ถ้าจับคู่ฝ่ายได้
  let persona = "";
  const expertKey = deptToExpertKey(userDept);
  if (expertKey) {
    try {
      const expert = await loadExpert(db, expertKey);
      persona = `คุณคือ "${expert.expert_name}" ผู้ช่วย AI ${expert.persona}\nความเชี่ยวชาญ: ${expert.focus}\n`;
    } catch { /* ไม่มี persona ก็ใช้ AVIVA AI ปกติ */ }
  }
  // ฐานความรู้องค์กร + บุคลิกผู้จัดการอาวุโส — ให้ AI เข้าใจโครงสร้างบริษัท/กระบวนการ
  // และโค้ชพนักงานเมื่อติดขัด (ทุกฝ่าย รวมพนักงานทั่วไป)
  persona = persona + MENTOR_STYLE + "\n\n" + buildDeptKnowledge(expertKey) + "\n\n";

  // บีบ context ให้สั้นลงเพื่อประหยัดโทเค็น แล้วต่อท้ายด้วยแนวทางการตอบ
  const compressionResult = compressContextForAPI(systemContext, isManager, 1200);
  const compressedHistory = compressChatHistory(history, message);
  const system =
    persona + compressionResult.compressed +
    "\n\nตอบเป็นภาษาไทยที่เป็นธรรมชาติ กระชับ ตรงคำถาม " +
    "เมื่ออ้างตัวเลข/ชื่อ ให้ใช้จากข้อมูลจริงด้านบนเท่านั้น ห้ามแต่งข้อมูลที่ไม่มี " +
    "ถ้าผู้ใช้คุยเรื่องทั่วไปนอกเหนืองาน ก็ตอบอย่างเป็นมิตรได้ตามปกติ";

  const { text, model, error } = await callClaudeText({
    system,
    messages: [...compressedHistory, { role: "user", content: message }],
    model: "claude-haiku-4-5",
    maxTokens: 900,
    timeoutMs: 40_000,
    accessToken: token,
  });

  // เรียก Claude ไม่สำเร็จ → ใช้ข้อความสำรองจากข้อมูลจริง แทนการโชว์ error
  if (!text) {
    return NextResponse.json({
      response: generateFallback(message, fallbackData, isManager),
      error: error ?? "AI_FAILED",
    });
  }

  return NextResponse.json({
    response: text,
    metadata: {
      model,
      tokensUsed: compressionResult.compressedSize,
      compressionApplied: true,
      retryCount: 0,
      responseTimeMs: Date.now() - startTime,
    },
  } as AIResponseBody);
}

function generateFallback(message: string, d: { soldUnits: number; totalUnits: number; delayedHouses: {house_number:string}[]; bookingLeads: unknown[]; monthIncome: number; monthExpense: number; pendingApprovals: number; employees: number; empByDept: Record<string,number>; pendingClaims: number; pendingInstallments: number; }, isManager: boolean) {
  if (!isManager) {
    return "ขออภัยค่ะ ไม่สามารถเชื่อมต่อกับระบบ AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ";
  }
  const pct = Math.round((d.soldUnits / (d.totalUnits || 1)) * 100);
  const net = d.monthIncome - d.monthExpense;
  const msg = message.toLowerCase();
  if (msg.includes("ขาย") || msg.includes("lead") || msg.includes("ลูกค้า") || msg.includes("crm"))
    return `ยอดขาย: ${d.soldUnits}/${d.totalUnits} ยูนิต (${pct}%) · อยู่ใน Booking/Loan/ปิดแล้ว: ${d.bookingLeads.length} ราย · แนะนำเร่งติดตาม pipeline ก่อนสิ้นเดือนค่ะ`;
  if (msg.includes("ล่าช้า") || msg.includes("ก่อสร้าง") || msg.includes("construction"))
    return `ยูนิตล่าช้า: ${d.delayedHouses.length} หน่วย${d.delayedHouses.length > 0 ? ` (${d.delayedHouses.map(h => h.house_number).slice(0,3).join(", ")})` : " ✅"} · งวดงานรอตรวจสอบ: ${d.pendingInstallments} งวด`;
  if (msg.includes("การเงิน") || msg.includes("เงิน") || msg.includes("cashflow") || msg.includes("รายรับ") || msg.includes("รายจ่าย"))
    return `เดือนนี้: รายรับ ฿${d.monthIncome.toLocaleString()} — รายจ่าย ฿${d.monthExpense.toLocaleString()} — ${net >= 0 ? "กำไร" : "ขาดทุน"} ฿${Math.abs(net).toLocaleString()} ${net >= 0 ? "✅" : "⚠️"}`;
  if (msg.includes("อนุมัติ") || msg.includes("approval"))
    return `รออนุมัติ: ${d.pendingApprovals} รายการ · แจ้งซ่อมรอดำเนินการ: ${d.pendingClaims} เรื่อง กรุณาตรวจสอบค่ะ`;
  if (msg.includes("พนักงาน") || msg.includes("บุคลากร") || msg.includes("hr") || msg.includes("staff"))
    return `พนักงาน Active: ${d.employees} คน · ${Object.entries(d.empByDept).map(([k,v]) => `${k}: ${v}`).join(", ")}`;
  if (msg.includes("ซ่อม") || msg.includes("warranty") || msg.includes("claim"))
    return `แจ้งซ่อมรอดำเนินการ: ${d.pendingClaims} เรื่อง แนะนำตรวจสอบและมอบหมายช่างค่ะ`;
  return `ภาพรวม AVIVA ONE: ขาย ${pct}% (${d.soldUnits}/${d.totalUnits}) · Cashflow ${net >= 0 ? "+" : ""}฿${net.toLocaleString()} · รออนุมัติ ${d.pendingApprovals} · แจ้งซ่อม ${d.pendingClaims} เรื่อง — สอบถามเพิ่มเติมได้เลยค่ะ`;
}
