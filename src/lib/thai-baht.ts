// แปลงจำนวนเงินเป็นข้อความภาษาไทย (เช่น 5290000 → "ห้าล้านสองแสนเก้าหมื่นบาทถ้วน")
// ใช้ในเอกสารใบเสนอราคา / ใบจอง / สัญญา

const TH_DIGIT = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const TH_POS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readChunk(n: string): string {
  // อ่านเลขจำนวนเต็มยาวไม่เกิน 6 หลัก
  n = n.replace(/^0+/, "");
  if (n === "") return "";
  const len = n.length;
  let out = "";
  for (let i = 0; i < len; i++) {
    const d = parseInt(n[i], 10);
    const pos = len - 1 - i; // ตำแหน่งหลัก (0=หน่วย)
    if (d === 0) continue;
    if (pos === 0) {
      out += d === 1 && len > 1 ? "เอ็ด" : TH_DIGIT[d];
    } else if (pos === 1) {
      out += d === 1 ? "" : d === 2 ? "ยี่" : TH_DIGIT[d];
      out += "สิบ";
    } else {
      out += TH_DIGIT[d] + TH_POS[pos];
    }
  }
  return out;
}

function readInteger(numStr: string): string {
  numStr = numStr.replace(/^0+/, "");
  if (numStr === "") return "";
  if (numStr.length > 6) {
    const head = numStr.slice(0, numStr.length - 6);
    const tail = numStr.slice(numStr.length - 6);
    return readInteger(head) + "ล้าน" + readChunk(tail);
  }
  return readChunk(numStr);
}

/** แปลงจำนวนเงิน (บาท) เป็นข้อความไทย ลงท้าย "บาทถ้วน" หรือ "...สตางค์" */
export function bahtText(amount: number | null | undefined): string {
  if (amount == null || isNaN(Number(amount))) return "";
  const amt = Math.round(Number(amount) * 100) / 100;
  const negative = amt < 0;
  const [bahtStr, satangStr] = Math.abs(amt).toFixed(2).split(".");
  let result = "";
  const bahtWords = readInteger(bahtStr);
  const satang = parseInt(satangStr, 10);

  if (bahtWords) result += bahtWords + "บาท";
  if (satang === 0) {
    result += bahtWords ? "ถ้วน" : "ศูนย์บาทถ้วน";
  } else {
    if (!bahtWords) result += "";
    result += readChunk(satangStr) + "สตางค์";
  }
  return (negative ? "ลบ" : "") + result;
}

/** จัดรูปแบบตัวเลขมีคอมมา เช่น 5290000 → "5,290,000" */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "";
  return Number(n).toLocaleString("th-TH");
}
