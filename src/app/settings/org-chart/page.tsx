"use client";
import { ChevronLeft, Building2, TrendingUp, HardHat, BookOpen, DollarSign, Megaphone, Users, FileText, CheckCircle, Crown } from "lucide-react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";

interface DeptCard {
  icon: typeof Building2;
  title: string;
  color: string;
  bg: string;
  description: string;
  responsibilities: string[];
}

const departments: DeptCard[] = [
  {
    icon: Crown,
    title: "ผู้บริหารสูงสุด",
    color: "text-aviva-gold",
    bg: "bg-aviva-gold/15 border-aviva-gold/40",
    description: "CEO / COO · สิทธิ์สูงสุด (เหนือทุกระดับ)",
    responsibilities: [
      "เข้าถึงข้อมูลได้ทุกส่วน ทำได้ทุกอย่างทุกฝ่าย",
      "อนุมัติทุกประเภทและทุกวงเงิน",
      "กำหนดนโยบายและตัดสินใจเชิงกลยุทธ์",
    ],
  },
  {
    icon: TrendingUp,
    title: "ฝ่ายขาย",
    color: "text-green-400",
    bg: "bg-green-400/10 border-green-400/20",
    description: "Sales · Leads · CRM",
    responsibilities: [
      "ออกใบเสนอราคา (BOOK) และติดตามลูกค้า",
      "บันทึก Leads และจัดการ CRM",
      "ออก Contract และมอบหมายแปลง",
      "บริหารการขายและความสัมพันธ์ลูกค้า",
    ],
  },
  {
    icon: HardHat,
    title: "ฝ่ายก่อสร้าง",
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/20",
    description: "Construction · Projects · Quality",
    responsibilities: [
      "ดำเนินการก่อสร้างและตรวจสอบคุณภาพ",
      "ส่งตรวจงวดงาน (INST) และขออนุมัติ",
      "บันทึก Defect และแนวทางแก้ไข",
      "ยื่น PO สำหรับวัสดุและเครื่องมือ",
    ],
  },
  {
    icon: BookOpen,
    title: "ฝ่ายบัญชี",
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
    description: "Accounting · Documents · Records",
    responsibilities: [
      "บันทึกใบสั่งซื้อ (PO) ใบเสร็จ ใบแจ้งหนี้",
      "จัดหมวดหมู่และเก็บรักษาเอกสาร",
      "สมุดบัญชีรายวันและประมาณการ",
      "ตรวจสอบเอกสารประกอบการทำงาน",
    ],
  },
  {
    icon: DollarSign,
    title: "ฝ่ายการเงิน",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    description: "Finance · Payroll · Cash Flow",
    responsibilities: [
      "วิเคราะห์กระแสเงินสดและงบประมาณ",
      "จัดการเงินเดือนพนักงานและตัดเงิน",
      "ยืนยันการชำระเงินและเบิกจ่าย",
      "รายงานสถานะการเงินและแนวโน้ม",
    ],
  },
  {
    icon: Megaphone,
    title: "ฝ่ายการตลาด",
    color: "text-pink-400",
    bg: "bg-pink-400/10 border-pink-400/20",
    description: "Marketing · Campaigns · Events",
    responsibilities: [
      "วางแผนและดำเนินการ Campaign",
      "จัดกิจกรรมและ Event ประชาสัมพันธ์",
      "ดูแลสื่อออนไลน์ โซเชียลและโฆษณา",
      "รายงานผลการตลาดและ KPI",
    ],
  },
  {
    icon: Users,
    title: "ฝ่าย HR / บุคคล",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10 border-cyan-400/20",
    description: "HR · Attendance · Staffing",
    responsibilities: [
      "บริหารงานบุคคลและสัญญาจ้าง",
      "ลงเวลาเข้า-ออก และติดตามเงินเดือน",
      "อนุมัติการลา (LEAVE) และเอกสารพนักงาน",
      "พัฒนาบุคลากรและการฝึกอบรม",
    ],
  },
  {
    icon: FileText,
    title: "สำนักเลขานุการ/ออฟฟิศ",
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
    description: "Office · Documents · Administration",
    responsibilities: [
      "จัดการเอกสาร (DOC) ทั่วไปและประเมิน",
      "ติดตามใบสั่ง ใบขออนุมัติ และรายงาน",
      "บริหารการประชุมและการประสานงาน",
      "ตรวจสอบและเก็บเอกสารสำคัญ",
    ],
  },
  {
    icon: CheckCircle,
    title: "อนุมัติ",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
    description: "Approvals · Workflows · Authority",
    responsibilities: [
      "ติดตามเอกสารรอการอนุมัติ (PO, LEAVE, etc)",
      "ประมวลผลการอนุมัติตามลำดับชั้นอำนาจ",
      "แจ้งเตือนผู้อนุมัติและเก็บบันทึก",
      "รายงานสถานะการไหลของการอนุมัติ",
    ],
  },
];

