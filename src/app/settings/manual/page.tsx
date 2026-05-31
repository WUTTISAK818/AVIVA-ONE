"use client";
import { useState } from "react";
import { ChevronLeft, BookOpen, Home, TrendingUp, HardHat, Briefcase, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";

interface Section {
  id: string;
  title: string;
  icon: typeof Home;
  color: string;
  bg: string;
  topics: { title: string; steps: string[] }[];
}

const sections: Section[] = [
  { id: "dashboard", title: "หน้าหลัก (Dashboard)", icon: Home, color: "text-aviva-gold", bg: "bg-aviva-gold/10 border-aviva-gold/20", topics: [
    { title: "ภาพรวมโครงการ", steps: ["กดการ์ด 'ยูนิตทั้งหมด / ขายแล้ว / ว่างอยู่' เพื่อดูรายละเอียด","ดูกราฟรายรับ-รายจ่ายรายเดือน","AI Executive Insights วิเคราะห์สถานะโครงการ real-time"] },
    { title: "AVIVA AI Executive", steps: ["กดกล่อง 'AVIVA AI Executive' ที่ด้านบนสุดเพื่อเปิดแชท","พิมพ์คำถามเกี่ยวกับข้อมูลโครงการ เช่น 'ยอดขายเดือนนี้เท่าไร'","AI จะดึงข้อมูลจากฐานข้อมูลจริงและตอบทันที"] },
    { title: "ปฏิทินกิจกรรม", steps: ["เลื่อนลงไปด้านล่างสุดของหน้าหลัก","กดวันที่เพื่อเพิ่ม / ดูกิจกรรม","ทำเครื่องหมาย Done ✓ เมื่อกิจกรรมเสร็จ"] },
  ]},
  { id: "crm", title: "ฝ่ายขาย (CRM)", icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20", topics: [
    { title: "เพิ่ม Lead ใหม่", steps: ["กดปุ่ม '+' หรือ 'เพิ่ม Lead' ในแท็บ Leads","กรอกชื่อ เบอร์โทร งบประมาณ และสถานะ","กด 'บันทึก' — ระบบจะสร้างโปรไฟล์ลูกค้าใหม่"] },
    { title: "อัปเดตสถานะลูกค้า", steps: ["กดชื่อลูกค้าในรายการ Leads","เลือกสถานะใหม่: New → Contacted → Interested → Site Visit → Booking → Closed Deal","เมื่อสถานะเป็น 'Booking' ระบบจะให้ระบุแปลงที่จอง","AI Score คำนวณอัตโนมัติจากสถานะและความเร่งด่วน"] },
    { title: "แผนผังโครงการ", steps: ["กดแท็บ 'แผนผัง' เพื่อดูแปลงทั้ง 31 แปลง","สีทอง = จอง/ขายแล้ว, สีขาว = ว่าง","กดแปลงเพื่อดูรายละเอียดและลูกค้า (ถ้ามี)"] },
    { title: "พิมพ์เอกสาร", steps: ["กดลูกค้าที่สถานะ Booking ขึ้นไป","เลือก 'พิมพ์ใบเสนอราคา' หรือ 'พิมพ์ใบจอง'","เอกสารจะเปิดในหน้าใหม่พร้อมพิมพ์"] },
    { title: "บันทึกกิจกรรมรายวัน", steps: ["ไปแท็บ 'ทีมงาน' → กดปุ่ม 'บันทึกกิจกรรม'","เลือกประเภท: รับลูกค้า / โทรหาลูกค้า / นัดหมาย / โอนกรรมสิทธิ์","กรอกรายละเอียดและบันทึก"] },
  ]},
  { id: "construction", title: "ฝ่ายก่อสร้าง", icon: HardHat, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20", topics: [
    { title: "ตรวจงวดงาน", steps: ["กดยูนิตที่ต้องการตรวจในรายการ","กด 'ตรวจงวดงาน' เพื่อดู Checklist 10 งวด","ทำเครื่องหมาย ✓ ผ่าน หรือ ✗ ไม่ผ่าน พร้อมหมายเหตุ","แนบรูปถ่ายหน้างาน (กดปุ่มกล้อง)"] },
    { title: "ส่งเบิกงวดงาน", steps: ["หลังตรวจผ่านครบ — กดปุ่ม 'ส่งเบิก'","ระบบจะสร้างเลขที่ INST-YYYY-XXX อัตโนมัติ","แจ้งเตือนผู้จัดการให้อนุมัติ"] },
    { title: "รายงานรายวัน", steps: ["กด 'บันทึกรายงานประจำวัน' ในหน้าก่อสร้าง","กรอกงานที่ทำ ความคืบหน้า และปัญหาที่พบ","กด 'พิมพ์รายงาน' เพื่อพิมพ์ PDF"] },
    { title: "จัดซื้อวัสดุ (PO)", steps: ["กดปุ่ม 'ยื่น PO' ในหน้าก่อสร้าง","กรอกรายการวัสดุ จำนวน ราคา และผู้ขาย","ส่งขออนุมัติ — ผู้จัดการจะเห็นใน 'คำขออนุมัติ'"] },
  ]},
  { id: "office", title: "ฝ่ายออฟฟิศ / HR", icon: Briefcase, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", topics: [
    { title: "บริหารเอกสาร", steps: ["ไปแท็บ 'เอกสาร' ในหน้าออฟฟิศ","กด 'เพิ่มเอกสาร' — กรอกชื่อ หมวด และรายละเอียด","ระบบสร้างเลขที่ DOC-YYYY-XXX อัตโนมัติ"] },
    { title: "จัดการพนักงาน", steps: ["ไปแท็บ 'บุคคล' → 'พนักงาน'","เพิ่ม/แก้ไขข้อมูลพนักงาน ตำแหน่ง แผนก เงินเดือน","กด 'ออก Payslip' เพื่อพิมพ์สลิปเงินเดือน"] },
    { title: "บันทึกรายรับ-รายจ่าย", steps: ["ไปแท็บ 'การเงิน' → 'บันทึกรายการ'","เลือกประเภท: รายรับ / รายจ่าย","กรอกจำนวนเงิน รายละเอียด และวันที่"] },
    { title: "ขออนุมัติรายจ่าย (FIN)", steps: ["ไปแท็บ 'อนุมัติ' → กด 'ยื่นขออนุมัติ'","กรอกวงเงินและเหตุผล","ระบบสร้างเลขที่ FIN-YYYY-XXX และส่งแจ้งเตือนผู้จัดการ"] },
  ]},
  { id: "aftersales", title: "ฝ่ายหลังการขาย", icon: Wrench, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20", topics: [
    { title: "รับแจ้งซ่อม", steps: ["ไปหน้า 'ออฟฟิศ' → แท็บ 'หลังการขาย'","กดปุ่ม 'แจ้งซ่อม' — กรอกชื่อลูกค้า แปลงบ้าน ประเภทปัญหา","มอบหมายช่าง และระบุวันนัดซ่อม","ระบบสร้างเลขที่ WR-YYYY-XXX อัตโนมัติ"] },
    { title: "อัปเดตสถานะเคส", steps: ["กดเคสที่ต้องการอัปเดต","เลือกสถานะ: รอดำเนินการ → กำลังดำเนินการ → เสร็จสิ้น","เมื่อปิดเคส ใส่คะแนนความพึงพอใจลูกค้า 1–5 ★"] },
    { title: "ดูสถิติเคส", steps: ["กดการ์ดสรุปด้านบน (ทั้งหมด / รอดำเนินการ / กำลังทำ / เสร็จสิ้น)","ดูรายละเอียดเคสในแต่ละสถานะ","คะแนน Satisfaction เฉลี่ยแสดงที่การ์ด 'เสร็จสิ้น'"] },
  ]},
  { id: "approvals", title: "ระบบอนุมัติ", icon: BookOpen, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20", topics: [
    { title: "ดูรายการรออนุมัติ", steps: ["กดไอคอน ✓ (BadgeCheck) มุมบนขวาของหน้าหลัก","หรือไปที่ /approvals โดยตรง","รายการแบ่งตามประเภท: งวดงาน / PO / FIN / เอกสาร / ลา"] },
    { title: "อนุมัติ / ปฏิเสธ", steps: ["กดรายการที่ต้องการดำเนินการ","กด 'อนุมัติ' เพื่อดำเนินการต่อ หรือ 'ปฏิเสธ' พร้อมระบุเหตุผล","ระบบอัปเดตสถานะในหน้าที่เกี่ยวข้องทันที"] },
  ]},
];

