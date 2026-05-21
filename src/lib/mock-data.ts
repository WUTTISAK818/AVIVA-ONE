export const dashboardKPIs = {
  totalUnits: 120,
  soldUnits: 73,
  available: 47,
  revenue: 285_000_000,
  revenueTarget: 400_000_000,
  constructionProgress: 68,
  selloutForecast: "Q3 2026",
  cashflow: 42_500_000,
  cashflowChange: +12.4,
  revenueChange: +8.7,
  soldChange: +5,
};

export const revenueData = [
  { month: "ม.ค.", revenue: 18, target: 33 },
  { month: "ก.พ.", revenue: 24, target: 33 },
  { month: "มี.ค.", revenue: 31, target: 33 },
  { month: "เม.ย.", revenue: 28.5, target: 33 },
  { month: "พ.ค.", revenue: 35, target: 33 },
  { month: "มิ.ย.", revenue: 42, target: 33 },
  { month: "ก.ค.", revenue: 38, target: 33 },
  { month: "ส.ค.", revenue: 47, target: 33 },
  { month: "ก.ย.", revenue: 22, target: 33 },
];

export type LeadStatus =
  | "New Lead"
  | "Contacted"
  | "Site Visit"
  | "Booking"
  | "Loan Process"
  | "Transfer"
  | "Closed Deal";

export const leads: {
  id: number;
  name: string;
  status: LeadStatus;
  score: number;
  source: string;
  phone: string;
  date: string;
  budget: number;
}[] = [
  { id: 1, name: "คุณสมชาย ใจดี", status: "Booking", score: 92, source: "Facebook", phone: "081-234-5678", date: "2026-05-15", budget: 8_500_000 },
  { id: 2, name: "คุณสุภาพ รักดี", status: "Site Visit", score: 78, source: "TikTok", phone: "082-345-6789", date: "2026-05-16", budget: 12_000_000 },
  { id: 3, name: "คุณวิภา มั่งมี", status: "Loan Process", score: 85, source: "Google", phone: "083-456-7890", date: "2026-05-14", budget: 9_200_000 },
  { id: 4, name: "คุณประสิทธิ์ ดีงาม", status: "New Lead", score: 45, source: "Facebook", phone: "084-567-8901", date: "2026-05-18", budget: 7_000_000 },
  { id: 5, name: "คุณจิราภา สุขใจ", status: "Contacted", score: 61, source: "Referral", phone: "085-678-9012", date: "2026-05-17", budget: 15_000_000 },
  { id: 6, name: "คุณธนากร รวยดี", status: "Transfer", score: 96, source: "Facebook", phone: "086-789-0123", date: "2026-05-10", budget: 11_500_000 },
  { id: 7, name: "คุณนภา ฟ้าใส", status: "New Lead", score: 38, source: "TikTok", phone: "087-890-1234", date: "2026-05-19", budget: 6_500_000 },
  { id: 8, name: "คุณกิตติ์ พัฒนา", status: "Closed Deal", score: 98, source: "Google", phone: "088-901-2345", date: "2026-05-01", budget: 13_000_000 },
  { id: 9, name: "คุณเพชร วิไล", status: "Site Visit", score: 72, source: "Facebook", phone: "089-012-3456", date: "2026-05-16", budget: 8_000_000 },
  { id: 10, name: "คุณรัตนา งามดี", status: "Booking", score: 88, source: "Referral", phone: "090-123-4567", date: "2026-05-13", budget: 10_000_000 },
  { id: 11, name: "คุณชัยวัฒน์ สว่าง", status: "Contacted", score: 55, source: "TikTok", phone: "091-234-5678", date: "2026-05-17", budget: 7_500_000 },
  { id: 12, name: "คุณมาลี บุญมา", status: "Loan Process", score: 81, source: "Facebook", phone: "092-345-6789", date: "2026-05-12", budget: 9_800_000 },
];

export const pipelineStages: LeadStatus[] = [
  "New Lead", "Contacted", "Site Visit", "Booking", "Loan Process", "Transfer", "Closed Deal",
];

export type HouseStatus = "complete" | "on-track" | "delayed";

