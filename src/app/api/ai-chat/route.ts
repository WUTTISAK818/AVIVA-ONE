import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { compressContextForAPI, compressChatHistory } from "@/lib/prompt-compression";
import {
  selectModelByQuota,
  AVIVA_RECOMMENDED_CONFIG,
} from "@/lib/model-selector";
import {
  parseAPIError,
  retryWithBackoff,
  retryWithCompression,
  getUserFriendlyErrorMessage,
  RateLimitCircuitBreaker,
} from "@/lib/api-error-handler";
import type { AIResponseBody } from "@/types/api";

// Placeholder fallbacks keep `createClient` from throwing during `next build`
// page-data collection when secrets are absent (local/CI). Real env vars are
// present at runtime in production, so live requests use the real credentials.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin client for trusted server-side operations (bypasses RLS for role lookup)
const supabaseAdmin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

// ✨ NEW: Circuit breaker for rate limit protection
const rateLimitBreaker = new RateLimitCircuitBreaker(5, 60000);

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
  if (!checkRateLimit(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("role, department, full_name")
    .eq("id", user.id)
    .single();
  const userRole: string = dbUser?.role ?? "user";
  const userDept: string = dbUser?.department ?? "";
  const userName: string = dbUser?.full_name ?? "พนักงาน";
  const isManager = ["admin", "ceo", "manager", "director", "project_manager"].includes(userRole);

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
    supabase.from("projects").select("*").eq("id", PROJECT_ID).single().then(r => r.data),
    supabase.from("leads").select("id,status,source,budget,assigned_to").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
    supabase.from("houses").select("id,house_number,status,progress,delayed_days,house_model").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
    supabase.from("finance_transactions").select("amount,created_at,transaction_type").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
    supabase.from("campaigns").select("name,platform,status,leads_generated,budget,spent").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
    supabase.from("employees").select("id,department,status").eq("status", "active").then(r => r.data ?? []),
    supabase.from("approval_logs").select("approval_id,workflow_type,amount,current_approver_role").eq("action_taken", "Pending").limit(20).then(r => r.data ?? []),
    supabase.from("warranty_claims").select("id").eq("status", "pending").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
    supabase.from("contractor_installments").select("id,status").eq("status", "in_review").then(r => r.data ?? []),
  ]).catch(() => null);

  if (!results) {
    return NextResponse.json({ response: "ไม่สามารถดึงข้อมูลโครงการได้ในขณะนี้ กรุณาลองใหม่ค่ะ" });
  }

  const [project, leads, houses, txns, campaigns, employees, pendingApprovals, pendingClaims, installments] = results;

  if (!project) {
    return NextResponse.json({ response: "ไม่พบข้อมูลโครงการ กรุณาตรวจสอบการตั้งค่าค่ะ" });
  }

  type HouseRow = { house_number: string; status: string; delayed_days?: number };
  type CampaignRow = { name: string; platform: string; status: string; leads_generated: number };

  const delayedHouses = (houses as HouseRow[]).filter(h => (h.delayed_days ?? 0) > 0);
  const bookingLeads = (leads as {status:string}[]).filter(l => ["Booking","Loan Process","Closed Deal"].includes(l.status));
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

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ response: generateFallback(message, fallbackData, isManager) });
  }

  try {
    // ✨ NEW: Compress system context before sending
    const compressionResult = compressContextForAPI(
      systemContext,
      isManager,
      900 // target size
    );

    console.log(
      `📦 Context compressed: ${compressionResult.originalSize} → ${compressionResult.compressedSize} tokens (${compressionResult.reductionPercent}% reduction)`
    );

    // ✨ NEW: Compress chat history (use last 2 instead of 5)
    const compressedHistory = compressChatHistory(history, message);

    // ✨ NEW: Retry with compression if prompt too long
    const response = await retryWithCompression(
      async (compressedContext: string) => {
        return await rateLimitBreaker.execute(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20_000);

          try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: compressedContext },
                  ...compressedHistory,
                  { role: "user", content: message },
                ],
                temperature: 0.7,
                max_tokens: 500,
              }),
            });

            clearTimeout(timeoutId);
            const data = await res.json();

            if (!res.ok) {
              throw new Error(data.error?.message || "API error");
            }

            return data.choices?.[0]?.message?.content ?? "ไม่สามารถประมวลผลได้ กรุณาลองใหม่";
          } catch (err) {
            clearTimeout(timeoutId);
            throw err;
          }
        });
      },
      compressionResult.compressed,
      isManager
    );

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      response,
      metadata: {
        model: "gpt-4o-mini",
        tokensUsed: compressionResult.compressedSize,
        compressionApplied: true,
        responseTimeMs: responseTime,
      },
    } as AIResponseBody);
  } catch (error: any) {
    console.error("[AI Error]", error);

    const parsedError = parseAPIError(error);
    const userMessage = getUserFriendlyErrorMessage(parsedError);

    // ✨ NEW: Check circuit breaker status
    if (rateLimitBreaker.getStatus() === "open") {
      return NextResponse.json(
        {
          response: "🔴 ระบบ AI ใช้ด้วยคนจำนวนมากเกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ",
          error: "RATE_LIMIT_BREAKER_OPEN",
        },
        { status: 429 }
      );
    }

    // Fallback response
    return NextResponse.json({
      response: userMessage || generateFallback(message, fallbackData, isManager),
      error: parsedError.code,
    });
  }
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
