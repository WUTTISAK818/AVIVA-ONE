// ข้อมูลกลางสำหรับเอกสาร: ใบเสนอราคา / ใบจอง / สัญญาจะซื้อจะขาย
// โครงการ AVIVA Private — บริษัท อลิสา พร็อพเพอร์ตี้ ดีเวลลอปเม้นท์ จำกัด
// ที่มา: ตัวอย่างเอกสารจริง + ตารางราคา (ราคา ณ พ.ย. 2568)

export const COMPANY = {
  name: "บริษัท อลิสา พร็อพเพอร์ตี้ ดีเวลลอปเม้นท์ จำกัด",
  nameEn: "Alisa Property Development Co., Ltd.",
  regAddress: "เลขที่ 93 ตรอกสวายเรียง ตำบลในเมือง อำเภอเมือง จังหวัดนครราชสีมา 30000",
  director: "นางนิศารัตน์ ภาวะศิลป์",
  receiverName: "นางสาวยารัศศกร คำดีบุญ", // ผู้รับจองตัวอย่าง
} as const;

export const PROJECT = {
  name: "อาวีว่า ไพรเวต",
  nameEn: "AVIVA Private",
  address: "เลขที่ 1188 โนนไม้แดง ซอย 11 ตำบลสุรนารี อำเภอเมือง จังหวัดนครราชสีมา",
  tambon: "สุรนารี",
  amphoe: "เมืองนครราชสีมา",
  province: "นครราชสีมา",
  phone: "064-456-2878",
  titleDeedMaster: "332682", // โฉนดแม่บท
} as const;

// ข้อมูลตามแบบบ้าน
export const MODEL_INFO: Record<string, { type: string; usableArea: number; cornerPremium: number }> = {
  AVA: { type: "บ้านเดี่ยว 2 ชั้น", usableArea: 245, cornerPremium: 100000 },
  VIVA: { type: "บ้านเดี่ยว 2 ชั้น", usableArea: 170, cornerPremium: 50000 },
};

// ค่าเริ่มต้นการชำระเงิน
export const PAYMENT_DEFAULTS = {
  bookingFee: 10000, // เงินจอง
  contractFee: 50000, // เงินทำสัญญา
  landAdjustPerWa: 28000, // ที่ดินเพิ่ม-ลด ต่อ ตร.วา
  maintenancePerWa: 30, // ค่าส่วนกลาง บาท/ตร.วา (ล่วงหน้า 2 ปี)
} as const;

export interface PlotInfo {
  plot: string; // รหัสแปลงที่แสดง เช่น "A5"
  plotNo: string; // รหัสแปลงทางการ เช่น "A-5"
  model: "AVA" | "VIVA";
  landSize: number; // ตร.วา
  usableArea: number; // ตร.ม.
  price: number; // ราคาขายตั้งต้น (แก้ไขได้ในเอกสาร)
}

// ตารางแปลง 31 แปลง (ราคาขายสุทธิล่าสุด — เป็นค่าเริ่มต้น แก้ไขได้)
const RAW_PLOTS: Array<[string, "AVA" | "VIVA", number, number]> = [
  ["A1", "AVA", 51.7, 5500000],
  ["A2", "AVA", 54.4, 5150000],
  ["A3", "AVA", 54.5, 5150000],
  ["A4", "AVA", 52.8, 5190000],
  ["A5", "AVA", 53.5, 5170000],
  ["A6", "AVA", 54.6, 5150000],
  ["A7", "AVA", 56.4, 5190000],
  ["A8", "AVA", 52.9, 5160000],
  ["A9", "AVA", 52.9, 5160000],
  ["A10", "AVA", 54.3, 5150000],
  ["A11", "AVA", 53.4, 5120000],
  ["A12", "AVA", 50, 5090000],
  ["A17", "AVA", 90.3, 6150000],
  ["A18", "AVA", 93.6, 6200000],
  ["V13-36", "VIVA", 40.3, 4080000],
  ["V14", "VIVA", 44, 4190000],
  ["V15", "VIVA", 41.4, 4080000],
  ["V16", "VIVA", 39, 4080000],
  ["V19", "VIVA", 66.5, 4880000],
  ["V20", "VIVA", 39.7, 4180000],
  ["V21", "VIVA", 39.7, 4180000],
  ["V22", "VIVA", 39.8, 4180000],
  ["V23", "VIVA", 39.8, 4180000],
  ["V24", "VIVA", 39.8, 4180000],
  ["V25", "VIVA", 39.8, 4180000],
  ["V26", "VIVA", 39.8, 4180000],
  ["V27", "VIVA", 39.8, 4180000],
  ["V28", "VIVA", 39.8, 4180000],
  ["V29", "VIVA", 39.9, 4180000],
  ["V30", "VIVA", 39.9, 3998000],
  ["V31", "VIVA", 54.8, 5600000],
];

