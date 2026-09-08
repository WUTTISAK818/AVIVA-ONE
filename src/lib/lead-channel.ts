// จัดกลุ่มช่องทางที่มาของลูกค้า (จาก leads.source) เป็น 4 กลุ่ม — ใช้ร่วมกันทั้ง cron sales-lead-digest และรายงานประจำเดือน/ช่วงเวลา
export const CHANNEL_ORDER = ["วอล์กอิน", "Facebook", "LINE", "อื่นๆ"] as const;
export type LeadChannel = (typeof CHANNEL_ORDER)[number];

export function channelBucket(source: string | null | undefined): LeadChannel {
  const s = (source ?? "").toLowerCase();
  if (!s) return "อื่นๆ";
  if (s.includes("walk-in") || s.includes("walkin") || s.includes("วอล์กอิน") || s.includes("วอล์คอิน")) return "วอล์กอิน";
  if (s.includes("facebook")) return "Facebook";
  if (s.includes("line")) return "LINE";
  return "อื่นๆ";
}
