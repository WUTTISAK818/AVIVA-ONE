"use client";
// น้อง Viva — ผู้ช่วย AI ของ AVIVA ONE (ปุ่มลอยทุกหน้า ทุกฝ่าย)
// 1) แนะนำวิธีใช้งานแอป (ถาม-ตอบ)  2) Action Mode: ลงมือทำแทน — สร้างคำขอซื้อ / แจ้งซ่อม / ขอลา
// เก็บประวัติบทสนทนาในเครื่อง + บันทึกลง ai_chat_logs สำหรับสถิติผู้บริหาร
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bot, Send, X, Sparkles, HelpCircle, Trash2, ShoppingCart, Wrench, CalendarDays, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { createPurchaseRequest, normalizePRCategory, baht, PR_THRESHOLD } from "@/lib/purchase-request";
import { createWarrantyClaim, createLeaveRequest } from "@/lib/work-actions";

const APP_NAME = "น้อง Viva";
const STORAGE_KEY = "aviva_copilot_history_v1";

interface PRData { item: string; amount: number; category: string; reason: string | null; }
interface ClaimData { customerName: string; houseNumber: string | null; issueType: string; description: string; assignedTo: string | null; scheduledDate: string | null; estimatedCompletionDate: string | null; }
interface LeaveData { employeeName: string; leaveType: string; dateFrom: string; dateTo: string; reason: string | null; }
type CardStatus = "pending" | "done" | "cancelled";
type ActionCard =
  | { kind: "pr"; status: CardStatus; data: PRData }
  | { kind: "claim"; status: CardStatus; data: ClaimData }
  | { kind: "leave"; status: CardStatus; data: LeaveData };

interface Msg { role: "user" | "assistant"; text: string; card?: ActionCard; }

const GREETING =
  `สวัสดีค่ะ 🤖 ${APP_NAME} ผู้ช่วยของ AVIVA ONE — ถามวิธีทำงานได้ทุกฝ่าย หรือสั่งให้ช่วยทำได้เลย เช่น "ซื้อมือถือให้ฝ่ายขาย", "แจ้งซ่อมหลังคารั่ว", "ขอลาพักร้อน"`;

const QUICK = [
  "ซื้อมือถือให้ฝ่ายขาย 1 เครื่อง",
  "แจ้งซ่อมหลังคารั่ว บ้านคุณสมชาย",
  "ขอลาพักร้อน 2 วัน",
  "เบิกงวดงานผู้รับเหมาทำยังไง",
];

const HIDE_ON = ["/login"];

const CARD_META = {
  pr: { icon: ShoppingCart, title: "ยืนยันสร้างคำขอซื้อ" },
  claim: { icon: Wrench, title: "ยืนยันแจ้งซ่อม" },
  leave: { icon: CalendarDays, title: "ยืนยันยื่นใบลา" },
} as const;

const leaveDays = (from: string, to: string) =>
  Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
const fmtD = (s: string) => new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

