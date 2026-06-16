"use client";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Msg { role: "user" | "assistant"; text: string; }

const DEPT_GREETING: Record<string, string> = {
  finance:     "สวัสดีค่ะ AVIVA AI ฝ่ายการเงิน พร้อมวิเคราะห์รายรับ-รายจ่าย PO และกระแสเงินสดค่ะ",
  accounting:  "สวัสดีค่ะ AVIVA AI ฝ่ายบัญชี พร้อมตอบคำถามเกี่ยวกับ JV, AR, AP, VAT/WHT และ TFRS 15 ค่ะ",
  hr:          "สวัสดีค่ะ AVIVA AI ฝ่ายบุคคล พร้อมช่วยด้านเงินเดือน วันลา และข้อมูลพนักงานค่ะ",
  marketing:   "สวัสดีค่ะ AVIVA AI ฝ่ายการตลาด พร้อมวิเคราะห์แคมเปญ ROI และ lead conversion ค่ะ",
  "after-sales": "สวัสดีค่ะ AVIVA AI ฝ่ายหลังการขาย พร้อมช่วยติดตามการแจ้งซ่อม สถานะ warranty และ SLA ค่ะ",
  construction: "สวัสดีค่ะ AVIVA AI ฝ่ายก่อสร้าง พร้อมวิเคราะห์งวดงาน ความคืบหน้า และ defect ค่ะ",
  sales:       "สวัสดีค่ะ AVIVA AI ฝ่ายขาย พร้อมวิเคราะห์ leads การปิดการขาย และสถานะแปลงค่ะ",
};

interface DeptAIChatProps {
  dept: string;
  label?: string;
}

export default function DeptAIChat({ dept, label }: DeptAIChatProps) {
  const greeting = DEPT_GREETING[dept] ?? "สวัสดีค่ะ AVIVA AI พร้อมช่วยค่ะ";
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", text: greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setMsgs(p => [...p, { role: "user", text: msg }]);
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
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ message: `[ฝ่าย: ${dept}] ${msg}`, history: msgs.slice(-5).map(m => ({ role: m.role, content: m.text })) }),
      });
      const data = await res.json();
      setMsgs(p => [...p, { role: "assistant", text: data.response ?? "ขออภัย ไม่สามารถตอบได้ค่ะ" }]);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setMsgs(p => [...p, { role: "assistant", text: "ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ" }]);
    }
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
          open ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card border-aviva-gold/20 text-aviva-secondary hover:border-aviva-gold/40"
        }`}
      >
        <Bot size={13} />
        <span>{label ?? "AI ผู้ช่วย"}</span>
        <Sparkles size={10} className={open ? "text-aviva-bg" : "text-aviva-gold"} />
      </button>

      {open && (
        <div className="mt-3 bg-aviva-bg/60 rounded-2xl border border-aviva-gold/15 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-aviva-gold/10">
            <div className="flex items-center gap-1.5">
              <Bot size={12} className="text-aviva-gold" />
              <span className="text-[11px] font-bold text-aviva-gold">AVIVA AI — {label ?? dept}</span>
            </div>
            <button onClick={() => setOpen(false)}><X size={13} className="text-aviva-secondary" /></button>
          </div>
          <div className="h-48 overflow-y-auto px-3 py-2 space-y-2">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed ${
                  m.role === "user" ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-card text-aviva-text border border-aviva-gold/10"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-aviva-card border border-aviva-gold/10 rounded-xl px-2.5 py-1.5">
                  <span className="text-xs text-aviva-secondary animate-pulse">กำลังคิด...</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="flex gap-2 px-3 py-2 border-t border-aviva-gold/10">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="ถามเกี่ยวกับฝ่ายนี้..."
              className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-2.5 py-1.5 text-xs text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="p-1.5 rounded-xl bg-aviva-gold text-aviva-bg disabled:opacity-40"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
