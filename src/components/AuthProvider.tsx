"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && pathname !== "/login") {
        router.replace("/login");
      }
      setChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && pathname !== "/login") {
        router.replace("/login");
      }
      if (event === "SIGNED_IN" && pathname === "/login") {
        router.replace("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  if (!checked && pathname !== "/login") {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
