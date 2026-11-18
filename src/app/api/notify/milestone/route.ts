import { NextRequest, NextResponse } from "next/server";
import { sendPush } from "@/lib/push-notify";

export const runtime = "nodejs";

/**
 * แจ้งเตือนหมุดหมายการขาย (จอง/ทำสัญญา/อนุมัติกู้/โอนแล้ว) ออกหลายช่องทาง:
 *  - Web push -> ฝ่ายขาย + ฝ่ายบริหาร (ตาม push_subscriptions)
 *  - (LINE กลุ่มเลิกใช้ตั้งแต่ v8.14 — ประหยัดโควตา LINE)
 * ทุกช่องทางเป็น best-effort: ไม่มี config ก็ข้ามเงียบ ไม่ทำให้ flow ล้ม
 */
export async function POST(req: NextRequest) {
  let p: { title: string; body: string; url?: string };
  try {
    p = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!p?.title || !p?.body) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }

  const base = req.nextUrl.origin;
  const absUrl = p.url ? (p.url.startsWith("http") ? p.url : base + p.url) : `${base}/crm`;

  // Web push -> ฝ่ายขาย + ฝ่ายบริหาร
  const depts = ["ฝ่ายขาย", "ฝ่ายบริหาร"];
  const pushResults = await Promise.allSettled(
    depts.map((department) =>
      sendPush({ department }, { title: p.title, body: p.body, url: absUrl, tag: "aviva-milestone" })
    )
  );
  const pushSent = pushResults.reduce((n, r) => n + (r.status === "fulfilled" ? r.value.sent : 0), 0);

  // v8.14 (Pom อนุมัติ 17 พ.ย. 69): เลิกส่ง LINE กลุ่ม — หมุดหมายการขายเป็นเรื่องแจ้งให้ทราบ
  // ยังเห็นในกระดิ่ง + push + ฉลองในแอปเหมือนเดิม · ข้อความกลุ่มนับโควตาตามจำนวนสมาชิกกลุ่ม และเดิมไม่ลงบันทึก
  return NextResponse.json({ ok: true, pushSent, line: false });
}
