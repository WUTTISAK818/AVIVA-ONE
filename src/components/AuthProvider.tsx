"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  const isPublicRoute = pathname === "/login" || pathname.startsWith("/v/");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !isPublicRoute) {
        router.replace("/login");
      }
      setChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !isPublicRoute) {
        router.replace("/login");
      }
      if (event === "SIGNED_IN" && pathname === "/login") {
        router.replace("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router, isPublicRoute]);

  if (!checked && !isPublicRoute) {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
