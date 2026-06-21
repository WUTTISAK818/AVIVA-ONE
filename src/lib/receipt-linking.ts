// ระบบจัดหมวดหมู่รายได้ (GL Account Linking) + ตรวจสอบ flag ผิดปกติ
// ดึง vendor name + items from OCR → map ไป GL account code + project + contractor

export interface ExtractedReceipt {
  date: string; // YYYY-MM-DD
  vendor_name: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
  subtotal: number;
  vat: number;
  total: number;
  payment_method: "cash" | "card" | "bank";
  vendor_tax_id?: string;
}

export interface GLLinkResult {
  category: string;
  gl_account: string;
  account_name: string;
  linked_project?: string;
  linked_contractor?: string;
  confidence: number; // 0-100
  flags: Array<{
    severity: "low" | "medium" | "high";
    message: string;
  }>;
}

// GL Account Master Chart
const GL_ACCOUNTS = {
  "5201": { name: "เชื้อเพลิง (Fuel)", category: "Transportation" },
  "5202": { name: "อาหารและเครื่องดื่ม (Meals & Entertainment)", category: "Hospitality" },
  "5203": { name: "เครื่องเขียนสำนักงาน (Office Supplies)", category: "Supplies" },
  "5204": { name: "ค่าซ่อมแซม (Maintenance)", category: "Maintenance" },
  "5301": { name: "ค่าสาธารณูปโภค (Utilities)", category: "Utilities" },
  "5401": { name: "ค่าโฆษณา (Advertising)", category: "Marketing" },
  "5402": { name: "ค่าประกอบการ (Professional Services)", category: "Services" },
  "6001": { name: "วัสดุก่อสร้าง (Construction Materials)", category: "Construction" },
  "6100": { name: "ค่าจ้างเหมา (Contractor Payment)", category: "Construction" },
  "6200": { name: "ค่าแรงงาน (Labor)", category: "Construction" },
} as const;

// Keyword mapping สำหรับ vendor → GL account
const VENDOR_PATTERNS: Array<{
  regex: RegExp;
  glAccount: keyof typeof GL_ACCOUNTS;
  category: string;
}> = [
  // Fuel
  {
    regex: /ปตท|เบนซิน|ดีเซล|สถานีน้ำมัน|shell|caltex|fuel|petrol|gas station/i,
    glAccount: "5201",
    category: "Transportation",
  },
  // Meals & Entertainment
  {
    regex: /ร้านอาหาร|โรงแรม|cafe|ร้านกาแฟ|ร้านชา|restaurant|hotel|cafe|coffee|meal/i,
    glAccount: "5202",
    category: "Hospitality",
  },
  // Office Supplies
  {
    regex: /เอกสาร|กระดาษ|ปากกา|ชุมพวก|office|supplies|stationery|paper|pen/i,
    glAccount: "5203",
    category: "Supplies",
  },
  // Maintenance & Repairs
  {
    regex: /ซ่อม|บำรุง|ซ่อมแซม|maintenance|repair|service|spare parts/i,
    glAccount: "5204",
    category: "Maintenance",
  },
  // Utilities
  {
    regex: /ไฟฟ้า|ประปา|น้ำประปา|แก๊ส|กระแสไฟ|utilities|electricity|water|gas/i,
    glAccount: "5301",
    category: "Utilities",
  },
  // Marketing/Advertising
  {
    regex: /โฆษณา|ประชาสัมพันธ์|สื่อ|advertising|marketing|pr|promotional/i,
    glAccount: "5401",
    category: "Marketing",
  },
  // Professional Services
  {
    regex: /ทนาย|บัญชี|สอบบัญชี|ปรึกษา|auditor|lawyer|consultant|legal|accounting/i,
    glAccount: "5402",
    category: "Services",
  },
  // Construction Materials
  {
    regex: /วัสดุก่อสร้าง|ปูน|ทราย|อิฐ|เหล็ก|ไม้|cement|sand|brick|steel|lumber/i,
    glAccount: "6001",
    category: "Construction",
  },
  // Contractor Payment
  {
    regex: /เหมา|ผู้รับจ้าง|ก่อสร้าง|ทำสัญญา|contractor|subcontractor|construction|company/i,
    glAccount: "6100",
    category: "Construction",
  },
  // Labor
  {
    regex: /แรงงาน|คนงาน|ค่าแรง|labor|worker|wages|salary/i,
    glAccount: "6200",
    category: "Construction",
  },
];

