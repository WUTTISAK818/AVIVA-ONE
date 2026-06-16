"use client";
// น้อง Viva — ผู้ช่วย AI ของ AVIVA ONE (ปุ่มลอยทุกหน้า ทุกฝ่าย)
// 1) แนะนำวิธีใช้งานแอป (ถาม-ตอบ)  2) Action Mode: ลงมือทำแทน — เริ่มที่ "สร้างคำขอซื้อ"
// เก็บประวัติบทสนทนาในเครื่อง + บันทึกลง ai_chat_logs สำหรับสถิติผู้บริหาร
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bot, Send, X, Sparkles, HelpCircle, Trash2, ShoppingCart, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { createPurchaseRequest, normalizePRCategory, baht, PR_THRESHOLD } from "@/lib/purchase-request";

const APP_NAME = "น้อง Viva";
const STORAGE_KEY = "aviva_copilot_history_v1";

interface PRDraft { item: string; amount: number; category: string; reason: string | null; }
interface PRCard { kind: "pr_confirm"; draft: PRDraft; status: "pending" | "done" | "cancelled"; }
interface Msg { role: "user" | "assistant"; text: string; card?: PRCard; }

const GREETING =
  `สวัสดีค่ะ 🤖 ${APP_NAME} ผู้ช่วยของ AVIVA ONE — ถามวิธีทำงานได้ทุกฝ่าย หรือสั่งให้ช่วยทำได้เลย เช่น "ซื้อมือถือให้ฝ่ายขาย 1 เครื่อง"`;

const QUICK = [
  "ซื้อมือถือให้ฝ่ายขาย 1 เครื่อง",
  "ลงค่าอาหารดูแลลูกค้าทำยังไง",
  "เบิกงวดงานผู้รับเหมาทำยังไง",
  "ขอลาหยุดทำอย่างไร",
];

const HIDE_ON = ["/login"];

