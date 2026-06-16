"use client";
// ระบบขออนุมัติก่อนซื้อ (Purchase Request)
// ขั้นตอน: เปิดคำขอ + ราคา → (≥ THRESHOLD ต้องอนุมัติ) → ผู้บริหารอนุมัติ → การเงินบันทึกจ่าย + ลงบัญชี
// ต่ำกว่าเกณฑ์ = อนุมัติอัตโนมัติ (ผ่านเงินสดย่อย/จ่ายได้เลย)
import { useCallback, useEffect, useState } from "react";
import { ShoppingCart, Plus, X, Check, Ban, Wallet, FileText, Clock, Bell } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { postJv } from "@/lib/jv";
import { resolveApprovalQueue, notifyPush } from "@/lib/workflow-events";
import { createNotification } from "@/lib/notify";
import { logAction } from "@/lib/audit";
import { useFocusHighlight } from "@/lib/use-focus-highlight";
import { createPurchaseRequest, PR_CATEGORIES, PR_THRESHOLD as THRESHOLD, PROJECT_ID, baht } from "@/lib/purchase-request";

interface PR {
  id: string;
  pr_number: string | null;
  category: string;
  item: string;
  reason: string | null;
  estimated_amount: number;
  quote_url: string | null;
  status: "pending" | "approved" | "rejected" | "purchased";
  requester: string | null;
  requester_dept: string | null;
  approver: string | null;
  reject_reason: string | null;
  paid_amount: number | null;
  needs_approval: boolean;
  created_at: string;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });

