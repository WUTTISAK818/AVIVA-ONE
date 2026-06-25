import { supabase } from "./supabase";

// In-memory cache for signed URLs — prevents redundant API calls
// Key: "url:expiresIn", Value: { signedUrl, expiresAt }
const signedUrlCache = new Map<string, { signedUrl: string; expiresAt: number }>();

// แปลงค่า file_url ที่เก็บไว้ (รูปแบบ public URL หรือ path) เป็น signed URL
// ใช้กับ private bucket — ถ้าไม่ใช่ supabase storage URL จะคืนค่าเดิม
// หมายเหตุ: createSignedUrl ทำงานได้ทั้ง bucket public และ private จึงเรียกได้เสมอ
// ปรับปรุง: เพิ่ม in-memory cache เพื่อลด API calls
export async function toSignedUrl(
  stored: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!stored) return null;

  // Check cache first
  const cacheKey = `${stored}:${expiresIn}`;
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.signedUrl;
  }

  const m = stored.match(/\/storage\/v1\/object\/(?:public\/|sign\/)?([^/?]+)\/(.+?)(?:\?|$)/);
  if (!m) return stored; // ไม่ใช่ URL ของ supabase storage (เช่นลิงก์ภายนอก) — คืนเดิม
  const bucket = m[1];
  const path = decodeURIComponent(m[2]);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (!error && data?.signedUrl) {
    // Cache the signed URL with expiration time
    signedUrlCache.set(cacheKey, {
      signedUrl: data.signedUrl,
      expiresAt: Date.now() + (expiresIn * 1000 * 0.9), // Cache for 90% of expiry time
    });
    return data.signedUrl;
  }

  return error ? stored : (data?.signedUrl ?? stored);
}
