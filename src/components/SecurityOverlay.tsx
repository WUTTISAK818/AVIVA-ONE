"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { isSessionCurrent, logAccess, clearLocalSid } from "@/lib/security";

// ลายน้ำระบุตัวตน + กัน copy/คลิกขวา + คุมเซสชันเดียว
export default function SecurityOverlay() {
  const user = useCurrentUser();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  // เวลาบนลายน้ำ (อัปเดตทุก 1 นาที)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  // กัน copy / คลิกขวา / ลากเลือก (ยกเว้นช่องกรอก) — เป็นตัวยับยั้ง ไม่ใช่กันเด็ดขาด
  useEffect(() => {
    const inField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(t.tagName);
    const block = (e: Event) => { if (!inField(e.target)) e.preventDefault(); };
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("selectstart", block);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("selectstart", block);
    };
  }, []);

  // คุมเซสชันเดียว: ถ้าถูกล็อกอินที่อื่น -> เตะออก
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const check = async () => {
      const ok = await isSessionCurrent(user.id);
      if (!alive || ok) return;
      await logAccess("session_kick");
      clearLocalSid();
      await supabase.auth.signOut();
      router.replace("/login?kicked=1");
    };
    const t = setInterval(check, 45_000);
    check();
    return () => { alive = false; clearInterval(t); };
  }, [user, router]);

  const wm = useMemo(() => {
    if (!user) return null;
    const d = new Date(now);
    const time = d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
    const line = `${user.full_name || user.email} · ${time}`;
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='340' height='200'>` +
      `<text x='10' y='100' transform='rotate(-28 170 100)' fill='rgba(30,58,95,0.06)' font-size='15' font-family='sans-serif'>${line.replace(/[<>&]/g, "")}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [user, now]);

  if (!user || !wm) return null;
  return <div aria-hidden className="fixed inset-0 z-[9998] pointer-events-none select-none" style={{ backgroundImage: wm, backgroundRepeat: "repeat" }} />;
}
