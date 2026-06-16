"use client";
// ดักจับ JS error / unhandled promise rejection จากเครื่องผู้ใช้จริง → เก็บลง client_errors
// ใช้ไล่หาเหตุการ crash ที่เกิดเฉพาะบางเครื่อง (best-effort, ไม่รบกวนผู้ใช้)
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const APP_VERSION = "5.63";

export default function ErrorLogger() {
  useEffect(() => {
    let sent = 0;
    let email: string | null = null;
    supabase.auth.getUser().then(({ data }) => { email = data.user?.email ?? null; }).catch(() => {});

    const record = (message: unknown, stack: unknown, source: string) => {
      if (sent >= 8) return; // กันสแปม
      sent++;
      try {
        supabase.from("client_errors").insert({
          message: String(message ?? "").slice(0, 600),
          stack: String(stack ?? "").slice(0, 3000),
          source,
          page_url: typeof location !== "undefined" ? location.href : null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          app_version: APP_VERSION,
          user_email: email,
        }).then(() => {}, () => {});
      } catch { /* best-effort */ }
    };

    const onError = (e: ErrorEvent) => record(e.message, e.error?.stack ?? `${e.filename}:${e.lineno}:${e.colno}`, "error");
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | undefined;
      record(r?.message ?? e.reason, r?.stack, "unhandledrejection");
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
