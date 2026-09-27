// วันที่แบบเวลาไทย (Asia/Bangkok) — แหล่งความจริงเดียวของทั้งแอป
//
// ปัญหาที่ไฟล์นี้กันไว้ (พบจากการตรวจมาตรฐาน 2026-09-17):
//   `new Date().toISOString().split("T")[0]` คืนวันที่ตามเวลา UTC เสมอ
//   ช่วง 00:00–07:00 น. ของไทยยังเป็น "เมื่อวาน" ในเวลา UTC → ข้อมูลถูกบันทึกย้อนหลัง 1 วันโดยไม่มีใครรู้
//
//   ส่วน `new Date(Date.now() + 7*3600000).getDay()` ก็ห้ามใช้เช่นกัน — ถ้ารันบนเบราว์เซอร์ที่ตั้งโซนเวลาไทยอยู่แล้ว
//   จะบวกซ้ำเป็น +14 ชม. ทำให้วันเพี้ยนไปข้างหน้าตั้งแต่ 17:00 น. (บั๊กที่เคยทำให้พีทส่งรายงานวันเสาร์ไม่ได้ — v7.38)
//
// ใช้ timeZone ตรง ๆ เท่านั้น ปลอดภัยทั้งฝั่งเซิร์ฟเวอร์ (UTC) และเบราว์เซอร์ผู้ใช้ (โซนเวลาใดก็ได้)

const TH = "Asia/Bangkok";

/** วันที่ตามเวลาไทยของ Date ที่ระบุ เป็น "YYYY-MM-DD" */
export function thaiDateOf(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TH });
}

/** วันที่ปัจจุบันตามเวลาไทย เป็น "YYYY-MM-DD" (ใส่ offsetMs เพื่อเลื่อนไป-กลับได้) */
export function thaiDateStr(offsetMs = 0): string {
  return thaiDateOf(new Date(Date.now() + offsetMs));
}

/** เดือนปัจจุบันตามเวลาไทย เป็น "YYYY-MM" */
export function thaiMonthStr(offsetMs = 0): string {
  return thaiDateStr(offsetMs).slice(0, 7);
}

/** เวลาไทยปัจจุบัน เป็น "HH:MM" (24 ชม.) */
export function thaiTimeStr(): string {
  return new Date().toLocaleTimeString("en-GB", { timeZone: TH, hour: "2-digit", minute: "2-digit" });
}

/** วันในสัปดาห์ (0=อาทิตย์ .. 6=เสาร์) ของวันที่แบบ "YYYY-MM-DD" — ไม่ขึ้นกับโซนเวลาเครื่องที่รัน */
export function dowOfDateStr(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

/** บวก/ลบวันจากวันที่แบบ "YYYY-MM-DD" โดยไม่ยุ่งกับโซนเวลา */
export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** แปลงค่าจากช่องกรอกวันที่ให้เป็น ค.ศ. เสมอ
 *
 *  ปัญหาจริงที่พบ (2026-09-27): มือถือที่ตั้งปฏิทินเป็นพุทธศักราชส่งค่าปี พ.ศ. กลับมา
 *  เช่น "2569-09-26" ซึ่งฐานข้อมูลเก็บเป็นปี ค.ศ. 2569 = อีก 543 ปีข้างหน้า
 *  ทำให้ลูกค้า 45 รายหายไปจากรายงานที่กรองด้วยวันที่ โดยไม่มีใครรู้
 *
 *  คืน null เมื่อว่าง · คืนค่าเดิมถ้ารูปแบบไม่ใช่ YYYY-MM-DD (ให้ฝั่ง DB ปฏิเสธเองตามปกติ)
 */
export function normalizeDateInput(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  const year = Number(m[1]);
  // ปี พ.ศ. ปัจจุบันอยู่ราว 2560-2600 — ถ้าเกิน 2400 ถือว่าเป็น พ.ศ. แน่นอน (ค.ศ. 2400 คืออีก ~370 ปี)
  return year > 2400 ? `${year - 543}-${m[2]}-${m[3]}` : v;
}
