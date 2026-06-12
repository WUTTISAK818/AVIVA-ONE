import { supabase } from "./supabase";

// แปลงค่า file_url ที่เก็บไว้ (รูปแบบ public URL หรือ path) เป็น signed URL
// ใช้กับ private bucket — ถ้าไม่ใช่ supabase storage URL จะคืนค่าเดิม
// หมายเหตุ: createSignedUrl ทำงานได้ทั้ง bucket public และ private จึงเรียกได้เสมอ
export async function toSignedUrl(
  stored: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!stored) return null;
  const m = stored.match(/\/storage\/v1\/object\/(?:public\/|sign\/)?([^/?]+)\/(.+?)(?:\?|$)/);
  if (!m) return stored; // ไม่ใช่ URL ของ supabase storage (เช่นลิงก์ภายนอก) — คืนเดิม
  const bucket = m[1];
  const path = decodeURIComponent(m[2]);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return error ? stored : (data?.signedUrl ?? stored);
}
