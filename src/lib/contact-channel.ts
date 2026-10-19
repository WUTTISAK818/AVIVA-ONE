// ช่องทางติดต่อลูกค้า — แหล่งความจริงเดียว ใช้ร่วมกันทั้ง CRM, คิวติดตาม และ cron เตือนฝ่ายขาย
//
// ปัญหาที่แก้ (Pom แจ้ง 9 ต.ค. 69): ลูกค้า 155 จาก 329 ราย (47%) ไม่มีเบอร์ที่ใช้ได้
// 103 รายใส่ "099-999-9999" แทน เพราะฟอร์มบังคับให้กรอกเบอร์ แต่ลูกค้าทักมาทาง Messenger
// แล้วไม่ให้เบอร์ · อีก 52 รายเว้นว่าง · ทั้งฐานข้อมูลไม่มีอีเมลและ LINE id สักราย
//
// ผลคือคิวติดตามบอกให้ "โทรหา" ลูกค้าที่โทรไม่ได้ และไม่มีใครรู้ว่าต้องไปทักที่ไหนแทน

/** เบอร์ที่ฝ่ายขายใช้แทน "ไม่มีเบอร์" — ไม่ใช่เบอร์จริง ห้ามเอาไปโทรหรือส่ง SMS */
const PLACEHOLDER_DIGITS = "0999999999";

/** ข้อความที่ใช้แทนเบอร์ เมื่อลูกค้าไม่ให้เบอร์ติดต่อ (Pom สั่ง 15 ต.ค. 69 ให้เลิกใช้ 099-999-9999)
 *  เก็บเป็นข้อความจริงในคอลัมน์ phone ไม่ใช่เบอร์ปลอม -> ไม่มีใครเผลอโทรหรือส่ง SMS ได้ */
export const NO_PHONE_LABEL = "ไม่ให้เบอร์ติดต่อ";

export type ContactChannel =
  | "phone" | "facebook" | "line" | "instagram" | "tiktok" | "email" | "walk_in";

export const CONTACT_CHANNELS: { value: ContactChannel; label: string; icon: string; /** สิ่งที่ต้องกรอกในช่อง handle */ placeholder: string }[] = [
  { value: "phone",     label: "โทรศัพท์",   icon: "📞", placeholder: "เบอร์ติดต่อ" },
  { value: "facebook",  label: "Facebook",   icon: "💬", placeholder: "ชื่อโปรไฟล์ หรือลิงก์ Messenger" },
  { value: "line",      label: "LINE",       icon: "💚", placeholder: "ชื่อที่แสดงใน LINE หรือ LINE ID" },
  { value: "instagram", label: "Instagram",  icon: "📷", placeholder: "@username" },
  { value: "tiktok",    label: "TikTok",     icon: "🎵", placeholder: "@username" },
  { value: "email",     label: "อีเมล",      icon: "✉️", placeholder: "อีเมล" },
  { value: "walk_in",   label: "มาที่โครงการ", icon: "🏠", placeholder: "นัดเจอที่ไหน/เมื่อไหร่" },
];

const BY_VALUE = new Map(CONTACT_CHANNELS.map((c) => [c.value, c]));

/** true เมื่อเบอร์นี้เป็นค่าแทน "ไม่มีเบอร์" ไม่ใช่เบอร์ที่โทรได้จริง
 *  รับทั้งแบบเก่า (099-999-9999) และแบบใหม่ (ข้อความ "ไม่ให้เบอร์ติดต่อ") */
export function isPlaceholderPhone(phone: string | null | undefined): boolean {
  return (phone ?? "").trim() === NO_PHONE_LABEL || digitsOf(phone) === PLACEHOLDER_DIGITS;
}

/** แปลงค่าที่พิมพ์ในช่อง "เบอร์โทร" ให้เป็นค่าที่เก็บได้
 *  - พิมพ์ 099-999-9999 (ค่าแทน "ไม่มีเบอร์") -> เก็บเป็นข้อความ "ไม่ให้เบอร์ติดต่อ" แทน
 *    กันเบอร์ปลอมกลับเข้าฐานข้อมูลอีก (CRM-0621 ถูกแก้กลับมาเป็น 099-999-9999 หลังล้างรอบแรก)
 *  - ข้อความ "ไม่ให้เบอร์ติดต่อ" ที่มีอยู่แล้ว -> คงไว้ ไม่ถูกตัดทิ้งเพราะไม่มีตัวเลข
 *  - เบอร์ปกติ -> จัดรูปแบบ xxx-xxx-xxxx */
export function normalizePhoneInput(v: string | null | undefined): string {
  const raw = (v ?? "").trim();
  if (raw === NO_PHONE_LABEL) return NO_PHONE_LABEL;
  const d = digitsOf(raw).slice(0, 10);
  if (d === PLACEHOLDER_DIGITS) return NO_PHONE_LABEL;
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join("-");
}

/** ข้อความที่แสดงแทนเบอร์บนหน้าจอ ใช้ที่เดิมเคยพิมพ์ lead.phone ตรง ๆ (ซึ่งโชว์ว่างเปล่าเมื่อไม่มีเบอร์)
 *  แยก 2 กรณีให้ชัด เพราะเป็นข้อเท็จจริงต่างกัน:
 *  - "ไม่ให้เบอร์ติดต่อ" = ถามแล้ว ลูกค้าไม่ให้
 *  - "ยังไม่มีเบอร์"     = ยังไม่มีใครกรอก (อาจมีเบอร์อยู่แต่ยังไม่ได้ลงระบบ) */
