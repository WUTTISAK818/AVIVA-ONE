// Source of truth สำหรับสิทธิ์ตาม role — ใช้ร่วมกันทั้ง client และ server
//
// ── กฎถาวร (PERMANENT) ────────────────────────────────────────────────
// CEO และ COO = สิทธิ์สูงสุด เข้าถึงข้อมูลได้ทุกส่วน และทำได้ทุกอย่าง (เทียบเท่า admin)
// บังคับใช้ 3 ชั้น:
//   1) UI/หน้าจอ  — isSuperRole / isManagerRole (ไฟล์นี้ + user-context.tsx)
//   2) API/server — MANAGER_ROLES (ai-chat, ai-council, admin/settings ฯลฯ)
//   3) ฐานข้อมูล  — auth_role() ใน Postgres map ceo/coo -> admin (RLS ทุก policy)
// หากเพิ่ม role ระดับผู้บริหารใหม่ ให้เพิ่มที่นี่ + ใน auth_role() ของ DB
// ──────────────────────────────────────────────────────────────────────

// สิทธิ์สูงสุด — เข้าถึง/แก้ไขได้ทุกอย่าง
export const SUPER_ROLES = ["admin", "ceo", "coo"] as const;

// ระดับผู้จัดการขึ้นไป (เห็นข้อมูลเชิงบริหาร, อนุมัติ ฯลฯ)
export const MANAGER_ROLES = ["admin", "ceo", "coo", "manager", "director", "project_manager"] as const;

// normalize ค่า role ก่อนเทียบ — กันปัญหาตัวพิมพ์ใหญ่/เล็กและช่องว่าง
// (ข้อมูลจริงใน DB/JWT มีทั้ง "CEO"/"ceo", "Sales Manager", "Finance" ปนกัน)
function normRole(role?: string | null): string {
  return (role ?? "").toLowerCase().trim();
}

export function isSuperRole(role?: string | null): boolean {
  return (SUPER_ROLES as readonly string[]).includes(normRole(role));
}

export function isManagerRole(role?: string | null): boolean {
  const r = normRole(role);
  if (!r) return false;
  if ((MANAGER_ROLES as readonly string[]).includes(r)) return true;
  // ตำแหน่งหัวหน้า/ผู้จัดการที่ระบุฝ่าย เช่น "Sales Manager", "Construction Manager", "QC Manager", "ผู้จัดการฝ่ายขาย"
  return /manager|director|management|executive|ผู้จัดการ|ผู้บริหาร|หัวหน้า/.test(r);
}
