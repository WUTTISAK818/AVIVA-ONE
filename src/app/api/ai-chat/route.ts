import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message) return NextResponse.json({ error: "No message provided" }, { status: 400 });

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [project, leads, houses, receipts, campaigns, employees, pendingApprovals, pendingClaims, installments] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", PROJECT_ID).single().then(r => r.data),
      supabase.from("leads").select("id,status,source,budget,assigned_to").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
      supabase.from("houses").select("id,house_number,status,progress,delayed_days,house_model").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
      supabase.from("receipts").select("amount,receipt_date,receipt_type").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
      supabase.from("campaigns").select("name,platform,status,leads_generated,budget,spent").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
      supabase.from("employees").select("id,department,status").eq("status", "active").then(r => r.data ?? []),
      supabase.from("approval_logs").select("approval_id", { count: "exact", head: true }).eq("action_taken", "Pending").then(r => Array(r.count ?? 0).fill({})),
      supabase.from("warranty_claims").select("id").eq("status", "pending").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
      supabase.from("contractor_installments").select("id,status").eq("status", "in_review").then(r => r.data ?? []),
    ]);

  const delayedHouses = (houses as {house_number:string;delayed_days:number;status:string}[]).filter(h => (h.delayed_days ?? 0) > 0);
  const bookingLeads = (leads as {status:string}[]).filter(l => ["Booking","Loan Process","Closed Deal"].includes(l.status));
  const closedLeads  = (leads as {status:string}[]).filter(l => l.status === "Closed Deal");
  const newLeads     = (leads as {status:string}[]).filter(l => l.status === "New Lead");

  const allReceipts = receipts as {amount:number;receipt_date:string;receipt_type:string}[];
  const thisMonthReceipts = allReceipts.filter(r => r.receipt_date?.startsWith(monthStr));
  const monthIncome  = thisMonthReceipts.filter(r => r.receipt_type === "income").reduce((s,r) => s + Number(r.amount), 0);
  const monthExpense = thisMonthReceipts.filter(r => r.receipt_type === "expense").reduce((s,r) => s + Math.abs(Number(r.amount)), 0);
  const totalRevenue = allReceipts.filter(r => r.receipt_type === "income").reduce((s,r) => s + Number(r.amount), 0);

  const activeCampaigns = (campaigns as {status:string}[]).filter(c => c.status === "active");
  const totalLeadsCampaign = (campaigns as {leads_generated:number}[]).reduce((s,c) => s + (c.leads_generated ?? 0), 0);
  const empByDept = (employees as {department:string}[]).reduce((acc: Record<string,number>, e) => {
    acc[e.department] = (acc[e.department] ?? 0) + 1; return acc;
  }, {});

  const systemContext = `คุณคือ AVIVA AI Executive Assistant ผู้ช่วยวิเคราะห์ธุรกิจอสังหาริมทรัพย์โครงการ AVIVA ONE
ข้อมูล Real-time ณ วันนี้ (${now.toLocaleDateString("th-TH")}):

📊 ภาพรวมโครงการ:
- ยูนิตทั้งหมด: ${project?.total_units ?? 0} | ขายแล้ว: ${project?.sold_units ?? 0} | ว่าง: ${(project?.total_units ?? 0) - (project?.sold_units ?? 0)}
- ความคืบหน้าก่อสร้าง: ${project?.construction_progress ?? 0}%
- คาดขายหมด: ${project?.sellout_forecast ?? "ไม่ระบุ"}

💰 การเงิน:
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
- แคมเปญ Active: ${activeCampaigns.length} แคมเปญ (${activeCampaigns.map((c:any) => c.platform).join(", ") || "ไม่มี"})
- Leads จากแคมเปญรวม: ${totalLeadsCampaign} ราย

👔 พนักงาน:
- พนักงาน Active: ${employees.length} คน · รออนุมัติทั้งระบบ: ${pendingApprovals.length} รายการ
- แบ่งตามแผนก: ${Object.entries(empByDept).map(([k,v]) => `${k}: ${v}`).join(", ")}

ตอบเป็นภาษาไทย กระชับ มืออาชีพ ให้คำแนะนำเชิงกลยุทธ์ที่นำไปใช้ได้จริง`;

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ response: generateFallback(message, { soldUnits: project?.sold_units ?? 0, totalUnits: project?.total_units ?? 0, delayedHouses, bookingLeads, monthIncome, monthExpense, pendingApprovals: pendingApprovals.length, employees: employees.length, empByDept, pendingClaims: pendingClaims.length, pendingInstallments: (installments as unknown[]).length }) });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: systemContext }, { role: "user", content: message }], temperature: 0.7, max_tokens: 500 }),
    });
    const data = await res.json();
    return NextResponse.json({ response: data.choices?.[0]?.message?.content ?? "ไม่สามารถประมวลผลได้ กรุณาลองใหม่" });
  } catch {
    return NextResponse.json({ response: generateFallback(message, { soldUnits: project?.sold_units ?? 0, totalUnits: project?.total_units ?? 0, delayedHouses, bookingLeads, monthIncome, monthExpense, pendingApprovals: pendingApprovals.length, employees: employees.length, empByDept, pendingClaims: pendingClaims.length, pendingInstallments: (installments as unknown[]).length }) });
  }
}

function generateFallback(message: string, d: { soldUnits: number; totalUnits: number; delayedHouses: {house_number:string}[]; bookingLeads: unknown[]; monthIncome: number; monthExpense: number; pendingApprovals: number; employees: number; empByDept: Record<string,number>; pendingClaims: number; pendingInstallments: number; }) {
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
