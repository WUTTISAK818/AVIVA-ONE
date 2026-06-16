"use client";
import { FileText, ChevronLeft, Hash } from "lucide-react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";

const DOC_PREFIXES = [
  { prefix: "FIN", nameTh: "ขออนุมัติรายจ่ายการเงิน", example: "FIN-26001", dept: "ฝ่ายการเงิน / บัญชี", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", desc: "เอกสารขออนุมัติรายจ่ายจากฝ่ายการเงิน เช่น ค่าใช้จ่ายโครงการ ค่าสาธารณูปโภค ค่าจ้างพิเศษ ต้องผ่านผู้จัดการ" },
  { prefix: "PO", nameTh: "ใบสั่งซื้อวัสดุ", example: "PO-26003", dept: "ฝ่ายก่อสร้าง", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20", desc: "ใบสั่งซื้อวัสดุก่อสร้าง อุปกรณ์ และวัสดุสิ้นเปลือง ต้องระบุปริมาณ ราคาต่อหน่วย และผู้จัดหา" },
  { prefix: "PR", nameTh: "ขออนุมัติก่อนซื้อ", example: "PR-26001", dept: "ฝ่ายสำนักงาน / การเงิน", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", desc: "คำขอซื้อ/ติดตั้งที่ต้องอนุมัติก่อนจ่าย (เกณฑ์ตั้งแต่ ฿2,000 ขึ้นไป) เช่น ฟิล์มกรองแสง อุปกรณ์สำนักงาน เมื่ออนุมัติแล้วฝ่ายการเงินบันทึกจ่ายและลงบัญชีอัตโนมัติ" },
  { prefix: "INST", nameTh: "ตรวจสอบงวดงานก่อสร้าง", example: "INST-26007", dept: "ฝ่ายก่อสร้าง", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", desc: "เอกสารส่งตรวจงวดงานก่อสร้าง 10 งวด เมื่อผ่านการตรวจ ผู้จัดการอนุมัติและเบิกเงินผู้รับเหมาได้" },
  { prefix: "DOC", nameTh: "ขออนุมัติเอกสารทั่วไป", example: "DOC-26002", dept: "ฝ่ายออฟฟิศ", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20", desc: "เอกสารสำคัญทั่วไปที่ต้องผ่านการอนุมัติ เช่น แบบฟอร์มภายใน ใบรับรอง เอกสารราชการ" },
  { prefix: "LEAVE", nameTh: "ใบขออนุมัติการลา", example: "LEAVE-26015", dept: "ฝ่ายบุคคล (HR)", color: "text-teal-400", bg: "bg-teal-400/10 border-teal-400/20", desc: "ใบขอลาหยุด ลากิจ ลาป่วย ลาพักร้อน ต้องยื่นล่วงหน้าอย่างน้อย 1 วัน (ยกเว้นลาป่วย)" },
  { prefix: "BOOK", nameTh: "ใบจอง / มัดจำ", example: "BOOK-26005", dept: "ฝ่ายขาย", color: "text-aviva-gold", bg: "bg-aviva-gold/10 border-aviva-gold/20", desc: "เอกสารยืนยันการจองยูนิต พร้อมรายละเอียดมัดจำ แปลงที่จอง และข้อกำหนดการจอง" },
  { prefix: "CONTRACT", nameTh: "อนุมัติสัญญา", example: "CONTRACT-26001", dept: "ฝ่ายขาย / ผู้บริหาร", color: "text-green-400", bg: "bg-green-400/10 border-green-400/20", desc: "สัญญาจะซื้อจะขาย สัญญาผู้รับเหมา ต้องผ่านผู้มีอำนาจลงนาม และมีพยาน 2 ท่าน" },
  { prefix: "MKTG", nameTh: "อนุมัติงบการตลาด", example: "MKTG-26004", dept: "ฝ่ายการตลาด", color: "text-pink-400", bg: "bg-pink-400/10 border-pink-400/20", desc: "ขออนุมัติงบโฆษณา จัดกิจกรรม งานอีเวนต์ สื่อออนไลน์ และประชาสัมพันธ์โครงการ" },
  { prefix: "WR", nameTh: "แจ้งซ่อม / ประกัน", example: "WR-26010", dept: "ฝ่ายหลังการขาย", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20", desc: "เอกสารแจ้งซ่อมหลังการขาย ครอบคลุมประกันโครงสร้าง ระบบท่อ ไฟฟ้า สีและทาสี" },
];

export default function DocIndexPage() {
  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/settings" className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10"><ChevronLeft size={18} className="text-aviva-secondary" /></Link>
          <div className="flex items-center gap-2"><FileText size={18} className="text-aviva-gold" /><h1 className="text-lg font-bold text-aviva-text">ดรรชนีเอกสาร</h1></div>
        </div>
      </div>
      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3"><Hash size={15} className="text-aviva-gold" /><p className="text-sm font-semibold text-aviva-text">รูปแบบเลขที่เอกสาร</p></div>
          <div className="bg-aviva-bg rounded-xl p-4 font-mono text-center mb-3">
            <span className="text-aviva-gold font-bold text-lg">PREFIX</span><span className="text-aviva-secondary text-lg"> — </span><span className="text-blue-400 font-bold text-lg">ปี ค.ศ.</span><span className="text-green-400 font-bold text-lg">ลำดับ</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-aviva-gold/10 rounded-lg p-2 border border-aviva-gold/20"><p className="font-bold text-aviva-gold">PREFIX</p><p className="text-aviva-secondary mt-0.5">รหัสฝ่าย/ประเภท</p></div>
            <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20"><p className="font-bold text-blue-400">26</p><p className="text-aviva-secondary mt-0.5">2 หลักสุดท้ายของปี</p></div>
            <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/20"><p className="font-bold text-green-400">001</p><p className="text-aviva-secondary mt-0.5">ลำดับ (รีเซ็ตทุกปี)</p></div>
          </div>
          <p className="text-[11px] text-aviva-secondary/70 mt-3 text-center">ตัวอย่าง: <span className="font-mono text-aviva-gold">WR-26003</span> = แจ้งซ่อมรายการที่ 3 ของปี 2026</p>
        </GlassCard>
        <div>
          <p className="text-xs font-semibold text-aviva-secondary/70 uppercase tracking-wider mb-3">รหัสตัวย่อทั้งหมด ({DOC_PREFIXES.length} ประเภท)</p>
          <div className="space-y-2.5">
            {DOC_PREFIXES.map(({ prefix, nameTh, example, dept, color, bg, desc }) => (
              <GlassCard key={prefix} className={`p-4 border ${bg}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${bg}`}><span className={`text-xs font-bold font-mono ${color}`}>{prefix}</span></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-aviva-text">{nameTh}</p>
                      <span className={`text-[10px] font-bold font-mono ${color} bg-aviva-bg px-1.5 py-0.5 rounded`}>{example}</span>
                    </div>
                    <p className="text-[10px] text-aviva-gold/70 mb-1">ฝ่ายรับผิดชอบ: {dept}</p>
                    <p className="text-xs text-aviva-secondary leading-relaxed">{desc}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
        <GlassCard className="p-4">
          <p className="text-xs font-semibold text-aviva-text mb-2">หมายเหตุ</p>
          <ul className="space-y-1.5 text-xs text-aviva-secondary">
            <li>• เลขลำดับรีเซ็ตเป็น 001 ทุกต้นปีปฏิทิน (1 มกราคม)</li>
            <li>• เลขที่เอกสารสร้างอัตโนมัติโดยระบบ ห้ามแก้ไขด้วยตนเอง</li>
            <li>• เอกสารที่ถูกปฏิเสธจะยังคงเลขที่เดิม แต่บันทึกสถานะ "ปฏิเสธ"</li>
            <li>• สามารถค้นหาเอกสารด้วยเลขที่ในหน้าอนุมัติ และฝ่ายออฟฟิศ</li>
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
