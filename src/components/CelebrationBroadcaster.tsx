"use client";

import { useEffect, useState } from "react";
import CelebrationModal from "./CelebrationModal";
import { subscribeCelebrations, type CelebrationPayload } from "@/lib/celebrate";
import { useCurrentUser } from "@/lib/user-context";

// #4 — ตัวรับประกาศแสดงความยินดี realtime (mount ครั้งเดียวใน layout)
// เมื่อมีใครปิดการขาย/ถึงหมุดหมาย ทุกคนที่เปิดแอปอยู่จะเห็นป๊อปอัปยินดีพร้อมกัน
export default function CelebrationBroadcaster() {
  const user = useCurrentUser();
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);

  useEffect(() => {
    const unsub = subscribeCelebrations((p) => {
      // ข้ามถ้าเป็นคนที่กดเอง (เห็น celebration ในหน้าจอตัวเองอยู่แล้ว)
      if (p.byUserId && user?.id && p.byUserId === user.id) return;
      setCelebration(p);
    });
    return unsub;
  }, [user?.id]);

  if (!celebration) return null;
  return (
    <CelebrationModal
      event={celebration.event}
      customerName={celebration.customerName}
      plotNumber={celebration.plotNumber}
      amount={celebration.amount}
      salesPerson={celebration.salesPerson}
      onClose={() => setCelebration(null)}
    />
  );
}
