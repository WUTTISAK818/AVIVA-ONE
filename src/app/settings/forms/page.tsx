"use client";
import { ChevronLeft, ClipboardList, FileText } from "lucide-react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";

const FORMS = [
  {
    code: "FIN",
    name: "ขออนุมัติรายจ่ายการเงิน",
    dept: "ฝ่ายการเงิน / บัญชี",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10 border-yellow-400/20",
    fields: ["วันที่", "ผู้ขออนุมัติ", "ฝ่าย", "รายการค่าใช้จ่าย", "จำนวนเงิน (บาท)", "เหตุผล / วัตถุประสงค์", "ลายเซ็นผู้ขอ", "ลายเซ็นผู้จัดการ"],
    steps: ["กรอกแบบฟอร์มให้ครบถ้วน", "ส่งผู้จัดการฝ่ายอนุมัติ", "ฝ่ายการเงินออกเลข FIN-XXXXX", "เบิกจ่าย / บันทึกบัญชี"],
  },
  {
    code: "INST",
    name: "ตรวจสอบงวดงานก่อสร้าง",
    dept: "ฝ่ายก่อสร้าง",
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
    fields: ["เลขที่งวดงาน (1–10)", "รหัสแปลง / บ้าน", "รายการงานที่ตรวจ", "ผลการตรวจ (ผ่าน/ไม่ผ่าน)", "หมายเหตุ", "รูปถ่ายประกอบ", "วิศวกรผู้ตรวจ", "วันที่ตรวจ"],
    steps: ["วิศวกรตรวจงานและกรอกแบบฟอร์ม", "ส่งขออนุมัติผู้จัดการ", "ออกเลข INST-XXXXX", "อนุมัติ → เบิกเงินผู้รับเหมา"],
  },
  {
    code: "PO",
    name: "ใบสั่งซื้อวัสดุ",
    dept: "ฝ่ายก่อสร้าง",
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/20",
    fields: ["วันที่", "ผู้ขอ", "รายการวัสดุ", "ปริมาณ", "ราคาต่อหน่วย", "ราคารวม", "ผู้จัดหา / Supplier", "ลายเซ็นผู้จัดการ"],
    steps: ["กรอกรายการวัสดุที่ต้องการ", "ส่งผู้จัดการอนุมัติ", "ออกเลข PO-XXXXX", "จัดซื้อ / รับของ / บันทึกคลัง"],
  },
  {
    code: "WR",
    name: "แจ้งซ่อม / ประกัน",
    dept: "ฝ่ายหลังการขาย",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/20",
    fields: ["ชื่อลูกค้า", "แปลง / บ้านเลขที่", "ประเภทปัญหา", "รายละเอียดปัญหา", "วันที่แจ้ง", "ผู้รับผิดชอบ", "วันนัดซ่อม", "สถานะ"],
    steps: ["ลูกค้าแจ้งปัญหา", "ออกเลข WR-XXXXX บันทึกระบบ", "นัดวันซ่อม / มอบหมายช่าง", "ซ่อมเสร็จ → ปิดเคส + ให้คะแนน"],
  },
  {
    code: "LEAVE",
    name: "ใบขออนุมัติการลา",
    dept: "ฝ่ายบุคคล (HR)",
    color: "text-teal-400",
    bg: "bg-teal-400/10 border-teal-400/20",
    fields: ["ชื่อพนักงาน", "ตำแหน่ง / ฝ่าย", "ประเภทการลา", "วันที่ขอลา (ตั้งแต่–ถึง)", "จำนวนวัน", "เหตุผล", "ผู้ทำงานแทน", "ลายเซ็นผู้จัดการ"],
    steps: ["ยื่นล่วงหน้า ≥ 1 วัน (ยกเว้นลาป่วย)", "ผู้จัดการอนุมัติ", "HR บันทึกวันลาสะสม", "ออกเลข LEAVE-XXXXX"],
  },
  {
    code: "MKTG",
    name: "อนุมัติงบการตลาด",
    dept: "ฝ่ายการตลาด",
    color: "text-pink-400",
    bg: "bg-pink-400/10 border-pink-400/20",
    fields: ["ชื่อกิจกรรม / แคมเปญ", "วัตถุประสงค์", "กลุ่มเป้าหมาย", "ช่องทาง", "งบประมาณที่ขอ", "วันที่จัดกิจกรรม", "KPI / เป้าหมาย", "ลายเซ็นผู้จัดการ"],
    steps: ["เสนอแผนงานและงบประมาณ", "ผู้จัดการอนุมัติ", "ออกเลข MKTG-XXXXX", "ดำเนินกิจกรรม → รายงานผล"],
  },
  {
    code: "BOOK",
    name: "ใบจอง / มัดจำ",
    dept: "ฝ่ายขาย",
    color: "text-aviva-gold",
    bg: "bg-aviva-gold/10 border-aviva-gold/20",
    fields: ["ชื่อผู้จอง", "เบอร์โทร", "แปลงที่จอง", "ราคายูนิต", "ยอดมัดจำ", "วันที่จอง", "เงื่อนไขการจอง", "ลายเซ็นพนักงานขาย"],
    steps: ["พนักงานขายกรอกข้อมูลลูกค้า", "รับมัดจำ / บันทึกในระบบ CRM", "ออกเลข BOOK-XXXXX", "ส่งใบจองให้ลูกค้า"],
  },
  {
    code: "DOC",
    name: "ขออนุมัติเอกสารทั่วไป",
    dept: "ฝ่ายออฟฟิศ",
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
    fields: ["วันที่", "ผู้ขอ", "ฝ่าย", "ชื่อเอกสาร / เรื่อง", "รายละเอียด", "ผู้รับเอกสาร", "ระดับความสำคัญ", "ลายเซ็นผู้จัดการ"],
    steps: ["กรอกแบบฟอร์มและแนบเอกสาร", "ส่งผู้จัดการอนุมัติ", "ออกเลข DOC-XXXXX", "แจกจ่าย / จัดเก็บในระบบ"],
  },
];

export default function FormsPage() {
  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <Link href="/settings" className="flex items-center gap-1.5 text-aviva-secondary text-xs mb-2 hover:text-aviva-gold transition-colors">
            <ChevronLeft size={14} /> ตั้งค่า
          </Link>
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-orange-400" />
            <h1 className="text-lg font-bold text-aviva-text">แบบฟอร์มมาตรฐาน</h1>
          </div>
          <p className="text-xs text-aviva-secondary mt-0.5">8 แบบฟอร์ม FIN / INST / PO / WR / LEAVE / MKTG / BOOK / DOC</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {FORMS.map((f) => (
          <GlassCard key={f.code} className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${f.bg}`}>
                <FileText size={16} className={f.color} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md border ${f.bg} ${f.color}`}>{f.code}</span>
                  <p className="text-sm font-semibold text-aviva-text">{f.name}</p>
                </div>
                <p className="text-[11px] text-aviva-secondary mt-0.5">{f.dept}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-1.5">ช่องข้อมูลในแบบฟอร์ม</p>
                <div className="flex flex-wrap gap-1">
                  {f.fields.map((field) => (
                    <span key={field} className="text-[10px] text-aviva-secondary bg-aviva-bg/50 border border-aviva-gold/10 px-2 py-0.5 rounded-full">
                      {field}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-1.5">ขั้นตอน</p>
                <ol className="space-y-1">
                  {f.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-aviva-secondary">
                      <span className={`flex-shrink-0 w-4 h-4 rounded-full border text-[9px] flex items-center justify-center font-bold ${f.bg} ${f.color}`}>
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
