"use client";
import { useEffect } from "react";

/**
 * ล้าง service worker + cache เก่าที่อาจค้างจากแอป AVIVA (PWA) ซึ่งเคย deploy
 * บน domain เดียวกันมาก่อน — กันปัญหาเปิดเว็บแล้วขึ้น "This page couldn't load"
 * เพราะ SW เก่าดัก request ไว้. WinVote ไม่ได้ใช้ service worker จึงล้างทิ้งได้เลย.
 */
export default function KillServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let reloaded = false;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        if (regs && regs.length > 0) {
          Promise.all(regs.map((r) => r.unregister())).then(() => {
            if (!reloaded) { reloaded = true; window.location.reload(); }
          });
        }
      }).catch(() => {});
    }
    if (typeof caches !== "undefined" && caches.keys) {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
    }
  }, []);
  return null;
}