export const PLOTS: PlotInfo[] = RAW_PLOTS.map(([plot, model, landSize, price]) => ({
  plot,
  plotNo: plot.includes("-") ? plot : `${plot[0]}-${plot.slice(1)}`,
  model,
  landSize,
  usableArea: MODEL_INFO[model].usableArea,
  price,
}));

export function findPlot(code: string | null | undefined): PlotInfo | undefined {
  if (!code) return undefined;
  const c = String(code).trim().toUpperCase().replace(/\s/g, "");
  return PLOTS.find(
    (p) => p.plot.toUpperCase() === c || p.plotNo.toUpperCase() === c
  );
}

// โปรโมชั่น/ของแถมมาตรฐานโครงการ
export const PROMOTIONS_STANDARD = [
  "ปั๊มน้ำและถังสำรองน้ำตามมาตรฐานโครงการ",
  "จัดสวนตามมาตรฐานโครงการ",
  "รับประกันฉีดปลวก 1 ปี",
  "ฟรีค่าโอนกรรมสิทธิ์",
  "ฟรีค่าส่วนกลาง 1 ปี",
  "ฟรีค่าประกันมิเตอร์ไฟฟ้า-ประปา",
  "หน้าต่าง ประตู Tostem",
  "เคาน์เตอร์ครัว พร้อมเตาและซิงค์",
  "ชุดกรองน้ำใช้",
];

// ของแถมเต็มชุด (ใช้ในหนังสือจอง)
export const GIVEAWAYS_FULL = [
  "ปั๊มน้ำและถังสำรองน้ำตามมาตรฐานโครงการ",
  "จัดสวนตามมาตรฐานโครงการ",
  "รับประกันฉีดปลวก 1 ปี",
  "ฟรีค่าโอนกรรมสิทธิ์",
  "ฟรีค่าส่วนกลาง 1 ปี",
  "ฟรีค่าประกันมิเตอร์ไฟฟ้า-ประปา",
  "ประตู Giesta จาก Tostem",
  "ชุดกรองน้ำใช้",
  "เคาน์เตอร์ครัวพร้อมเตา และซิงค์",
  "เครื่องปรับอากาศ 18,000 BTU จำนวน 1 เครื่อง และ 12,000 BTU จำนวน 2 เครื่อง (ตามมาตรฐานโครงการ)",
];

// เงื่อนไขใบเสนอราคา
export const QUOTATION_TERMS = [
  "ที่ดินเพิ่ม-ลด ตารางวาละ 28,000 บาท",
  "ทำสัญญาภายใน 7 วัน นับจากวันจอง",
  "ค่าบำรุงรักษาส่วนกลาง 30.00 บาท/ตร.วา (ชำระล่วงหน้า 2 ปี)",
  "ค่าธรรมเนียมการโอนกรรมสิทธิ์ ผู้ซื้อและผู้ขายชำระคนละครึ่ง",
  "ผู้จะซื้อเป็นผู้ชำระค่าประกันมิเตอร์ไฟฟ้า/ประปา และค่าติดตั้ง ณ วันโอนกรรมสิทธิ์",
  "ค่าจดจำนอง 1% ของวงเงินกู้ (ในกรณีผู้จะซื้อขอสินเชื่อ) ผู้จะซื้อเป็นผู้ชำระ",
  "ใบเสนอราคานี้ ขอสงวนสิทธิ์ในการเปลี่ยนแปลงโดยมิต้องแจ้งให้ทราบล่วงหน้า",
  "บริษัทขอสงวนสิทธิ์ไม่คืนเงินทุกกรณี ยกเว้นธนาคารไม่อนุมัติสินเชื่อ",
  "การชำระเงินด้วยบัตรเครดิต/เดบิต หากมีการคืนเงินไม่ว่ากรณีใดๆ บริษัทขอสงวนการหักเงินเรียกเก็บไม่เกินอัตรา 2% ของเงินที่ชำระก่อนคืนเงิน",
];

// แปลงเลขเดือนไทย + ปี พ.ศ.
const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** แปลงวันที่ (ISO หรือ Date) เป็นข้อความไทยเต็ม เช่น "29 พฤษภาคม 2569" */
export function thaiDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return `${date.getDate()} ${TH_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

/** วันนี้ในรูปแบบ input[type=date] (yyyy-mm-dd) */
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/** สร้างเลขที่สัญญา เช่น 0569/1 (เดือนปี/ลำดับ) */
export function makeContractNo(seq: number | string, date?: Date): string {
  const d = date ?? new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, "0");
  return `${mm}${yy}/${seq}`;
}
