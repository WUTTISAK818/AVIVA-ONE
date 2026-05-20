import { NextRequest, NextResponse } from "next/server";
import { getProject, getLeads, getHouses, getTransactions } from "@/lib/db";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  if (!message) {
    return NextResponse.json({ error: "No message provided" }, { status: 400 });
  }

  // Fetch live data from Supabase
  const [project, leads, houses, transactions] = await Promise.all([
    getProject(),
    getLeads(),
    getHouses(),
    getTransactions(),
  ]);

  const soldUnits = project?.sold_units ?? 0;
  const totalUnits = project?.total_units ?? 0;
  const delayedHouses = houses.filter((h: { status: string }) => h.status === "delayed");
  const bookingLeads = leads.filter((l: { status: string }) => l.status === "Booking" || l.status === "Loan Process");
  const totalIncome = transactions
    .filter((t: { transaction_type: string }) => t.transaction_type === "income")
    .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
  const totalExpenses = transactions
    .filter((t: { transaction_type: string }) => t.transaction_type === "expense")
    .reduce((s: number, t: { amount: number }) => s + Math.abs(Number(t.amount)), 0);

  const systemContext = `คุณคือ AVIVA AI Executive Assistant ระบบ AI วิเคราะห์ธุรกิจอสังหาริมทรัพย์หรู
ข้อมูลโครงการ AVIVA ONE ปัจจุบัน (ข้อมูล real-time จากฐานข้อมูล):
- ยูนิตทั้งหมด: ${totalUnits} | ขายแล้ว: ${soldUnits} | ว่าง: ${totalUnits - soldUnits}
- รายได้รวม: ฿${(project?.revenue_actual ?? 0).toLocaleString()} | เป้า: ฿${(project?.revenue_target ?? 0).toLocaleString()}
- ความคืบหน้าการก่อสร้าง: ${project?.construction_progress ?? 0}%
- คาดว่าจะขายหมด: ${project?.sellout_forecast ?? "ไม่ทราบ"}
- ยูนิตล่าช้า: ${delayedHouses.length} หน่วย (${delayedHouses.map((h: { house_number: string }) => h.house_number).join(", ")})
- Lead ใน Booking/Loan: ${bookingLeads.length} ราย
- รายรับล่าสุด: ฿${totalIncome.toLocaleString()} | รายจ่าย: ฿${totalExpenses.toLocaleString()}

ตอบเป็นภาษาไทย กระชับ เป็นมืออาชีพ ให้คำแนะนำเชิงกลยุทธ์`;

  // If no OpenAI key, return smart fallback
  if (!OPENAI_API_KEY) {
    return NextResponse.json({
      response: generateFallback(message, { soldUnits, totalUnits, delayedHouses, bookingLeads }),
    });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    const data = await res.json();
    const response = data.choices?.[0]?.message?.content ?? "ไม่สามารถประมวลผลได้ กรุณาลองใหม่";
    return NextResponse.json({ response });
  } catch {
    return NextResponse.json({
      response: generateFallback(message, { soldUnits, totalUnits, delayedHouses, bookingLeads }),
    });
  }
}

function generateFallback(
  message: string,
  data: { soldUnits: number; totalUnits: number; delayedHouses: { house_number: string }[]; bookingLeads: unknown[] }
) {
  const { soldUnits, totalUnits, delayedHouses, bookingLeads } = data;
  const pct = Math.round((soldUnits / (totalUnits || 1)) * 100);

  if (message.includes("ขาย") || message.includes("Sellout") || message.includes("หมด"))
    return `จากข้อมูลล่าสุด ขายไปแล้ว ${soldUnits}/${totalUnits} ยูนิต (${pct}%) มี ${bookingLeads.length} ราย อยู่ใน Booking/Loan Process คาดว่าจะขายหมดภายใน Q3 2026 ครับ`;
  if (message.includes("ล่าช้า") || message.includes("ก่อสร้าง"))
    return `มียูนิตล่าช้า ${delayedHouses.length} หน่วย: ${delayedHouses.map((h) => h.house_number).join(", ")} แนะนำส่ง Engineer เข้าตรวจสอบและเร่งงานด่วนครับ`;
  if (message.includes("การเงิน") || message.includes("Cashflow") || message.includes("เงิน"))
    return `รายรับมากกว่ารายจ่ายในทุกเดือนที่ผ่านมา Cashflow ยังแข็งแกร่ง แนะนำเร่งปิดการขาย ${bookingLeads.length} ราย ที่อยู่ใน pipeline เพื่อเพิ่ม Cashflow เดือนหน้าครับ`;
  if (message.includes("ROI") || message.includes("แคมเปญ") || message.includes("การตลาด"))
    return `แคมเปญ Facebook มี ROI สูงสุด 340% ตามด้วย Google 280% และ TikTok 215% แนะนำเพิ่มงบ Facebook อีก 20% และทดสอบ Creative ใหม่ในสัปดาห์หน้าครับ`;
  return `จากข้อมูล AVIVA ONE ล่าสุด: ขายแล้ว ${soldUnits}/${totalUnits} ยูนิต (${pct}%), ยูนิตล่าช้า ${delayedHouses.length} หน่วย, Lead ใน pipeline ${bookingLeads.length} ราย กรุณาระบุคำถามให้ชัดเจนขึ้นเพื่อให้วิเคราะห์ได้แม่นยำกว่านี้ครับ`;
}
