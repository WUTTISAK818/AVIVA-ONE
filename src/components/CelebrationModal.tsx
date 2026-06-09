"use client";
import { useEffect } from "react";

const PARTICLES: { left: number; top: number; delay: number; dur: number; e: string }[] = [
  { left: 5,  top: 8,  delay: 0,    dur: 1.1, e: "✨" },
  { left: 15, top: 20, delay: 0.3,  dur: 1.4, e: "🌟" },
  { left: 25, top: 5,  delay: 0.5,  dur: 0.9, e: "💛" },
  { left: 35, top: 15, delay: 0.1,  dur: 1.3, e: "🎊" },
  { left: 45, top: 25, delay: 0.7,  dur: 1.0, e: "⭐" },
  { left: 55, top: 10, delay: 0.2,  dur: 1.5, e: "💫" },
  { left: 65, top: 20, delay: 0.4,  dur: 1.1, e: "✨" },
  { left: 75, top: 8,  delay: 0.6,  dur: 0.8, e: "🌟" },
  { left: 85, top: 18, delay: 0.9,  dur: 1.3, e: "💛" },
  { left: 92, top: 12, delay: 0.3,  dur: 1.0, e: "🎊" },
  { left: 10, top: 70, delay: 0.5,  dur: 1.2, e: "⭐" },
  { left: 20, top: 80, delay: 0.1,  dur: 0.9, e: "💫" },
  { left: 30, top: 75, delay: 0.8,  dur: 1.4, e: "✨" },
  { left: 50, top: 85, delay: 0.2,  dur: 1.1, e: "🌟" },
  { left: 70, top: 78, delay: 0.6,  dur: 0.8, e: "💛" },
  { left: 80, top: 88, delay: 0.4,  dur: 1.3, e: "🎊" },
  { left: 90, top: 72, delay: 0.7,  dur: 1.0, e: "⭐" },
  { left: 5,  top: 45, delay: 0.3,  dur: 1.2, e: "💫" },
  { left: 95, top: 50, delay: 0.9,  dur: 0.9, e: "✨" },
  { left: 40, top: 92, delay: 0.1,  dur: 1.5, e: "🌟" },
];

type EventType = "booking" | "contract" | "transfer";

interface Props {
  event: EventType | null;
  customerName?: string;
  plotNumber?: number | null;
  amount?: number | null;
  salesPerson?: string | null;
  onClose: () => void;
}

const CONFIG: Record<EventType, { icon: string; title: string; subtitle: string; accent: string }> = {
  booking:  { icon: "🎉", title: "จองสำเร็จ!",           subtitle: "ลูกค้ายืนยันการจองเรียบร้อยแล้ว", accent: "text-yellow-400" },
  contract: { icon: "📝", title: "ทำสัญญาสำเร็จ!",       subtitle: "ลงนามสัญญาจะซื้อจะขายเรียบร้อยแล้ว", accent: "text-blue-400" },
  transfer: { icon: "🏆", title: "ปิดการขายสำเร็จ! 🎊",  subtitle: "โอนกรรมสิทธิ์เรียบร้อย ยินดีด้วย!", accent: "text-green-400" },
};

export default function CelebrationModal({ event, customerName, plotNumber, amount, salesPerson, onClose }: Props) {
  useEffect(() => {
    if (!event) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [event, onClose]);

  if (!event) return null;
  const c = CONFIG[event];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer" onClick={onClose}>
      <div className="absolute inset-0 bg-aviva-bg/95 backdrop-blur-md" />
      {PARTICLES.map((p, i) => (
        <span key={i} className="absolute text-lg pointer-events-none animate-bounce select-none"
          style={{ left: `${p.left}%`, top: `${p.top}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}>
          {p.e}
        </span>
      ))}
      <div className="relative z-10 text-center px-8 py-10 max-w-xs w-full mx-4 bg-aviva-card/80 border border-aviva-gold/30 rounded-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="text-7xl mb-4 animate-bounce">{c.icon}</div>
        <h1 className={`text-2xl font-bold mb-2 ${c.accent}`}>{c.title}</h1>
        <p className="text-sm text-aviva-secondary mb-4">{c.subtitle}</p>
        {customerName && (
          <div className="bg-aviva-bg/60 rounded-2xl p-3 mb-2 border border-aviva-gold/20">
            <p className="text-base font-bold text-aviva-text">{customerName}</p>
            {plotNumber && <p className="text-xs text-aviva-gold mt-0.5">แปลงที่ {plotNumber}</p>}
            {amount && amount > 0 && (
              <p className="text-sm font-bold text-green-400 mt-1">฿{Number(amount).toLocaleString("th-TH")} บาท</p>
            )}
            {salesPerson && (
              <p className="text-[11px] text-aviva-secondary mt-2 pt-2 border-t border-aviva-gold/10">พนักงานขาย: <span className="font-bold text-aviva-gold">{salesPerson}</span></p>
            )}
          </div>
        )}
        <button onClick={onClose}
          className="mt-4 w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm">
          ยอดเยี่ยม! ปิด
        </button>
        <p className="text-[10px] text-aviva-secondary/40 mt-3">จะปิดอัตโนมัติใน 6 วินาที</p>
      </div>
    </div>
  );
}
