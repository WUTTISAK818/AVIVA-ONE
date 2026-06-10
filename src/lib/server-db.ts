import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Supabase client ฝั่งเซิร์ฟเวอร์สำหรับ API routes:
 * - ถ้ามี SUPABASE_SERVICE_ROLE_KEY ใน env → ใช้ service role (ข้าม RLS)
 * - ถ้าไม่มี (เช่นยังไม่ได้ตั้งใน Vercel) → ใช้สิทธิ์ของผู้ใช้ที่ล็อกอินผ่าน access token
 *   (RLS policy ของตารางที่เกี่ยวข้องเปิดให้ role authenticated แล้ว — ดู migration v473)
 * ทำให้ระบบ AI ทำงานได้ครบโดยไม่ต้องพึ่ง ENV ลับใน Vercel เลย
 */
export function serverDb(accessToken?: string | null): SupabaseClient {
  if (SERVICE_KEY) {
    return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}
