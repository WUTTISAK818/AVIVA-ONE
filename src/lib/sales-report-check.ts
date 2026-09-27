import { supabase } from "@/lib/supabase";

// กัน "รายงานว่ารับจอง แต่ไม่ได้บันทึกในระบบ" — เคสจริง 26 ก.ย. 69:
// ฟ้าเขียนในรายงานประจำวันว่าบุ๊กจองบ้าน V29 แต่สถานะลูกค้าใน CRM ยังเป็น "เยี่ยมชมโครงการ"
// ผลคือผังโครงการไม่อัปเดต · ไม่มีคำขออนุมัติเงินจอง · แปลงเดียวกันยังเสนอลูกค้ารายอื่นได้ (เสี่ยงขายซ้ำ)
//
// หมายเหตุทิศทางข้อมูล: ถ้าบันทึกใน CRM ก่อน ระบบจะดึงมาเติมรายงานให้เองอยู่แล้ว (report-auto-items)
// ตัวตรวจนี้จึงกันเฉพาะทิศทางกลับกัน คือพิมพ์ในรายงานแต่ไม่ได้ลงระบบ

const BOOKING_WORDS = ["จอง", "บุ๊ก", "booking", "book ", "ทำสัญญา", "เซ็นสัญญา", "ปิดการขาย", "closed deal"];
const BOOKED_STATUSES = ["Booking", "Contract", "Loan Approved", "Closed Deal"];

export interface BookingCheck {
  /** รายงานพูดถึงการจอง/ทำสัญญา */
  mentioned: boolean;
  /** คำที่ตรวจเจอ (ใช้บอกผู้ใช้ว่าเจอจากตรงไหน) */
  keyword: string | null;
  /** จำนวนลูกค้าที่ถูกบันทึกเป็นจอง/สัญญาในวันนั้นจริง */
  recordedCount: number;
}

/** ตรวจว่ารายงานพูดถึงการจอง แล้วมีการบันทึกใน CRM วันนั้นจริงไหม
 *  best-effort — ถ้าตรวจไม่ได้ให้ถือว่าไม่ต้องเตือน (ห้ามขวางการส่งรายงาน) */
export async function checkUnrecordedBooking(opts: {
  userEmail: string;
  reportDate: string;          // "YYYY-MM-DD" เวลาไทย
  texts: string[];             // รายการงาน + สรุป
}): Promise<BookingCheck> {
  const none: BookingCheck = { mentioned: false, keyword: null, recordedCount: 0 };
  try {
    const blob = opts.texts.filter(Boolean).join(" ").toLowerCase();
    const keyword = BOOKING_WORDS.find(w => blob.includes(w.toLowerCase())) ?? null;
    if (!keyword) return none;

    // ชื่อที่ใช้ใน leads.assigned_to คือชื่อเล่น/ชื่อเต็มในทะเบียนพนักงาน
    const { data: me } = await supabase
      .from("employees_directory")
      .select("full_name, nickname")
      .ilike("email", opts.userEmail)
      .maybeSingle();
    const names = [me?.nickname, me?.full_name].filter(Boolean) as string[];
    if (names.length === 0) return { mentioned: true, keyword, recordedCount: 0 };

    // ลูกค้าของคนนี้ที่ถูกอัปเดตเป็นสถานะจอง/สัญญา ภายในวันที่ของรายงาน
    const { data: booked } = await supabase
      .from("leads")
      .select("id, updated_at, status, assigned_to")
      .in("status", BOOKED_STATUSES)
      .in("assigned_to", names)
      .gte("updated_at", `${opts.reportDate}T00:00:00+07:00`)
      .lte("updated_at", `${opts.reportDate}T23:59:59+07:00`)
      .limit(20);

    return { mentioned: true, keyword, recordedCount: (booked ?? []).length };
  } catch {
    return none;   // ตรวจไม่ได้ = ไม่เตือน ดีกว่าขวางไม่ให้ส่งรายงาน
  }
}
