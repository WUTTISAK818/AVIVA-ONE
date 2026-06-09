import { createClient } from "@supabase/supabase-js";

// Placeholder fallbacks keep `createClient` from throwing during `next build`
// prerendering when secrets are absent (local/CI). Real env vars are injected
// at runtime in production, so the browser/runtime client uses real credentials.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = "CEO" | "Director" | "Sales" | "Marketing" | "Engineer" | "Finance" | "Admin";

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}