// Detect anomalies in receipt data
function detectFlags(receipt: ExtractedReceipt): Array<{ severity: "low" | "medium" | "high"; message: string }> {
  const flags: Array<{ severity: "low" | "medium" | "high"; message: string }> = [];

  // Check amount anomalies
  if (receipt.total > 1_000_000) {
    flags.push({
      severity: "high",
      message: `ยอดรวมสูงมาก (${receipt.total.toLocaleString()} บาท) — ตรวจสอบก่อนอนุมัติ`,
    });
  }

  if (receipt.total < 50) {
    flags.push({
      severity: "low",
      message: "ยอดรวมน้อย — อาจไม่ต้องบันทึก",
    });
  }

  // Check VAT accuracy
  const calcVat = receipt.subtotal * 0.07; // 7% VAT
  if (Math.abs(receipt.vat - calcVat) > 1) {
    flags.push({
      severity: "medium",
      message: `ภาษีมูลค่าเพิ่มไม่ตรง (คำนวณ: ${calcVat.toFixed(2)}, ใบเสร็จ: ${receipt.vat.toFixed(2)})`,
    });
  }

  // Check if total matches subtotal + VAT
  const calcTotal = receipt.subtotal + receipt.vat;
  if (Math.abs(receipt.total - calcTotal) > 1) {
    flags.push({
      severity: "medium",
      message: `ยอดรวมไม่ตรง (คำนวณ: ${calcTotal.toFixed(2)}, ใบเสร็จ: ${receipt.total.toFixed(2)})`,
    });
  }

  // Check for missing vendor info
  if (!receipt.vendor_tax_id || receipt.vendor_tax_id.trim() === "") {
    flags.push({
      severity: "low",
      message: "ไม่มีหมายเลขประจำตัวผู้เสียภาษี — ตรวจสอบใบเสร็จ",
    });
  }

  // Check for missing items detail
  if (!receipt.items || receipt.items.length === 0) {
    flags.push({
      severity: "medium",
      message: "ไม่มีรายละเอียดสินค้า/บริการ — อาจเป็นใบสำคัญ",
    });
  }

  // Check future date
  const today = new Date();
  const receiptDate = new Date(receipt.date);
  if (receiptDate > today) {
    flags.push({
      severity: "high",
      message: `วันที่ในอนาคต (${receipt.date}) — ตรวจสอบวันที่`,
    });
  }

  // Check very old date
  const daysDiff = Math.floor((today.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 90) {
    flags.push({
      severity: "low",
      message: `ใบเสร็จเก่า (${daysDiff} วันที่แล้ว) — อาจหมดอายุการอนุมัติ`,
    });
  }

  return flags;
}

// Main function: Suggest GL account based on receipt data
export async function suggestGLAccount(receipt: ExtractedReceipt): Promise<GLLinkResult> {
  let bestMatch: {
    glAccount: keyof typeof GL_ACCOUNTS;
    confidence: number;
    category: string;
  } | null = null;

  // Try to match vendor name
  const vendorName = receipt.vendor_name.toLowerCase().trim();
  for (const pattern of VENDOR_PATTERNS) {
    if (pattern.regex.test(vendorName)) {
      bestMatch = {
        glAccount: pattern.glAccount,
        confidence: 95,
        category: pattern.category,
      };
      break;
    }
  }

  // If no vendor match, try item descriptions
  if (!bestMatch && receipt.items && receipt.items.length > 0) {
    const itemDesc = receipt.items.map((i) => i.description.toLowerCase()).join(" ");
    for (const pattern of VENDOR_PATTERNS) {
      if (pattern.regex.test(itemDesc)) {
        bestMatch = {
          glAccount: pattern.glAccount,
          confidence: 80,
          category: pattern.category,
        };
        break;
      }
    }
  }

  // Default: General expense
  if (!bestMatch) {
    bestMatch = {
      glAccount: "5203",
      confidence: 50,
      category: "Supplies",
    };
  }

  const accountInfo = GL_ACCOUNTS[bestMatch.glAccount];
  const flags = detectFlags(receipt);

  return {
    category: bestMatch.category,
    gl_account: bestMatch.glAccount,
    account_name: accountInfo.name,
    confidence: bestMatch.confidence,
    flags,
  };
}

// Detect if this is construction-related (for project linking)
export function isConstructionRelated(receipt: ExtractedReceipt): boolean {
  const text = `${receipt.vendor_name} ${receipt.items.map((i) => i.description).join(" ")}`.toLowerCase();
  return /ก่อสร้าง|วัสดุ|คอนกรีต|ปูน|ทราย|เหล็ก|ไม้|construction|material|concrete/i.test(text);
}

// Detect if linked to specific contractor
export function detectContractor(vendor_name: string): string | null {
  // This would connect to database lookup in real implementation
  // For now, just pass through vendor name
  return vendor_name;
}