export default function ManualPage() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/settings" className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10"><ChevronLeft size={18} className="text-aviva-secondary" /></Link>
          <div className="flex items-center gap-2"><BookOpen size={18} className="text-aviva-gold" /><h1 className="text-lg font-bold text-aviva-text">คู่มือการใช้งาน</h1></div>
        </div>
      </div>
      <div className="px-4 py-6 max-w-lg mx-auto space-y-3">
        <GlassCard className="p-4"><p className="text-xs text-aviva-secondary">คู่มือการใช้งาน AVIVA ONE สำหรับผู้ปฏิบัติงานทุกฝ่าย กดหัวข้อเพื่อดูรายละเอียด</p></GlassCard>
        {sections.map((section) => {
          const Icon = section.icon;
          const isOpen = openSection === section.id;
          return (
            <GlassCard key={section.id} className={`overflow-hidden border ${isOpen ? section.bg : ""}`}>
              <button onClick={() => setOpenSection(isOpen ? null : section.id)} className="w-full flex items-center gap-3 p-4 hover:bg-aviva-gold/5 transition-all">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${section.bg}`}><Icon size={16} className={section.color} /></div>
                <p className="flex-1 text-sm font-semibold text-aviva-text text-left">{section.title}</p>
                {isOpen ? <ChevronDown size={16} className="text-aviva-secondary flex-shrink-0" /> : <ChevronRight size={16} className="text-aviva-secondary flex-shrink-0" />}
              </button>
              {isOpen && (
                <div className="border-t border-aviva-gold/10 divide-y divide-aviva-gold/5">
                  {section.topics.map((topic) => {
                    const topicKey = `${section.id}-${topic.title}`;
                    const topicOpen = openTopic === topicKey;
                    return (
                      <div key={topic.title}>
                        <button onClick={() => setOpenTopic(topicOpen ? null : topicKey)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-aviva-gold/5 transition-all">
                          <p className="text-xs font-medium text-aviva-text text-left">{topic.title}</p>
                          {topicOpen ? <ChevronDown size={13} className="text-aviva-secondary flex-shrink-0" /> : <ChevronRight size={13} className="text-aviva-secondary flex-shrink-0" />}
                        </button>
                        {topicOpen && (
                          <div className="px-4 pb-4 space-y-1.5">
                            {topic.steps.map((step, i) => (
                              <div key={i} className="flex gap-2.5 items-start">
                                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${section.bg} ${section.color}`}>{i + 1}</span>
                                <p className="text-xs text-aviva-secondary leading-relaxed pt-0.5">{step}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          );
        })}
        <GlassCard className="p-4">
          <p className="text-xs font-semibold text-aviva-text mb-2">ติดต่อขอความช่วยเหลือ</p>
          <ul className="space-y-1 text-xs text-aviva-secondary">
            <li>• หากพบปัญหาการใช้งาน — แจ้งหัวหน้าฝ่ายโดยตรง</li>
            <li>• ข้อมูลหาย / ระบบผิดพลาด — แจ้งผู้ดูแลระบบ Admin</li>
            <li>• ต้องการเพิ่มสิทธิ์ใช้งาน — ขออนุมัติผ่านผู้จัดการ</li>
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
