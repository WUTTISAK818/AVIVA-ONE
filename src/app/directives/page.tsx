"use client";
import { useEffect, useState, useCallback } from "react";
import { Send, Plus, X, MessageSquareText, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import { sendDirective, updateDirectiveStatus, type Directive, type DirectiveStatus } from "@/lib/directives";
import GlassCard from "@/components/GlassCard";

type Tab = "received" | "sent";

interface EmployeeOption {
  email: string;
  full_name: string;
  department: string | null;
}

const STATUS_META: Record<DirectiveStatus, { label: string; cls: string }> = {
  sent: { label: "ส่งแล้ว", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  acknowledged: { label: "รับทราบแล้ว", cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  in_progress: { label: "กำลังดำเนินการ", cls: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  done: { label: "เสร็จแล้ว", cls: "bg-green-500/10 text-green-400 border-green-500/30" },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function DirectivesPage() {
  const user = useCurrentUser();
  const [tab, setTab] = useState<Tab>("received");
  const [items, setItems] = useState<Directive[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  const [assignedTo, setAssignedTo] = useState("");
  const [department, setDepartment] = useState("");
  const [message, setMessage] = useState("");
  const [referenceNote, setReferenceNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sending, setSending] = useState(false);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [closeErrors, setCloseErrors] = useState<Record<string, string>>({});
  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const col = tab === "received" ? "assigned_to" : "created_by";
    const { data } = await supabase
      .from("directives")
      .select("*")
      .eq(col, user.email)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Directive[]);
    setLoading(false);
  }, [user, tab]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.isManager) return;
    supabase
      .from("employees")
      .select("email, full_name, department")
      .eq("status", "active")
      .order("full_name")
      .then(({ data }) => setEmployees((data ?? []).filter((e) => e.email) as EmployeeOption[]));
  }, [user]);

  const handleSend = async () => {
    if (!user || !assignedTo || !message.trim()) return;
    setSending(true);
    const emp = employees.find((e) => e.email === assignedTo);
    const r = await sendDirective({
      createdByEmail: user.email,
      createdByName: user.full_name || user.email,
      assignedToEmail: assignedTo,
      assignedToName: emp?.full_name || assignedTo,
      department: department || emp?.department || null,
      message: message.trim(),
      referenceNote: referenceNote.trim() || null,
      dueDate: dueDate || null,
    });
    setSending(false);
    if (r.ok) {
      setShowCompose(false);
      setAssignedTo(""); setDepartment(""); setMessage(""); setReferenceNote(""); setDueDate("");
      if (tab === "sent") load();
    }
  };

  // ปิดงาน "เสร็จแล้ว" ต้องมีรายงานปิดงานแนบเสมอ (กันปิดจ็อบเงียบๆ ไม่มีใครรู้ว่าทำอะไรไปบ้าง)
  const handleStatusUpdate = async (d: Directive, status: DirectiveStatus) => {
    const note = responseDrafts[d.id]?.trim() ?? "";
    if (status === "done" && !note) {
      setCloseErrors((p) => ({ ...p, [d.id]: "กรุณาเขียนรายงานปิดงานก่อนกดเสร็จแล้ว" }));
      return;
    }
    setCloseErrors((p) => ({ ...p, [d.id]: "" }));
    await updateDirectiveStatus(d, status, note || undefined);
    load();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-10 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquareText size={18} className="text-aviva-gold" />
            <h1 className="text-base font-bold text-aviva-text">คำสั่งงาน</h1>
          </div>
          {user.isManager && (
            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-aviva-gold text-aviva-bg text-xs font-semibold"
            >
              <Plus size={14} /> สั่งงาน
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab("received")}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold ${tab === "received" ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-card text-aviva-secondary border border-aviva-gold/10"}`}
          >
            ที่ได้รับ
          </button>
          {user.isManager && (
            <button
              onClick={() => setTab("sent")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold ${tab === "sent" ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-card text-aviva-secondary border border-aviva-gold/10"}`}
            >
              ที่ฉันสั่ง
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-aviva-secondary text-center py-10">กำลังโหลด...</p>
        ) : items.length === 0 ? (
          <GlassCard className="p-6 text-center">
            <p className="text-sm text-aviva-secondary">
              {tab === "received" ? "ยังไม่มีคำสั่งงานถึงคุณ" : "ยังไม่เคยสั่งงานใคร"}
            </p>
          </GlassCard>
        ) : (
          items.map((d) => {
            const meta = STATUS_META[d.status];
            const overdue = !!d.due_date && d.due_date < todayStr && d.status !== "done";
            return (
              <GlassCard key={d.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-aviva-secondary">
                    {tab === "received" ? `จาก ${d.created_by_name || d.created_by}` : `ถึง ${d.assigned_to_name || d.assigned_to}`}
                    {d.department && ` · ${d.department}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {overdue && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold bg-red-500/10 text-red-400 border-red-500/30">เกินกำหนด</span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${meta.cls}`}>{meta.label}</span>
                  </div>
                </div>
                <p className="text-sm text-aviva-text leading-relaxed">{d.message}</p>
                {d.reference_note && <p className="text-xs text-aviva-gold mt-1">อ้างอิง: {d.reference_note}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-[10px] text-aviva-secondary">{formatDateTime(d.created_at)}</p>
                  {d.due_date && (
                    <p className={`text-[10px] ${overdue ? "text-red-400 font-semibold" : "text-aviva-secondary"}`}>
                      · กำหนดเสร็จ {new Date(d.due_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
                {d.response_note && (
                  <div className="mt-2 pt-2 border-t border-aviva-gold/10">
                    <p className="text-xs text-aviva-secondary">{d.status === "done" ? "รายงานปิดงาน" : "ตอบกลับ"}: {d.response_note}</p>
                  </div>
                )}

                {tab === "received" && d.status !== "done" && (
                  <div className="mt-3 pt-3 border-t border-aviva-gold/10 space-y-2">
                    <input
                      type="text"
                      placeholder="เขียนความคืบหน้า (บังคับตอนกดเสร็จแล้ว)"
                      value={responseDrafts[d.id] ?? ""}
                      onChange={(e) => setResponseDrafts((p) => ({ ...p, [d.id]: e.target.value }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/15 rounded-lg px-3 py-1.5 text-xs text-aviva-text"
                    />
                    {closeErrors[d.id] && <p className="text-[11px] text-red-400">{closeErrors[d.id]}</p>}
                    <div className="flex gap-1.5">
                      {d.status === "sent" && (
                        <button
                          onClick={() => handleStatusUpdate(d, "acknowledged")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px] font-semibold"
                        >
                          <Clock size={11} /> รับทราบ
                        </button>
                      )}
                      {(d.status === "sent" || d.status === "acknowledged") && (
                        <button
                          onClick={() => handleStatusUpdate(d, "in_progress")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[11px] font-semibold"
                        >
                          <PlayCircle size={11} /> กำลังทำ
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusUpdate(d, "done")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 text-[11px] font-semibold"
                      >
                        <CheckCircle2 size={11} /> เสร็จแล้ว (ปิดงาน)
                      </button>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </div>

      {showCompose && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <GlassCard className="w-full max-w-md p-4 bg-aviva-bg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-aviva-text">สั่งงานถึงพนักงาน</h2>
              <button onClick={() => setShowCompose(false)}><X size={18} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ถึง</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full bg-aviva-card border border-aviva-gold/15 rounded-xl px-3 py-2 text-sm text-aviva-text"
                >
                  <option value="">— เลือกพนักงาน —</option>
                  {employees.map((e) => (
                    <option key={e.email} value={e.email}>{e.full_name}{e.department ? ` (${e.department})` : ""}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-aviva-secondary mb-1 block">อ้างอิงถึง (ไม่บังคับ)</label>
                  <input
                    type="text"
                    value={referenceNote}
                    onChange={(e) => setReferenceNote(e.target.value)}
                    placeholder="เช่น ชื่อลูกค้า / เลขที่บ้าน"
                    className="w-full bg-aviva-card border border-aviva-gold/15 rounded-xl px-3 py-2 text-sm text-aviva-text"
                  />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">กำหนดเสร็จ (ไม่บังคับ)</label>
                  <input
                    type="date"
                    value={dueDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-aviva-card border border-aviva-gold/15 rounded-xl px-3 py-2 text-sm text-aviva-text"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ข้อความสั่งงาน</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full bg-aviva-card border border-aviva-gold/15 rounded-xl px-3 py-2 text-sm text-aviva-text resize-none"
                  placeholder="เช่น ติดตามการแก้ไขบ้าน A07 ให้เสร็จภายในสัปดาห์นี้"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!assignedTo || !message.trim() || sending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-aviva-gold text-aviva-bg text-sm font-bold disabled:opacity-50"
              >
                <Send size={14} /> {sending ? "กำลังส่ง..." : "ส่งคำสั่งงาน"}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
