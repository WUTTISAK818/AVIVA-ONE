// ตัวช่วยตรวจยอดเงินรวมศูนย์ — มาตรฐานทีม (docs/QA-STANDARD.md ส่วน D)
// กันเคสจริงที่เคยพัง: พิมพ์ "1,000" (ลูกน้ำ) → Number() = NaN → บันทึกล้มเหลวเงียบ · ติดลบ/ศูนย์หลุดเข้า DB

/**
 * แปลงข้อความยอดเงินเป็นตัวเลขที่ปลอดภัย
 * รองรับลูกน้ำคั่นหลัก/ช่องว่าง/สัญลักษณ์ ฿ — คืน null เมื่อไม่ใช่ตัวเลขบวก
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const cleaned = String(input).replace(/[,฿\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** เหมือน parseAmount แต่ยอมให้เป็น 0 ได้ (เช่น อัตรา % หรือค่า optional) */
export function parseAmountOrZero(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || String(input).trim() === "") return 0;
  const cleaned = String(input).replace(/[,฿\s]/g, "").trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** ข้อความแจ้งเตือนมาตรฐานเมื่อยอดเงินไม่ถูกต้อง */
export const AMOUNT_ERROR = "ยอดเงินไม่ถูกต้อง — กรอกเป็นตัวเลขมากกว่า 0 (ไม่ต้องใส่ลูกน้ำ)";
