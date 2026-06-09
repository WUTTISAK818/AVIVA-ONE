// นิยาม "ผู้เชี่ยวชาญ AI ประจำฝ่าย" — persona เริ่มต้น + ชนิดข้อมูลที่ใช้ร่วมกัน
// ทั้งฝั่ง API (สร้างบรีฟ) และ settings (ตั้งค่า)

export const DEFAULT_MODEL = "claude-opus-4-8";

export interface DeptExpert {
  dept: string;
  expert_name: string;
  focus: string;
  persona: string;
  model: string;
  is_active: boolean;
}

// persona เริ่มต้นต่อฝ่าย — ใช้เมื่อยังไม่ตั้งค่าใน settings (ตาราง ai_experts)
export const DEFAULT_EXPERTS: Record<string, DeptExpert> = {
  sales: {
    dept: "sales",
    expert_name: "คุณขายดี",
    focus: "ปิดการขาย · ดูแล lead pipeline · เลือกลูกค้าที่ควรตามต่อ",
    persona:
      "ผู้เชี่ยวชาญการขายอสังหาฯ มองหาลูกค้าที่ 'ร้อน' และใกล้ปิด ชี้ lead ที่เริ่มเย็นและต้องรีบตาม วางลำดับความสำคัญการติดตามให้เซลส์ทำงานได้ทันที",
    model: DEFAULT_MODEL,
    is_active: true,
  },
  construction: {
    dept: "construction",
    expert_name: "วิศวกรเอก",
    focus: "ความคืบหน้าก่อสร้าง · ยูนิตล่าช้า · งวดงานรอตรวจ",
    persona:
      "ผู้จัดการโครงการก่อสร้าง โฟกัสยูนิตที่ล่าช้าและความเสี่ยงต่อแผนส่งมอบ เร่งงวดงานที่ค้างตรวจ และจัดลำดับงานหน้างานรายสัปดาห์",
    model: DEFAULT_MODEL,
    is_active: true,
  },
  finance: {
    dept: "finance",
    expert_name: "เหรัญญิกอาวุโส",
    focus: "กระแสเงินสด · รายการรออนุมัติ · เบิกจ่ายก่อสร้าง",
    persona:
      "ผู้เชี่ยวชาญการเงิน เฝ้าระวังกระแสเงินสดและรายการที่ต้องอนุมัติด่วน ชี้ความเสี่ยงรายจ่ายผิดปกติ และวางแผนเบิกจ่ายให้สมดุล",
    model: DEFAULT_MODEL,
    is_active: true,
  },
  accounting: {
    dept: "accounting",
    expert_name: "สมุห์บัญชี",
    focus: "ลูกหนี้/เจ้าหนี้ค้าง · ภาษีถึงกำหนด · JV รอ post · TFRS15",
    persona:
      "ผู้เชี่ยวชาญบัญชีและภาษีไทย ติดตามลูกหนี้เกินกำหนด เจ้าหนี้ใกล้ครบ ภาษี (VAT/WHT/ภ.ธ.40/ภาษีที่ดิน) ที่ถึงกำหนด และรายการ JV ที่ค้างบันทึก",
    model: DEFAULT_MODEL,
    is_active: true,
  },
  marketing: {
    dept: "marketing",
    expert_name: "นักการตลาดดิจิทัล",
    focus: "ROI แคมเปญ · ต้นทุนต่อ lead · ช่องทางที่ได้ผล",
    persona:
      "ผู้เชี่ยวชาญการตลาดอสังหาฯ วิเคราะห์ ROI และต้นทุนต่อ lead ของแต่ละแคมเปญ แนะนำการจัดสรรงบและคอนเทนต์รายสัปดาห์",
    model: DEFAULT_MODEL,
    is_active: true,
  },
  hr: {
    dept: "hr",
    expert_name: "ผู้จัดการบุคคล",
    focus: "กำลังคน · โควต้าวันลา · เงินเดือน",
    persona:
      "ผู้เชี่ยวชาญทรัพยากรบุคคล ดูแลกำลังคนแต่ละแผนก โควต้าวันลา และรายการที่ต้องดำเนินการด้านบุคคล",
    model: DEFAULT_MODEL,
    is_active: true,
  },
  "after-sales": {
    dept: "after-sales",
    expert_name: "หัวหน้าหลังการขาย",
    focus: "แจ้งซ่อมค้าง · SLA · ความพึงพอใจลูกค้า",
    persona:
      "ผู้เชี่ยวชาญบริการหลังการขาย ติดตามงานแจ้งซ่อมที่ค้างและเกิน SLA จัดลำดับการมอบหมายช่าง และดูแลความพึงพอใจลูกค้า",
    model: DEFAULT_MODEL,
    is_active: true,
  },
};

export const EXPERT_DEPTS = Object.keys(DEFAULT_EXPERTS);

export const DEPT_LABEL: Record<string, string> = {
  sales: "ฝ่ายขาย",
  construction: "ฝ่ายก่อสร้าง",
  finance: "ฝ่ายการเงิน",
  accounting: "ฝ่ายบัญชี",
  marketing: "ฝ่ายการตลาด",
  hr: "ฝ่ายบุคคล",
  "after-sales": "ฝ่ายหลังการขาย",
};

// โครงสร้างผลลัพธ์บรีฟที่ AI ต้องคืน (ใช้ทั้ง prompt และ render)
export interface BriefHighlight {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  action: string;
}
export interface BriefPlanItem {
  label: string; // วัน/สัปดาห์/ธีม
  task: string;
  why: string;
}
export interface DeptBriefing {
  title: string;
  summary: string;
  highlights: BriefHighlight[];
  weekly_plan: BriefPlanItem[];
  monthly_plan: BriefPlanItem[];
}

// ── สภา AI / Executive (Phase 2) ─────────────────────────────────────────────
export interface CrossIssue {
  title: string;
  detail: string;
  depts: string[];
  priority: "high" | "medium" | "low";
  recommendation: string;
}
export interface ExecDecision {
  question: string;
  recommended: string;
  impact: string;
}
export interface CouncilBriefing {
  title: string;
  summary: string;
  cross_issues: CrossIssue[];
  decisions: ExecDecision[];
  weekly_plan: BriefPlanItem[];
  monthly_plan: BriefPlanItem[];
}
