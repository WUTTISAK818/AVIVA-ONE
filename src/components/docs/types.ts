// ข้อมูลที่ใช้ร่วมกันในเอกสารทั้ง 3 แบบ
export interface DocData {
  // ── ข้อมูลเอกสาร ──
  docDate: string; // ISO วันที่ออกเอกสาร / วันจอง
  contractNo: string; // เลขที่สัญญา
  contractDate: string; // ISO วันทำสัญญา
  transferDate: string; // ISO กำหนดโอนกรรมสิทธิ์

  // ── ผู้จอง / ผู้จะซื้อ ──
  customerName: string;
  customerAge: string;
  customerIdCard: string;
  customerAddress: string;
  customerPhone: string;

  // ── แปลง / สิ่งปลูกสร้าง ──
  plot: string; // เช่น A5
  model: string; // AVA / VIVA
  houseType: string; // บ้านเดี่ยว 2 ชั้น
  landSize: number; // ตร.วา
  usableArea: number; // ตร.ม.
  titleDeed: string; // โฉนดเลขที่

  // ── ราคา / การชำระเงิน ──
  price: number; // ราคารวมทั้งสิ้น
  specialDiscount: number; // ส่วนลดพิเศษ
  bookingFee: number; // เงินจอง
  contractFee: number; // เงินทำสัญญา
  downInstallments: number; // จำนวนงวดผ่อนดาวน์
  downPerInstallment: number; // งวดละ
  downTotal: number; // รวมเงินดาวน์
  remaining: number; // ส่วนที่เหลือ ณ วันโอน

  // ── การชำระเงินจอง ──
  paymentMethod: "cash" | "transfer" | "credit" | "";
  bankName: string;
  bankBranch: string;
}

export const emptyDocData: DocData = {
  docDate: "",
  contractNo: "",
  contractDate: "",
  transferDate: "",
  customerName: "",
  customerAge: "",
  customerIdCard: "",
  customerAddress: "",
  customerPhone: "",
  plot: "",
  model: "",
  houseType: "บ้านเดี่ยว 2 ชั้น",
  landSize: 0,
  usableArea: 0,
  titleDeed: "",
  price: 0,
  specialDiscount: 0,
  bookingFee: 10000,
  contractFee: 50000,
  downInstallments: 0,
  downPerInstallment: 0,
  downTotal: 0,
  remaining: 0,
  paymentMethod: "",
  bankName: "",
  bankBranch: "",
};
