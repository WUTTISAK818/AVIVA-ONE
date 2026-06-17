// ผังบัญชี GL กลาง + คำนวณภาษีซื้อ/หัก ณ ที่จ่าย สำหรับรายการการเงิน
// แก้ปัญหาเดิมที่ JV hardcode 5000 (ต้นทุนขาย-header) / 1100 (ไม่มีในผังบัญชี)
// ให้ map หมวด -> บัญชีที่ถูกต้องตาม chart_of_accounts จริง
export interface GLAccount { code: string; name: string; }

export const CASH: GLAccount = { code: "1110", name: "เงินสด" };
export const BANK: GLAccount = { code: "1120", name: "เงินฝากธนาคาร" };
export const INPUT_VAT: GLAccount = { code: "1600", name: "ภาษีมูลค่าเพิ่มซื้อ" };
export const OUTPUT_VAT: GLAccount = { code: "2300", name: "ภาษีมูลค่าเพิ่มขาย" };
export const WHT_PAYABLE: GLAccount = { code: "2400", name: "ภาษีหัก ณ ที่จ่ายค้างชำระ" };
export const CONTRACTOR_PAYABLE: GLAccount = { code: "2100", name: "เจ้าหนี้ผู้รับเหมา" };
export const RETENTION_PAYABLE: GLAccount = { code: "2150", name: "เงินประกันผลงานค้างจ่าย" };
export const AR: GLAccount = { code: "1200", name: "ลูกหนี้การค้า" };
export const CUSTOMER_ADVANCE: GLAccount = { code: "2200", name: "เงินรับล่วงหน้าจากลูกค้า" };
export const AP: GLAccount = { code: "2100", name: "เจ้าหนี้การค้า" };
export const PREPAID_WHT: GLAccount = { code: "1610", name: "ภาษีเงินได้ถูกหัก ณ ที่จ่าย (เครดิต CIT)" };
export const SBT_EXPENSE: GLAccount = { code: "6710", name: "ภาษีธุรกิจเฉพาะ (ภ.ธ.40)" };
export const TRANSFER_FEE: GLAccount = { code: "6700", name: "ค่าธรรมเนียมการโอน" };
// ธุรกิจอสังหา: ต้นทุนก่อสร้างสะสมใน "งานระหว่างก่อสร้าง" (สินค้าคงเหลือ) → ตัดเป็นต้นทุนขายตอนโอน
export const WIP: GLAccount = { code: "1180", name: "งานระหว่างก่อสร้าง" };
export const COGS: GLAccount = { code: "5210", name: "ต้นทุนขายบ้าน" };
export const LAND_COST: GLAccount = { code: "5100", name: "ต้นทุนที่ดิน" };
export const SALES_REVENUE: GLAccount = { code: "4100", name: "รายได้จากการขายบ้าน" };

// อัตรามาตรฐานจ่ายผู้รับเหมา (ค่าจ้างทำของ หัก ณ ที่จ่าย 3% / เงินประกันผลงาน 5%)
export const DEFAULT_CONTRACTOR_WHT = 3;
export const DEFAULT_RETENTION = 5;

// หมวดรายจ่าย -> บัญชีค่าใช้จ่าย (ทุก code มีจริงใน chart_of_accounts และไม่ใช่ header)
const EXPENSE_BY_CATEGORY: Record<string, GLAccount> = {
  "ค่าก่อสร้าง": { code: "5200", name: "ต้นทุนก่อสร้าง" },
  "ค่าวัสดุ": { code: "5200", name: "ต้นทุนก่อสร้าง" },
  "ค่าการตลาด": { code: "6300", name: "ค่าโฆษณา" },
  "เงินเดือน": { code: "6100", name: "เงินเดือนพนักงาน" },
  "ค่าดำเนินการ": { code: "6600", name: "ค่าใช้จ่ายสำนักงาน" },
  "ค่าใช้จ่ายสำนักงาน": { code: "6600", name: "ค่าใช้จ่ายสำนักงาน" },
  "ซ่อมบำรุงสำนักงาน": { code: "6600", name: "ค่าใช้จ่ายสำนักงาน" },
  "สวัสดิการ/ต้อนรับลูกค้า": { code: "6600", name: "ค่าใช้จ่ายสำนักงาน" },
};
const DEFAULT_EXPENSE: GLAccount = { code: "6600", name: "ค่าใช้จ่ายสำนักงาน" };

