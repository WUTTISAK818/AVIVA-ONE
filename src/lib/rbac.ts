// ===== WinVote — สิทธิ์การเข้าถึง 5 ชั้น (RBAC) =====
// แหล่งความจริงเดียวของชั้นสิทธิ์ + ความสามารถของแต่ละชั้น
// บังคับจริงอีกชั้นด้วย RLS ที่ฐานข้อมูล (ทำในเฟสถัดไปเมื่อผูกผู้ใช้กับเขต/ชุมชน)

export type Tier =
  | "exec"          // ผู้บริหารระดับสูง
  | "staff_senior"  // เจ้าหน้าที่ระดับสูง
  | "staff_mid"     // เจ้าหน้าที่ระดับกลาง
  | "user_senior"   // ผู้ใช้ระดับสูง
  | "user_mid"      // ผู้ใช้ระดับกลาง
  | "none";

export type Scope = "all" | "district" | "community" | "own";

export interface Rbac {
  tier: Tier;
  tierLabel: string;
  scope: Scope;
  canAccess: boolean;          // เข้าระบบได้
  canManageUsers: boolean;     // จัดการผู้ใช้
  canApprove: boolean;         // อนุมัติ/ยืนยันข้อมูล
  canEditData: boolean;        // แก้ไข/ลบข้อมูลที่มีอยู่
  canAddResident: boolean;     // เพิ่มราษฎรใหม่
  canExport: boolean;          // ส่งออก/ดูรายงาน
  canSeeAllDistricts: boolean; // เห็นทุกเขต
}

const DEF: Record<Tier, Omit<Rbac, "tier">> = {
  exec:         { tierLabel: "ผู้บริหารระดับสูง",   scope: "all",       canAccess: true,  canManageUsers: true,  canApprove: true,  canEditData: true,  canAddResident: true,  canExport: true,  canSeeAllDistricts: true },
  staff_senior: { tierLabel: "เจ้าหน้าที่ระดับสูง", scope: "all",       canAccess: true,  canManageUsers: false, canApprove: true,  canEditData: true,  canAddResident: true,  canExport: true,  canSeeAllDistricts: true },
  staff_mid:    { tierLabel: "เจ้าหน้าที่ระดับกลาง", scope: "district", canAccess: true,  canManageUsers: false, canApprove: true,  canEditData: true,  canAddResident: true,  canExport: true,  canSeeAllDistricts: false },
  user_senior:  { tierLabel: "ผู้ใช้ระดับสูง",       scope: "community", canAccess: true,  canManageUsers: false, canApprove: false, canEditData: true,  canAddResident: true,  canExport: false, canSeeAllDistricts: false },
  user_mid:     { tierLabel: "ผู้ใช้ระดับกลาง",      scope: "own",       canAccess: true,  canManageUsers: false, canApprove: false, canEditData: false, canAddResident: true,  canExport: false, canSeeAllDistricts: false },
  none:         { tierLabel: "ไม่มีสิทธิ์",          scope: "own",       canAccess: false, canManageUsers: false, canApprove: false, canEditData: false, canAddResident: false, canExport: false, canSeeAllDistricts: false },
};

// แปลง role string (รวม legacy) → ชั้นสิทธิ์
const ROLE_TO_TIER: Record<string, Tier> = {
  exec: "exec", admin: "exec", ceo: "exec",
  staff_senior: "staff_senior", director: "staff_senior",
  staff_mid: "staff_mid", manager: "staff_mid", project_manager: "staff_mid",
  user_senior: "user_senior",
  user_mid: "user_mid", user: "user_mid",
};

export function resolveRbac(role: string | undefined | null): Rbac {
  const tier = ROLE_TO_TIER[(role ?? "").trim()] ?? "none";
  return { tier, ...DEF[tier] };
}
