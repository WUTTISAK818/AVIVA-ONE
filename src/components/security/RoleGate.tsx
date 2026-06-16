"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/user-context";

export type Persona = "admin" | "manager" | "guard" | "resident";

function userHasPersona(user: { isAdmin: boolean; isManager: boolean; isGuard: boolean; isResident: boolean }, p: Persona) {
  switch (p) {
    case "admin":    return user.isAdmin;
    case "manager":  return user.isManager;
    case "guard":    return user.isGuard;
    case "resident": return user.isResident;
  }
}

export default function RoleGate({
  personas,
  fallback = "/dashboard",
  children,
}: {
  personas: Persona[];
  fallback?: string;
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const router = useRouter();

  const allowed = user ? personas.some(p => userHasPersona(user, p)) : false;

  useEffect(() => {
    if (user && !allowed) router.replace(fallback);
  }, [user, allowed, fallback, router]);

  if (!user) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" />
      </div>
    );
  }
  if (!allowed) return null;
  return <>{children}</>;
}
