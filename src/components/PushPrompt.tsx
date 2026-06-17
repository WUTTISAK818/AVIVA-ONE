"use client";
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { pushSupported, subscribeToPush } from "@/lib/push-subscribe";

const SNOOZE_KEY = "aviva-push-prompt-snooze";
const SNOOZE_DAYS = 3;

// แบนเนอร์เด้งเตือนให้ "เปิดการแจ้งเตือนบนมือถือ" อัตโนมัติหลังล็อกอิน
// แสดงเมื่อ: รองรับ push + ล็อกอินแล้ว + ยังไม่ subscribe + ยังไม่ได้กดภายหลัง (snooze)
export default function PushPrompt() {
  const user = useCurrentUser();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !pushSupported()) return;
    const snoozed = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (Date.now() < snoozed) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((s) => { if (!s) setShow(true); })
      .catch(() => {});
  }, [user]);

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000));
    setShow(false);
  };

  const enable = async () => {
    if (!user) return;
    setBusy(true); setMsg(null);
    const r = await subscribeToPush({ email: user.email, role: user.role, department: user.department });
    setBusy(false);
    if (r.ok) { setMsg("เปิดการแจ้งเตือนแล้ว ✓"); setTimeout(() => setShow(false), 1200); }
    else if (r.reason === "denied") { setMsg("เบราว์เซอร์ปฏิเสธสิทธิ์ — เปิดได้ภายหลังที่ ตั้งค่า"); snooze(); }
    else if (r.reason === "no-vapid-key") { setShow(false); } // ระบบยังไม่ตั้ง VAPID — ไม่รบกวนผู้ใช้
    else setMsg("เปิดไม่สำเร็จ ลองใหม่ที่หน้า ตั้งค่า");
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md">
      <div className="rounded-2xl border border-aviva-gold/30 bg-aviva-card/95 backdrop-blur-sm shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-aviva-gold/15 flex items-center justify-center flex-shrink-0">
            <Bell size={18} className="text-aviva-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-aviva-text">เปิดการแจ้งเตือนบนมือถือ</p>
            <p className="text-xs text-aviva-secondary mt-0.5">รับงานรออนุมัติ/ทวงถาม/อัปเดต เข้ามือถือทันที ไม่พลาดงาน</p>
            {msg && <p className="text-xs text-aviva-gold mt-1.5">{msg}</p>}
            <div className="flex items-center gap-2 mt-2.5">
              <button onClick={enable} disabled={busy}
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-aviva-gold text-black disabled:opacity-50">
                {busy ? "กำลังเปิด…" : "เปิดแจ้งเตือน"}
              </button>
              <button onClick={snooze} className="text-xs font-medium px-3 py-1.5 rounded-full border border-aviva-gold/20 text-aviva-secondary">
                ภายหลัง
              </button>
            </div>
          </div>
          <button onClick={snooze} aria-label="ปิด" className="flex-shrink-0"><X size={16} className="text-aviva-secondary" /></button>
        </div>
      </div>
    </div>
  );
}
