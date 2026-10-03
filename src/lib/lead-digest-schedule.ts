// ตารางเวลาของสรุปลูกค้าใหม่รายเดือน — แยกออกมาเป็นไฟล์ของตัวเองเพื่อทดสอบได้โดยไม่ต้องยิง cron จริง
//
// ปัญหาเดิม (Pom ถาม 3 ต.ค. 69 ว่าสรุปรายเดือนของกันยาส่งเข้า LINE จริงไหม):
// สรุปรายเดือนยิงได้แค่ "วันสุดท้ายของเดือน" ครั้งเดียว ถ้ารอบนั้นไม่ทำงานหรือส่งไม่สำเร็จ
// สรุปของเดือนนั้นจะหายไปเลย ไม่มีรอบไหนตามเก็บ และไม่มีใครรู้ว่าหาย

export interface MonthlyDigestTarget {
  /** ขอบล่างของช่วง (ISO) — รวมตัวมันเอง */
  since: string;
  /** ขอบบนของช่วง (ISO) — ไม่รวมตัวมันเอง */
  until: string;
  /** ป้ายเดือนแบบไทย เช่น "กันยายน 2569" — ใช้เป็นส่วนหนึ่งของหัวข้อ จึงใช้เทียบว่าส่งไปแล้วหรือยัง */
  label: string;
}

const monthStartUtcMs = (yy: number, mm: number) => Date.UTC(yy, mm, 1) - 7 * 3_600_000;

const monthLabelTh = (yy: number, mm: number) =>
  new Date(Date.UTC(yy, mm, 15)).toLocaleDateString("th-TH", { timeZone: "UTC", month: "long", year: "numeric" });

/**
 * เดือนที่ต้องสรุปในรอบนี้ — null = รอบนี้ไม่ต้องสรุปรายเดือน
 * - วันสุดท้ายของเดือน → สรุปเดือนปัจจุบัน (พฤติกรรมเดิม ไม่เปลี่ยน)
 * - วันที่ 1-5 ของเดือน → สรุปเดือนที่แล้ว เป็นรอบตามเก็บเผื่อรอบวันสุดท้ายไม่ได้ทำงาน
 *
 * @param thaiNow เวลาปัจจุบันที่บวก UTC+7 ไว้แล้ว (อ่านค่าด้วย getUTC* เหมือนที่ cron ตัวอื่นทำ)
 */
export function monthlyDigestTarget(thaiNow: Date): MonthlyDigestTarget | null {
  const y = thaiNow.getUTCFullYear();
  const m = thaiNow.getUTCMonth();
  const day = thaiNow.getUTCDate();

  const isLastDayOfMonth = new Date(Date.UTC(y, m, day + 1)).getUTCMonth() !== m;
  if (isLastDayOfMonth) {
    return {
      since: new Date(monthStartUtcMs(y, m)).toISOString(),
      until: new Date(monthStartUtcMs(y, m + 1)).toISOString(),
      label: monthLabelTh(y, m),
    };
  }
  if (day <= 5) {
    return {
      since: new Date(monthStartUtcMs(y, m - 1)).toISOString(),
      until: new Date(monthStartUtcMs(y, m)).toISOString(),
      label: monthLabelTh(y, m - 1),
    };
  }
  return null;
}
