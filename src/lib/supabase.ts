import { createClient } from "@supabase/supabase-js";

// ค่า public เริ่มต้นของ WinVote (publishable anon key — ปลอดภัยตามดีไซน์ ป้องกันด้วย RLS)
// ถ้าตั้ง env ไว้จะใช้ env ก่อน ไม่งั้น fallback เป็นค่าจริง เพื่อให้ deploy ทำงานได้ทันทีโดยไม่ต้องตั้ง env
const WINVOTE_URL = "https://gfnelofmgzqfwvlbaabd.supabase.co";
const WINVOTE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbmVsb2ZtZ3pxZnd2bGJhYWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzEwMDAsImV4cCI6MjA5NjE0NzAwMH0.zpAG-5MorIEhBjd21V5XTl6snJ_RWDewV9jqR0NfyOQ";

// กัน build/runtime พังถ้า env หาย/ผิดรูป (เช่นลืมใส่ https://)
function normalizeUrl(raw: string | undefined): string {
  let u = (raw ?? "").trim();
  if (!u) return WINVOTE_URL;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u; // เติม protocol ให้อัตโนมัติ
  return u;
}

const supabaseUrl = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() || WINVOTE_ANON;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = "CEO" | "Director" | "Sales" | "Marketing" | "Engineer" | "Finance" | "Admin";

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}
