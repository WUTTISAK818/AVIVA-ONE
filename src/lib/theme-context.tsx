"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light" | "auto";
/** ระดับขนาดตัวอักษร 0=เล็ก 1=ปกติ 2=ใหญ่ 3=ใหญ่พิเศษ */
export type FontLevel = 0 | 1 | 2 | 3;
const FONT_PX: Record<FontLevel, number> = { 0: 16, 1: 18, 2: 21, 3: 25 };

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  fontLevel: FontLevel;
  setFontLevel: (l: FontLevel) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light", setTheme: () => {}, fontLevel: 1, setFontLevel: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // ค่าเริ่มต้น = โหมดสว่าง (เหมาะกับผู้สูงอายุ มองเห็นชัดกลางแดด)
  const [theme, setThemeState] = useState<Theme>("light");
  const [fontLevel, setFontLevelState] = useState<FontLevel>(1);

  useEffect(() => {
    const saved = (localStorage.getItem("aviva-theme") as Theme) ?? "light";
    setThemeState(saved);
    applyTheme(saved);
    const f = parseInt(localStorage.getItem("aviva-fontlevel") ?? "1", 10);
    const lvl = ([0, 1, 2, 3].includes(f) ? f : 1) as FontLevel;
    setFontLevelState(lvl);
    applyFont(lvl);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("aviva-theme", t);
    applyTheme(t);
  };

  const setFontLevel = (l: FontLevel) => {
    setFontLevelState(l);
    localStorage.setItem("aviva-fontlevel", String(l));
    applyFont(l);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, fontLevel, setFontLevel }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("theme-light");
  } else if (theme === "dark") {
    root.classList.remove("theme-light");
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("theme-light", !prefersDark);
  }
}

function applyFont(level: FontLevel) {
  // html font-size = base ของทั้งแอป (Tailwind ใช้ rem จึงสเกลทุกอย่างตามนี้)
  document.documentElement.style.fontSize = `${FONT_PX[level]}px`;
}

export function useTheme() {
  return useContext(ThemeContext);
}
