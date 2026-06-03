"use client";
import { useState } from "react";
import { ChevronLeft, BookOpen, Home, TrendingUp, HardHat, Briefcase, Wrench, ChevronDown, ChevronRight, DollarSign, Megaphone, ClipboardList, GitMerge } from "lucide-react";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";

interface Topic { title: string; steps: string[] }
interface Section {
  id: string;
  title: string;
  icon: typeof Home;
  color: string;
  bg: string;
  topics: Topic[];
}

const sections: Section[] = [
  {
    id: "dashboard",
    title: "หน้าหลัก (Dashboard)",
    icon: Home,
    color: "text-aviva-gold",
    bg: "bg-aviva-gold/10 border-aviva-gold/20",
    topics: [
      { title: "ภาพรวมโครงการ", steps: [
        "การ์ด 'ยูนิตทั้งหมด / ขายแล้ว / ว่างอยู่' — กดเพื่อดูรายละเอียดแต่ละประเภท",
        "กราฟรายรับ-รายจ่ายรายเดือนแสดงใน 'ภาพรวมการเงิน' — เลือกดูช่วงเวลาต่างๆ",
        "กล่อง 'ก่อสร้าง' แสดงความคืบหน้าและงวดงานที่รออนุมัติ",
        "คลิกการ์ดใดก็ได้เพื่อดู Drill-down รายละเอียด",
      ]},
      { title: "AI Executive Insights", steps: [
        "กล่อง Insights วิเคราะห์สถานการณ์โครงการโดยอัตโนมัติ เช่น รายรับ vs เป้าหมาย, ความเร็วการขาย",
        "สีแดง = ต้องดำเนินการด่วน / สีเหลือง = ควรติดตาม / สีเขียว = ปกติ",
        "กดการ์ด Insight ที่มี link เพื่อไปหน้าที่เกี่ยวข้องโดยตรง",
      ]},
      { title: "AVIVA AI Chat", steps: [
        "กดกล่อง 'AVIVA AI Executive' ด้านบนเพื่อเปิดแชท",
        "ถามข้อมูลโครงการได้เลย เช่น 'ยอดขายเดือนนี้เท่าไร', 'มีงวดงานรออนุมัติกี่งวด'",
        "AI ดึงข้อมูลจากฐานข้อมูลจริงและตอบทันที",
        "ประวัติบทสนทนา 5 ข้อความล่าสุดถูกส่งเป็น context",
      ]},
      { title: "การแจ้งเตือน (กระดิ่ง)", steps: [
        "ไอคอนกระดิ่งมุมบนขวา — กดเพื่อดูการแจ้งเตือนทั้งหมด",
        "แจ้งเตือนเมื่อมีคำขออนุมัติใหม่, เอกสารสำคัญ, SLA ใกล้ครบกำหนด",
        "กดรายการแจ้งเตือนเพื่อไปหน้าที่เกี่ยวข้องโดยตรง",
      ]},
      { title: "ปฏิทินกิจกรรม", steps: [
        "เลื่อนลงด้านล่างของหน้าหลัก — เห็นปฏิทินรายเดือน",
        "กดวันที่เพื่อเพิ่มกิจกรรม ระบุฝ่าย ประเภท รายละเอียด",
        "ทำเครื่องหมาย ✓ Done เมื่อกิจกรรมเสร็จสิ้น",
        "กิจกรรมข้ามฝ่าย (เช่น ประชุมทีม) เห็นได้ทุกคนตามฝ่ายที่เลือก",
      ]},
    ],
  },
  {
    id: "crm",
    title: "ฝ่ายขาย (CRM)",
    icon: TrendingUp,
    color: "text-green-400",
    bg: "bg-green-400/10 border-green-400/20",
    topics: [
      { title: "เพิ่ม Lead ใหม่", steps: [
        "ไปหน้า CRM → กดปุ่ม '+' หรือ 'เพิ่ม Lead'",
        "กรอกชื่อ เบอร์โทร อีเมล งบประมาณ แหล่งที่มา และสถานะเริ่มต้น",
        "กด 'บันทึก' — ระบบสร้างโปรไฟล์ลูกค้าใหม่และ AI Score อัตโนมัติ",
        "ประสานงานกับฝ่ายการตลาด หาก Lead มาจากแคมเปญโฆษณา",
      ]},
      { title: "อัปเดตสถานะลูกค้า", steps: [
        "กดชื่อลูกค้าในรายการ Leads",
        "เลือกสถานะ: New → Contacted → Interested → Site Visit → Booking → Closed Deal",
        "เมื่อสถานะเป็น 'Booking' — ระบุแปลงที่จอง และส่งขออนุมัติเงินจอง (BOOK-XXXX)",
        "เมื่อสถานะเป็น 'Closed Deal' — ส่งสัญญาซื้อขายขออนุมัติ (CONTRACT-XXXX)",
        "เมื่ออนุมัติแล้ว ระบบจะออกเอกสารในดรรชนีเอกสารอัตโนมัติ",
      ]},
      { title: "แผนผังโครงการ", steps: [
        "กดแท็บ 'แผนผัง' — เห็นแปลงทั้ง 31 แปลงพร้อมสีสถานะ",
        "สีทอง = จอง/ขายแล้ว / สีขาว = ว่าง / สีแดง = ล่าช้า",
        "กดแปลงเพื่อดูรายละเอียด ลูกค้า และ progress ก่อสร้าง",
        "ข้อมูลแปลงเชื่อมตรงกับฝ่ายก่อสร้าง — ความคืบหน้าอัปเดต Real-time",
      ]},
      { title: "พิมพ์เอกสาร", steps: [
        "กดลูกค้าที่สถานะ Booking ขึ้นไป → กด 'พิมพ์ใบเสนอราคา' หรือ 'พิมพ์ใบจอง'",
        "เอกสารเปิดในหน้าใหม่พร้อม print — ตรวจสอบข้อมูลก่อนพิมพ์",
        "เลขที่ใบจอง (BOOK-XXXX) ถูกสร้างอัตโนมัติก่อนส่งขออนุมัติ",
        "สำเนาเอกสารเก็บในดรรชนีเอกสารหลังผ่านการอนุมัติ",
      ]},
      { title: "บันทึกกิจกรรมรายวัน (ทีมขาย)", steps: [
        "ไปแท็บ 'ทีมงาน' → กดปุ่ม 'บันทึกกิจกรรม'",
        "เลือกประเภท: รับลูกค้า / โทรหาลูกค้า / นัดหมาย / โอนกรรมสิทธิ์",
        "กรอกรายละเอียด ชื่อลูกค้า และผลลัพธ์",
        "ยอดสรุปรายบุคคลแสดงใน 'teamStats' — close rate, booking, revenue",
      ]},
      { title: "ประสานงานกับฝ่ายก่อสร้าง", steps: [
        "เมื่อลูกค้า Closed Deal — แจ้งฝ่ายก่อสร้างหมายเลขแปลงและวันส่งมอบที่คาด",
        "ติดตามความคืบหน้าก่อสร้างผ่านหน้า Dashboard (กล่อง 'ก่อสร้าง')",
        "ประสานวันโอนกรรมสิทธิ์กับฝ่ายก่อสร้างและฝ่ายการเงิน",
      ]},
    ],
  },
  {
    id: "construction",
    title: "ฝ่ายก่อสร้าง",
    icon: HardHat,
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/20",
    topics: [
      { title: "ตรวจงวดงาน", steps: [
        "ไปหน้า 'ก่อสร้าง' → กดยูนิตที่ต้องการตรวจ",
        "กด 'ตรวจงวดงาน' → เห็น Checklist 10 งวดตามสัญญา",
        "ทำเครื่องหมาย ✓ ผ่าน หรือ ✗ ไม่ผ่าน พร้อมหมายเหตุแต่ละรายการ",
        "กดปุ่มกล้องเพื่อแนบรูปถ่ายหน้างาน (อัปโหลดทันที)",
        "ตรวจสอบครบทุกรายการก่อนส่งเบิก",
      ]},
      { title: "ส่งเบิกงวดงาน (INST-XXXX)", steps: [
        "หลังตรวจผ่านครบทุกรายการ — กดปุ่ม 'ส่งเบิก'",
        "ระบบสร้างเลขที่ INST-YYMM-NNN อัตโนมัติ เช่น INST-2606-001",
        "คำขอส่งไปยังผู้จัดการ/ผู้บริหารเพื่ออนุมัติใน /approvals",
        "เมื่ออนุมัติแล้ว ระบบออกเอกสาร INST-XXXX ในดรรชนีเอกสารอัตโนมัติ",
        "ฝ่ายการเงินรับเอกสารเพื่อจ่ายเงินผู้รับเหมา",
      ]},
      { title: "จัดซื้อวัสดุ (PO-XXXX)", steps: [
        "กดปุ่ม 'ยื่น PO' ในหน้าก่อสร้าง",
        "กรอกรายการวัสดุ จำนวน ราคา ผู้ขาย และวันที่ต้องการ",
        "ส่งขออนุมัติ — ระบบสร้างเลข PO-YYMM-NNN อัตโนมัติ",
        "ผู้จัดการเห็นคำขอใน /approvals และอนุมัติ/ปฏิเสธ",
        "เมื่ออนุมัติ ระบบออกเอกสาร PO-XXXX และแจ้งฝ่ายการเงินอัตโนมัติ",
      ]},
      { title: "รายงานรายวัน", steps: [
        "กด 'บันทึกรายงานประจำวัน' ในหน้าก่อสร้าง",
        "กรอกงานที่ทำวันนี้ ความคืบหน้า (%) ปัญหาที่พบ",
        "ส่งรายงานก่อน 18:00 น. ทุกวัน",
        "กด 'พิมพ์รายงาน' เพื่อ export เป็น PDF สำหรับส่งผู้รับเหมา",
      ]},
      { title: "ประสานงานกับฝ่ายการเงิน", steps: [
        "เมื่อ PO อนุมัติแล้ว — ฝ่ายการเงินจะเห็นรายการในดรรชนีเอกสารโดยอัตโนมัติ",
        "เมื่อ INST อนุมัติแล้ว — ฝ่ายการเงินจ่ายเงินให้ผู้รับเหมา",
        "ติดตามสถานะการจ่ายเงินผ่านหน้าอนุมัติ (แท็บ 'งวดงาน')",
      ]},
      { title: "ประสานงานกับฝ่ายขาย", steps: [
        "รับข้อมูลแปลงที่ขายแล้วจากฝ่ายขาย (ผ่าน Dashboard)",
        "อัปเดตความคืบหน้า % ของแต่ละแปลงในหน้าก่อสร้าง",
        "แจ้งฝ่ายขายเมื่อบ้านพร้อมส่งมอบ เพื่อนัดหมายลูกค้า",
      ]},
    ],
  },
  {
    id: "finance",
    title: "ฝ่ายการเงิน / บัญชี",
    icon: DollarSign,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10 border-yellow-400/20",
    topics: [
      { title: "ขออนุมัติรายจ่าย (FIN-XXXX)", steps: [
        "ไปหน้า Office → แท็บ 'การเงิน' → กด 'ขออนุมัติรายจ่าย'",
        "กรอกประเภทรายจ่าย วงเงิน เหตุผล และแนบเอกสารประกอบ",
        "ระบบสร้างเลข FIN-YYMM-NNN อัตโนมัติและส่งขออนุมัติ",
        "เมื่ออนุมัติ ระบบบันทึก finance_transaction และออกเอกสาร FIN-XXXX อัตโนมัติ",
        "วงเงิน > 50,000 บาท ต้องผ่านการอนุมัติ 2 ชั้น (Maker-Checker)",
      ]},
      { title: "บันทึกรายรับ-รายจ่าย", steps: [
        "ไปแท็บ 'การเงิน' → 'บันทึกรายการ'",
        "เลือกประเภท: รายรับ (income) / รายจ่าย (expense)",
        "กรอกจำนวนเงิน รายละเอียด วันที่ และหมวดหมู่",
        "กด 'บันทึก' — ข้อมูลอัปเดตในกราฟ Dashboard ทันที",
      ]},
      { title: "จ่ายเงินผู้รับเหมา (งวดงาน)", steps: [
        "ตรวจสอบรายการ INST-XXXX ที่อนุมัติแล้วในดรรชนีเอกสาร",
        "บันทึกการจ่ายเงินเป็น receipt_type='expense' พร้อมอ้างอิงเลข INST-XXXX",
        "อัปเดตสถานะงวดงานเป็น 'paid' ในหน้าก่อสร้าง",
        "เก็บหลักฐานการโอนเงินในระบบเอกสาร",
      ]},
      { title: "รายงานการเงินประจำเดือน", steps: [
        "Dashboard หน้าหลัก → กล่อง 'ภาพรวมการเงิน' → ดูกราฟรายเดือน",
        "กด 'Export CSV' ในหน้า /approvals → แท็บ 'เอกสาร' เพื่อดาวน์โหลดรายการทั้งหมด",
        "รายงาน Revenue vs Target ดูได้ที่กล่อง 'รายรับจริง vs เป้าหมาย'",
        "นำข้อมูลไปจัดทำรายงานสรุปประจำเดือนให้ผู้บริหาร",
      ]},
      { title: "ประสานงานกับฝ่ายก่อสร้าง", steps: [
        "รับ PO ที่อนุมัติแล้วจากดรรชนีเอกสาร (หมวด 'จัดซื้อวัสดุ')",
        "รับ INST ที่อนุมัติแล้ว และจ่ายเงินให้ผู้รับเหมาตามงวด",
        "แจ้งสถานะการชำระเงินกลับไปยังฝ่ายก่อสร้าง",
      ]},
    ],
  },
  {
    id: "marketing",
    title: "ฝ่ายการตลาด",
    icon: Megaphone,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10 border-cyan-400/20",
    topics: [
      { title: "ขออนุมัติงบการตลาด (MKTG-XXXX)", steps: [
        "ไปหน้า Office → แท็บ 'การตลาด' หรือ 'เอกสาร' → กด 'ยื่นขอ MKTG'",
        "กรอกชื่อแคมเปญ วัตถุประสงค์ งบประมาณ ช่วงเวลา",
        "ระบบสร้างเลข MKTG-YYMM-NNN อัตโนมัติและส่งขออนุมัติ",
        "เมื่ออนุมัติ ระบบออกเอกสาร MKTG-XXXX อัตโนมัติ",
      ]},
      { title: "บันทึกกิจกรรมการตลาด", steps: [
        "กด 'บันทึกกิจกรรม' → ระบุประเภท: โฆษณา / Event / Social Media / Open House",
        "กรอกงบที่ใช้จริง จำนวน Lead ที่ได้ ช่องทาง",
        "ข้อมูล Lead เชื่อมกับฝ่ายขาย — ติดตามได้ใน CRM",
      ]},
      { title: "วิเคราะห์ Lead จากแคมเปญ", steps: [
        "ดูรายงาน Lead ใน CRM → กรองตาม 'แหล่งที่มา'",
        "เปรียบเทียบ Lead ที่ได้ vs งบที่ใช้ต่อแคมเปญ",
        "ส่งสรุปผลแคมเปญให้ฝ่ายขายและผู้บริหาร",
      ]},
      { title: "ประสานงานกับฝ่ายขาย", steps: [
        "แจ้งฝ่ายขายล่วงหน้าเมื่อมี Open House หรือ Event เพื่อเตรียมทีม",
        "รับ Feedback จากฝ่ายขายเรื่องคุณภาพ Lead เพื่อปรับแคมเปญ",
        "ประสานกำหนดการ Site Visit กับฝ่ายขาย",
      ]},
    ],
  },
  {
    id: "office",
    title: "ฝ่ายออฟฟิศ / HR",
    icon: Briefcase,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
    topics: [
      { title: "บริหารเอกสาร (DOC-XXXX)", steps: [
        "ไปหน้า Office → แท็บ 'เอกสาร'",
        "กด 'เพิ่มเอกสาร' → กรอกชื่อ หมวด รายละเอียด",
        "ระบบสร้างเลขที่ DOC-YYMM-NNN อัตโนมัติ",
        "ส่งขออนุมัติ → เมื่ออนุมัติ status เปลี่ยนเป็น 'approved' อัตโนมัติ",
        "ดรรชนีเอกสารทั้งหมดดูได้ที่ Settings → 'ดรรชนีเอกสาร'",
      ]},
      { title: "จัดการพนักงาน", steps: [
        "แท็บ 'บุคคล' → 'พนักงาน' — เพิ่ม/แก้ไขข้อมูลพนักงาน",
        "กรอก ชื่อ ตำแหน่ง แผนก เงินเดือน วันเริ่มงาน",
        "กด 'ออก Payslip' เพื่อพิมพ์สลิปเงินเดือนรายบุคคล",
      ]},
      { title: "ขอลา (LEAVE-XXXX)", steps: [
        "พนักงานทุกฝ่าย: ไปหน้า Office → แท็บ 'บุคคล' → 'ขอลา'",
        "กรอกประเภทลา วันที่ เหตุผล",
        "ระบบสร้างเลข LEAVE-YYMM-NNN อัตโนมัติและส่งให้ HR/ผู้จัดการ",
        "เมื่ออนุมัติ ระบบออกเอกสาร LEAVE-XXXX และอัปเดตสถานะอัตโนมัติ",
      ]},
      { title: "บันทึกรายรับ-รายจ่าย (ออฟฟิศ)", steps: [
        "แท็บ 'การเงิน' → 'บันทึกรายการ'",
        "เลือกประเภทและกรอกข้อมูล ข้อมูลจะแสดงในกราฟ Dashboard ทันที",
        "ค่าใช้จ่ายสำนักงานทั่วไปบันทึกที่นี่ (ไม่ต้องขออนุมัติ FIN)",
      ]},
      { title: "ประสานงาน HR กับทุกฝ่าย", steps: [
        "รับใบขอลาจากทุกฝ่ายผ่านระบบ (LEAVE-XXXX) — ไม่ต้องใช้กระดาษ",
        "ออก Payslip ประจำเดือนและส่งให้ฝ่ายการเงินเพื่อโอนเงินเดือน",
        "อัปเดตข้อมูลพนักงานใหม่และพนักงานออกทันทีในระบบ",
      ]},
    ],
  },
  {
    id: "aftersales",
    title: "ฝ่ายหลังการขาย",
    icon: Wrench,
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/20",
    topics: [
      { title: "รับแจ้งซ่อม (WR-XXXX)", steps: [
        "ไปหน้า Office → แท็บ 'หลังการขาย' → กด 'แจ้งซ่อม'",
        "กรอกชื่อลูกค้า แปลง/ยูนิต ประเภทปัญหา อาการ",
        "ระบบสร้างเลข WR-YYMM-NNN อัตโนมัติ",
        "มอบหมายช่าง ระบุวันนัดซ่อม กด 'บันทึก'",
        "ลูกค้าได้รับหมายเลข WR เพื่อติดตามสถานะ",
      ]},
      { title: "อัปเดตสถานะเคส", steps: [
        "กดเคสที่ต้องการ → เลือกสถานะ: รอดำเนินการ → กำลังดำเนินการ → เสร็จสิ้น",
        "บันทึกรายละเอียดงานซ่อมและวัสดุที่ใช้",
        "เมื่อปิดเคส — ใส่คะแนนความพึงพอใจลูกค้า 1–5 ★",
        "กด 'บันทึก' — คะแนนเฉลี่ยแสดงในการ์ด 'เสร็จสิ้น'",
      ]},
      { title: "ดูสถิติเคส", steps: [
        "กดการ์ดสรุปด้านบน: ทั้งหมด / รอดำเนินการ / กำลังทำ / เสร็จสิ้น",
        "ดูรายละเอียดเคสแต่ละสถานะและช่างที่รับผิดชอบ",
        "คะแนน Satisfaction เฉลี่ยแสดงในการ์ด 'เสร็จสิ้น'",
      ]},
      { title: "ประสานงานกับฝ่ายก่อสร้าง", steps: [
        "เมื่อปัญหาซ่อมต้องใช้ผู้รับเหมา — ประสานกับฝ่ายก่อสร้างผ่านแชทหรือ Event ในปฏิทิน",
        "แนบรูปถ่ายปัญหา (WR record) ให้ช่างก่อสร้างดูก่อนไปซ่อม",
        "อัปเดตสถานะเคสเมื่อฝ่ายก่อสร้างซ่อมเสร็จ",
      ]},
    ],
  },
  {
    id: "approvals",
    title: "ระบบอนุมัติ",
    icon: BookOpen,
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
    topics: [
      { title: "ดูรายการรออนุมัติ", steps: [
        "กดไอคอน BadgeCheck (✓) มุมบนขวาของ Dashboard หรือไปที่ /approvals",
        "แท็บ 'รออนุมัติ' แสดงทุกคำขอที่ยังรอการดำเนินการ",
        "รายการแบ่งตามประเภท พร้อม SLA กำหนดเวลาอนุมัติ",
        "รายการที่เกิน SLA จะแสดงสีแดงและ Pulse animation",
      ]},
      { title: "อนุมัติ / ปฏิเสธ", steps: [
        "กด 'ดูรายละเอียด' เพื่อดูข้อมูลเต็มรูปแบบก่อนตัดสินใจ",
        "กด 'อนุมัติ' — ระบบอัปเดตสถานะต้นทางและออกเอกสารอัตโนมัติ",
        "กด 'ปฏิเสธ' — ต้องระบุเหตุผลก่อนยืนยัน (บังคับ)",
        "ผู้ส่งคำขอจะได้รับแจ้งเตือนทันทีทั้งอนุมัติและปฏิเสธ",
      ]},
      { title: "เอกสารที่ออกอัตโนมัติหลังอนุมัติ", steps: [
        "INST-XXXX (งวดงาน) → สถานะก่อสร้างอัปเดต + เอกสารออกใน Documents",
        "PO-XXXX (จัดซื้อ) → สถานะ PO อัปเดต + เอกสารออก + แจ้งฝ่ายการเงิน",
        "FIN-XXXX (รายจ่าย) → บันทึก finance_transaction + เอกสารออก",
        "BOOK-XXXX (จอง) → สถานะลูกค้าเปลี่ยนเป็น Booking + เอกสารออก",
        "CONTRACT-XXXX (สัญญา) → สถานะลูกค้าเปลี่ยนเป็น Closed Deal + เอกสารออก",
        "LEAVE-XXXX (ลา) → สถานะการลาอัปเดต + เอกสารออก",
        "MKTG-XXXX (งบการตลาด) → เอกสารออกในดรรชนี",
      ]},
      { title: "SLA การอนุมัติ", steps: [
        "งวดงาน (INST): SLA 3 วันทำงาน",
        "จัดซื้อ (PO): SLA 3 วันทำงาน",
        "ขออนุมัติรายจ่าย (FIN): SLA 2 วันทำงาน",
        "ขอลา (LEAVE): SLA 1 วันทำงาน",
        "วงเงิน > 50,000 บาท ต้องผ่าน 2 ชั้น (ผู้จัดการ + ผู้บริหาร)",
        "ระบบแจ้งเตือนเมื่อ SLA ใกล้ครบและเมื่อเกินกำหนด",
      ]},
      { title: "ดูทะเบียนเอกสารทั้งหมด", steps: [
        "แท็บ 'เอกสาร' ใน /approvals — ค้นหา กรองตามประเภทและสถานะ",
        "Export CSV เพื่อนำไปรายงานหรือวิเคราะห์เพิ่มเติม",
        "ดูประวัติการอนุมัติ ผู้อนุมัติ วันที่ และเหตุผลปฏิเสธ",
      ]},
    ],
  },
  {
    id: "dailyreport",
    title: "รายงานประจำวัน",
    icon: ClipboardList,
    color: "text-teal-400",
    bg: "bg-teal-400/10 border-teal-400/20",
    topics: [
      { title: "พนักงานทุกฝ่าย — ส่งรายงานประจำวัน", steps: [
        "Dashboard → กด Link 'รายงานประจำวัน' ในกล่อง Insights (แสดงเมื่อ 17:00+)",
        "หรือไปที่ /reports โดยตรง",
        "กรอกสิ่งที่ทำวันนี้ ปัญหาที่พบ และแผนงานวันพรุ่งนี้",
        "กด 'ส่งรายงาน' ก่อน 18:00 น. ทุกวัน",
        "ผู้จัดการเห็นรายงานของทีมใน /reports",
      ]},
      { title: "ฝ่ายก่อสร้าง — รายงานหน้างาน", steps: [
        "ไปหน้า 'ก่อสร้าง' → กด 'บันทึกรายงานประจำวัน'",
        "กรอกงานที่ทำ ความคืบหน้า (%) ปัญหา จำนวนแรงงาน",
        "แนบรูปถ่ายหน้างานประกอบรายงาน",
        "กด 'พิมพ์รายงาน' เพื่อส่งผู้รับเหมา",
      ]},
      { title: "ฝ่ายขาย — กิจกรรมรายวัน", steps: [
        "CRM → แท็บ 'ทีมงาน' → 'บันทึกกิจกรรม'",
        "เลือกประเภทกิจกรรม กรอกรายละเอียดผลลัพธ์",
        "ยอดสรุปรายบุคคลคำนวณอัตโนมัติ (close rate, booking, revenue)",
      ]},
    ],
  },
  {
    id: "crossdept",
    title: "การประสานงานข้ามฝ่าย",
    icon: GitMerge,
    color: "text-pink-400",
    bg: "bg-pink-400/10 border-pink-400/20",
    topics: [
      { title: "Flow: ขาย → ก่อสร้าง → การเงิน", steps: [
        "1. ฝ่ายขาย: ปิดการขาย (Closed Deal) → แจ้งแปลงและวันส่งมอบให้ฝ่ายก่อสร้าง",
        "2. ฝ่ายก่อสร้าง: รับแปลง อัปเดตความคืบหน้า → ส่งเบิก INST-XXXX เมื่อครบงวด",
        "3. ผู้บริหาร: อนุมัติ INST ใน /approvals",
        "4. ระบบ: ออกเอกสาร INST-XXXX อัตโนมัติและแจ้งฝ่ายการเงิน",
        "5. ฝ่ายการเงิน: รับเอกสาร INST → จ่ายเงินให้ผู้รับเหมา",
      ]},
      { title: "Flow: จัดซื้อ (PO)", steps: [
        "1. ฝ่ายก่อสร้าง: ยื่น PO-XXXX ในระบบ",
        "2. ผู้จัดการ: อนุมัติ PO ใน /approvals",
        "3. ระบบ: ออกเอกสาร PO-XXXX อัตโนมัติ",
        "4. ฝ่ายการเงิน: เห็น PO ที่อนุมัติในดรรชนีเอกสาร (หมวด 'จัดซื้อวัสดุ') → จ่ายเงิน",
        "5. ฝ่ายก่อสร้าง: รับวัสดุ อัปเดตรายงานหน้างาน",
      ]},
      { title: "Flow: ซ่อมแซม (Warranty)", steps: [
        "1. ลูกค้าแจ้งซ่อม → ฝ่ายหลังการขายรับเรื่อง ออกเลข WR-XXXX",
        "2. ฝ่ายหลังการขาย: ประสานกับฝ่ายก่อสร้างหรือช่างประจำโครงการ",
        "3. ฝ่ายก่อสร้าง: ดำเนินการซ่อม อัปเดตสถานะ",
        "4. ฝ่ายหลังการขาย: ปิดเคส บันทึกความพึงพอใจ",
        "5. ฝ่ายการเงิน: บันทึกค่าใช้จ่ายซ่อมแซม (ถ้ามี)",
      ]},
      { title: "Flow: ขอลา (Leave)", steps: [
        "1. พนักงานทุกฝ่าย: กรอกขอลาในระบบ → ออกเลข LEAVE-XXXX อัตโนมัติ",
        "2. ผู้จัดการ/HR: อนุมัติหรือปฏิเสธใน /approvals",
        "3. ระบบ: แจ้งพนักงานและออกเอกสาร LEAVE-XXXX",
        "4. HR: เห็นประวัติการลาทั้งหมดใน Office → แท็บ 'บุคคล'",
      ]},
      { title: "Flow: การตลาด → ขาย", steps: [
        "1. ฝ่ายการตลาด: ขออนุมัติงบ MKTG-XXXX → ผู้บริหารอนุมัติ",
        "2. ฝ่ายการตลาด: จัดแคมเปญ / Open House / โฆษณา",
        "3. Lead ใหม่เข้าระบบ → ฝ่ายขายรับ Lead ใน CRM",
        "4. ฝ่ายขาย: ติดตาม Lead → สรุป Conversion Rate ให้ฝ่ายการตลาดรายเดือน",
      ]},
      { title: "ปฏิทินและการประชุม", steps: [
        "ปฏิทิน Dashboard — ทุกฝ่ายเห็นกิจกรรมร่วมกัน",
        "เพิ่มประชุมทีมข้ามฝ่าย พร้อมระบุฝ่ายที่เข้าร่วม",
        "รายงานการประชุม (มติ/การบ้าน) บันทึกใน Office → 'เอกสาร'",
        "ติดตามงานที่ได้รับมอบหมายผ่านปฏิทิน (Checkbox Done)",
      ]},
    ],
  },
];

