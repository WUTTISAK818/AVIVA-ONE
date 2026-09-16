import { supabase } from "./supabase";
import { createNotification, notifyPersonalLine } from "./notify";

// เมื่อแปลงใดถูกจอง → ลูกค้าคนอื่นที่สนใจแปลงเดียวกันจะ "ลอย" ทันที
// ระบบจึงแจ้งพนักงานเจ้าของลูกค้ากลุ่มนั้นให้กลับไปเสนอแปลงอื่น พร้อมรายชื่อแปลงที่ยังว่าง
// (สถานะที่ถือว่าปิดการขายแล้ว — ตรงกับ BOOKING_STATUSES ในหน้า CRM)
const TAKEN_STATUSES = ["Booking", "Contract", "Loan Approved", "Closed Deal"];
const PLOT_COUNT = 31;

interface OrphanLead {
  id: string;
  customer_name: string;
  phone: string | null;
  assigned_to: string | null;
  status: string;
}

/** แปลงที่ยังไม่มีใครจอง/ทำสัญญา — ใช้เสนอเป็นตัวเลือกแทนให้ลูกค้าที่ลอย */
async function availablePlots(excludePlot: number): Promise<number[]> {
  const { data } = await supabase
    .from("leads")
    .select("plot_number, status")
    .in("status", TAKEN_STATUSES)
    .not("plot_number", "is", null);
  const taken = new Set<number>((data ?? []).map(r => r.plot_number as number));
  taken.add(excludePlot);
  return Array.from({ length: PLOT_COUNT }, (_, i) => i + 1).filter(n => !taken.has(n));
}

/** ชื่อผู้ดูแลใน leads.assigned_to (ชื่อเล่น) -> อีเมล เพื่อเจาะแจ้งเตือนถึงตัวคน */
async function emailByOwnerName(): Promise<Map<string, string>> {
  const { data } = await supabase.from("employees_directory").select("full_name, nickname, email");
  const map = new Map<string, string>();
  for (const e of (data ?? []) as { full_name: string | null; nickname: string | null; email: string | null }[]) {
    if (!e.email) continue;
    if (e.nickname) map.set(e.nickname.trim().toLowerCase(), e.email);
    if (e.full_name) map.set(e.full_name.trim().toLowerCase(), e.email);
  }
  return map;
}

/**
 * แจ้งพนักงานที่มีลูกค้าสนใจแปลงที่เพิ่งถูกจอง ให้กลับไปเสนอแปลงอื่น
 * best-effort — ไม่ throw เพื่อไม่ให้กระทบการบันทึกการจอง
 */
export async function alertOthersInterestedInPlot(opts: {
  plotNumber: number;
  bookedLeadId: string;
  bookedCustomerName: string;
  byName: string;
}): Promise<{ notified: number; orphans: number }> {
  const { data } = await supabase
    .from("leads")
    .select("id, customer_name, phone, assigned_to, status")
    .eq("plot_number", opts.plotNumber)
    .not("status", "in", `(${TAKEN_STATUSES.map(s => `"${s}"`).join(",")})`)
    .neq("id", opts.bookedLeadId);

  const orphans = (data as OrphanLead[]) ?? [];
  if (orphans.length === 0) return { notified: 0, orphans: 0 };

  const [free, ownerEmail] = await Promise.all([availablePlots(opts.plotNumber), emailByOwnerName()]);
  const freeText = free.length > 0
    ? `แปลงที่ยังว่างอยู่: ${free.slice(0, 12).join(", ")}${free.length > 12 ? ` (และอีก ${free.length - 12} แปลง)` : ""}`
    : "ขณะนี้ไม่มีแปลงว่างเหลือแล้ว";

  // จัดกลุ่มตามผู้ดูแล — คนที่ไม่มีผู้ดูแลรวมไว้แจ้งผู้บริหาร
  const byOwner = new Map<string, OrphanLead[]>();
  for (const o of orphans) {
    const key = (o.assigned_to ?? "").trim() || "(ไม่มีผู้ดูแล)";
    byOwner.set(key, [...(byOwner.get(key) ?? []), o]);
  }

  let notified = 0;
  for (const [owner, list] of byOwner) {
    const names = list.map(l => `${l.customer_name}${l.phone ? ` (${l.phone})` : ""}`).join("\n• ");
    const title = `แปลง ${opts.plotNumber} ถูกจองแล้ว — มีลูกค้าของคุณ ${list.length} รายที่สนใจแปลงนี้`;
    const body = `${opts.bookedCustomerName} จองแปลง ${opts.plotNumber} แล้ว (โดย ${opts.byName})\n\nลูกค้าที่ต้องกลับไปเสนอแปลงอื่น:\n• ${names}\n\n${freeText}`;
    const email = ownerEmail.get(owner.toLowerCase());

    if (email) {
      await createNotification({ type: "activity", title, message: body, to_user_email: email, link: "/crm" }).catch(() => {});
      await notifyPersonalLine(title, body, "/crm", [email]).catch(() => {});
      notified++;
    } else {
      // ไม่รู้ว่าใครดูแล (หรือชื่อไม่ตรงทะเบียนพนักงาน) → ส่งให้ผู้บริหารตัดสินใจมอบหมาย
      await createNotification({
        type: "activity",
        title: `${title} — ยังไม่มีผู้ดูแล`,
        message: `${body}\n\n(ผู้ดูแลในระบบ: ${owner} — ไม่พบอีเมลที่ตรงกับทะเบียนพนักงาน กรุณามอบหมายผู้รับผิดชอบ)`,
        from_dept: "ฝ่ายขาย", to_dept: "ผู้บริหาร", link: "/crm",
      }).catch(() => {});
    }
  }

  return { notified, orphans: orphans.length };
}
