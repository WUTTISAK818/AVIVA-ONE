"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { isSuperRole, isManagerRole } from "./roles";

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string;
  isAdmin: boolean;
  isManager: boolean;
  isProjectManager: boolean;
}

const UserContext = createContext<AppUser | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);

  function buildUser(u: { id: string; email?: string; user_metadata?: Record<string, string>; app_metadata?: Record<string, string> }): AppUser {
    const um = u.user_metadata ?? {};
    // app_metadata เขียนได้เฉพาะ service_role (ผู้ใช้แก้ไม่ได้) -> ใช้เป็นแหล่ง role/department ที่เชื่อถือได้
    // fallback user_metadata เผื่อ session เก่าที่ JWT ยังไม่มี app_metadata (จะหายเองหลัง re-login)
    const am = u.app_metadata ?? {};
    const role = am.role ?? um.role ?? "user";
    const department = am.department ?? um.department ?? "ฝ่ายบริหาร";
    return {
      id: u.id,
      email: u.email ?? "",
      full_name: um.full_name ?? u.email ?? "ผู้ใช้",
      role,
      department,
      isAdmin: isSuperRole(role),
      isManager: isManagerRole(role),
      isProjectManager: role === "project_manager",
    };
  }

  useEffect(() => {
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
