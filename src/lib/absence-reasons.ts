// เหตุผลที่ไม่ได้ส่งรายงานประจำวัน — ตัวเลือกมาตรฐาน (Pom สั่ง 27 ต.ค. 69)
//
// ทำไมต้องเป็นตัวเลือก ไม่ใช่พิมพ์เอง:
//   ดูคำชี้แจงจริง 6 ครั้งแรกในระบบ — 5 ใน 6 เป็นเรื่องวันหยุดทั้งนั้น แต่เขียนคนละแบบ
//     "วันหยุด" · "วันหยุด" · "วันหยุดตามปฏิทินบริษัท (วันปิยมหาราช)"
//     "สลับวันหยุดจาก วันอาทิตย์ ที่ 11/10/69 มาใช้ วันพุธ ที่ 21/10/69"
//     "ใช้วันหยุดนักขัตฤกต์เลื่อนมาใช้ก่อน"
//   → เป็นข้อความอิสระ จึงนับไม่ได้ สรุปไม่ได้ และตรวจไม่ได้ว่าสลับวันหยุดไปใช้วันไหน
//   พอเป็นตัวเลือก: พนักงานกดทีเดียวจบ (ไม่ต้องพิมพ์) และผู้บริหารเห็นภาพรวมได้ว่า
//   เดือนนี้ขาดส่งเพราะวันหยุดกี่ครั้ง เพราะลืมกี่ครั้ง

export interface AbsenceReason {
  key: string;
  label: string;
  icon: string;
  /** ต้องระบุ "วันหยุดเดิมที่สลับมา" ด้วย */
  needsSwapDate?: boolean;
  /** ต้องพิมพ์รายละเอียดเพิ่ม ห้ามปล่อยว่าง */
  needsNote?: boolean;
}

export const ABSENCE_REASONS: AbsenceReason[] = [
  { key: "weekly_off", label: "วันหยุดประจำสัปดาห์ของฉัน", icon: "🌴" },
  { key: "swapped_off", label: "สลับวันหยุด", icon: "🔄", needsSwapDate: true },
  { key: "public_holiday", label: "วันหยุดบริษัท / นักขัตฤกษ์", icon: "🎌" },
  { key: "leave", label: "ลา (ป่วย / กิจ / พักร้อน)", icon: "📝", needsNote: true },
  { key: "no_signal", label: "ไปต่างจังหวัด ไม่มีสัญญาณ", icon: "📵" },
  { key: "forgot", label: "ลืมส่ง", icon: "😅" },
  { key: "other", label: "อื่น ๆ", icon: "✏️", needsNote: true },
];

export function absenceReasonOf(key: string | null | undefined): AbsenceReason | null {
  return ABSENCE_REASONS.find((r) => r.key === key) ?? null;
}

/** ป้ายสั้น ๆ ไว้แสดงในรายการ — เคสเก่าที่ไม่มีประเภทจะขึ้นว่า "ชี้แจงแบบเดิม" */
export function absenceReasonLabel(key: string | null | undefined): string {
  const r = absenceReasonOf(key);
  return r ? `${r.icon} ${r.label}` : "✏️ ชี้แจงแบบเดิม";
}

/** เหตุผลกลุ่ม "หยุดตามสิทธิ์" — ไม่ควรนับเป็นความบกพร่องตอนประเมิน */
export const ENTITLED_OFF_REASONS = ["weekly_off", "swapped_off", "public_holiday", "leave"];

export function isEntitledOff(key: string | null | undefined): boolean {
  return !!key && ENTITLED_OFF_REASONS.includes(key);
}

export interface ExplanationDraft {
  reasonType: string;
  note: string;
  swapFromDate: string;
}

/** ตรวจว่าคำชี้แจงกรอกครบพอที่จะส่งได้หรือยัง — ใช้ทั้งฝั่งปุ่มและฝั่งบันทึก */
export function validateExplanation(d: ExplanationDraft): string | null {
  const reason = absenceReasonOf(d.reasonType);
  if (!reason) return "กรุณาเลือกเหตุผลก่อน";
  if (reason.needsSwapDate && !d.swapFromDate) return "กรุณาระบุวันหยุดเดิมที่สลับมา";
  if (reason.needsNote && !d.note.trim()) return `เลือก "${reason.label}" แล้ว ต้องเขียนรายละเอียดเพิ่มด้วย`;
  return null;
}

/** ข้อความที่เก็บลงช่อง explanation — ให้อ่านรู้เรื่องทั้งในแอปและในแจ้งเตือน LINE */
export function composeExplanation(d: ExplanationDraft): string {
  const reason = absenceReasonOf(d.reasonType);
  if (!reason) return d.note.trim();
  const parts = [reason.label];
  if (reason.needsSwapDate && d.swapFromDate) {
    const th = new Date(d.swapFromDate + "T12:00:00Z")
      .toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
    parts.push(`(สลับมาจากวันหยุดเดิม ${th})`);
  }
  if (d.note.trim()) parts.push(`— ${d.note.trim()}`);
  return parts.join(" ");
}
