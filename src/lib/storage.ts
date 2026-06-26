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

  // Try to extract bucket and path from URL
  const m = stored.match(/\/storage\/v1\/object\/(?:public\/|sign\/)?([^/?]+)\/(.+?)(?:\?|$)/);
  if (!m) {
    // Not a storage URL; could be a public URL, external link, or bare path
    console.log("[toSignedUrl] Not a storage URL:", stored.substring(0, 50));
    return stored;
  }

  const bucket = m[1];
  const path = decodeURIComponent(m[2]);
  console.log("[toSignedUrl] Creating signed URL:", { bucket, path: path.substring(0, 50) });

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (error) {
    console.error("[toSignedUrl] Error creating signed URL:", error.message, { bucket, path: path.substring(0, 50) });
    return stored; // Return original URL on error
  }

  if (data?.signedUrl) {
    // Cache the signed URL with expiration time
    signedUrlCache.set(cacheKey, {
      signedUrl: data.signedUrl,
      expiresAt: Date.now() + (expiresIn * 1000 * 0.9), // Cache for 90% of expiry time
    });
    console.log("[toSignedUrl] Created signed URL successfully");
    return data.signedUrl;
  }

  console.warn("[toSignedUrl] No signed URL returned but no error either");
  return stored;
}
