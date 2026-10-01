// คำอธิบายภาษาไทยของสาเหตุที่ส่ง LINE ไม่สำเร็จ — ใช้ได้ทั้งฝั่ง client และ server
// (แยกจาก line-log.ts ซึ่งเป็น server-only เพราะเรียก LINE API โดยตรง)
const LINE_ERROR_TH: Record<string, string> = {
  "not-linked": "ผู้รับยังไม่ได้ผูกบัญชี LINE",
  "no-line-token": "ระบบยังไม่ได้ตั้งค่าโทเคน LINE",
  "no-recipient": "ไม่พบบัญชี LINE ของผู้รับ",
  "line-error": "ติดต่อ LINE ไม่ได้ชั่วคราว",
  "lookup-error": "อ่านข้อมูลการผูกบัญชีไม่สำเร็จ",
};

export function lineErrorTh(code: string | null | undefined): string {
  if (!code) return "ส่งไม่สำเร็จ";
  if (LINE_ERROR_TH[code]) return LINE_ERROR_TH[code];
  if (code.startsWith("line-http-")) return `LINE ปฏิเสธข้อความ (รหัส ${code.replace("line-http-", "")})`;
  return code;
}
