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
