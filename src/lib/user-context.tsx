"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { DEMO_MODE, DEMO_USER } from "./demo-data";
import { resolveRbac, type Rbac } from "./rbac";

export interface AppUser extends Rbac {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string;
  // legacy flags (เผื่อโค้ดเดิม) — อิงจากชั้นสิทธิ์ใหม่
  isAdmin: boolean;
  isManager: boolean;
  isProjectManager: boolean;
}

const UserContext = createContext<AppUser | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(DEMO_MODE ? DEMO_USER : null);

  function buildUser(u: { id: string; email?: string; user_metadata?: Record<string, string> }): AppUser {
    const meta = u.user_metadata ?? {};
    const rbac = resolveRbac(meta.role);
    return {
      id: u.id,
      email: u.email ?? "",
      full_name: meta.full_name ?? u.email ?? "ผู้ใช้",
      role: meta.role ?? "user",
      department: meta.department ?? "ฝ่ายบริหาร",
      ...rbac,
      isAdmin: rbac.tier === "exec",
      isManager: rbac.canApprove,
      isProjectManager: meta.role === "project_manager",
    };
  }

  useEffect(() => {
    if (DEMO_MODE) return; // โหมดเดโม: ใช้ผู้ใช้จำลอง ไม่ต้องเรียก Supabase auth
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) setUser(buildUser(u));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) setUser(buildUser(session.user));
      else setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(UserContext);
}