export default function HelpAssistant() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // โหลดประวัติจากเครื่อง (ครั้งแรก)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Msg[];
        if (Array.isArray(saved) && saved.length > 0) setMsgs(saved);
      }
    } catch { /* ignore */ }
  }, []);

  // บันทึกประวัติลงเครื่องทุกครั้งที่เปลี่ยน (ข้ามถ้ามีแต่คำทักทาย)
  useEffect(() => {
    try {
      if (msgs.length > 1) localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-40)));
    } catch { /* ignore */ }
  }, [msgs]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(p))) return null;

  const clearHistory = () => {
    setMsgs([{ role: "assistant", text: GREETING }]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const push = (m: Msg) => setMsgs((p) => [...p, m]);

  // บันทึกคำถาม-คำตอบลงระบบ (best-effort, สำหรับสถิติผู้บริหาร)
  const logQA = async (question: string, answer: string) => {
    try {
      await supabase.from("ai_chat_logs").insert({
        user_email: user?.email ?? null,
        user_name: user?.full_name ?? null,
        user_dept: user?.department ?? null,
        question, answer, source: "copilot",
      });
    } catch { /* ignore */ }
  };

  // history สำหรับส่งให้ API (แปลงการ์ดเป็นข้อความสั้น ๆ ให้ AI เข้าใจบริบท)
  const histFor = (list: Msg[]) =>
    list.slice(-6).map((m) => ({
      role: m.role,
      content: m.text || (m.card ? `[เสนอสร้างคำขอซื้อ: ${m.card.draft.item} ${m.card.draft.amount}]` : ""),
    }));

  const ask = async (raw: string) => {
    const msg = raw.trim();
    if (!msg || loading) return;
    setInput("");
    const history = histFor(msgs);
    setMsgs((p) => [...p, { role: "user", text: msg }]);
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const auth: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      // 1) แยกเจตนา — ผู้ใช้สั่งให้ Viva "สร้างคำขอซื้อ" แทนหรือไม่
      try {
        const aRes = await fetch("/api/ai-action", {
          method: "POST", signal: ctrl.signal,
          headers: { "Content-Type": "application/json", ...auth },
          body: JSON.stringify({ message: msg, history }),
        });
        if (aRes.ok) {
          const a = await aRes.json();
          if (a?.intent === "create_pr") {
            if (a.reply) push({ role: "assistant", text: a.reply });
            if (a.ready && typeof a.amount === "number" && a.amount > 0) {
              push({
                role: "assistant", text: "",
                card: {
                  kind: "pr_confirm",
                  status: "pending",
                  draft: {
                    item: String(a.item || msg).trim(),
                    amount: a.amount,
                    category: normalizePRCategory(a.category),
                    reason: a.reason ?? null,
                  },
                },
              });
            }
            logQA(msg, a.reply || "[เสนอสร้างคำขอซื้อ]");
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") { setLoading(false); return; }
        /* intent error → ตกไปใช้โหมดแนะนำปกติ */
      }

      // 2) โหมดแนะนำวิธีใช้งาน (เดิม)
      const res = await fetch("/api/ai-chat", {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          message: `[ถามวิธีใช้งานแอป/ขั้นตอนการทำงาน ตอบเป็นขั้นตอนทำตามได้ทันที ระบุเมนู/ปุ่มจริง] ${msg}`,
          history,
        }),
      });
      const data = await res.json();
      const answer = data.response ?? "ขออภัย ไม่สามารถตอบได้ค่ะ";
      push({ role: "assistant", text: answer });
      logQA(msg, answer);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      push({ role: "assistant", text: "ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ" });
    }
    setLoading(false);
  };

  // กดยืนยันการ์ด → สร้างคำขอซื้อจริง (ใช้สิทธิ์/RLS ของผู้ใช้เอง เหมือนทำผ่านฟอร์ม)
  const confirmCard = async (idx: number, draft: PRDraft) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await createPurchaseRequest({
        category: draft.category, item: draft.item, reason: draft.reason, amount: draft.amount,
        requester: user?.full_name ?? user?.email ?? "ผู้ใช้",
        requesterDept: user?.department ?? null, requesterRole: user?.role ?? null,
      });
      setMsgs((p) => p.map((m, i) => i === idx && m.card ? { ...m, card: { ...m.card, status: "done" } } : m));
      const line = res.needsApproval
        ? `✅ สร้างคำขอ ${res.prNumber} แล้วค่ะ — ${draft.item} ${baht(draft.amount)}\nส่งให้ผู้บริหารอนุมัติเรียบร้อย ติดตามได้ที่ ออฟฟิศ → การเงิน (คำขอจะไฮไลต์ให้)`
        : `✅ สร้างคำขอ ${res.prNumber} แล้วค่ะ — ${draft.item} ${baht(draft.amount)}\nต่ำกว่าเกณฑ์ ${baht(PR_THRESHOLD)} → อนุมัติอัตโนมัติ พร้อมให้ฝ่ายการเงินจ่ายได้เลย`;
      push({ role: "assistant", text: line });
      logQA(`[ยืนยันสร้างคำขอซื้อ] ${draft.item} ${draft.amount}`, line);
    } catch (e) {
      push({ role: "assistant", text: `ขออภัยค่ะ สร้างคำขอไม่สำเร็จ: ${e instanceof Error ? e.message : "ลองใหม่อีกครั้ง"}` });
    }
    setLoading(false);
  };

  const cancelCard = (idx: number) => {
    setMsgs((p) => p.map((m, i) => i === idx && m.card ? { ...m, card: { ...m.card, status: "cancelled" } } : m));
    push({ role: "assistant", text: "ยกเลิกคำขอแล้วค่ะ — บอกได้ใหม่ทุกเมื่อนะคะ" });
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed right-4 bottom-24 z-40 flex items-center gap-1.5 bg-aviva-gold text-aviva-bg font-bold pl-3 pr-3.5 py-2.5 rounded-full shadow-xl shadow-black/30 active:scale-95 transition-transform">
          <HelpCircle size={16} />
          <span className="text-xs">{APP_NAME}</span>
          <Sparkles size={12} />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-aviva-card border border-aviva-gold/20 rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-aviva-gold/10 bg-aviva-gold/5">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-aviva-gold" />
                <span className="text-sm font-bold text-aviva-text">{APP_NAME} — ถาม & สั่งให้ช่วยทำ</span>
              </div>
              <div className="flex items-center gap-2">
                {msgs.length > 1 && (
                  <button onClick={clearHistory} title="ล้างประวัติ" className="text-aviva-secondary hover:text-red-400"><Trash2 size={15} /></button>
                )}
                <button onClick={() => setOpen(false)}><X size={18} className="text-aviva-secondary" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-[200px]">
              {msgs.map((m, i) => (
                <div key={i}>
                  {m.text && (
                    <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                        m.role === "user" ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-bg text-aviva-text border border-aviva-gold/10"
                      }`}>
                        {m.text}
                      </div>
                    </div>
                  )}
                  {m.card && (
                    <div className="flex justify-start mt-1">
                      <div className="max-w-[90%] w-full bg-aviva-bg border border-aviva-gold/30 rounded-2xl p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <ShoppingCart size={13} className="text-aviva-gold" />
                          <span className="text-xs font-bold text-aviva-text">ยืนยันสร้างคำขอซื้อ</span>
                        </div>
                        <div className="space-y-1 text-[11px] text-aviva-text">
                          <div className="flex justify-between gap-2"><span className="text-aviva-secondary">รายการ</span><span className="text-right font-medium">{m.card.draft.item}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-aviva-secondary">ราคาประมาณ</span><span className="font-bold text-aviva-gold">{baht(m.card.draft.amount)}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-aviva-secondary">หมวด</span><span>{m.card.draft.category}</span></div>
                          {m.card.draft.reason && <div className="flex justify-between gap-2"><span className="text-aviva-secondary">เหตุผล</span><span className="text-right">{m.card.draft.reason}</span></div>}
                        </div>
                        <p className={`text-[10px] mt-1.5 ${m.card.draft.amount >= PR_THRESHOLD ? "text-yellow-400" : "text-green-400"}`}>
                          {m.card.draft.amount >= PR_THRESHOLD
                            ? `≥ ${baht(PR_THRESHOLD)} → ส่งผู้บริหารอนุมัติก่อน`
                            : `ต่ำกว่า ${baht(PR_THRESHOLD)} → อนุมัติอัตโนมัติ`}
                        </p>
                        {m.card.status === "pending" ? (
                          <div className="flex gap-2 mt-2.5">
                            <button onClick={() => confirmCard(i, m.card!.draft)} disabled={loading}
                              className="flex-1 flex items-center justify-center gap-1 bg-aviva-gold text-aviva-bg font-bold py-2 rounded-xl text-[11px] disabled:opacity-50">
                              <Check size={12} /> ยืนยันสร้างคำขอ
                            </button>
                            <button onClick={() => cancelCard(i)} disabled={loading}
                              className="px-3 bg-aviva-card border border-aviva-gold/20 text-aviva-secondary rounded-xl text-[11px] disabled:opacity-50">
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <p className={`text-[11px] mt-2 font-semibold ${m.card.status === "done" ? "text-green-400" : "text-aviva-secondary"}`}>
                            {m.card.status === "done" ? "✅ สร้างคำขอแล้ว" : "ยกเลิกแล้ว"}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-aviva-bg border border-aviva-gold/10 rounded-2xl px-3 py-2">
                    <span className="text-xs text-aviva-secondary animate-pulse">กำลังทำงาน...</span>
                  </div>
                </div>
              )}
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
                placeholder="ถามวิธีทำ หรือสั่งให้ช่วยทำ เช่น ซื้อปริ้นเตอร์ให้ออฟฟิศ…"
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
