"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string;
  isAdmin: boolean;
  isManager: boolean;
}

const UserContext = createContext<AppUser | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);

  function buildUser(u: { id: string; email?: string; user_metadata?: Record<string, string> }): AppUser {
    const meta = u.user_metadata ?? {};
    return {
      id: u.id,
      email: u.email ?? "",
      full_name: meta.full_name ?? u.email ?? "ผู้ใช้",
      role: meta.role ?? "user",
      department: meta.department ?? "ฝ่ายบริหาร",
      isAdmin: meta.role === "admin",
      isManager: meta.role === "admin" || meta.role === "manager",
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
