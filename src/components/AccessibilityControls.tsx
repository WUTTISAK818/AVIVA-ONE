"use client";
import { useState } from "react";
import { Type, Sun, Moon, X, Check } from "lucide-react";
import clsx from "clsx";
import { useTheme, type FontLevel } from "@/lib/theme-context";

const FONTS: { lvl: FontLevel; label: string; size: number }[] = [
  { lvl: 0, label: "เล็ก", size: 14 },
  { lvl: 1, label: "ปกติ", size: 17 },
  { lvl: 2, label: "ใหญ่", size: 21 },
  { lvl: 3, label: "ใหญ่พิเศษ", size: 26 },
];

/** ปุ่มลอยปรับการแสดงผล (ขนาดอักษร + โหมดสี) — ออกแบบให้ผู้สูงอายุกดง่าย */
export default function AccessibilityControls() {
  const { theme, setTheme, fontLevel, setFontLevel } = useTheme();
  const [open, setOpen] = useState(false);
  const isLight = theme !== "dark";

  return (
    <>
      {/* ปุ่มลอย */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="ปรับการแสดงผล"
        className="fixed right-4 bottom-24 z-50 w-14 h-14 rounded-full bg-aviva-gold text-aviva-bg shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
      >
        <Type size={26} strokeWidth={2.5} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-aviva-card rounded-t-3xl p-5 pb-8 border-t-2 border-aviva-gold/30"
            style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.25)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-aviva-text">ปรับการแสดงผล</h2>
              <button onClick={() => setOpen(false)} aria-label="ปิด"
                className="w-10 h-10 rounded-full bg-aviva-bg/60 flex items-center justify-center text-aviva-secondary">
                <X size={22} />
              </button>
            </div>

            {/* ขนาดตัวอักษร */}
            <p className="text-sm font-semibold text-aviva-secondary mb-2">ขนาดตัวอักษร</p>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {FONTS.map((f) => (
                <button key={f.lvl} onClick={() => setFontLevel(f.lvl)}
                  className={clsx(
                    "flex flex-col items-center justify-center gap-1 py-3 rounded-2xl border-2 transition-colors",
                    fontLevel === f.lvl
                      ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                      : "bg-aviva-bg/50 text-aviva-text border-aviva-gold/15"
                  )}>
                  <span style={{ fontSize: f.size, fontWeight: 700, lineHeight: 1 }}>ก</span>
                  <span className="text-[11px] font-medium">{f.label}</span>
                </button>
              ))}
            </div>

            {/* โหมดสี */}
            <p className="text-sm font-semibold text-aviva-secondary mb-2">โหมดสี</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTheme("light")}
                className={clsx(
                  "flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-semibold transition-colors",
                  isLight ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-bg/50 text-aviva-text border-aviva-gold/15"
                )}>
                <Sun size={22} /> สว่าง {isLight && <Check size={18} />}
              </button>
              <button onClick={() => setTheme("dark")}
                className={clsx(
                  "flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-semibold transition-colors",
                  !isLight ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-bg/50 text-aviva-text border-aviva-gold/15"
                )}>
                <Moon size={22} /> กลางคืน {!isLight && <Check size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