export default function HelpAssistant() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Msg[];
        if (Array.isArray(saved) && saved.length > 0) setMsgs(saved);
      }
    } catch { /* ignore */ }
  }, []);

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

  const logQA = async (question: string, answer: string) => {
    try {
      await supabase.from("ai_chat_logs").insert({
        user_email: user?.email ?? null, user_name: user?.full_name ?? null,
        user_dept: user?.department ?? null, question, answer, source: "copilot",
      });
    } catch { /* ignore */ }
  };

  const histFor = (list: Msg[]) =>
    list.slice(-6).map((m) => ({ role: m.role, content: m.text || (m.card ? `[เสนอ${CARD_META[m.card.kind].title}]` : "") }));

  // แปลงผลแยกเจตนาเป็นการ์ดยืนยัน (ถ้าข้อมูลครบ)
  const cardFromAction = (a: Record<string, unknown>): ActionCard | null => {
    if (a.intent === "create_pr" && a.ready) {
      const pr = a.pr as PRData | undefined;
      if (pr && typeof pr.amount === "number" && pr.amount > 0)
        return { kind: "pr", status: "pending", data: { item: String(pr.item).trim(), amount: pr.amount, category: normalizePRCategory(pr.category), reason: pr.reason ?? null } };
    }
    if (a.intent === "create_claim" && a.ready) {
      const c = a.claim as ClaimData | undefined;
      if (c && c.customerName && c.description)
        return { kind: "claim", status: "pending", data: { customerName: c.customerName, houseNumber: c.houseNumber ?? null, issueType: c.issueType || "อื่นๆ", description: c.description, assignedTo: c.assignedTo ?? null, scheduledDate: c.scheduledDate ?? null, estimatedCompletionDate: c.estimatedCompletionDate ?? null } };
    }
    if (a.intent === "create_leave" && a.ready) {
      const l = a.leave as LeaveData | undefined;
      if (l && l.employeeName && l.dateFrom && l.dateTo)
        return { kind: "leave", status: "pending", data: { employeeName: l.employeeName, leaveType: l.leaveType || "ลาอื่นๆ", dateFrom: l.dateFrom, dateTo: l.dateTo, reason: l.reason ?? null } };
    }
    return null;
  };

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

      // 1) แยกเจตนา — สั่งให้ Viva ทำงานแทน (ซื้อ/แจ้งซ่อม/ลา) หรือไม่
      try {
        const aRes = await fetch("/api/ai-action", {
          method: "POST", signal: ctrl.signal,
          headers: { "Content-Type": "application/json", ...auth },
          body: JSON.stringify({ message: msg, history }),
        });
        if (aRes.ok) {
          const a = await aRes.json();
          if (typeof a?.intent === "string" && a.intent.startsWith("create_")) {
            if (a.reply) push({ role: "assistant", text: a.reply });
            const card = cardFromAction(a);
            if (card) push({ role: "assistant", text: "", card });
            logQA(msg, a.reply || `[เสนอ ${a.intent}]`);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") { setLoading(false); return; }
        /* intent error → ใช้โหมดแนะนำปกติ */
      }

      // 2) โหมดแนะนำวิธีใช้งาน
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

  // กดยืนยันการ์ด → ทำรายการจริง (ใช้สิทธิ์/RLS ของผู้ใช้เอง เหมือนทำผ่านฟอร์ม)
  const confirmCard = async (idx: number, card: ActionCard) => {
    if (loading) return;
    setLoading(true);
    try {
      let line = "";
      if (card.kind === "pr") {
        const r = await createPurchaseRequest({
          category: card.data.category, item: card.data.item, reason: card.data.reason, amount: card.data.amount,
          requester: user?.full_name ?? user?.email ?? "ผู้ใช้", requesterDept: user?.department ?? null, requesterRole: user?.role ?? null,
          requesterUserId: user?.id ?? null,
        });
        line = r.needsApproval
          ? `✅ สร้างคำขอ ${r.prNumber} แล้วค่ะ — ${card.data.item} ${baht(card.data.amount)}\nส่งผู้บริหารอนุมัติแล้ว · ติดตามที่ ออฟฟิศ → การเงิน`
          : `✅ สร้างคำขอ ${r.prNumber} แล้วค่ะ — ${card.data.item} ${baht(card.data.amount)}\nต่ำกว่าเกณฑ์ ${baht(PR_THRESHOLD)} → อนุมัติอัตโนมัติ พร้อมให้การเงินจ่าย`;
      } else if (card.kind === "claim") {
        const r = await createWarrantyClaim({
          customerName: card.data.customerName, houseNumber: card.data.houseNumber, issueType: card.data.issueType,
          description: card.data.description, assignedTo: card.data.assignedTo,
          scheduledDate: card.data.scheduledDate, estimatedCompletionDate: card.data.estimatedCompletionDate,
        });
        line = `✅ บันทึกแจ้งซ่อม ${r.docNumber} แล้วค่ะ — ${card.data.customerName}: ${card.data.description}\nติดตามได้ที่ บริการหลังการขาย`;
      } else {
        const r = await createLeaveRequest({
          employeeName: card.data.employeeName, leaveType: card.data.leaveType,
          dateFrom: card.data.dateFrom, dateTo: card.data.dateTo, reason: card.data.reason, userId: user?.id ?? null,
        });
        line = `✅ ยื่นใบลา ${r.docNumber} แล้วค่ะ — ${card.data.employeeName} ${card.data.leaveType} ${r.days} วัน\nส่งผู้บริหารอนุมัติแล้ว · ติดตามที่ ออฟฟิศ → บุคคล`;
      }
      setMsgs((p) => p.map((m, i) => i === idx && m.card ? { ...m, card: { ...m.card, status: "done" } } : m));
      push({ role: "assistant", text: line });
      logQA(`[ยืนยัน ${card.kind}]`, line);
    } catch (e) {
      push({ role: "assistant", text: `ขออภัยค่ะ ทำรายการไม่สำเร็จ: ${e instanceof Error ? e.message : "ลองใหม่อีกครั้ง"}` });
    }
    setLoading(false);
  };

  const cancelCard = (idx: number) => {
    setMsgs((p) => p.map((m, i) => i === idx && m.card ? { ...m, card: { ...m.card, status: "cancelled" } } : m));
    push({ role: "assistant", text: "ยกเลิกรายการแล้วค่ะ — บอกได้ใหม่ทุกเมื่อนะคะ" });
  };

  // รายละเอียดที่แสดงในการ์ดแต่ละชนิด
  const cardRows = (card: ActionCard): [string, string][] => {
    if (card.kind === "pr") return [
      ["รายการ", card.data.item], ["ราคาประมาณ", baht(card.data.amount)], ["หมวด", card.data.category],
      ...(card.data.reason ? [["เหตุผล", card.data.reason] as [string, string]] : []),
    ];
    if (card.kind === "claim") return [
      ["ผู้แจ้ง (ลูกค้า)", card.data.customerName],
      ...(card.data.houseNumber ? [["ยูนิต/แปลง", card.data.houseNumber] as [string, string]] : []),
      ["ประเภท", card.data.issueType], ["อาการ", card.data.description],
      ["ผู้รับผิดชอบ", card.data.assignedTo || "ยังไม่ระบุ"],
      ...(card.data.estimatedCompletionDate ? [["กำหนดเสร็จ", fmtD(card.data.estimatedCompletionDate)] as [string, string]] : []),
    ];
    return [
      ["ผู้ขอลา", card.data.employeeName], ["ประเภท", card.data.leaveType],
      ["ช่วงวัน", `${fmtD(card.data.dateFrom)} – ${fmtD(card.data.dateTo)} (${leaveDays(card.data.dateFrom, card.data.dateTo)} วัน)`],
      ...(card.data.reason ? [["เหตุผล", card.data.reason] as [string, string]] : []),
    ];
  };

  const cardNote = (card: ActionCard): { text: string; cls: string } | null => {
    if (card.kind === "pr") return card.data.amount >= PR_THRESHOLD
      ? { text: `≥ ${baht(PR_THRESHOLD)} → ส่งผู้บริหารอนุมัติก่อน`, cls: "text-yellow-400" }
      : { text: `ต่ำกว่า ${baht(PR_THRESHOLD)} → อนุมัติอัตโนมัติ`, cls: "text-green-400" };
    if (card.kind === "leave") return { text: "ส่งผู้บริหารอนุมัติก่อน", cls: "text-yellow-400" };
    return { text: "บันทึกเข้าระบบหลังการขายทันที", cls: "text-green-400" };
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
                  {m.card && (() => {
                    const Meta = CARD_META[m.card.kind];
                    const Icon = Meta.icon;
                    const note = cardNote(m.card);
                    return (
                      <div className="flex justify-start mt-1">
                        <div className="max-w-[90%] w-full bg-aviva-bg border border-aviva-gold/30 rounded-2xl p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Icon size={13} className="text-aviva-gold" />
                            <span className="text-xs font-bold text-aviva-text">{Meta.title}</span>
                          </div>
                          <div className="space-y-1 text-[11px] text-aviva-text">
                            {cardRows(m.card).map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-2">
                                <span className="text-aviva-secondary flex-shrink-0">{k}</span>
                                <span className="text-right font-medium">{v}</span>
                              </div>
                            ))}
                          </div>
                          {note && <p className={`text-[10px] mt-1.5 ${note.cls}`}>{note.text}</p>}
                          {m.card.status === "pending" ? (
                            <div className="flex gap-2 mt-2.5">
                              <button onClick={() => confirmCard(i, m.card!)} disabled={loading}
                                className="flex-1 flex items-center justify-center gap-1 bg-aviva-gold text-aviva-bg font-bold py-2 rounded-xl text-[11px] disabled:opacity-50">
                                <Check size={12} /> ยืนยัน
                              </button>
                              <button onClick={() => cancelCard(i)} disabled={loading}
                                className="px-3 bg-aviva-card border border-aviva-gold/20 text-aviva-secondary rounded-xl text-[11px] disabled:opacity-50">
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <p className={`text-[11px] mt-2 font-semibold ${m.card.status === "done" ? "text-green-400" : "text-aviva-secondary"}`}>
                              {m.card.status === "done" ? "✅ ทำรายการแล้ว" : "ยกเลิกแล้ว"}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
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
                placeholder="ถามวิธีทำ หรือสั่งให้ช่วยทำ เช่น แจ้งซ่อม / ขอลา / ซื้อของ…"
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
