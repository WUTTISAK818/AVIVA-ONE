"use client";
import { useEffect } from "react";

// อ่าน ?focus=<id> จาก URL แล้วเลื่อนไป + ไฮไลต์ element ที่มี data-focus ตรงกัน
// ใช้ในหน้าปลายทางของกล่องงาน (/inbox) เพื่อให้คลิกแล้วเปิด "รายการนั้นจริง ๆ"
// poll รอจน list render เสร็จ (สูงสุด ~6 วินาที)
export function useFocusHighlight() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("focus");
    if (!id) return;
    let tries = 0;
    const timer = setInterval(() => {
      let el: HTMLElement | null = null;
      try { el = document.querySelector<HTMLElement>(`[data-focus="${CSS.escape(id)}"]`); } catch { /* invalid id */ }
      if (el) {
        clearInterval(timer);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-aviva-gold", "ring-offset-2", "ring-offset-aviva-bg", "rounded-xl");
        setTimeout(() => el?.classList.remove("ring-2", "ring-aviva-gold", "ring-offset-2", "ring-offset-aviva-bg"), 3500);
      } else if (++tries > 40) {
        clearInterval(timer);
      }
    }, 150);
    return () => clearInterval(timer);
  }, []);
}
