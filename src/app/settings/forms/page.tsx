"use client";
import { useState } from "react";
import { ChevronLeft, ClipboardList, Receipt, HardHat, Briefcase, TrendingUp, Megaphone, Wrench, FileText, ChevronDown, ChevronRight, Users, Shield, Star } from "lucide-react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import clsx from "clsx";

interface FormField {
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  note?: string;
}

interface ApprovalStep {
  actor: string;
  action: string;
  condition?: string;
  color: string;
}

interface StandardForm {
  code: string;
  name: string;
  dept: string;
  bg: string;
  border: string;
  icon: typeof FileText;
  iconColor: string;
  tagColor: string;
  description: string;
  fields: FormField[];
  approvalChain: ApprovalStep[];
  relatedForms: string[];
}

const FORMS: StandardForm[] = [
  {
    code: "FIN",
    name: "คำขออนุมัติรายจ่าย",
    dept: "ฝ่ายออฟฟิศ / HR",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: Receipt,
    iconColor: "text-blue-400",
    tagColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    description: "ขออนุมัติรายจ่ายทุกประเภทที่ไม่มีแบบฟอร์มเฉพาะ รวมถึงค่าใช้จ่ายทั่วไปของสำนักงาน",
    fields: [
      { label: "วันที่ขอ", type: "วันที่", required: true },
      { label: "หมวดหมู่รายจ่าย", type: "เลือก", required: true, options: ["วัสดุสำนักงาน", "ค่าน้ำมัน/เดินทาง", "ค่าบำรุงรักษา", "ค่าสาธารณูปโภค", "ค่าบริการ", "อื่นๆ"] },
      { label: "รายละเอียดการใช้จ่าย", type: "ข้อความยาว", required: true },
      { label: "จำนวนเงิน (บาท)", type: "ตัวเลข", required: true },
      { label: "แผนกที่รับผิดชอบ", type: "เลือก", required: true, options: ["ฝ่ายขาย", "ฝ่ายก่อสร้าง", "ฝ่ายออฟฟิศ", "ฝ่ายการตลาด"] },
      { label: "แนบใบเสร็จ / ใบเสนอราคา", type: "ไฟล์", required: false, note: "บังคับสำหรับรายจ่าย > 5,000 บาท" },
    ],
    approvalChain: [
      { actor: "ฝ่ายออฟฟิศ", action: "บันทึกและส่งคำขอ FIN", color: "text-blue-400" },
      { actor: "ผู้จัดการโครงการ", action: "อนุมัติ ≤ 500,000 บาท", color: "text-purple-400" },
      { actor: "ผู้อำนวยการ", action: "อนุมัติ > 500,000 บาท", condition: "เฉพาะวงเงินสูง", color: "text-aviva-gold" },
    ],
    relatedForms: ["PO", "INST", "MKTG"],
  },
  {
    code: "INST",
    name: "คำขอเบิกงวดงานก่อสร้าง",
    dept: "ฝ่ายก่อสร้าง",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    icon: HardHat,
    iconColor: "text-orange-400",
    tagColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    description: "ผู้รับเหมายื่นขอเบิกเงินตามงวดงานที่แล้วเสร็จ พร้อมหลักฐานรูปถ่ายและ Checklist",
    fields: [
      { label: "บ้านเลขที่ / แปลงที่", type: "เลือก", required: true },
      { label: "งวดที่", type: "เลือก", required: true, options: ["งวดที่ 1", "งวดที่ 2", "งวดที่ 3", "งวดที่ 4", "งวดที่ 5", "งวดที่ 6–10"] },
      { label: "รายละเอียดงานที่แล้วเสร็จ", type: "ข้อความยาว", required: true },
      { label: "% ความสำเร็จสะสม", type: "ตัวเลข", required: true },
      { label: "จำนวนเงินขอเบิก (บาท)", type: "ตัวเลข", required: true },
      { label: "Checklist งานประจำงวด", type: "รายการตรวจสอบ", required: true },
      { label: "รูปถ่ายผลงาน", type: "รูปภาพ", required: true, note: "อย่างน้อย 3 รูป" },
    ],
    approvalChain: [
      { actor: "ผู้รับเหมา", action: "ยื่น INST + รูปถ่าย + checklist", color: "text-gray-400" },
      { actor: "หัวหน้าฝ่ายก่อสร้าง", action: "ตรวจสอบหน้างาน", color: "text-orange-400" },
      { actor: "ผู้จัดการโครงการ", action: "อนุมัติ ≤ 500,000 บาท", color: "text-purple-400" },
      { actor: "ผู้อำนวยการ", action: "อนุมัติ > 500,000 บาท", condition: "เฉพาะวงเงินสูง", color: "text-aviva-gold" },
    ],
    relatedForms: ["PO", "FIN"],
  },
  {
    code: "PO",
    name: "ใบสั่งซื้อวัสดุ / บริการ",
    dept: "ฝ่ายก่อสร้าง",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    icon: HardHat,
    iconColor: "text-orange-400",
    tagColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    description: "ขออนุมัติจัดซื้อวัสดุก่อสร้างและบริการจากผู้ขายภายนอก ต้องแนบใบเสนอราคาอย่างน้อย 1 ใบ",
    fields: [
      { label: "วันที่", type: "วันที่", required: true },
      { label: "ผู้ขาย / Supplier", type: "ข้อความ", required: true },
      { label: "รายการสินค้า (ชื่อ / หน่วย / จำนวน / ราคา/หน่วย)", type: "ตาราง", required: true },
      { label: "ยอดรวมทั้งสิ้น (บาท)", type: "ตัวเลข (อัตโนมัติ)", required: true },
      { label: "บ้าน / แปลงที่ใช้งาน", type: "เลือก", required: true },
      { label: "วันที่ต้องการ", type: "วันที่", required: true },
      { label: "ใบเสนอราคา Supplier", type: "ไฟล์", required: true },
    ],
    approvalChain: [
      { actor: "หัวหน้าฝ่ายก่อสร้าง", action: "ยื่น PO", color: "text-orange-400" },
      { actor: "ผู้จัดการโครงการ", action: "อนุมัติ ≤ 500,000 บาท", color: "text-purple-400" },
      { actor: "ผู้อำนวยการ", action: "อนุมัติ > 500,000 บาท", condition: "เฉพาะวงเงินสูง", color: "text-aviva-gold" },
      { actor: "ฝ่ายออฟฟิศ", action: "ออก FIN เบิกจ่าย", color: "text-blue-400" },
    ],
    relatedForms: ["FIN", "INST"],
  },
  {
    code: "LEAVE",
    name: "ใบลาพนักงาน",
    dept: "ทุกฝ่าย",
    bg: "bg-teal-500/10",
    border: "border-teal-500/20",
    icon: Briefcase,
    iconColor: "text-teal-400",
    tagColor: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    description: "แบบฟอร์มขออนุมัติการลาทุกประเภท ต้องระบุผู้รับผิดชอบงานแทนก่อนส่งคำขอ",
    fields: [
      { label: "ประเภทการลา", type: "เลือก", required: true, options: ["ลาป่วย", "ลากิจ", "ลาพักร้อน", "ลาคลอด", "ลากิจฉุกเฉิน"] },
      { label: "วันที่เริ่มลา", type: "วันที่", required: true },
      { label: "วันที่สิ้นสุด", type: "วันที่", required: true },
      { label: "จำนวนวัน", type: "ตัวเลข (อัตโนมัติ)", required: true },
      { label: "เหตุผล", type: "ข้อความยาว", required: true },
      { label: "ผู้รับผิดชอบงานแทน", type: "ข้อความ", required: true },
      { label: "แนบใบรับรองแพทย์", type: "ไฟล์", required: false, note: "บังคับสำหรับลาป่วย > 3 วัน" },
    ],
    approvalChain: [
      { actor: "พนักงาน", action: "ยื่นใบลา LEAVE", color: "text-gray-400" },
      { actor: "หัวหน้าฝ่าย", action: "รับทราบและส่งต่อ", color: "text-teal-400" },
      { actor: "ผู้จัดการโครงการ", action: "อนุมัติ", color: "text-purple-400" },
    ],
    relatedForms: [],
  },
  {
    code: "WR",
    name: "คำร้องแจ้งซ่อม / ประกัน",
    dept: "ฝ่ายขาย + ฝ่ายก่อสร้าง",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: Wrench,
    iconColor: "text-red-400",
    tagColor: "bg-red-500/20 text-red-400 border-red-500/30",
    description: "รับแจ้งปัญหาจากลูกค้าหลังโอนกรรมสิทธิ์ รับผิดชอบร่วม: ฝ่ายขายประสานงาน — ฝ่ายก่อสร้างดำเนินการซ่อม",
    fields: [
      { label: "บ้านเลขที่ / แปลงที่", type: "เลือก", required: true },
      { label: "ชื่อลูกค้า", type: "ข้อความ", required: true },
      { label: "เบอร์โทรติดต่อ", type: "ข้อความ", required: true },
      { label: "ประเภทปัญหา", type: "เลือก", required: true, options: ["โครงสร้าง", "ระบบไฟฟ้า", "ระบบประปา", "งานสี / ฝ้า", "ประตู / หน้าต่าง", "อื่นๆ"] },
      { label: "รายละเอียดปัญหา", type: "ข้อความยาว", required: true },
      { label: "ระดับความเร่งด่วน", type: "เลือก", required: true, options: ["ด่วนมาก (ภายใน 24 ชม.)", "ด่วน (ภายใน 3 วัน)", "ปกติ (ภายใน 7 วัน)"] },
      { label: "รูปถ่ายปัญหา", type: "รูปภาพ", required: false },
    ],
    approvalChain: [
      { actor: "ฝ่ายขาย", action: "รับแจ้งและบันทึก WR", color: "text-green-400" },
      { actor: "ฝ่ายก่อสร้าง", action: "รับมอบหมาย + ดำเนินการซ่อม", color: "text-orange-400" },
      { actor: "ฝ่ายขาย", action: "ประสานลูกค้า + ยืนยันปิดเคส", color: "text-green-400" },
    ],
    relatedForms: ["FIN"],
  },
  {
    code: "MKTG",
    name: "คำขออนุมัติงบการตลาด",
    dept: "ฝ่ายการตลาด",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    icon: Megaphone,
    iconColor: "text-pink-400",
    tagColor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    description: "ขออนุมัติงบประมาณสำหรับกิจกรรมการตลาด โฆษณา และ Event ต้องระบุ KPI และช่องทางที่ชัดเจน",
    fields: [
      { label: "ชื่อกิจกรรม / แคมเปญ", type: "ข้อความ", required: true },
      { label: "ช่วงเวลาดำเนินการ", type: "ช่วงวันที่", required: true },
      { label: "งบประมาณที่ขอ (บาท)", type: "ตัวเลข", required: true },
      { label: "ช่องทางการตลาด", type: "เลือกหลายตัว", required: true, options: ["Social Media", "Google Ads", "Event / งานบ้าน", "สื่อสิ่งพิมพ์", "Influencer", "อื่นๆ"] },
      { label: "วัตถุประสงค์", type: "ข้อความยาว", required: true },
      { label: "KPI ที่คาดหวัง", type: "ข้อความยาว", required: true, note: "เช่น Leads ที่คาด, Reach, Engagement" },
      { label: "แผนการใช้งบฯ (รายการ)", type: "ตาราง", required: false },
    ],
    approvalChain: [
      { actor: "ฝ่ายการตลาด", action: "ยื่น MKTG", color: "text-pink-400" },
      { actor: "ผู้จัดการโครงการ", action: "อนุมัติงบ", color: "text-purple-400" },
      { actor: "ฝ่ายออฟฟิศ", action: "ออก FIN เบิกจ่ายหลังได้รับอนุมัติ", color: "text-blue-400" },
    ],
    relatedForms: ["FIN"],
  },
  {
    code: "BOOK",
    name: "ใบจอง / ใบเสนอราคา",
    dept: "ฝ่ายขาย",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    icon: TrendingUp,
    iconColor: "text-green-400",
    tagColor: "bg-green-500/20 text-green-400 border-green-500/30",
    description: "บันทึกการจองและเสนอราคาให้ลูกค้า ต้องตรวจสอบสถานะแปลงก่อนออกใบจองทุกครั้ง",
    fields: [
      { label: "ชื่อลูกค้า", type: "ข้อความ", required: true },
      { label: "เบอร์โทร / LINE ID", type: "ข้อความ", required: true },
      { label: "แปลงที่จอง", type: "เลือก", required: true, note: "ตรวจสอบว่าว่างก่อนจอง" },
      { label: "แบบบ้าน", type: "ข้อความ (อัตโนมัติ)", required: true },
      { label: "ราคาเสนอขาย (บาท)", type: "ตัวเลข", required: true },
      { label: "เงินจอง (บาท)", type: "ตัวเลข", required: true },
      { label: "พนักงานขาย", type: "เลือก", required: true },
      { label: "เงื่อนไขพิเศษ", type: "ข้อความยาว", required: false },
    ],
    approvalChain: [
      { actor: "หัวหน้าฝ่ายขาย", action: "ออกใบจอง + รับเงินจอง", color: "text-green-400" },
      { actor: "ฝ่ายออฟฟิศ", action: "ออก FIN บันทึกรายรับ", color: "text-blue-400" },
      { actor: "ผู้จัดการโครงการ", action: "ตรวจสอบและอนุมัติสัญญา CONTRACT", color: "text-purple-400" },
      { actor: "ผู้อำนวยการ", action: "ลงนาม CONTRACT", color: "text-aviva-gold" },
    ],
    relatedForms: ["FIN", "DOC"],
  },
  {
    code: "DOC",
    name: "คำขออนุมัติเอกสาร",
    dept: "ฝ่ายออฟฟิศ",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    icon: FileText,
    iconColor: "text-purple-400",
    tagColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    description: "ออกเอกสารทางการ หนังสือราชการ และสัญญา ที่ต้องมีลายเซ็นผู้มีอำนาจ",
    fields: [
      { label: "ประเภทเอกสาร", type: "เลือก", required: true, options: ["หนังสือราชการ", "สัญญาจะซื้อจะขาย (CONTRACT)", "ใบรับรอง", "หนังสือมอบอำนาจ", "อื่นๆ"] },
      { label: "หัวเรื่อง", type: "ข้อความ", required: true },
      { label: "ถึง (ผู้รับ)", type: "ข้อความ", required: true },
      { label: "รายละเอียด / เนื้อหา", type: "ข้อความยาว", required: true },
      { label: "วันที่ต้องการ", type: "วันที่", required: true },
      { label: "แนบไฟล์เอกสารต้นฉบับ", type: "ไฟล์", required: false },
    ],
    approvalChain: [
      { actor: "ฝ่ายออฟฟิศ", action: "ร่างและยื่น DOC", color: "text-purple-400" },
      { actor: "ผู้จัดการโครงการ", action: "ตรวจสอบและอนุมัติ", color: "text-purple-400" },
      { actor: "ผู้อำนวยการ", action: "ลงนาม (สัญญา / เอกสารสำคัญ)", condition: "เฉพาะเอกสารสำคัญ", color: "text-aviva-gold" },
    ],
    relatedForms: ["BOOK", "FIN"],
  },
];