const REVENUE_BY_CATEGORY: Record<string, GLAccount> = {
  "รายรับจากการขาย": { code: "4100", name: "รายได้จากการขายบ้าน" },
};
const DEFAULT_REVENUE: GLAccount = { code: "4200", name: "รายได้อื่น" };

// ── ค่าใช้จ่ายประจำเดือน: ประเภท -> บัญชี GL ──────────────────────────────────
export const ACCUM_DEPR: GLAccount = { code: "1290", name: "ค่าเสื่อมราคาสะสม" };
export interface RecurringCategory { label: string; code: string; name: string; nonCash?: boolean; canCapitalize?: boolean; }
export const RECURRING_CATEGORIES: RecurringCategory[] = [
  { label: "ดอกเบี้ยเงินกู้/Project Finance", code: "5300", name: "ดอกเบี้ยจ่าย", canCapitalize: true },
  { label: "เงินเดือน+ประกันสังคม", code: "6100", name: "เงินเดือนพนักงาน" },
  { label: "ค่าเช่า (สำนักงาน/สนง.ขาย)", code: "6500", name: "ค่าเช่า" },
  { label: "สาธารณูปโภค (ไฟ/น้ำ/เน็ต/โทร)", code: "6400", name: "ค่าสาธารณูปโภค" },
  { label: "การตลาดประจำ", code: "6300", name: "ค่าโฆษณา" },
  { label: "ค่าบริการวิชาชีพ (บัญชี/กม.)", code: "6600", name: "ค่าใช้จ่ายสำนักงาน" },
  { label: "ค่าประกันภัย", code: "6600", name: "ค่าใช้จ่ายสำนักงาน" },
  { label: "ค่าเสื่อมราคา", code: "6900", name: "ค่าเสื่อมราคา", nonCash: true },
  { label: "อื่น ๆ", code: "6600", name: "ค่าใช้จ่ายสำนักงาน" },
];
export function recurringCategory(label?: string | null): RecurringCategory {
  return RECURRING_CATEGORIES.find((c) => c.label === label) ?? RECURRING_CATEGORIES[RECURRING_CATEGORIES.length - 1];
}

export function expenseAccountFor(category?: string | null): GLAccount {
  const c = category?.trim();
  return (c && EXPENSE_BY_CATEGORY[c]) || DEFAULT_EXPENSE;
}
export function revenueAccountFor(category?: string | null): GLAccount {
  const c = category?.trim();
  return (c && REVENUE_BY_CATEGORY[c]) || DEFAULT_REVENUE;
}

/** ดึงหมวดจาก description รูปแบบ "[หมวด] รายละเอียด" */
export function categoryFromDescription(desc?: string | null): string | null {
  const m = desc?.match(/^\[([^\]]+)\]/);
  return m ? m[1].trim() : null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface TaxBreakdown {
  base: number;   // ฐานก่อน VAT (= ค่าใช้จ่ายจริงที่รับรู้)
  vat: number;    // ภาษีซื้อ 7%
  wht: number;    // ภาษีหัก ณ ที่จ่าย
  net: number;    // ยอดจ่ายสุทธิ (amount - wht)
  gross: number;  // ยอดรวม VAT (= amount ที่กรอก)
}

export interface ContractorPayBreakdown {
  gross: number;      // มูลค่างานงวด (ก่อนหัก)
  wht: number;        // ภาษีหัก ณ ที่จ่าย
  retention: number;  // เงินประกันผลงานที่หักไว้
  net: number;        // ยอดจ่ายสุทธิ
}

/** คำนวณยอดจ่ายผู้รับเหมา: หัก WHT + เงินประกันผลงาน จากมูลค่างานงวด */
export function calcContractorPay(amount: number, whtRate: number, retentionRate: number): ContractorPayBreakdown {
  const gross = r2(amount);
  const wht = whtRate > 0 ? r2((gross * whtRate) / 100) : 0;
  const retention = retentionRate > 0 ? r2((gross * retentionRate) / 100) : 0;
  const net = r2(gross - wht - retention);
  return { gross, wht, retention, net };
}

/** คำนวณภาษีจากยอดที่กรอก (vatIncluded = ยอดนั้นรวม VAT 7% แล้ว) */
export function calcTax(amount: number, vatIncluded: boolean, whtRate: number): TaxBreakdown {
  const gross = r2(amount);
  const vat = vatIncluded ? r2((gross * 7) / 107) : 0;
  const base = r2(gross - vat);                 // base + vat = gross เป๊ะ
  const wht = whtRate > 0 ? r2((base * whtRate) / 100) : 0;
  const net = r2(gross - wht);
  return { base, vat, wht, net, gross };
}
