import { supabase } from "./supabase";

// #4 — Broadcast แสดงความยินดีแบบ realtime ให้ทุกคนที่ออนไลน์เห็นพร้อมกัน
// ใช้ Supabase Realtime broadcast (ไม่แตะ DB) — best-effort ไม่ throw

export type CelebrationEvent = "booking" | "contract" | "loan" | "transfer";

export interface CelebrationPayload {
  event: CelebrationEvent;
  customerName?: string;
  plotNumber?: number | null;
  amount?: number | null;
  salesPerson?: string | null;
  byUserId?: string | null; // กันเด้งซ้ำให้คนที่กดเอง (เห็น local อยู่แล้ว)
}

const CHANNEL = "aviva-celebrations";

/** ยิงประกาศแสดงความยินดีไปยังทุก client ที่ subscribe ช่องเดียวกัน */
export async function broadcastCelebration(payload: CelebrationPayload): Promise<void> {
  try {
    const ch = supabase.channel(CHANNEL);
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 1500); // safety: ไม่ค้างถ้า subscribe ช้า
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") { clearTimeout(t); resolve(); }
      });
    });
    await ch.send({ type: "broadcast", event: "celebrate", payload });
    setTimeout(() => { supabase.removeChannel(ch); }, 1000);
  } catch {
    /* best-effort */
  }
}

/** subscribe รับประกาศ — คืน unsubscribe function */
export function subscribeCelebrations(onCelebrate: (p: CelebrationPayload) => void): () => void {
  const ch = supabase
    .channel(CHANNEL)
    .on("broadcast", { event: "celebrate" }, ({ payload }) => {
      onCelebrate(payload as CelebrationPayload);
    })
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
