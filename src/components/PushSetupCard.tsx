"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { useCurrentUser } from "@/lib/user-context";
import { pushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push-subscribe";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export default function PushSetupCard() {
  const user = useCurrentUser();
  const [supported] = useState<boolean>(() => pushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((s) => setSubscribed(!!s))
      .catch(() => {});
  }, []);

  async function enable() {
    if (!user) return;
    setBusy(true); setMsg(null);
    const r = await subscribeToPush({ email: user.email, role: user.role, department: user.department });
    setBusy(false);
    if (r.ok) { setSubscribed(true); setMsg("เปิดการแจ้งเตือนแล้ว"); }
    else if (r.reason === "denied") setMsg("เบราว์เซอร์ปฏิเสธสิทธิ์แจ้งเตือน");
    else if (r.reason === "no-vapid-key") setMsg("ระบบยังไม่ตั้งค่า VAPID key");
    else setMsg("เปิดไม่สำเร็จ: " + (r.reason ?? ""));
  }

  async function disable() {
    setBusy(true); setMsg(null);
    await unsubscribeFromPush();
    setBusy(false); setSubscribed(false); setMsg("ปิดการแจ้งเตือนแล้ว");
  }

  if (!supported) {
    return (
      <GlassCard className="p-4">
        <div className="flex items-center gap-3">
          <Smartphone size={18} className="text-aviva-gold" />
          <div className="text-sm text-aviva-secondary">
            {isIos() && !isStandalone()
              ? "บน iPhone: กดแชร์ → เพิ่มไปยังหน้าจอโฮม (Add to Home Screen) ก่อน จึงจะเปิดแจ้งเตือนได้"
              : "อุปกรณ์นี้ไม่รองรับการแจ้งเตือนแบบ push"}
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {subscribed ? <Bell size={18} className="text-green-400" /> : <BellOff size={18} className="text-aviva-secondary" />}
          <div>
            <div className="text-sm font-medium text-aviva-text">การแจ้งเตือนบนอุปกรณ์ (Web Push)</div>
            <div className="text-xs text-aviva-secondary">{subscribed ? "เปิดอยู่" : "ปิดอยู่"}</div>
          </div>
        </div>
        <button
          onClick={subscribed ? disable : enable}
          disabled={busy}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border border-aviva-gold/30 bg-aviva-gold/10 text-aviva-gold disabled:opacity-50"
        >
          {busy ? "..." : subscribed ? "ปิด" : "เปิด"}
        </button>
      </div>
      {msg && <div className="mt-2 text-xs text-aviva-secondary">{msg}</div>}
    </GlassCard>
  );
}
