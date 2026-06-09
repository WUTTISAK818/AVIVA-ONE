// PDPA: ปิดบังข้อมูลส่วนบุคคลสำหรับบทบาทที่ไม่จำเป็นต้องเห็นเต็ม
export function maskPhone(phone?: string | null): string {
  if (!phone) return "-";
  const d = phone.replace(/\D/g, "");
  if (d.length < 4) return "•••";
  return `${d.slice(0, 3)}-•••-${d.slice(-2)}`;
}

export function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return email ?? "-";
  const [u, dom] = email.split("@");
  return `${u.slice(0, 2)}•••@${dom}`;
}
