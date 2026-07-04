// หมวดวัสดุก่อสร้าง — ใช้ร่วมฟอร์มขอสั่งซื้อ (PR/PO) ทั้งหน้าก่อสร้างและคลังวัสดุ
// เพื่อให้ผู้บริหารกรอง/สรุปงบจัดซื้อตามหมวดได้ (ชุดงาน #7)
export const MATERIAL_CATEGORIES = [
  "โครงสร้าง",
  "กระเบื้อง/พื้นผิว",
  "สุขภัณฑ์",
  "ไฟฟ้า",
  "ประปา",
  "สี/เคลือบผิว",
  "ประตู/หน้าต่าง",
  "หลังคา",
  "เครื่องมือ/อุปกรณ์",
  "อื่น ๆ",
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];
export const DEFAULT_MATERIAL_CATEGORY: MaterialCategory = "อื่น ๆ";
