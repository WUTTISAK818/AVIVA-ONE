import { supabase } from "./supabase";
import { compressImage } from "./image-compress";

// อัปโหลดรูป/ไฟล์หลายไฟล์เข้า bucket แล้วคืน public URL array (เรียงตามลำดับไฟล์ที่ส่งเข้ามา)
// มาตรฐานทีม (docs/QA-STANDARD.md ส่วน D): จำกัดชนิดไฟล์ (รูป/PDF) + ขนาด ≤10MB
// และ "ห้ามข้ามไฟล์พลาดเงียบ" — รายงานชื่อไฟล์ที่ไม่ผ่านผ่าน opts.onFail ให้ผู้เรียกแจ้งผู้ใช้

const MAX_SIZE_MB = 10;
const ALLOWED = (f: File) => f.type.startsWith("image/") || f.type === "application/pdf";

export interface UploadOpts {
  compress?: boolean;
  /** เรียกเมื่อมีไฟล์ไม่ผ่าน (ชนิดผิด/ใหญ่เกิน/อัปโหลดพลาด) — ส่งรายชื่อ+เหตุผลให้แจ้งผู้ใช้ */
  onFail?: (failures: { name: string; reason: string }[]) => void;
}

export async function uploadPhotos(
  bucket: string,
  pathPrefix: string,
  files: File[],
  opts: UploadOpts = {}
): Promise<string[]> {
  const compress = opts.compress ?? true;
  const urls: string[] = [];
  const failures: { name: string; reason: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!ALLOWED(file)) {
      failures.push({ name: file.name, reason: "รองรับเฉพาะรูปภาพหรือ PDF" });
      continue;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      failures.push({ name: file.name, reason: `ไฟล์ใหญ่เกิน ${MAX_SIZE_MB}MB` });
      continue;
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${pathPrefix}-${Date.now()}-${i}.${ext}`;
    const body = compress && file.type.startsWith("image/") ? await compressImage(file) : file;
    const { error } = await supabase.storage.from(bucket).upload(path, body, { upsert: true });
    if (error) {
      failures.push({ name: file.name, reason: "อัปโหลดไม่สำเร็จ (ลองใหม่อีกครั้ง)" });
    } else {
      urls.push(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl);
    }
  }

  if (failures.length) opts.onFail?.(failures);
  return urls;
}

/** ข้อความสรุปไฟล์ที่พลาด สำหรับโชว์ใน toast/alert */
export function uploadFailText(failures: { name: string; reason: string }[]): string {
  return `ไฟล์ ${failures.length} รายการไม่ถูกแนบ: ` + failures.map(f => `${f.name} (${f.reason})`).join(" · ");
}
