"use client";
// ผู้ช่วย AI แนะนำการใช้งานแอป — ปุ่มลอยอยู่ทุกหน้า ทุกฝ่ายถามได้
// เช่น "ลงค่าอาหารดูแลลูกค้าทำยังไง", "อยากขอซื้อมือถือเริ่มที่ไหน"
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bot, Send, X, Sparkles, HelpCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Msg { role: "user" | "assistant"; text: string; }

const GREETING =
  "สวัสดีค่ะ 🤖 ผู้ช่วย AVIVA AI พร้อมแนะนำวิธีทำงานในแอปทุกฝ่าย — ถามได้เลยว่า \"เรื่องนี้ทำยังไง / เริ่มที่ไหน\"";

const QUICK = [
  "ลงค่าอาหารดูแลลูกค้าทำยังไง",
  "อยากขอซื้อมือถือ เริ่มที่ไหน",
  "เบิกงวดงานผู้รับเหมาทำยังไง",
  "ขอลาหยุดทำอย่างไร",
];

// ซ่อนในหน้าที่ไม่มี nav (เหมือน BottomNav)
const HIDE_ON = ["/login", "/guard", "/security", "/v/"];

export default function HelpAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(p))) return null;

  const ask = async (raw: string) => {
    const msg = raw.trim();
    if (!msg || loading) return;
    setInput("");
    setMsgs((p) => [...p, { role: "user", text: msg }]);
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        // เน้นให้ตอบเป็น "วิธีใช้งานแอป/ขั้นตอนการทำงาน"
        body: JSON.stringify({
          message: `[ถามวิธีใช้งานแอป/ขั้นตอนการทำงาน ตอบเป็นขั้นตอนทำตามได้ทันที ระบุเมนู/ปุ่มจริง] ${msg}`,
          history: msgs.slice(-5).map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await res.json();
      setMsgs((p) => [...p, { role: "assistant", text: data.response ?? "ขออภัย ไม่สามารถตอบได้ค่ะ" }]);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setMsgs((p) => [...p, { role: "assistant", text: "ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ" }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* ปุ่มลอย */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed right-4 bottom-24 z-40 flex items-center gap-1.5 bg-aviva-gold text-aviva-bg font-bold pl-3 pr-3.5 py-2.5 rounded-full shadow-xl shadow-black/30 active:scale-95 transition-transform">
          <HelpCircle size={16} />
          <span className="text-xs">ถาม AI ช่วยงาน</span>
          <Sparkles size={12} />
        </button>
      )}

      {/* แผงแชต */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-aviva-card border border-aviva-gold/20 rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-aviva-gold/10 bg-aviva-gold/5">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-aviva-gold" />
                <span className="text-sm font-bold text-aviva-text">ผู้ช่วย AVIVA AI — แนะนำการใช้งาน</span>
              </div>
              <button onClick={() => setOpen(false)}><X size={18} className="text-aviva-secondary" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-[200px]">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-bg text-aviva-text border border-aviva-gold/10"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-aviva-bg border border-aviva-gold/10 rounded-2xl px-3 py-2">
                    <span className="text-xs text-aviva-secondary animate-pulse">กำลังคิด...</span>
                  </div>
                </div>
              )}
              {/* คำถามตัวอย่าง (แสดงเฉพาะตอนเริ่ม) */}
              {msgs.length === 1 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK.map((q) => (
                    <button key={q} onClick={() => ask(q)}
                      className="text-[11px] text-aviva-gold border border-aviva-gold/30 rounded-full px-2.5 py-1 hover:bg-aviva-gold/10">
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="flex gap-2 px-3 py-3 border-t border-aviva-gold/10">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask(input)}
                placeholder="พิมพ์คำถาม เช่น ลงค่าใช้จ่ายแบบนี้ทำยังไง…"
                className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-xs text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/50" />
              <button onClick={() => ask(input)} disabled={!input.trim() || loading}
                className="p-2 rounded-xl bg-aviva-gold text-aviva-bg disabled:opacity-40">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
