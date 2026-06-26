// แหล่งกลางสำหรับ "ดึงงานที่ทำระหว่างวัน" มาเติมรายงานประจำวัน
// ใช้ร่วมกันระหว่างหน้า /reports และปุ่ม "ส่งรายงานวัน" ใน CRM เพื่อให้ logic ตรงกัน ไม่ซ้ำซ้อน
import { supabase } from "@/lib/supabase";

export interface AutoItem {
  category: string;
  description: string;
  source: string;
}

// ใช้เฉพาะฟิลด์ที่จำเป็น (ไม่ผูกกับ AppUser เต็มรูปแบบ)
export interface AutoItemUser {
  id: string;
  full_name?: string | null;
  department?: string | null;
}

const WF_LABELS: Record<string, string> = {
  Finance_Approval:   "เบิกเงิน",
  Material_Purchase:  "ขอจัดซื้อวัสดุ",
  Installment_Review: "ส่งตรวจงวดงาน",
  Leave_Request:      "ยื่นคำขอลา",
  Document_Approval:  "ขออนุมัติเอกสาร",
  Booking_Deposit:    "บันทึกการจอง",
  Contract_Approval:  "ส่งสัญญาซื้อขาย",
  Warranty_Claim:     "แจ้งซ่อม",
};

// today = วันที่ UTC (YYYY-MM-DD) ใช้กับคอลัมน์ created_at (timestamptz)
// todayBkk = วันที่เวลาไทย (UTC+7) ใช้กับ activity_logs.activity_date (date) ที่บันทึกเป็นวันที่ไทย
export async function buildAutoItems(
  user: AutoItemUser,
  today: string,
  todayBkk: string,
): Promise<AutoItem[]> {
  const out: AutoItem[] = [];
  const add = (category: string, description: string, source: string) => {
    const d = (description ?? "").trim();
    if (d) out.push({ category, description: d, source });
  };
  const dayStart = `${today}T00:00:00`, dayEnd = `${today}T23:59:59`;

  // 1) approval_logs — เอกสาร/คำขออนุมัติของผู้ใช้ (exact ด้วย submitted_by_user_id; เลี่ยง ilike %% ที่ match ทุกแถว)
  const { data: logs } = await supabase
    .from("approval_logs")
    .select("workflow_type, source_doc_index, amount")
    .eq("submitted_by_user_id", user.id)
    .gte("created_at", dayStart).lte("created_at", dayEnd);
  (logs ?? []).forEach((log: Record<string, any>) => {
    const label = WF_LABELS[log.workflow_type] ?? log.workflow_type;
    const docNum = (log.source_doc_index as string)?.split(" | ")[0] ?? "";
    const amount = log.amount ? ` (฿${Number(log.amount).toLocaleString()})` : "";
    add("activity", `${label}: ${docNum}${amount}`, "auto");
  });

  // 2) activity_logs — งานที่พนักงานพิมพ์เองระหว่างวัน (เฉพาะ source=manual กันซ้ำกับสรุปอัตโนมัติ)
  const { data: activityLogs } = await supabase
    .from("activity_logs")
    .select("title, detail")
    .eq("user_id", user.id)
    .eq("activity_date", todayBkk)
    .eq("source", "manual")
    .order("activity_time", { ascending: true });
  (activityLogs ?? []).forEach((log: Record<string, any>) => {
    const detail = log.detail ? ` — ${log.detail}` : "";
    add("activity", `${log.title}${detail}`, "activity");
  });

  // 3) ฝ่ายขาย — กิจกรรมการขาย + การติดต่อลูกค้าของตัวเองวันนี้
  if (user.department === "ฝ่ายขาย") {
    const { data: acts } = await supabase
      .from("sales_activities")
      .select("activity_type, note, created_by, created_by_name")
      .gte("created_at", dayStart).lte("created_at", dayEnd);
    (acts ?? [])
      .filter((a: Record<string, any>) => a.created_by === user.id || a.created_by_name === user.full_name)
      .forEach((a: Record<string, any>) => {
        add("activity", `[ขาย] ${a.activity_type ?? ""}${a.note ? ` — ${a.note}` : ""}`, "auto");
      });

    // crm_logs — โทร/ติดต่อลูกค้า (created_by_id มี default auth.uid() เชื่อถือได้)
    const { data: calls } = await supabase
      .from("crm_logs")
      .select("contact_channel, call_status, call_note")
      .eq("created_by_id", user.id)
      .gte("created_at", dayStart).lte("created_at", dayEnd);
    (calls ?? []).forEach((l: Record<string, any>) => {
      const status = l.call_status ? ` (${l.call_status})` : "";
      const note = l.call_note ? ` — ${l.call_note}` : "";
      add("activity", `[ติดต่อลูกค้า] ${l.contact_channel ?? ""}${status}${note}`, "auto");
    });
  }

  // 4) ฝ่ายก่อสร้าง — รายงานก่อสร้างของตัวเองวันนี้
  if (user.department === "ฝ่ายก่อสร้าง") {
    const { data: creports } = await supabase
      .from("construction_reports")
      .select("work_type, work_detail, progress, created_by, reported_by")
      .gte("created_at", dayStart).lte("created_at", dayEnd);
    (creports ?? [])
      .filter((r: Record<string, any>) => r.created_by === user.id || r.reported_by === user.full_name)
      .forEach((r: Record<string, any>) => {
        const pct = typeof r.progress === "number" ? ` (${r.progress}%)` : "";
        add("activity", `[ก่อสร้าง] ${r.work_type ?? "งาน"}: ${r.work_detail ?? ""}${pct}`, "auto");
      });
  }

  return out;
}

// กรองรายการซ้ำ: เทียบ description ที่ normalize แล้ว กับชุดที่มีอยู่ + กันซ้ำภายในชุดเอง
export function dedupeAutoItems<T extends { description: string }>(
  candidates: T[],
  existingDescriptions: string[],
): T[] {
  const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const seen = new Set(existingDescriptions.map(norm));
  const out: T[] = [];
  for (const c of candidates) {
    const k = norm(c.description);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}
