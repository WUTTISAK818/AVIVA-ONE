// src/lib/payment-plan.ts
// แผนการชำระเงินมาตรฐาน — single source of truth
// ใช้ร่วมกันทั้ง "เอกสารพิมพ์" (ใบจอง / สัญญา) และ "ตารางผ่อนชำระลูกค้า" (customer_installments)
// เพื่อกันปัญหา % ไม่ตรงกัน (เดิมใบจอง 1% / สัญญา 5% แต่ตารางผ่อนใช้ 2% / 8%)
// อ้างอิงเอกสารจริง: เงินจอง 1% · ทำสัญญา 5% · ระหว่างก่อสร้าง 10% · โอนกรรมสิทธิ์ (ส่วนที่เหลือ)
export const PAYMENT_PLAN = {
  booking: 0.01,
  contract: 0.05,
  construction: 0.1,
  transfer: 0.84,
} as const;

export interface InstallmentRow {
  installment_no: number;
  name: string;
  amount: number;
  due_date: null;
}

/**
 * สร้างตารางงวดผ่อนชำระมาตรฐานจากราคาขาย (รวมเท่ากับราคาขายเป๊ะ)
 * งวดจอง/ทำสัญญาตรงกับ % ที่ใช้ในเอกสารพิมพ์ ส่วนงวดโอน = ส่วนที่เหลือ (ดูดเศษปัด)
 */
export function defaultInstallments(price: number): InstallmentRow[] {
  const p = Number(price) || 0;
  const booking = Math.round(p * PAYMENT_PLAN.booking);
  const contract = Math.round(p * PAYMENT_PLAN.contract);
  const construction = Math.round(p * PAYMENT_PLAN.construction);
  const transfer = p - booking - contract - construction; // ส่วนที่เหลือ → ยอดรวมตรงราคาขาย
  return [
    { installment_no: 1, name: "งวดจอง", amount: booking, due_date: null },
    { installment_no: 2, name: "งวดทำสัญญา", amount: contract, due_date: null },
    { installment_no: 3, name: "งวดระหว่างก่อสร้าง", amount: construction, due_date: null },
    { installment_no: 4, name: "งวดโอนกรรมสิทธิ์", amount: transfer, due_date: null },
  ];
}
