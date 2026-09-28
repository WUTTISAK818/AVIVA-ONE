// src/lib/payment-plan.ts
// แผนการชำระเงินมาตรฐาน — single source of truth
// ใช้ร่วมกันทั้ง "เอกสารพิมพ์" (ใบจอง / สัญญา) และ "ตารางผ่อนชำระลูกค้า" (customer_installments)
// เพื่อกันปัญหา % ไม่ตรงกัน (เดิมใบจอง 1% / สัญญา 5% แต่ตารางผ่อนใช้ 2% / 8%)
// อ้างอิงเอกสารจริง: ทำสัญญา 5% · ระหว่างก่อสร้าง 10% · โอนกรรมสิทธิ์ (ส่วนที่เหลือ)
// เงินจอง = ยอดคงที่ 10,000 บาท (Pom กำหนด 28 ก.ย. 69) ไม่ใช่ % ของราคาขาย
// ถ้าตกลงกับลูกค้าเป็นยอดอื่น ผู้บันทึกกรอกทับได้ที่ช่อง "ยอดเงินจอง" ในข้อมูลลูกค้า
export const PAYMENT_PLAN = {
  contract: 0.05,
  construction: 0.1,
} as const;

/** ยอดเงินจองตั้งต้น (บาท) — ใช้เมื่อผู้บันทึกยังไม่ได้ระบุยอดจริง */
export const DEFAULT_BOOKING_DEPOSIT = 10_000;

/** ยอดเงินจองที่ใช้จริงของลูกค้ารายนี้ — ค่าที่ผู้บันทึกกรอกไว้ ถ้าไม่มีให้ใช้ค่าตั้งต้น */
export function bookingDepositOf(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BOOKING_DEPOSIT;
}

export interface InstallmentRow {
  installment_no: number;
  name: string;
  amount: number;
  due_date: null;
}

/**
 * สร้างตารางงวดผ่อนชำระมาตรฐานจากราคาขาย (รวมเท่ากับราคาขายเป๊ะ)
 * งวดจอง = ยอดเงินจองที่รับจริง · งวดทำสัญญา/ระหว่างก่อสร้างตาม % ที่ใช้ในเอกสารพิมพ์
 * งวดโอน = ส่วนที่เหลือ (ดูดเศษปัด) เพื่อให้ยอดรวมตรงราคาขายเสมอ
 */
export function defaultInstallments(price: number, depositAmount?: number | null): InstallmentRow[] {
  const p = Number(price) || 0;
  // ยังไม่มีราคาขาย → ตารางเป็น 0 ทั้งหมด (กันงวดโอนติดลบ) · มีราคาแล้วเงินจองต้องไม่เกินราคาขาย
  const booking = p > 0 ? Math.min(bookingDepositOf(depositAmount), p) : 0;
  // ราคาขายต่ำผิดปกติจนเงินจอง+งวดกลางเกินราคา (เช่นกรอกราคาเป็น "หลักล้าน" แทนบาท)
  // → บีบงวดกลางลงตามเงินที่เหลือจริง ไม่ปล่อยให้งวดโอนติดลบ
  const contract = Math.min(Math.round(p * PAYMENT_PLAN.contract), Math.max(0, p - booking));
  const construction = Math.min(Math.round(p * PAYMENT_PLAN.construction), Math.max(0, p - booking - contract));
  const transfer = p - booking - contract - construction; // ส่วนที่เหลือ → ยอดรวมตรงราคาขาย
  return [
    { installment_no: 1, name: "งวดจอง", amount: booking, due_date: null },
    { installment_no: 2, name: "งวดทำสัญญา", amount: contract, due_date: null },
    { installment_no: 3, name: "งวดระหว่างก่อสร้าง", amount: construction, due_date: null },
    { installment_no: 4, name: "งวดโอนกรรมสิทธิ์", amount: transfer, due_date: null },
  ];
}