export default function ManualPage() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/settings" className="p-2 rounded-xl bg-aviva-card border border-aviva-gold/10">
            <ChevronLeft size={18} className="text-aviva-secondary" />
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-aviva-gold" />
            <h1 className="text-lg font-bold text-aviva-text">คู่มือการใช้งาน</h1>
          </div>
        </div>
      </div>
      <div className="px-4 py-6 max-w-lg mx-auto space-y-3">
        <GlassCard className="p-4">
          <p className="text-xs text-aviva-secondary">
            คู่มือการใช้งาน AVIVA ONE ครบทุกฝ่าย — กดหัวข้อเพื่อดูรายละเอียดขั้นตอนการทำงานและการประสานงานข้ามฝ่าย
          </p>
        </GlassCard>
        {sections.map((section) => {
          const Icon = section.icon;
          const isOpen = openSection === section.id;
          return (
            <GlassCard key={section.id} className={`overflow-hidden border ${isOpen ? section.bg : ""}`}>
              <button
                onClick={() => setOpenSection(isOpen ? null : section.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-aviva-gold/5 transition-all"
              >
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${section.bg}`}>
                  <Icon size={16} className={section.color} />
                </div>
                <p className="flex-1 text-sm font-semibold text-aviva-text text-left">{section.title}</p>
                {isOpen
                  ? <ChevronDown size={16} className="text-aviva-secondary flex-shrink-0" />
                  : <ChevronRight size={16} className="text-aviva-secondary flex-shrink-0" />}
              </button>
              {isOpen && (
                <div className="border-t border-aviva-gold/10 divide-y divide-aviva-gold/5">
                  {section.topics.map((topic) => {
                    const topicKey = `${section.id}-${topic.title}`;
                    const topicOpen = openTopic === topicKey;
                    return (
                      <div key={topic.title}>
                        <button
                          onClick={() => setOpenTopic(topicOpen ? null : topicKey)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-aviva-gold/5 transition-all"
                        >
                          <p className="text-xs font-medium text-aviva-text text-left">{topic.title}</p>
                          {topicOpen
                            ? <ChevronDown size={13} className="text-aviva-secondary flex-shrink-0" />
                            : <ChevronRight size={13} className="text-aviva-secondary flex-shrink-0" />}
                        </button>
                        {topicOpen && (
                          <div className="px-4 pb-4 space-y-1.5">
                            {topic.steps.map((step, i) => (
                              <div key={i} className="flex gap-2.5 items-start">
                                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${section.bg} ${section.color}`}>
                                  {i + 1}
                                </span>
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
          <p className="text-xs font-semibold text-aviva-text mb-2">รหัสเอกสารมาตรฐาน</p>
          <div className="grid grid-cols-2 gap-1.5 text-[10px] text-aviva-secondary">
            {[
              ["FIN-YYMM-NNN", "ขออนุมัติรายจ่าย"],
              ["PO-YYMM-NNN", "ใบสั่งซื้อวัสดุ"],
              ["INST-YYMM-NNN", "เบิกงวดงาน"],
              ["DOC-YYMM-NNN", "เอกสารทั่วไป"],
              ["LEAVE-YYMM-NNN", "ขออนุมัติลา"],
              ["BOOK-YYMM-NNN", "จองแปลง"],
              ["CONTRACT-YYMM-NNN", "สัญญาซื้อขาย"],
              ["MKTG-YYMM-NNN", "งบการตลาด"],
              ["WR-YYMM-NNN", "แจ้งซ่อม/ประกัน"],
            ].map(([code, desc]) => (
              <div key={code} className="flex flex-col">
                <span className="font-mono text-aviva-gold font-bold text-[9px]">{code}</span>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </GlassCard>
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