export const houseProgress: {
  unit: string;
  progress: number;
  status: HouseStatus;
  contractor: string;
  phase: string;
  delay?: number;
}[] = [
  { unit: "A-101", progress: 100, status: "complete", contractor: "บ. สร้างดี จำกัด", phase: "พร้อมโอน" },
  { unit: "A-102", progress: 85, status: "on-track", contractor: "บ. สร้างดี จำกัด", phase: "ตกแต่งภายใน" },
  { unit: "A-103", progress: 45, status: "delayed", contractor: "บ. สร้างดี จำกัด", phase: "โครงสร้าง", delay: 7 },
  { unit: "A-104", progress: 100, status: "complete", contractor: "บ. พัฒนาดี จำกัด", phase: "พร้อมโอน" },
  { unit: "A-105", progress: 72, status: "on-track", contractor: "บ. พัฒนาดี จำกัด", phase: "งานระบบ" },
  { unit: "B-101", progress: 30, status: "delayed", contractor: "บ. ก่อสร้างไทย จำกัด", phase: "ฐานราก", delay: 14 },
  { unit: "B-102", progress: 65, status: "on-track", contractor: "บ. ก่อสร้างไทย จำกัด", phase: "งานก่ออิฐ" },
  { unit: "B-103", progress: 100, status: "complete", contractor: "บ. ก่อสร้างไทย จำกัด", phase: "พร้อมโอน" },
  { unit: "B-104", progress: 90, status: "on-track", contractor: "บ. สร้างดี จำกัด", phase: "งานทาสี" },
  { unit: "B-105", progress: 55, status: "delayed", contractor: "บ. พัฒนาดี จำกัด", phase: "โครงสร้าง", delay: 5 },
  { unit: "C-101", progress: 100, status: "complete", contractor: "บ. สร้างดี จำกัด", phase: "พร้อมโอน" },
  { unit: "C-102", progress: 78, status: "on-track", contractor: "บ. สร้างดี จำกัด", phase: "ตกแต่งภายใน" },
];

export const financeSummary = {
  totalIncome: 285_000_000,
  totalExpenses: 192_000_000,
  netCashflow: 93_000_000,
  pendingPayments: 18_200_000,
  budgetUtilization: 72,
  contractorBudget: 120_000_000,
  contractorUsed: 86_400_000,
  marketingBudget: 8_000_000,
  marketingUsed: 5_600_000,
  adminBudget: 15_000_000,
  adminUsed: 9_200_000,
};

export const cashflowData = [
  { month: "ม.ค.", income: 18, expenses: 12 },
  { month: "ก.พ.", income: 24, expenses: 15 },
  { month: "มี.ค.", income: 31, expenses: 18 },
  { month: "เม.ย.", income: 28.5, expenses: 21 },
  { month: "พ.ค.", income: 35, expenses: 19 },
  { month: "มิ.ย.", income: 42, expenses: 24 },
  { month: "ก.ค.", income: 38, expenses: 22 },
  { month: "ส.ค.", income: 47, expenses: 26 },
  { month: "ก.ย.", income: 22, expenses: 15 },
];

export const transactions = [
  { id: 1, desc: "ค่าก่อสร้าง A-102", amount: -2_400_000, type: "expense", date: "2026-05-18" },
  { id: 2, desc: "รับชำระค่าจอง B-104", amount: 500_000, type: "income", date: "2026-05-17" },
  { id: 3, desc: "ค่าการตลาด Facebook Q2", amount: -320_000, type: "expense", date: "2026-05-16" },
  { id: 4, desc: "รับเงินดาวน์ A-105", amount: 1_200_000, type: "income", date: "2026-05-15" },
  { id: 5, desc: "ค่าแรงผู้รับเหมา บ. สร้างดี", amount: -850_000, type: "expense", date: "2026-05-14" },
];