export function phoneDisplay(phone: string | null | undefined): string {
  if (isUsablePhone(phone)) return (phone ?? "").trim();
  return isPlaceholderPhone(phone) ? NO_PHONE_LABEL : "ยังไม่มีเบอร์";
}

/** ค่าที่พิมพ์ลงเอกสาร (ใบเสนอราคา/สัญญา/ใบแจ้งหนี้) — เบอร์จริง หรือ "-"
 *  ห้ามพิมพ์ประโยค "ไม่ให้เบอร์ติดต่อ" ลงช่องเบอร์โทรในสัญญา */
export function phoneForDocument(phone: string | null | undefined): string {
  return isUsablePhone(phone) ? (phone ?? "").trim() : "-";
}

/** true เมื่อเบอร์นี้โทรได้จริง (ไม่ว่าง ไม่ใช่ค่าแทน และยาวพอเป็นเบอร์ไทย) */
export function isUsablePhone(phone: string | null | undefined): boolean {
  const d = digitsOf(phone);
  return d.length >= 9 && d !== PLACEHOLDER_DIGITS;
}

function digitsOf(phone: string | null | undefined): string {
  return (phone ?? "").replace(/[^0-9]/g, "");
}

export interface ContactSource {
  phone?: string | null;
  contact_channel?: string | null;
  contact_handle?: string | null;
  source?: string | null;
}

export interface ContactPlan {
  channel: ContactChannel | null;
  label: string;
  icon: string;
  /** ชื่อ/เบอร์/ลิงก์ที่ใช้ติดต่อ — null เมื่อยังไม่มีใครกรอก */
  handle: string | null;
  /** ประโยคสั่งงานตรง ๆ ว่าต้องทำอะไร ใช้ได้ทั้งบนหน้าจอและในข้อความ LINE */
  instruction: string;
  /** true เมื่อยังติดต่อไม่ได้ ต้องไปตามหาช่องทางก่อนถึงจะติดตามได้ */
  unreachable: boolean;
}

/** บอกว่าลูกค้ารายนี้ต้องติดตามทางไหนและด้วยอะไร
 *  ใช้แทนการสมมติว่า "มีเบอร์ = โทรได้" ซึ่งผิดกับลูกค้าออนไลน์เกือบครึ่งฐานข้อมูล */
export function contactPlan(lead: ContactSource): ContactPlan {
  const explicit = (lead.contact_channel ?? "").trim() as ContactChannel;
  const meta = BY_VALUE.get(explicit);
  const handle = (lead.contact_handle ?? "").trim() || null;

  // ช่องทางคือโทรศัพท์ (ระบุไว้ หรือไม่ได้ระบุแต่มีเบอร์จริง) -> โทรได้
  if ((meta?.value === "phone" || !meta) && isUsablePhone(lead.phone)) {
    return {
      channel: "phone", label: "โทรศัพท์", icon: "📞",
      handle: (lead.phone ?? "").trim(),
      instruction: `โทรหา ${(lead.phone ?? "").trim()}`,
      unreachable: false,
    };
  }

  if (meta && meta.value !== "phone") {
    return {
      channel: meta.value, label: meta.label, icon: meta.icon, handle,
      instruction: handle
        ? `ทักกลับทาง ${meta.label}: ${handle}`
        : `ทักกลับทาง ${meta.label} — ยังไม่ได้บันทึกชื่อผู้ติดต่อ ให้เปิดแชต${meta.label}หาลูกค้ารายนี้ แล้วกรอกชื่อไว้ในระบบด้วย`,
      unreachable: false,
    };
  }

  // ไม่มีช่องทาง และเบอร์ใช้ไม่ได้
  const why = isPlaceholderPhone(lead.phone)
    ? "ลูกค้าไม่ได้ให้เบอร์ติดต่อไว้ (ในระบบบันทึกว่า “ไม่ให้เบอร์ติดต่อ”) โทรไม่ได้"
    : "ยังไม่มีเบอร์ติดต่อในระบบ";
  const hint = lead.source ? ` ลูกค้ามาจาก “${lead.source}” ลองหาแชตเดิมในช่องทางนั้น` : "";
  return {
    channel: null, label: "ยังติดต่อไม่ได้", icon: "⚠️", handle: null,
    instruction: `${why}${hint} — เปิด CRM แล้วกรอก “ช่องทางติดต่อ” ให้ลูกค้ารายนี้ก่อน`,
    unreachable: true,
  };
}

/** ข้อความสั้นสำหรับแสดงแทนเบอร์บนการ์ด/รายการ (ไม่โชว์เบอร์ปลอมให้เข้าใจผิดว่าโทรได้) */
export function contactLine(lead: ContactSource): string {
  const p = contactPlan(lead);
  if (p.channel === "phone") return `${p.icon} ${p.handle}`;
  if (p.unreachable) return `${p.icon} ยังไม่มีช่องทางติดต่อ`;
  return `${p.icon} ${p.label}${p.handle ? `: ${p.handle}` : " (ยังไม่ได้กรอกชื่อผู้ติดต่อ)"}`;
}
