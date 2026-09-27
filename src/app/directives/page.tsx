"use client";
import { useEffect, useState, useCallback } from "react";
import { Send, Plus, X, MessageSquareText, CheckCircle2, Clock, PlayCircle, BadgeCheck, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import { sendDirective, updateDirectiveStatus, closeDirective, returnDirective, type Directive, type DirectiveStatus } from "@/lib/directives";
import GlassCard from "@/components/GlassCard";
import { thaiDateStr } from "@/lib/thai-date";
import { loadWorkSchedule, loadHolidays, dueDateFromWorkingDays, DEFAULT_SCHEDULE, type WorkSchedule } from "@/lib/work-schedule";

type Tab = "received" | "sent";

interface EmployeeOption {
  email: string;
  full_name: string;
  department: string | null;
  weekly_off_day: number | null;
}

const STATUS_META: Record<DirectiveStatus, { label: string; cls: string }> = {
  sent: { label: "ส่งแล้ว", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  acknowledged: { label: "รับทราบแล้ว", cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  in_progress: { label: "กำลังดำเนินการ", cls: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  done: { label: "รอผู้สั่งตรวจรับ", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  closed: { label: "ปิดจ็อบแล้ว", cls: "bg-green-500/10 text-green-400 border-green-500/30" },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** ระยะห่างจากเวลาหนึ่งถึงตอนนี้ (หรือถึงอีกเวลาหนึ่ง) แบบอ่านง่าย */
function elapsed(fromIso: string, toIso?: string | null): string {
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime();
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins} นาที`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} ชั่วโมง`;
  return `${Math.round(hrs / 24)} วัน`;
}

/** แถวไทม์ไลน์ 1 ขั้น */
function Step({ label, at, note, tone = "normal" }: { label: string; at?: string | null; note?: string | null; tone?: "normal" | "pending" | "warn" | "ok" }) {
  const dot = tone === "ok" ? "bg-green-400" : tone === "warn" ? "bg-amber-400" : at ? "bg-aviva-gold" : "bg-aviva-secondary/30";
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center pt-1">
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <span className="flex-1 w-px bg-aviva-gold/10 mt-1" />
      </div>
      <div className="pb-3 min-w-0 flex-1">
        <p className={`text-[13px] font-bold ${at ? "text-aviva-text" : "text-aviva-secondary/50"}`}>{label}</p>
        {at ? <p className="text-[13px] text-aviva-secondary mt-0.5">{formatDateTime(at)}</p>
            : <p className="text-[13px] text-aviva-secondary/50 mt-0.5">ยังไม่ถึงขั้นนี้</p>}
        {note && <p className="text-[13px] text-aviva-text/90 mt-1 leading-relaxed break-words">{note}</p>}
      </div>
    </div>
  );
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
  const [dueDays, setDueDays] = useState<number | null>(null);      // จำนวนวันทำงานที่เลือกไว้ (null = เลือกวันเอง)
  const [skipOffDays, setSkipOffDays] = useState(true);             // ข้ามวันหยุดของผู้รับงาน
  const [holidays, setHolidays] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<WorkSchedule>(DEFAULT_SCHEDULE);
  const [sending, setSending] = useState(false);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [closeErrors, setCloseErrors] = useState<Record<string, string>>({});
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});   // ความเห็นผู้สั่งตอนตรวจรับ
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});   // เปิดดูรายละเอียด/ไทม์ไลน์
  const todayStr = thaiDateStr();

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
      .select("email, full_name, department, weekly_off_day")
      .eq("status", "active")
      .order("full_name")
      .then(({ data }) => setEmployees((data ?? []).filter((e) => e.email) as EmployeeOption[]));
  }, [user]);

  // โหลดวันหยุดบริษัท + ตารางงาน เพื่อคำนวณ "กี่วันทำงาน" ให้ตรงความจริง
  useEffect(() => {
    if (!user?.isManager) return;
    loadWorkSchedule().then(setSchedule).catch(() => {});
    loadHolidays().then((h) => setHolidays(h.map((x) => x.holiday_date))).catch(() => {});
  }, [user]);

  // เลือก "เสร็จใน N วันทำงาน" → คำนวณวันที่จริง โดยข้ามวันหยุดของผู้รับงานคนนั้น
  const pickDueDays = (days: number) => {
    setDueDays(days);
    const emp = employees.find((e) => e.email === assignedTo);
    const off = skipOffDays ? (emp?.weekly_off_day ?? null) : null;
    const companyOff = skipOffDays ? schedule.weekly_off_days : [];
    const hol = skipOffDays ? holidays : [];
    setDueDate(dueDateFromWorkingDays(thaiDateStr(), days, off, companyOff, hol));
  };

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
      setAssignedTo(""); setDepartment(""); setMessage(""); setReferenceNote(""); setDueDate(""); setDueDays(null);
      if (tab === "sent") load();
    }
  };

  // ปิดงาน "เสร็จแล้ว" ต้องมีรายงานปิดงานแนบเสมอ (กันปิดจ็อบเงียบๆ ไม่มีใครรู้ว่าทำอะไรไปบ้าง)
  const handleStatusUpdate = async (d: Directive, status: DirectiveStatus) => {
    const note = responseDrafts[d.id]?.trim() ?? "";
    if (status === "done" && !note) {
      setCloseErrors((p) => ({ ...p, [d.id]: "กรุณาเขียนรายงานผลงานก่อนส่งให้ผู้สั่งตรวจรับ" }));
      return;
    }
    setCloseErrors((p) => ({ ...p, [d.id]: "" }));
    await updateDirectiveStatus(d, status, note || undefined);
    load();
  };

  // ผู้สั่งงานตรวจรับแล้วปิดจ็อบ — ความเห็นไม่บังคับ
  const handleClose = async (d: Directive) => {
    if (!user) return;
    setReviewing(d.id); setReviewErrors((p) => ({ ...p, [d.id]: "" }));
    const r = await closeDirective(d, user.email, reviewDrafts[d.id] ?? "");
    setReviewing(null);
    if (!r.ok) { setReviewErrors((p) => ({ ...p, [d.id]: r.error ?? "ปิดจ็อบไม่สำเร็จ" })); return; }
    setReviewDrafts((p) => ({ ...p, [d.id]: "" }));
    load();
  };

  // ตีกลับให้แก้ — ต้องเขียนเหตุผลเสมอ เพื่อให้พนักงานรู้ว่าต้องแก้อะไร
  const handleReturn = async (d: Directive) => {
    const reason = (reviewDrafts[d.id] ?? "").trim();
    if (!reason) {
      setReviewErrors((p) => ({ ...p, [d.id]: "กรุณาเขียนสิ่งที่ต้องแก้ก่อนตีกลับ" }));
      return;
    }
    setReviewing(d.id); setReviewErrors((p) => ({ ...p, [d.id]: "" }));
    const r = await returnDirective(d, reason);
    setReviewing(null);
    if (!r.ok) { setReviewErrors((p) => ({ ...p, [d.id]: r.error ?? "ตีกลับไม่สำเร็จ" })); return; }
    setReviewDrafts((p) => ({ ...p, [d.id]: "" }));
    load();
  };

  const pendingReview = items.filter((d) => d.status === "done").length;

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
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-aviva-gold text-aviva-bg text-[14px] font-bold"
            >
              <Plus size={14} /> สั่งงาน
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab("received")}
            className={`flex-1 py-2.5 rounded-xl text-[14px] font-bold ${tab === "received" ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-card text-aviva-secondary border border-aviva-gold/10"}`}
          >
            ที่ได้รับ
          </button>
          {user.isManager && (
            <button
              onClick={() => setTab("sent")}
              className={`flex-1 py-2.5 rounded-xl text-[14px] font-bold ${tab === "sent" ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-card text-aviva-secondary border border-aviva-gold/10"}`}
            >
              ที่ฉันสั่ง{tab === "sent" && pendingReview > 0 ? ` · รอตรวจรับ ${pendingReview}` : ""}
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
            const overdue = !!d.due_date && d.due_date < todayStr && d.status !== "done" && d.status !== "closed";
            return (
              <GlassCard key={d.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-aviva-secondary font-medium">
                    {tab === "received" ? `จาก ${d.created_by_name || d.created_by}` : `ถึง ${d.assigned_to_name || d.assigned_to}`}
                    {d.department && ` · ${d.department}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {overdue && (
                      <span className="text-[12px] px-2 py-0.5 rounded-full border font-bold bg-red-500/10 text-red-400 border-red-500/30">เกินกำหนด</span>
                    )}
                    <span className={`text-[12px] px-2.5 py-1 rounded-full border font-bold ${meta.cls}`}>{meta.label}</span>
                  </div>
                </div>
                <p className="text-[15px] text-aviva-text leading-relaxed whitespace-pre-line">{d.message}</p>
                {d.reference_note && <p className="text-[13px] text-aviva-gold mt-1.5 font-medium">อ้างอิง: {d.reference_note}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <p className="text-[13px] text-aviva-secondary">สั่งเมื่อ {formatDateTime(d.created_at)}</p>
                  {d.due_date ? (
                    <p className={`text-[13px] ${overdue ? "text-red-400 font-semibold" : "text-aviva-secondary"}`}>
                      · กำหนดเสร็จ {new Date(d.due_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                      {overdue ? ` (เลยมา ${Math.max(1, Math.round((Date.now() - new Date(d.due_date + "T23:59:59+07:00").getTime()) / 86400000))} วัน)` : ""}
                    </p>
                  ) : (
                    <p className="text-[13px] text-amber-400/80">· ไม่ได้กำหนดวันเสร็จ</p>
                  )}
                  {d.status === "sent" && (
                    <p className="text-[13px] text-amber-400">· ยังไม่กดรับทราบ ({elapsed(d.created_at)})</p>
                  )}
                </div>

                <button
                  onClick={() => setExpanded((p) => ({ ...p, [d.id]: !p[d.id] }))}
                  className={`mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border transition-colors ${
                    expanded[d.id]
                      ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                      : "bg-aviva-gold/15 text-aviva-gold border-aviva-gold/40"
                  }`}
                >
                  {expanded[d.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {expanded[d.id] ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                </button>

                {expanded[d.id] && (
                  <div className="mt-3 pt-3 border-t border-aviva-gold/10">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-4">
                      <p className="text-[13px] text-aviva-secondary">ผู้สั่งงาน</p>
                      <p className="text-[13px] text-aviva-text text-right font-medium">{d.created_by_name || d.created_by}</p>
                      <p className="text-[13px] text-aviva-secondary">ผู้รับคำสั่ง</p>
                      <p className="text-[13px] text-aviva-text text-right font-medium">{d.assigned_to_name || d.assigned_to}</p>
                      {d.department && (<><p className="text-[13px] text-aviva-secondary">แผนก</p><p className="text-[13px] text-aviva-text text-right font-medium">{d.department}</p></>)}
                      {d.reference_note && (<><p className="text-[13px] text-aviva-secondary">อ้างอิงถึง</p><p className="text-[13px] text-aviva-text text-right font-medium">{d.reference_note}</p></>)}
                      <p className="text-[13px] text-aviva-secondary">ใช้เวลาไปแล้ว</p>
                      <p className="text-[13px] text-aviva-text text-right font-medium">
                        {elapsed(d.created_at, d.closed_at)}{d.closed_at ? " (จนปิดจ็อบ)" : " (นับถึงตอนนี้)"}
                      </p>
                      {d.return_count > 0 && (<><p className="text-[13px] text-aviva-secondary">ตีกลับให้แก้</p><p className="text-[13px] text-amber-400 text-right font-bold">{d.return_count} ครั้ง</p></>)}
                    </div>

                    <p className="text-[13px] font-bold text-aviva-gold mb-3">ความเคลื่อนไหวของงาน</p>
                    <Step label="ผู้สั่งงานส่งคำสั่ง" at={d.created_at} note={d.message} />
                    <Step label="ผู้รับกดรับทราบ" at={d.acknowledged_at} tone={d.status === "sent" ? "warn" : "normal"} />
                    <Step label="เริ่มลงมือทำ" at={d.status === "in_progress" || d.done_at || d.closed_at ? (d.acknowledged_at ?? d.created_at) : null} />
                    <Step label="รายงานผล · ส่งให้ตรวจรับ" at={d.done_at} note={d.response_note} />
                    {d.returned_at && <Step label="ผู้สั่งตีกลับให้แก้" at={d.returned_at} note={d.return_note} tone="warn" />}
                    <Step label="ผู้สั่งตรวจรับ · ปิดจ็อบ" at={d.closed_at} note={d.close_note} tone={d.closed_at ? "ok" : "normal"} />
                  </div>
                )}
                {d.response_note && (
                  <div className="mt-2 pt-2 border-t border-aviva-gold/10">
                    <p className="text-[14px] text-aviva-secondary">
                      {d.status === "done" || d.status === "closed" ? "รายงานผลงานจากพนักงาน" : "ความคืบหน้า"}: {d.response_note}
                    </p>
                  </div>
                )}
                {d.return_note && d.status !== "closed" && (
                  <div className="mt-2 pt-2 border-t border-aviva-gold/10">
                    <p className="text-[14px] text-amber-400">
                      🔁 ผู้สั่งงานตีกลับให้แก้{d.return_count > 1 ? ` (ครั้งที่ ${d.return_count})` : ""}: {d.return_note}
                    </p>
                  </div>
                )}
                {d.status === "closed" && (
                  <div className="mt-2 pt-2 border-t border-green-500/20">
                    <p className="text-[14px] text-green-400">
                      ✅ ผู้สั่งงานตรวจรับและปิดจ็อบแล้ว{d.closed_at ? ` · ${formatDateTime(d.closed_at)}` : ""}
                      {d.return_count > 0 ? ` · ตีกลับให้แก้ ${d.return_count} ครั้งก่อนผ่าน` : ""}
                    </p>
                    {d.close_note && <p className="text-[14px] text-aviva-secondary mt-1">ความเห็นผู้สั่งงาน: {d.close_note}</p>}
                  </div>
                )}

                {tab === "sent" && d.status === "done" && (
                  <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2">
                    <p className="text-[13px] text-amber-400 font-semibold">
                      พนักงานรายงานว่าทำเสร็จแล้ว — กรุณาตรวจรับ
                    </p>
                    <input
                      type="text"
                      placeholder="ความเห็น (ไม่บังคับตอนปิดจ็อบ · บังคับตอนตีกลับ)"
                      value={reviewDrafts[d.id] ?? ""}
                      onChange={(e) => setReviewDrafts((p) => ({ ...p, [d.id]: e.target.value }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/15 rounded-lg px-3 py-2.5 text-[14px] text-aviva-text"
                    />
                    {reviewErrors[d.id] && <p className="text-[13px] text-red-400">{reviewErrors[d.id]}</p>}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleClose(d)}
                        disabled={reviewing === d.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 text-[13px] font-semibold disabled:opacity-50"
                      >
                        <BadgeCheck size={11} /> {reviewing === d.id ? "กำลังบันทึก…" : "ตรวจรับ · ปิดจ็อบ"}
                      </button>
                      <button
                        onClick={() => handleReturn(d)}
                        disabled={reviewing === d.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[13px] font-semibold disabled:opacity-50"
                      >
                        <RotateCcw size={11} /> ตีกลับให้แก้
                      </button>
                    </div>
                  </div>
                )}

                {tab === "received" && d.status === "done" && (
                  <div className="mt-3 pt-3 border-t border-amber-500/20">
                    <p className="text-[13px] text-amber-400">
                      รายงานผลไปแล้ว — รอ {d.created_by_name || "ผู้สั่งงาน"} ตรวจรับและปิดจ็อบ
                    </p>
                  </div>
                )}

                {tab === "received" && d.status !== "done" && d.status !== "closed" && (
                  <div className="mt-3 pt-3 border-t border-aviva-gold/10 space-y-2">
                    <input
                      type="text"
                      placeholder="เขียนรายงานผลงาน (บังคับตอนส่งให้ตรวจรับ)"
                      value={responseDrafts[d.id] ?? ""}
                      onChange={(e) => setResponseDrafts((p) => ({ ...p, [d.id]: e.target.value }))}
                      className="w-full bg-aviva-bg border border-aviva-gold/15 rounded-lg px-3 py-2.5 text-[14px] text-aviva-text"
                    />
                    {closeErrors[d.id] && <p className="text-[13px] text-red-400">{closeErrors[d.id]}</p>}
                    <div className="flex gap-1.5">
                      {d.status === "sent" && (
                        <button
                          onClick={() => handleStatusUpdate(d, "acknowledged")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[13px] font-bold"
                        >
                          <Clock size={11} /> รับทราบ
                        </button>
                      )}
                      {(d.status === "sent" || d.status === "acknowledged") && (
                        <button
                          onClick={() => handleStatusUpdate(d, "in_progress")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[13px] font-bold"
                        >
                          <PlayCircle size={11} /> กำลังทำ
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusUpdate(d, "done")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 text-[13px] font-semibold"
                      >
                        <CheckCircle2 size={11} /> ทำเสร็จแล้ว · ส่งให้ตรวจรับ
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
                <label className="text-[13px] text-aviva-secondary mb-1.5 block">ถึง</label>
                <select
                  value={assignedTo}
                  onChange={(e) => { setAssignedTo(e.target.value); if (dueDays !== null) setTimeout(() => pickDueDays(dueDays), 0); }}
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
                  <label className="text-[13px] text-aviva-secondary mb-1.5 block">อ้างอิงถึง (ไม่บังคับ)</label>
                  <input
                    type="text"
                    value={referenceNote}
                    onChange={(e) => setReferenceNote(e.target.value)}
                    placeholder="เช่น ชื่อลูกค้า / เลขที่บ้าน"
                    className="w-full bg-aviva-card border border-aviva-gold/15 rounded-xl px-3 py-2 text-sm text-aviva-text"
                  />
                </div>
              </div>
              <div>
                <label className="text-[13px] text-aviva-secondary mb-1.5 block">ต้องเสร็จภายใน</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { d: 0, label: "ภายในวันนี้" },
                    { d: 1, label: "1 วัน" },
                    { d: 2, label: "2 วัน" },
                    { d: 3, label: "3 วัน" },
                    { d: 5, label: "5 วัน" },
                    { d: 7, label: "1 สัปดาห์" },
                  ].map((o) => (
                    <button key={o.d} type="button" onClick={() => pickDueDays(o.d)}
                      className={`px-2.5 py-1.5 rounded-lg text-[13px] font-semibold border ${
                        dueDays === o.d
                          ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                          : "bg-aviva-card text-aviva-secondary border-aviva-gold/15"}`}>
                      {o.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => { setDueDays(null); setDueDate(""); }}
                    className={`px-2.5 py-1.5 rounded-lg text-[13px] font-semibold border ${
                      dueDays === null && !dueDate
                        ? "bg-aviva-card text-aviva-secondary border-aviva-gold/40"
                        : "bg-aviva-card text-aviva-secondary/70 border-aviva-gold/15"}`}>
                    เลือกวันเอง
                  </button>
                </div>

                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={skipOffDays}
                    onChange={(e) => { setSkipOffDays(e.target.checked); if (dueDays !== null) setTimeout(() => pickDueDays(dueDays), 0); }}
                    className="accent-aviva-gold" />
                  <span className="text-[13px] text-aviva-secondary">
                    นับเฉพาะวันทำงาน — ข้ามวันหยุดประจำสัปดาห์ของผู้รับงานและวันหยุดบริษัท
                  </span>
                </label>

                <input
                  type="date"
                  value={dueDate}
                  min={thaiDateStr()}
                  onChange={(e) => { setDueDate(e.target.value); setDueDays(null); }}
                  className="w-full mt-2 bg-aviva-card border border-aviva-gold/15 rounded-xl px-3 py-2 text-sm text-aviva-text"
                />
                {dueDate ? (
                  <p className="text-[13px] text-aviva-gold mt-1">
                    ครบกำหนด {new Date(dueDate + "T12:00:00Z").toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    {dueDays !== null && skipOffDays ? " (คำนวณข้ามวันหยุดของผู้รับแล้ว)" : ""}
                  </p>
                ) : (
                  <p className="text-[13px] text-amber-400/80 mt-1">ยังไม่กำหนดวันเสร็จ — งานที่ไม่มีเส้นตายมักค้างโดยไม่มีใครตาม</p>
                )}
              </div>
              <div>
                <label className="text-[13px] text-aviva-secondary mb-1.5 block">ข้อความสั่งงาน</label>
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
