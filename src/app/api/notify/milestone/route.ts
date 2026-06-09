import { NextRequest, NextResponse } from "next/server";
import { sendPush } from "@/lib/push-notify";
import { sendLine } from "@/lib/line";

export const runtime = "nodejs";

/**
 * แจ้งเตือนหมุดหมายการขาย (จอง/ทำสัญญา/อนุมัติกู้/โอนแล้ว) ออกหลายช่องทาง:
 *  - Web push -> ฝ่ายขาย + ฝ่ายบริหาร (ตาม push_subscriptions)
 *  - LINE     -> กลุ่ม/ผู้รับที่ตั้งใน LINE_SALE_GROUP_ID (ถ้ามี)
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

  // LINE -> กลุ่มทีมขาย/ผู้บริหาร
  const lineTarget = process.env.LINE_SALE_GROUP_ID;
  let line = false;
  if (lineTarget) {
    const text = `${p.title}\n${p.body}\nเปิดดู: ${absUrl}`;
    const r = await sendLine(lineTarget, text);
    line = r.ok;
  }

  return NextResponse.json({ ok: true, pushSent, line });
}
