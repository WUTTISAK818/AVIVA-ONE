import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * อ่านค่าตั้งค่าฝั่งเซิร์ฟเวอร์: ใช้ env ก่อน (แนะนำ) ถ้าไม่มีค่อย fallback
 * ไปอ่านจากตาราง app_settings (ตั้งผ่านฐานข้อมูลได้โดยไม่ต้องแตะ Vercel).
 * cache สั้นๆ 30 วินาที กัน query ถี่.
 */
let cache: Record<string, { v: string | undefined; at: number }> = {};

export async function getSetting(key: string, envValue?: string): Promise<string | undefined> {
  if (envValue) return envValue;
  const hit = cache[key];
  if (hit && Date.now() - hit.at < 30_000) return hit.v;
  let v: string | undefined;
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
    v = (data?.value as string | undefined) ?? undefined;
  } catch {
    v = undefined;
  }
  cache[key] = { v, at: Date.now() };
  return v;
}