function DepartmentCard({ dept }: { dept: DeptCard }) {
  const Icon = dept.icon;
  return (
    <GlassCard className={`p-4 border ${dept.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${dept.bg}`}>
          <Icon size={16} className={dept.color} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold ${dept.color}`}>{dept.title}</p>
          <p className="text-xs text-aviva-secondary">{dept.description}</p>
          <ul className="mt-2 space-y-0.5">
            {dept.responsibilities.map((r, i) => (
              <li key={i} className="text-[10px] text-aviva-secondary flex items-start gap-1">
                <span className={`mt-0.5 flex-shrink-0 ${dept.color}`}>→</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </GlassCard>
  );
}

const approvalMatrix = [
  { amount: "0 – 50,000 บาท",      approver: "ผู้จัดการโครงการ", time: "ภายใน 2 วัน" },
  { amount: "50,001 – 200,000 บาท", approver: "ผู้จัดการโครงการ (2 ชั้น)", time: "ภายใน 2 วัน" },
  { amount: "200,001 – 500,000 บาท", approver: "ผู้จัดการ + ผู้อำนวยการ", time: "ภายใน 3 วัน" },
  { amount: "500,001 บาทขึ้นไป",   approver: "ผู้อำนวยการ / CEO / COO", time: "ภายใน 5 วัน" },
];

// CEO/COO มีสิทธิ์สูงสุด อนุมัติได้ทุกวงเงินเหนือทุกระดับในตารางนี้

export default function OrgChartPage() {
  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/settings" className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10">
            <ChevronLeft size={18} className="text-aviva-secondary" />
          </Link>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-aviva-gold" />
            <h1 className="text-lg font-bold text-aviva-text">โครงสร้างองค์กร</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Project info */}
        <GlassCard className="p-4 text-center">
          <p className="text-xs text-aviva-secondary mb-1">โครงการ</p>
          <p className="text-base font-bold text-aviva-gold tracking-wide">AVIVA Private</p>
          <p className="text-xs text-aviva-secondary mt-0.5">หมู่บ้านจัดสรร · 31 ยูนิต</p>
        </GlassCard>

        {/* Departments Grid */}
        <div>
          <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-3">แผนกและหน้าที่ปฏิบัติการ</p>
          <div className="grid grid-cols-1 gap-3">
            {departments.map((dept, i) => (
              <DepartmentCard key={i} dept={dept} />
            ))}
          </div>
        </div>

        {/* Approval matrix */}
        <div>
          <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-3">ตาราง Matrix การอนุมัติตามวงเงิน</p>
          <GlassCard className="overflow-hidden">
            <div className="divide-y divide-aviva-gold/10">
              <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-aviva-gold/5">
                <p className="text-[10px] font-bold text-aviva-gold uppercase">วงเงิน</p>
                <p className="text-[10px] font-bold text-aviva-gold uppercase">ผู้อนุมัติ</p>
                <p className="text-[10px] font-bold text-aviva-gold uppercase">SLA</p>
              </div>
              {approvalMatrix.map((row, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 px-4 py-3">
                  <p className="text-[10px] text-aviva-text font-medium">{row.amount}</p>
                  <p className="text-[10px] text-aviva-secondary">{row.approver}</p>
                  <p className="text-[10px] text-green-400">{row.time}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Communication rules */}
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-aviva-gold" />
            <p className="text-sm font-semibold text-aviva-text">กฎการสื่อสารและสั่งการ</p>
          </div>
          <ul className="space-y-2 text-xs text-aviva-secondary">
            <li className="flex gap-2"><span className="text-aviva-gold flex-shrink-0">★</span><span><span className="text-aviva-gold font-semibold">CEO และ COO มีสิทธิ์สูงสุด</span> — เข้าถึงข้อมูลได้ทุกส่วน อนุมัติและทำได้ทุกอย่างทุกฝ่าย (เทียบเท่า/เหนือ Admin)</span></li>
            <li className="flex gap-2"><span className="text-aviva-gold flex-shrink-0">1.</span>การสั่งการเป็นลำดับชั้น — ห้ามข้ามสายงาน</li>
            <li className="flex gap-2"><span className="text-aviva-gold flex-shrink-0">2.</span>เอกสารทุกประเภทต้องบันทึกในระบบก่อนดำเนินการ</li>
            <li className="flex gap-2"><span className="text-aviva-gold flex-shrink-0">3.</span>การอนุมัติทางวาจาต้องตามด้วยเอกสารยืนยันใน 24 ชั่วโมง</li>
            <li className="flex gap-2"><span className="text-aviva-gold flex-shrink-0">4.</span>ข้อมูลโครงการถือเป็นความลับ ห้ามเปิดเผยแก่บุคคลภายนอก</li>
            <li className="flex gap-2"><span className="text-aviva-gold flex-shrink-0">5.</span>ปัญหาเร่งด่วน — แจ้งผู้จัดการโดยตรงพร้อมบันทึกในระบบ</li>
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
