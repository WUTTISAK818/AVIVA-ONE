"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, User } from "lucide-react";
import clsx from "clsx";
import { suggestedQuestions } from "@/lib/mock-data";

interface Message {
  role: "user" | "assistant";
  message: string;
}

const initialMessages: Message[] = [
  {
    role: "assistant",
    message: "สวัสดีครับ ผมคือ AVIVA AI Executive Assistant พร้อมวิเคราะห์ข้อมูลโครงการแบบ Real-time จาก Supabase ถามได้เลยครับ",
  },
];

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  async function sendMessage(text: string) {
    if (!text.trim() || isThinking) return;
    setMessages((prev) => [...prev, { role: "user", message: text }]);
    setInput("");
    setIsThinking(true);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", message: data.response ?? "ไม่สามารถประมวลผลได้ กรุณาลองใหม่" },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", message: "เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อและลองใหม่ครับ" },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-aviva-bg">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center">
            <Sparkles size={16} className="text-aviva-gold" />
          </div>
          <div>
            <h1 className="text-base font-bold text-aviva-text">AVIVA AI</h1>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              วิเคราะห์จากข้อมูล Supabase Real-time
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={clsx("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles size={12} className="text-aviva-gold" />
              </div>
            )}
            <div className={clsx(
              "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              msg.role === "user"
                ? "bg-aviva-gold text-aviva-bg font-medium rounded-tr-sm"
                : "bg-aviva-card border border-aviva-gold/10 text-aviva-text rounded-tl-sm"
            )}>
              {msg.message}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-aviva-card border border-aviva-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={12} className="text-aviva-secondary" />
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center flex-shrink-0">
              <Sparkles size={12} className="text-aviva-gold" />
            </div>
            <div className="bg-aviva-card border border-aviva-gold/10 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-aviva-gold animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-aviva-gold animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-aviva-gold animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested */}
      <div className="px-4 max-w-lg mx-auto w-full">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={isThinking}
              className="flex-shrink-0 text-xs bg-aviva-card border border-aviva-gold/20 text-aviva-gold px-3 py-2 rounded-full hover:border-aviva-gold/50 transition-all disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 max-w-lg mx-auto w-full">
        <div className="flex gap-2 bg-aviva-card border border-aviva-gold/20 rounded-2xl px-4 py-3 focus-within:border-aviva-gold/50 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="ถามเกี่ยวกับโครงการ..."
            disabled={isThinking}
            className="flex-1 bg-transparent text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isThinking}
            className="w-8 h-8 rounded-full bg-aviva-gold flex items-center justify-center disabled:opacity-40 transition-opacity"
          >
            <Send size={14} className="text-aviva-bg" />
          </button>
        </div>
      </div>
    </div>
  );
}