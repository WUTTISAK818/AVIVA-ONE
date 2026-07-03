// แปลรหัสข้อผิดพลาดจากฐานข้อมูล/เครือข่ายเป็นภาษาไทยที่ผู้ใช้เข้าใจ + แนะวิธีแก้
// มาตรฐานทีม (docs/QA-STANDARD.md ส่วน D): ห้ามโชว์ raw error อังกฤษให้ผู้ใช้

interface DbErrorLike { code?: string; message?: string }

export function thaiDbError(error: DbErrorLike | null | undefined, action = "บันทึกข้อมูล"): string {
  if (!error) return `${action}ไม่สำเร็จ — ลองใหม่อีกครั้ง`;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();

  if (code === "23505") return `${action}ไม่สำเร็จ — มีรายการนี้อยู่แล้ว (ข้อมูลซ้ำ)`;
  if (code === "23503") return `${action}ไม่สำเร็จ — ข้อมูลอ้างอิงไม่ครบ (รายการที่เกี่ยวข้องอาจถูกลบไปแล้ว)`;
  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission"))
    return `${action}ไม่สำเร็จ — บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้ (ติดต่อผู้ดูแลระบบ)`;
  if (code === "23502") return `${action}ไม่สำเร็จ — ข้อมูลบางช่องที่จำเป็นยังว่างอยู่`;
  if (code === "22P02" || msg.includes("invalid input"))
    return `${action}ไม่สำเร็จ — รูปแบบข้อมูลไม่ถูกต้อง ตรวจตัวเลข/วันที่อีกครั้ง`;
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("timeout"))
    return `${action}ไม่สำเร็จ — การเชื่อมต่ออินเทอร์เน็ตมีปัญหา ตรวจสัญญาณแล้วลองใหม่ (ข้อมูลที่กรอกยังอยู่)`;
  return `${action}ไม่สำเร็จ (${code || "ไม่ทราบสาเหตุ"}) — ลองใหม่อีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ`;
}
