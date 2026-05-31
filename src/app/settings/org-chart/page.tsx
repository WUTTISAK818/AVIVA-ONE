"use client";
import { ChevronLeft, Building2, ChevronDown, Shield, Star, Users, HardHat, Briefcase, TrendingUp, Wrench, Megaphone } from "lucide-react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";

interface OrgNode {
  title: string;
  role: string;
  level: number;
  icon: typeof Building2;
  color: string;
  bg: string;
  approvals?: string[];
  children?: OrgNode[];
}

const orgData: OrgNode = {
  title: "ผู้อำนวยการ / เจ้าของโครงการ",
  role: "Director / Admin",
  level: 1,
  icon: Shield,
  color: "text-aviva-gold",
  bg: "bg-aviva-gold/10 border-aviva-gold/30",
  approvals: [
    "อนุมัติงบโครงการทุกประเภท",
    "อนุมัติสัญญา (CONTRACT)",
    "อนุมัติรายจ่ายเกิน 500,000 บาท",
    "ตัดสินใจเชิงกลยุทธ์",
  ],
  children: [
    {
      title: "ผู้จัดการโครงการ",
      role: "Manager",
      level: 2,
      icon: Star,
      color: "text-purple-400",
      bg: "bg-purple-400/10 border-purple-400/20",
      approvals: [
        "อนุมัติรายจ่ายสูงสุด 500,000 บาท",
        "อนุมัติงวดงานก่อสร้าง (INST)",
        "อนุมัติใบสั่งซื้อ (PO)",
        "อนุมัติการลา (LEAVE)",
        "อนุมัติงบการตลาด (MKTG)",
        "จัดการผู้ใช้งานในระบบ",
      ],
      children: [
        {
          title: "หัวหน้าฝ่ายขาย",
          role: "Sales Lead",
          level: 3,
          icon: TrendingUp,
          color: "text-green-400",
          bg: "bg-green-400/10 border-green-400/20",
          approvals: [
            "ออกใบเสนอราคา / ใบจอง (BOOK)",
            "บันทึก Leads และ CRM",
            "มอบหมายแปลงให้ลูกค้า",
            "ส่งสัญญาให้ผู้จัดการอนุมัติ",
          ],
        },
        {
          title: "หัวหน้าฝ่ายก่อสร้าง",
          role: "Construction Lead",
          level: 3,
          icon: HardHat,
          color: "text-orange-400",
          bg: "bg-orange-400/10 border-orange-400/20",
          approvals: [
            "ส่งตรวจงวดงาน (INST)",
            "ยื่น PO จัดซื้อวัสดุ",
            "รายงานความคืบหน้าก่อสร้าง",
            "บันทึก Defect / ปัญหาหน้างาน",
          ],
        },
        {
          title: "หัวหน้าฝ่ายออฟฟิศ / HR",
          role: "Office / HR Lead",
          level: 3,
          icon: Briefcase,
          color: "text-blue-400",
          bg: "bg-blue-400/10 border-blue-400/20",
          approvals: [
            "จัดการเอกสาร (DOC)",
            "บริหารงานบุคคลและเงินเดือน",
            "ขออนุมัติรายจ่ายการเงิน (FIN)",
            "ออก Payslip พนักงาน",
          ],
        },
        {
          title: "ฝ่ายหลังการขาย",
          role: "After-Sales",
          level: 3,
          icon: Wrench,
          color: "text-red-400",
          bg: "bg-red-400/10 border-red-400/20",
          approvals: [
            "รับแจ้งซ่อม / ประกัน (WR)",
            "มอบหมายช่างซ่อม",
            "ติดตามสถานะเคส",
            "บันทึกคะแนนความพึงพอใจ",
          ],
        },
        {
          title: "ฝ่ายการตลาด",
          role: "Marketing",
          level: 3,
          icon: Megaphone,
          color: "text-pink-400",
          bg: "bg-pink-400/10 border-pink-400/20",
          approvals: [
            "ยื่น MKTG ขออนุมัติงบ",
            "จัดกิจกรรมและ Event",
            "ดูแลสื่อออนไลน์และโฆษณา",
          ],
        },
      ],
    },
  ],
};

function OrgCard({ node }: { node: OrgNode }) {
  const Icon = node.icon;
  return (
    <div className="space-y-2">
      <GlassCard className={`p-4 border ${node.bg}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${node.bg}`}>
            <Icon size={16} className={node.color} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-bold ${node.color}`}>{node.title}</p>
            <p className="text-xs text-aviva-secondary">{node.role}</p>
            {node.approvals && (
              <ul className="mt-2 space-y-0.5">
                {node.approvals.map((a, i) => (
                  <li key={i} className="text-[10px] text-aviva-secondary flex items-start gap-1">
                    <span className={`mt-0.5 flex-shrink-0 ${node.color}`}>•</span>
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </GlassCard>

      {node.children && node.children.length > 0 && (
        <div className="pl-6 space-y-2">
          <div className="flex items-center gap-1 py-1">
            <div className="w-px h-4 bg-aviva-gold/20 ml-2" />
            <ChevronDown size={12} className="text-aviva-gold/40" />
            <span className="text-[10px] text-aviva-secondary/50">รายงานต่อ</span>
          </div>
          {node.children.map((child, i) => (
            <OrgCard key={i} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

const approvalMatrix = [
  { amount: "0 – 50,000 บาท",     approver: "หัวหน้าฝ่าย", time: "ภายใน 1 วัน" },
  { amount: "50,001 – 200,000 บาท", approver: "ผู้จัดการโครงการ", time: "ภายใน 2 วัน" },
  { amount: "200,001 – 500,000 บาท", approver: "ผู้จัดการ + ผู้อำนวยการ", time: "ภายใน 3 วัน" },
  { amount: "500,001 บาทขึ้นไป",   approver: "ผู้อำนวยการเท่านั้น", time: "ภายใน 5 วัน" },
];

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

        {/* Org hierarchy */}
        <div>
          <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-3">สายการบังคับบัญชา</p>
          <OrgCard node={orgData} />
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
