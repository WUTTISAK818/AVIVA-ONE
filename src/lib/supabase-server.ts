import "server-only";
import { createClient } from "@supabase/supabase-js";

// ใส่ fallback แบบเดียวกับ supabase.ts — กัน createClient() throw ตอน build (เมื่อ env ยังไม่ถูก inject)
// ทำให้ next build รวบรวม page data ของ route ที่ใช้ supabaseAdmin ได้โดยไม่ล้ม
// ตอน runtime บน Vercel จะได้ env จริง; ถ้าขาด จะ fail แบบ request error ไม่ใช่ build error
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-role-key";

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function getAuthUserFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}
