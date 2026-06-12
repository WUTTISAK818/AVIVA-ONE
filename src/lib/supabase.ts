import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

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

// ---------------------------------------------------------------------------
// Phase 1+2 server clients
// ---------------------------------------------------------------------------

// Wrap fetch with an 8-second timeout so SSR pages never hang indefinitely.
function fetchWithTimeout(timeout = 8000) {
  return (url: RequestInfo | URL, options?: RequestInit) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
  };
}

const clientOpts = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout(8000),
  },
} as const;

// Read-only client (anon key). Used by Server Components for data fetching.
export const getSupabase = cache(() => createClient(supabaseUrl, supabaseAnonKey, clientOpts));

// Write client for Route Handlers. Prefers the service-role key when present
// in .env.local (bypasses RLS); otherwise falls back to the anon key, in which
// case the Phase-2 RLS policies (see supabase/migrations) must be applied.
// Never import this into a Client Component — it stays server-side only.
export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey;
  return createClient(supabaseUrl, key, clientOpts);
}
