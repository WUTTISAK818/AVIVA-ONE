import { createClient } from "@supabase/supabase-js";

// กัน build/runtime พังถ้า env หาย/ผิดรูป (เช่นลืมใส่ https://)
function normalizeUrl(raw: string | undefined): string {
  let u = (raw ?? "").trim();
  if (!u) return "https://placeholder.supabase.co";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u; // เติม protocol ให้อัตโนมัติ
  return u;
}

const supabaseUrl = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() || "public-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = "CEO" | "Director" | "Sales" | "Marketing" | "Engineer" | "Finance" | "Admin";

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}
