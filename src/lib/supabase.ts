import { createClient } from "@supabase/supabase-js";

// กัน build/runtime พังถ้า env หาย/ผิดรูป (เช่นลืมใส่ https://)
function normalizeUrl(raw: string | undefined): string {
  let u = (raw ?? "").trim();
  if (!u) return "https://placeholder.supabase.co";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u; // เติม protocol ให้อัตโนมัติ
  return u;
}

// ค่า default = โปรเจกต์ AVIVA PLUS (azstncqpwyrabwvcuxjf) — เป็นค่า public (anon key ป้องกันด้วย RLS อยู่แล้ว)
// ใช้เมื่อ build ไม่ได้ตั้ง env (เช่น deploy ครั้งแรก) เพื่อให้แอปต่อ DB จริงได้ทันที
const DEFAULT_SUPABASE_URL = "https://azstncqpwyrabwvcuxjf.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6c3RuY3Fwd3lyYWJ3dmN1eGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MjQ3MTEsImV4cCI6MjA5NjMwMDcxMX0.j0WiYyqcRHXr1au8xDMWWkQDY5filO5zmd2c_Bb319M";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const supabaseUrl = rawUrl ? normalizeUrl(rawUrl) : DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = "CEO" | "Director" | "Sales" | "Marketing" | "Engineer" | "Finance" | "Admin";

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}