const STATUS_BADGE: Record<PR["status"], { label: string; cls: string }> = {
  pending:   { label: "รออนุมัติ", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  approved:  { label: "อนุมัติแล้ว · รอจ่าย", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  rejected:  { label: "ไม่อนุมัติ", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  purchased: { label: "จ่าย/ซื้อแล้ว", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
};

export default function PurchaseRequestPanel() {
  const user = useCurrentUser();
  const [rows, setRows] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // ฟอร์มสร้างคำขอ
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<string>(PR_CATEGORIES[0]);
  const [item, setItem] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [quoteUrl, setQuoteUrl] = useState("");

  // จ่ายเงิน / ปฏิเสธ
  const [paying, setPaying] = useState<PR | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [rejecting, setRejecting] = useState<PR | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ทวงถาม (ผู้ขอกดเตือนผู้อนุมัติ) — จำว่าทวงเรื่องไหนไปแล้ว + กำลังส่ง
  const [nudged, setNudged] = useState<Set<string>>(new Set());
  const [nudging, setNudging] = useState<string | null>(null);

  const canApprove = !!(user?.isManager || user?.isAdmin);
  const dept = user?.department ?? "";
  const role = (user?.role ?? "").toLowerCase();
  const canPay = canApprove || dept.includes("การเงิน") || dept.includes("บัญชี") ||
    role.includes("finance") || role.includes("account");
  const who = user?.full_name ?? user?.email ?? "ผู้ใช้";

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("purchase_requests")
      .select("*")
      .eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data as PR[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusHighlight();

  const openForm = () => {
    setCategory(PR_CATEGORIES[0]); setItem(""); setReason(""); setAmount(""); setQuoteUrl("");
    setErr(""); setShowForm(true);
  };

  const waitDays = (createdAt: string) => Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));

  // ผู้ขอกด "ทวงถาม" → เตือนผู้บริหารให้รีบอนุมัติ (จำกัด 1 ครั้ง/วัน/เรื่อง)
  const nudge = async (pr: PR) => {
    if (nudging) return;
    setNudging(pr.id); setErr("");
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("workflow_events")
      .select("id", { count: "exact", head: true })
      .eq("source_record_id", pr.id).eq("event_type", "reminded")
      .gte("created_at", todayStart.toISOString());
    if ((count ?? 0) > 0) {
      setNudged((s) => new Set(s).add(pr.id));
      setErr(`${pr.pr_number} — ทวงถามไปแล้ววันนี้ รอผู้บริหารดำเนินการค่ะ`);
      setNudging(null);
      return;
    }
    const d = waitDays(pr.created_at);
    await supabase.from("workflow_events").insert({
      project_id: PROJECT_ID, workflow_type: "Purchase_Request",
      source_record_id: pr.id, doc_index: pr.pr_number,
      event_type: "reminded", condition_note: `ผู้ขอทวงถาม (รอ ${d} วัน)`,
      actor_name: who, actor_role: user?.role ?? null,
    });
    await createNotification({
      type: "approval", title: "🔔 ทวงถามอนุมัติคำขอซื้อ",
      message: `${pr.pr_number} · ${pr.item} ${baht(pr.estimated_amount)} — รอมาแล้ว ${d} วัน (โดย ${who})`,
      from_dept: dept || undefined, to_dept: "ฝ่ายบริหาร", record_id: pr.id, link: "/office?tab=finance",
    });
    await notifyPush("ฝ่ายบริหาร", "🔔 ทวงถามอนุมัติ", `${pr.pr_number} · ${pr.item} — รอ ${d} วัน`, "/office?tab=finance", `nudge-${pr.id}`);
    setNudged((s) => new Set(s).add(pr.id));
    setNudging(null);
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!item.trim()) { setErr("กรุณาระบุรายการที่จะซื้อ"); return; }
    if (!amt || amt <= 0) { setErr("กรุณาระบุราคาประมาณที่ถูกต้อง"); return; }
    setSaving(true); setErr("");
    try {
      await createPurchaseRequest({
        category, item, reason, amount: amt, quoteUrl,
        requester: who, requesterDept: dept || null, requesterRole: user?.role ?? null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); setSaving(false); return;
    }
    setSaving(false); setShowForm(false); load();
  };

  const approve = async (pr: PR) => {
    setSaving(true); setErr("");
    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: "approved", approver: who, approved_at: new Date().toISOString() })
      .eq("id", pr.id);
    if (error) { setErr("อนุมัติไม่สำเร็จ"); setSaving(false); return; }
    await resolveApprovalQueue({
      workflowType: "Purchase_Request", sourceRecordId: pr.id, docIndex: pr.pr_number,
      approved: true, actorName: who, actorRole: user?.role ?? null,
    });
    await createNotification({
      type: "success", title: "อนุมัติคำขอซื้อแล้ว",
      message: `${pr.pr_number} · ${pr.item} ${baht(pr.estimated_amount)} — รอฝ่ายการเงินบันทึกจ่าย`,
      from_dept: "ฝ่ายบริหาร", to_dept: "ฝ่ายการเงิน", record_id: pr.id, link: "/office?tab=finance",
      line_to_depts: ["ฝ่ายการเงิน", pr.requester_dept ?? ""].filter(Boolean),
    });
    await logAction("office", "pr_approve", `อนุมัติคำขอซื้อ ${pr.pr_number} — ${pr.item}`, pr.id);
    setSaving(false); load();
  };

  const doReject = async () => {
    if (!rejecting) return;
    setSaving(true); setErr("");
    const pr = rejecting;
    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: "rejected", approver: who, approved_at: new Date().toISOString(), reject_reason: rejectReason.trim() || null })
      .eq("id", pr.id);
    if (error) { setErr("บันทึกไม่สำเร็จ"); setSaving(false); return; }
    await resolveApprovalQueue({
      workflowType: "Purchase_Request", sourceRecordId: pr.id, docIndex: pr.pr_number,
      approved: false, actorName: who, actorRole: user?.role ?? null,
      conditionNote: rejectReason.trim() || undefined,
    });
    await createNotification({
      type: "info", title: "คำขอซื้อไม่ได้รับอนุมัติ",
      message: `${pr.pr_number} · ${pr.item}${rejectReason.trim() ? ` — ${rejectReason.trim()}` : ""}`,
      from_dept: "ฝ่ายบริหาร", to_dept: pr.requester_dept ?? undefined, record_id: pr.id, link: "/office?tab=finance",
    });
    await logAction("office", "pr_reject", `ไม่อนุมัติคำขอซื้อ ${pr.pr_number} — ${pr.item}`, pr.id);
    setSaving(false); setRejecting(null); setRejectReason(""); load();
  };

  const openPay = (pr: PR) => { setPaying(pr); setPayAmount(String(pr.estimated_amount)); setErr(""); };

  const doPay = async () => {
    if (!paying) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { setErr("กรุณาระบุยอดจ่ายที่ถูกต้อง"); return; }
    setSaving(true); setErr("");
    const pr = paying;
    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
    // ลงบัญชี: เดบิต ค่าใช้จ่ายสำนักงาน / เครดิต เงินฝากธนาคาร
    await postJv({
      project_id: PROJECT_ID, jv_date: today,
      description: `[${pr.pr_number}] ${pr.item}`,
      ref_number: pr.pr_number,
      lines: [
        { account_code: "6600", account_name: "ค่าใช้จ่ายสำนักงาน", debit: amt, credit: 0 },
        { account_code: "1120", account_name: "เงินฝากธนาคาร", debit: 0, credit: amt },
      ],
    });
    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: "purchased", paid_amount: amt, paid_at: new Date().toISOString(), paid_by: who })
      .eq("id", pr.id);
    if (error) { setErr("บันทึกจ่ายไม่สำเร็จ"); setSaving(false); return; }
    await createNotification({
      type: "success", title: "จ่ายเงินคำขอซื้อแล้ว",
      message: `${pr.pr_number} · ${pr.item} — จ่าย ${baht(amt)} แล้ว`,
      from_dept: "ฝ่ายการเงิน", to_dept: pr.requester_dept ?? undefined, record_id: pr.id, link: "/office?tab=finance",
    });
    await logAction("office", "pr_pay", `บันทึกจ่ายคำขอซื้อ ${pr.pr_number} — ${pr.item} ${baht(amt)}`, pr.id);
    setSaving(false); setPaying(null); load();
  };

  const active = rows.filter((r) => r.status === "pending" || r.status === "approved");
  const recent = rows.filter((r) => r.status === "rejected" || r.status === "purchased").slice(0, 4);
  const amtNum = Number(amount);

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-aviva-gold" />
          <span className="text-sm font-semibold text-aviva-text">ขออนุมัติก่อนซื้อ</span>
        </div>
        <button onClick={openForm}
          className="flex items-center gap-1.5 bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/25 px-3 py-1.5 rounded-xl text-xs font-semibold">
          <Plus size={13} /> สร้างคำขอ
        </button>
      </div>
      <p className="text-[11px] text-aviva-secondary/80 mb-3">
        รายการตั้งแต่ {baht(THRESHOLD)} ขึ้นไป ต้องขออนุมัติก่อนซื้อ · ต่ำกว่านี้ผ่านได้เลย
      </p>

      {loading ? (
        <div className="text-[11px] text-aviva-secondary/70 text-center py-2">กำลังโหลด…</div>
      ) : active.length === 0 && recent.length === 0 ? (
        <div className="text-[11px] text-aviva-secondary/70 text-center py-2">
          ยังไม่มีคำขอซื้อ — กด &quot;สร้างคำขอ&quot; เพื่อเริ่ม
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((pr) => {
            const b = STATUS_BADGE[pr.status];
            return (
              <div key={pr.id} data-focus={pr.id} className="border border-aviva-gold/10 rounded-xl p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-aviva-text font-medium truncate">{pr.item}</div>
                    <div className="text-[10px] text-aviva-secondary/70 mt-0.5">
                      {pr.pr_number} · {pr.category} · {fmtDate(pr.created_at)}
                      {pr.requester ? ` · ${pr.requester}` : ""}
                    </div>
                    {pr.reason && <div className="text-[10px] text-aviva-secondary/60 mt-0.5 truncate">เหตุผล: {pr.reason}</div>}
                    {pr.quote_url && (
                      <a href={pr.quote_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-aviva-gold mt-0.5">
                        <FileText size={10} /> ใบเสนอราคา
                      </a>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-aviva-gold">{baht(pr.estimated_amount)}</div>
                    <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full border ${b.cls}`}>{b.label}</span>
                  </div>
                </div>
                {/* ปุ่มดำเนินการตามบทบาท */}
                {pr.status === "pending" && canApprove && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => approve(pr)} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1 bg-green-500/15 text-green-400 border border-green-500/25 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50">
                      <Check size={12} /> อนุมัติ
                    </button>
                    <button onClick={() => { setRejecting(pr); setRejectReason(""); setErr(""); }} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1 bg-red-500/15 text-red-400 border border-red-500/25 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50">
                      <Ban size={12} /> ปฏิเสธ
                    </button>
                  </div>
                )}
                {pr.status === "pending" && !canApprove && (
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <span className={`flex items-center gap-1 text-[10px] ${waitDays(pr.created_at) >= 2 ? "text-red-400" : "text-yellow-400/80"}`}>
                      <Clock size={10} /> รออนุมัติ · {waitDays(pr.created_at)} วัน{waitDays(pr.created_at) >= 2 ? " (เกินกำหนด)" : ""}
                    </span>
                    <button onClick={() => nudge(pr)} disabled={nudging === pr.id || nudged.has(pr.id)}
                      className="flex items-center gap-1 text-[10px] font-semibold bg-aviva-gold/15 text-aviva-gold border border-aviva-gold/25 px-2 py-1 rounded-lg disabled:opacity-50">
                      <Bell size={10} /> {nudged.has(pr.id) ? "ทวงแล้ว" : nudging === pr.id ? "กำลังส่ง…" : "ทวงถาม"}
                    </button>
                  </div>
                )}
                {pr.status === "approved" && canPay && (
                  <button onClick={() => openPay(pr)} disabled={saving}
                    className="w-full flex items-center justify-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/25 py-1.5 rounded-lg text-[11px] font-semibold mt-2 disabled:opacity-50">
                    <Wallet size={12} /> บันทึกจ่าย
                  </button>
                )}
                {pr.status === "approved" && !canPay && (
                  <div className="flex items-center gap-1 text-[10px] text-blue-400/80 mt-1.5">
                    <Clock size={10} /> อนุมัติแล้ว — รอฝ่ายการเงินจ่าย
                  </div>
                )}
              </div>
            );
          })}

          {recent.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] text-aviva-secondary/60 mb-1">ล่าสุด</p>
              {recent.map((pr) => {
                const b = STATUS_BADGE[pr.status];
                return (
                  <div key={pr.id} className="flex items-center justify-between text-[11px] py-1 opacity-75">
                    <span className="truncate text-aviva-secondary">{pr.pr_number} · {pr.item}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-aviva-secondary">{baht(pr.paid_amount ?? pr.estimated_amount)}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${b.cls}`}>{b.label}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ฟอร์มสร้างคำขอ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="w-full max-w-sm bg-aviva-bg border border-aviva-gold/20 rounded-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-aviva-text">สร้างคำขอซื้อ</h3>
              <button onClick={() => !saving && setShowForm(false)} className="text-aviva-secondary"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-aviva-secondary">หมวด</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text">
                  {PR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary">รายการที่จะซื้อ/ติดตั้ง</label>
                <input type="text" value={item} onChange={(e) => setItem(e.target.value)}
                  placeholder="เช่น ฟิล์มกรองแสงกระจกหน้าสำนักงาน"
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary">เหตุผล/รายละเอียด (ถ้ามี)</label>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="เช่น ลดความร้อน/แสงจ้าหน้าเคาน์เตอร์"
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary">ราคาประมาณ (บาท)</label>
                <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="เช่น 4500"
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
                {amtNum > 0 && (
                  <p className={`text-[11px] mt-1 ${amtNum >= THRESHOLD ? "text-yellow-400" : "text-green-400"}`}>
                    {amtNum >= THRESHOLD
                      ? `≥ ${baht(THRESHOLD)} → ต้องขออนุมัติก่อนซื้อ`
                      : `ต่ำกว่า ${baht(THRESHOLD)} → อนุมัติอัตโนมัติ พร้อมจ่ายได้เลย`}
                  </p>
                )}
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary">ลิงก์ใบเสนอราคา (ถ้ามี)</label>
                <input type="url" value={quoteUrl} onChange={(e) => setQuoteUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
              {err && <div className="text-[11px] text-red-400">{err}</div>}
              <button onClick={submit} disabled={saving}
                className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                {saving ? "กำลังบันทึก…" : "ส่งคำขอ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* บันทึกจ่าย */}
      {paying && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => !saving && setPaying(null)}>
          <div className="w-full max-w-sm bg-aviva-bg border border-aviva-gold/20 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-aviva-text">บันทึกจ่าย</h3>
              <button onClick={() => !saving && setPaying(null)} className="text-aviva-secondary"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] text-aviva-secondary">
                {paying.pr_number} · {paying.item} · ประมาณ {baht(paying.estimated_amount)}
              </div>
              <div>
                <label className="text-[11px] text-aviva-secondary">ยอดจ่ายจริง (บาท)</label>
                <input type="number" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
                <p className="text-[10px] text-aviva-secondary/60 mt-1">ลงบัญชีอัตโนมัติ: เดบิตค่าใช้จ่ายสำนักงาน / เครดิตเงินฝากธนาคาร</p>
              </div>
              {err && <div className="text-[11px] text-red-400">{err}</div>}
              <button onClick={doPay} disabled={saving}
                className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                {saving ? "กำลังบันทึก…" : "ยืนยันจ่าย"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ปฏิเสธ */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => !saving && setRejecting(null)}>
          <div className="w-full max-w-sm bg-aviva-bg border border-aviva-gold/20 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-aviva-text">ปฏิเสธคำขอซื้อ</h3>
              <button onClick={() => !saving && setRejecting(null)} className="text-aviva-secondary"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] text-aviva-secondary">{rejecting.pr_number} · {rejecting.item}</div>
              <div>
                <label className="text-[11px] text-aviva-secondary">เหตุผลที่ไม่อนุมัติ (ถ้ามี)</label>
                <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="เช่น ขอใบเสนอราคาเปรียบเทียบเพิ่ม"
                  className="w-full mt-1 bg-aviva-card border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text" />
              </div>
              {err && <div className="text-[11px] text-red-400">{err}</div>}
              <button onClick={doReject} disabled={saving}
                className="w-full bg-red-500/90 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                {saving ? "กำลังบันทึก…" : "ยืนยันปฏิเสธ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
