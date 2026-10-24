"use client";
// แถบแจ้งเมื่อมีเวอร์ชันใหม่ — ไม่รีโหลดเอง เพราะจะทำให้ข้อมูลที่กำลังพิมพ์หาย
// ให้ผู้ใช้กดเอง หรือกดปิดถ้ายังพิมพ์ไม่เสร็จ
import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { APP_VERSION } from "@/lib/version";

const CHECK_MS = 5 * 60 * 1000;

export default function VersionBanner() {
  // เก็บเวอร์ชันบนเซิร์ฟเวอร์ไว้ แล้วค่อยคำนวณว่าต้องโชว์ไหม
  // (setState ตรง ๆ ในตัว effect ผิดกฎ react-hooks/set-state-in-effect)
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const outdated = !!serverVersion && serverVersion !== APP_VERSION && serverVersion !== dismissed;

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { version?: string };
        if (!cancelled && j.version) setServerVersion(j.version);
      } catch {
        // ออฟไลน์/เน็ตหลุดชั่วคราว — ไม่ต้องทำอะไร รอบหน้าค่อยเช็คใหม่
      }
    };
    void check();
    const id = setInterval(() => void check(), CHECK_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  if (!outdated) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[70] px-3 pt-[env(safe-area-inset-top)]">
      <div className="mt-2 mx-auto max-w-md bg-aviva-gold text-aviva-bg rounded-xl shadow-lg px-3 py-2 flex items-center gap-2">
        <RefreshCw size={15} className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold leading-tight">มีเวอร์ชันใหม่ {serverVersion} แล้ว</p>
          <p className="text-[10px] leading-tight opacity-80">หน้าจอนี้ยังเป็น {APP_VERSION} — ของที่เพิ่งแก้จะยังใช้ไม่ได้จนกว่าจะโหลดใหม่</p>
        </div>
        <button onClick={() => window.location.reload()}
          className="text-[11px] font-bold bg-aviva-bg text-aviva-gold px-2.5 py-1 rounded-lg flex-shrink-0">
          โหลดใหม่
        </button>
        <button onClick={() => setDismissed(serverVersion)} aria-label="ปิดแถบแจ้งเตือน"
          className="flex-shrink-0 opacity-70">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