const FIELD_COLORS: Record<string, string> = {
  "วันที่": "text-blue-300",
  "เลือก": "text-purple-300",
  "ข้อความยาว": "text-gray-300",
  "ตัวเลข": "text-green-300",
  "ไฟล์": "text-yellow-300",
  "รูปภาพ": "text-orange-300",
  "ตาราง": "text-teal-300",
  "รายการตรวจสอบ": "text-yellow-300",
  "ข้อความ": "text-gray-300",
  "ตัวเลข (อัตโนมัติ)": "text-green-300",
  "ช่วงวันที่": "text-blue-300",
  "เลือกหลายตัว": "text-purple-300",
  "ข้อความ (อัตโนมัติ)": "text-gray-300",
};

function FormCard({ form }: { form: StandardForm }) {
  const [open, setOpen] = useState(false);
  const Icon = form.icon;
  return (
    <GlassCard className={`overflow-hidden border ${form.border}`}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full text-left p-4 flex items-start gap-3 active:scale-[0.99] transition-all">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${form.bg} ${form.border}`}>
          <Icon size={16} className={form.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${form.tagColor}`}>{form.code}</span>
            <p className="text-sm font-bold text-aviva-text">{form.name}</p>
          </div>
          <p className="text-xs text-aviva-secondary mt-0.5">{form.dept}</p>
        </div>
        <ChevronDown size={15} className={clsx("text-aviva-secondary/50 flex-shrink-0 mt-1.5 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-aviva-gold/10 p-4 space-y-4 bg-aviva-bg/20">
          <p className="text-xs text-aviva-secondary/80 leading-relaxed">{form.description}</p>

          <div>
            <p className="text-[10px] font-bold text-aviva-secondary/50 uppercase tracking-wider mb-2">ฟิลด์แบบฟอร์ม ({form.fields.length} รายการ)</p>
            <div className="space-y-1.5">
              {form.fields.map((f, i) => (
                <div key={i} className="flex items-start gap-2 bg-aviva-bg/40 rounded-lg px-3 py-2">
                  <span className="text-[10px] font-bold text-aviva-gold/50 w-4 flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-aviva-text font-medium">{f.label}</span>
                      {f.required && <span className="text-[9px] text-red-400 font-bold">*บังคับ</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-medium ${FIELD_COLORS[f.type] ?? "text-gray-300"}`}>[{f.type}]</span>
                      {f.options && <span className="text-[9px] text-aviva-secondary/60 truncate max-w-[160px]">{f.options.slice(0, 3).join(" / ")}{f.options.length > 3 ? " ..." : ""}</span>}
                      {f.note && <span className="text-[9px] text-yellow-400/80">⚠ {f.note}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-aviva-secondary/50 uppercase tracking-wider mb-2">สายการอนุมัติ</p>
            <div className="space-y-1">
              {form.approvalChain.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border border-aviva-gold/20 bg-aviva-bg ${step.color}`}>{i + 1}</div>
                    {i < form.approvalChain.length - 1 && <div className="w-px h-3 bg-aviva-gold/15 mt-0.5" />}
                  </div>
                  <div className="pb-1 min-w-0">
                    <p className={`text-xs font-semibold ${step.color}`}>{step.actor}</p>
                    <p className="text-[10px] text-aviva-secondary/70">{step.action}</p>
                    {step.condition && <p className="text-[9px] text-yellow-400/80 mt-0.5">({step.condition})</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {form.relatedForms.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-aviva-secondary/50 uppercase tracking-wider mb-2">แบบฟอร์มที่เกี่ยวข้อง</p>
              <div className="flex items-center gap-2 flex-wrap">
                {form.relatedForms.map(code => (
                  <span key={code} className="text-[10px] px-2 py-1 rounded-lg bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 font-bold">{code}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

const MEETING_AGREEMENTS = [
  "กำหนดแบบฟอร์มมาตรฐาน 8 ประเภท ครอบคลุมทุกกระบวนการ",
  "เลขที่เอกสารรูปแบบ [CODE]-[YYMM]-[ลำดับ] เช่น FIN-2605-001",
  "ทุกแบบฟอร์มต้องบันทึกในระบบก่อนดำเนินการจริง ห้ามใช้ช่องทางนอกระบบ",
  "WR — รับผิดชอบร่วม: ฝ่ายขายรับแจ้ง ฝ่ายก่อสร้างดำเนินการซ่อม",
  "PO ทุกรายการต้องแนบใบเสนอราคา Supplier ก่อนขออนุมัติ",
  "MKTG ต้องระบุ KPI ชัดเจน ผู้จัดการมีสิทธิ์ขอปรับก่อนอนุมัติ",
  "BOOK ต้องตรวจสอบสถานะแปลงในระบบก่อนออกใบจองทุกครั้ง",
  "หัวหน้าฝ่าย (project_manager) ไม่มีสิทธิ์อนุมัติ — เฉพาะ manager/director/admin เท่านั้น",
];

const FORM_RELATIONS = [
  { from: "BOOK", to: "FIN", label: "รับเงินจอง" },
  { from: "BOOK", to: "DOC", label: "ออกสัญญา CONTRACT" },
  { from: "INST", to: "PO", label: "สั่งซื้อวัสดุ" },
  { from: "PO", to: "FIN", label: "เบิกจ่าย" },
  { from: "MKTG", to: "FIN", label: "เบิกงบกิจกรรม" },
  { from: "WR", to: "FIN", label: "ค่าซ่อม (ถ้ามี)" },
];

export default function FormsPage() {
  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/settings" className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10">
            <ChevronLeft size={18} className="text-aviva-secondary" />
          </Link>
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-aviva-gold" />
            <h1 className="text-lg font-bold text-aviva-text">แบบฟอร์มมาตรฐาน</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">

        <GlassCard className="p-4 text-center">
          <p className="text-xs text-aviva-secondary mb-1">โครงการ</p>
          <p className="text-base font-bold text-aviva-gold tracking-wide">AVIVA Private</p>
          <p className="text-xs text-aviva-secondary mt-0.5">แบบฟอร์มมาตรฐาน 8 ประเภท · ตกลงร่วมกันทุกฝ่าย</p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-aviva-gold" />
            <p className="text-sm font-semibold text-aviva-text">บันทึกการประชุมกำหนดมาตรฐานแบบฟอร์ม</p>
          </div>

          <div className="bg-aviva-bg/50 rounded-xl p-3 mb-3">
            <p className="text-[10px] font-bold text-aviva-secondary/50 uppercase tracking-wider mb-2">ผู้เข้าร่วมประชุม</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { role: "ผู้อำนวยการ", sub: "ประธานที่ประชุม", color: "text-aviva-gold" },
                { role: "ผู้จัดการโครงการ", sub: "Management", color: "text-purple-400" },
                { role: "หัวหน้าฝ่ายก่อสร้าง", sub: "Construction Lead", color: "text-orange-400" },
                { role: "หัวหน้าฝ่ายขาย", sub: "Sales Lead", color: "text-green-400" },
                { role: "หัวหน้าฝ่ายออฟฟิศ / HR", sub: "Office Lead", color: "text-blue-400" },
                { role: "ฝ่ายการตลาด", sub: "Marketing", color: "text-pink-400" },
              ].map(p => (
                <div key={p.role} className="flex items-start gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 bg-current ${p.color}`} />
                  <div>
                    <p className={`text-[10px] font-semibold ${p.color}`}>{p.role}</p>
                    <p className="text-[9px] text-aviva-secondary/50">{p.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-aviva-bg/30 rounded-xl p-3 mb-3 border border-aviva-gold/10">
            <p className="text-[10px] font-bold text-aviva-gold/70 uppercase tracking-wider mb-2">สรุปการหารือ</p>
            <div className="space-y-2 text-[10px] text-aviva-secondary/80 leading-relaxed">
              <p><span className="text-orange-400 font-semibold">ฝ่ายก่อสร้าง:</span> &quot;ขอให้ INST ต้องมีรูปถ่ายอย่างน้อย 3 รูป และ checklist ครบก่อนยื่น ช่วยลดการส่งคืนเอกสาร&quot;</p>
              <p><span className="text-blue-400 font-semibold">ฝ่ายออฟฟิศ:</span> &quot;FIN ควรบังคับแนบใบเสร็จสำหรับรายจ่าย {">"}  5,000 บาท และกำหนด SLA 2 วันทำการ&quot;</p>
              <p><span className="text-green-400 font-semibold">ฝ่ายขาย:</span> &quot;BOOK ต้องตรวจสอบแปลงว่างในระบบก่อนออกใบจอง ป้องกันการจองซ้ำ&quot;</p>
              <p><span className="text-red-400 font-semibold">หลังการขาย:</span> &quot;WR ควรแยกบทบาทชัดเจน — ขายรับแจ้ง ก่อสร้างซ่อม ขายยืนยันปิดเคส&quot;</p>
              <p><span className="text-pink-400 font-semibold">การตลาด:</span> &quot;MKTG ต้องมี KPI ก่อนอนุมัติงบ และหลังจบกิจกรรมส่ง Report ผลลัพธ์&quot;</p>
              <p><span className="text-purple-400 font-semibold">ผู้จัดการ:</span> &quot;ยืนยันว่าหัวหน้าฝ่ายไม่มีสิทธิ์อนุมัติ ต้องส่งต่อผู้จัดการขึ้นไป&quot;</p>
            </div>
          </div>

          <p className="text-[10px] font-bold text-aviva-secondary/50 uppercase tracking-wider mb-2">มติที่ประชุม ({MEETING_AGREEMENTS.length} ข้อ)</p>
          <ul className="space-y-1.5">
            {MEETING_AGREEMENTS.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-aviva-gold font-bold text-xs flex-shrink-0">{i + 1}.</span>
                <p className="text-xs text-aviva-secondary">{item}</p>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className="p-4">
          <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-3">ความสัมพันธ์ระหว่างแบบฟอร์ม</p>
          <div className="space-y-2">
            {FORM_RELATIONS.map((rel, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-aviva-gold/10 text-aviva-gold border border-aviva-gold/20 min-w-[44px] text-center">{rel.from}</span>
                <ChevronRight size={11} className="text-aviva-secondary/40 flex-shrink-0" />
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-aviva-card text-aviva-text border border-aviva-gold/10 min-w-[36px] text-center">{rel.to}</span>
                <span className="text-[10px] text-aviva-secondary/60">{rel.label}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <div>
          <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-3">แบบฟอร์ม 8 ประเภท — กดเพื่อดูรายละเอียด</p>
          <div className="space-y-3">
            {FORMS.map(form => (
              <FormCard key={form.code} form={form} />
            ))}
          </div>
        </div>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={13} className="text-aviva-gold" />
            <p className="text-xs font-semibold text-aviva-text">หมายเหตุสำคัญ</p>
          </div>
          <ul className="space-y-1.5 text-xs text-aviva-secondary">
            <li className="flex gap-2"><span className="text-aviva-gold flex-shrink-0">•</span>เอกสารทุกประเภทใช้รูปแบบเลขที่ [CODE]-[YYMM]-[ลำดับ]</li>
            <li className="flex gap-2"><span className="text-aviva-gold flex-shrink-0">•</span>ฟิลด์ <span className="text-red-400 font-semibold">*บังคับ</span> ต้องกรอกครบก่อนส่งคำขอ</li>
            <li className="flex gap-2"><span className="text-aviva-gold flex-shrink-0">•</span>การอนุมัติทางวาจาต้องตามด้วยเอกสารในระบบภายใน 24 ชั่วโมง</li>
            <li className="flex gap-2"><span className="text-aviva-gold flex-shrink-0">•</span>SLA การอนุมัติ: ≤50K = 2 วัน | ≤500K = 3 วัน | {">"}  500K = 5 วัน</li>
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
