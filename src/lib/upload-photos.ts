import { supabase } from "./supabase";
import { compressImage } from "./image-compress";

// อัปโหลดรูป/ไฟล์หลายไฟล์เข้า bucket แล้วคืน public URL array (เรียงตามลำดับไฟล์ที่ส่งเข้ามา)
// ใช้กับฟอร์มที่รองรับการแนบหลายรูปพร้อมกัน — บีบอัดรูปฝั่ง client ก่อนอัป (PDF/ไฟล์อื่นปล่อยผ่าน)
// ไฟล์ไหนอัปไม่สำเร็จจะข้าม (ไม่บล็อกทั้งชุด) — ผลลัพธ์คือเฉพาะ URL ที่อัปสำเร็จ
export async function uploadPhotos(
  bucket: string,
  pathPrefix: string,
  files: File[],
  opts: { compress?: boolean } = {}
): Promise<string[]> {
  const compress = opts.compress ?? true;
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${pathPrefix}-${Date.now()}-${i}.${ext}`;
    const body = compress ? await compressImage(file) : file;
    const { error } = await supabase.storage.from(bucket).upload(path, body, { upsert: true });
    if (!error) {
      urls.push(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl);
    }
  }
  return urls;
}