export const aiInsights: {
  id: number;
  type: "warning" | "success" | "alert" | "info";
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
}[] = [
  { id: 1, type: "warning", priority: "high", title: "ความเสี่ยง Cashflow", message: "คาดการณ์ว่า cashflow อาจติดลบในเดือนตุลาคม จากค่าก่อสร้างที่เพิ่มขึ้น 23% แนะนำให้เร่งปิดการขาย 8 ยูนิตที่อยู่ในขั้น Loan Process" },
  { id: 2, type: "success", priority: "medium", title: "แคมเปญ Facebook ROI สูง", message: "แคมเปญ 'AVIVA Luxury May' มี ROI 340% สูงกว่าค่าเฉลี่ย 2.1x แนะนำเพิ่มงบ 20% ในสัปดาห์หน้า" },
  { id: 3, type: "alert", priority: "high", title: "ยูนิตล่าช้า 3 หน่วย", message: "B-101, A-103, B-105 ล่าช้ากว่าแผน ควรส่ง Engineer ตรวจสอบด่วน เพื่อไม่ให้กระทบวันโอนกรรมสิทธิ์" },
  { id: 4, type: "info", priority: "low", title: "Sales Conversion ดีขึ้น", message: "อัตราแปลงจาก Site Visit → Booking เพิ่มขึ้นเป็น 42% (จาก 31% เดือนก่อน) ทีม Sales ทำงานได้ยอดเยี่ยม" },
];

export const aiChatHistory = [
  {
    role: "assistant" as const,
    message: "สวัสดีครับ ผมคือ AVIVA AI Executive Assistant พร้อมช่วยวิเคราะห์ข้อมูลโครงการให้คุณตลอดเวลาครับ",
  },
];

export const suggestedQuestions = [
  "แคมเปญไหน ROI สูงสุด?",
  "ยูนิตไหนล่าช้าบ้าง?",
  "Cashflow เดือนหน้าเป็นอย่างไร?",
  "พนักงานขายคนไหน Conversion ดีที่สุด?",
  "คาดว่าโครงการจะขายหมดเมื่อไหร่?",
];

export const mockAIResponses: Record<string, string> = {
  "แคมเปญไหน ROI สูงสุด?": "จากข้อมูลล่าสุด แคมเปญ 'AVIVA Luxury May' บน Facebook มี ROI สูงสุดที่ 340% ตามด้วย Google Search 'luxury house bangkok' ที่ 280% และ TikTok 'AVIVA Home Tour' ที่ 215% แนะนำเพิ่มงบ Facebook เพิ่มอีก 20% ครับ",
  "ยูนิตไหนล่าช้าบ้าง?": "มี 3 ยูนิตที่ล่าช้ากว่าแผน ได้แก่ B-101 (ล่าช้า 14 วัน อยู่ในขั้นฐานราก), A-103 (ล่าช้า 7 วัน อยู่ในขั้นโครงสร้าง), B-105 (ล่าช้า 5 วัน อยู่ในขั้นโครงสร้าง) ควรส่ง Engineer เข้าตรวจสอบทันทีครับ",
  "Cashflow เดือนหน้าเป็นอย่างไร?": "คาดการณ์ Cashflow เดือนมิถุนายน: รายรับ 38-45 ล้านบาท รายจ่าย 22-28 ล้านบาท Net Cashflow +15-22 ล้านบาท อย่างไรก็ดี มีความเสี่ยงจากค่าก่อสร้างที่อาจบวมเพิ่ม 15% หากยูนิตที่ล่าช้าต้องใช้ทรัพยากรเพิ่มเติมครับ",
  "พนักงานขายคนไหน Conversion ดีที่สุด?": "จากข้อมูล CRM คุณธนพล มี Conversion Rate สูงสุด 68% (จาก Site Visit → Booking) ตามด้วยคุณสิริพร 55% และคุณวรวุฒิ 48% คุณธนพลมีจุดเด่นด้านการ Follow-up ภายใน 24 ชั่วโมงหลัง Site Visit ครับ",
  "คาดว่าโครงการจะขายหมดเมื่อไหร่?": "จากอัตราการขาย 8-10 ยูนิตต่อเดือน และ pipeline ที่แข็งแกร่ง (42 lead ใน Booking/Loan Process) คาดว่าโครงการจะขายหมด 100% ภายใน Q3 2026 (ประมาณเดือนสิงหาคม-กันยายน) ก่อนเป้าหมายเดิม 3 เดือนครับ",
};
