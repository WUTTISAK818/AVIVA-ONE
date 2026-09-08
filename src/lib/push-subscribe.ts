"use client";
import { supabase } from "./supabase";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// เดิม reg.pushManager.subscribe() ไม่มี timeout — ถ้าเบราว์เซอร์ (พบมากบน iOS PWA)
// ค้าง promise ไว้เฉยๆ ไม่ resolve/reject เลย ผู้ใช้จะเจอปุ่ม "เปิดแจ้งเตือน" วนซ้ำไม่รู้จบ
// โดยไม่มี error ให้ตรวจสอบ — ใส่ timeout กันไว้เพื่อให้ล้มเหลวแบบมีเหตุผลชัดเจนแทน
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export async function subscribeToPush(user: { email: string; role?: string; department?: string }): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublic) return { ok: false, reason: "no-vapid-key" };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const reg = await withTimeout(navigator.serviceWorker.ready, 10000, "sw-ready");

    // ถ้ามี subscription เดิมค้างอยู่ (เช่น ผูกด้วย VAPID key คนละชุด) ต้องเลิกก่อน
    // ไม่งั้น subscribe() ใหม่จะโยน InvalidStateError
    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const sub = await withTimeout(
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      }),
      10000,
      "subscribe",
    );

    const json = sub.toJSON();
    const keys = json.keys ?? {};
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_email: user.email,
        role: user.role ?? null,
        department: user.department ?? null,
        endpoint: json.endpoint ?? "",
        p256dh: keys.p256dh ?? "",
        auth: keys.auth ?? "",
      },
      { onConflict: "endpoint" }
    );
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
