import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * อ่านค่าตั้งค่าฝั่งเซิร์ฟเวอร์: ใช้ env ก่อน (แนะนำ) ถ้าไม่มีค่อย fallback
 * ไปอ่านจากตาราง app_settings (ตั้งผ่านฐานข้อมูลได้โดยไม่ต้องแตะ Vercel).
 * ถ้าไม่มี SUPABASE_SERVICE_ROLE_KEY ใน env ให้ใช้ access token ของผู้ใช้
 * ที่ล็อกอินแทน (RLS เปิดให้ authenticated อ่าน app_settings — migration v473).
 * cache สั้นๆ 30 วินาที กัน query ถี่.
 */
let cache: Record<string, { v: string | undefined; at: number }> = {};

/** ล้าง cache หลังอัปเดตค่า (เช่นตั้ง key ใหม่จากหน้า settings) ให้ค่าใหม่มีผลทันที */
export function clearSettingCache(key?: string) {
  if (key) delete cache[key];
  else cache = {};
}

async function readSetting(key: string, accessToken?: string): Promise<string | undefined> {
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        // ไม่มี service role → แนบ token ผู้ใช้เพื่อผ่าน RLS (role authenticated)
        global: !process.env.SUPABASE_SERVICE_ROLE_KEY && accessToken
          ? { headers: { Authorization: `Bearer ${accessToken}` } }
          : undefined,
      },
    );
    const { data } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
    return (data?.value as string | undefined) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function getSetting(
  key: string,
  envValue?: string,
  accessToken?: string,
): Promise<string | undefined> {
  if (envValue) return envValue;
  const hit = cache[key];
  // cache เฉพาะค่าที่อ่านเจอ — ถ้าครั้งก่อนอ่านไม่เจอ (เช่นไม่มี token) ให้ลองใหม่
  if (hit && hit.v && Date.now() - hit.at < 30_000) return hit.v;
  const v = await readSetting(key, accessToken);
  cache[key] = { v, at: Date.now() };
  return v;
}
