"use client";
// แถบขั้นตอนงาน "รับจอง" บนการ์ดลูกค้า — พนักงานไม่ต้องจำ workflow เอง
// เห็นทันทีว่าอยู่ขั้นไหน ใครต้องทำอะไรต่อ และมีปุ่มของขั้นที่ตัวเองทำได้อยู่ตรงนั้นเลย
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { CheckCircle2, Circle, Loader2, Paperclip, Printer, CalendarPlus, ExternalLink, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { thaiDateStr } from "@/lib/thai-date";
import { thaiDbError } from "@/lib/db-errors";
import { checkUploadFile } from "@/lib/upload-photos";
import { defaultInstallments } from "@/lib/payment-plan";
import {
  loadBookingFlow, syncBookingQueue, bookingProgress, currentBookingStep,
  OWNER_LABEL, type BookingStep, type BookingFlowFacts,
} from "@/lib/booking-flow";

export default function BookingFlowCard({
  leadId, customerName, salePrice, onPrintBooking, onChanged,
}: {
  leadId: string;
  customerName: string;
  salePrice: number;
  onPrintBooking?: () => void;
  onChanged?: () => void;
}) {
  const user = useCurrentUser();
  const [steps, setSteps] = useState<BookingStep[] | null>(null);
  const [facts, setFacts] = useState<BookingFlowFacts | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [appointDate, setAppointDate] = useState("");

  const refresh = useCallback(async (autoCreateInstallments = true) => {
    const res = await loadBookingFlow(leadId);
    if (!res) { setSteps(null); setFacts(null); return; }

    // ขั้นที่ 5 เป็นงานของระบบ: อนุมัติแล้ว + รับเงินแล้ว แต่ยังไม่มีตารางผ่อน → สร้างให้เลย
    const needInstallments = autoCreateInstallments
      && res.facts.installmentCount === 0
      && res.steps.find(s => s.key === "installments")?.state === "current";
    if (needInstallments) {
      const rows = defaultInstallments(salePrice, res.facts.lead.booking_deposit)
        .map(r => ({ ...r, lead_id: leadId, house_id: null, status: "pending" as const }));
      const { error } = await supabase.from("customer_installments").insert(rows);
      if (!error) { onChanged?.(); return refresh(false); }
    }

    setSteps(res.steps);
    setFacts(res.facts);
    void syncBookingQueue(leadId, customerName, res.steps, user?.full_name ?? user?.email ?? null);
  }, [leadId, customerName, salePrice, user?.full_name, user?.email, onChanged]);

  useEffect(() => { void refresh(); }, [refresh]);

  const patchLead = async (patch: Record<string, unknown>, label: string) => {
    setBusy(label); setErr("");
    const { error } = await supabase.from("leads")
      .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", leadId);
    setBusy("");
    if (error) { setErr(thaiDbError(error, label)); return false; }
    onChanged?.();
    await refresh();
    return true;
  };

  const uploadSlip = async (file: File) => {
    const bad = checkUploadFile(file);
    if (bad) { setErr(bad); return; }
    setBusy("แนบสลิป"); setErr("");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `entity-docs/lead/${leadId}/deposit-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("document-attachments").upload(path, file, { upsert: true });
    if (error) { setErr(thaiDbError(error, "แนบสลิป")); setBusy(""); return; }
    const { data: { publicUrl } } = supabase.storage.from("document-attachments").getPublicUrl(path);
    setBusy("");
    await patchLead({
      deposit_slip_url: publicUrl,
      deposit_received_at: new Date().toISOString(),
      deposit_received_by: user?.full_name ?? user?.email ?? null,
    }, "บันทึกการรับเงินจอง");
  };

  if (!steps) return null;
  const { done, total } = bookingProgress(steps);
  const cur = currentBookingStep(steps);
  const allDone = done === total;

  return (
    <div className="col-span-2 bg-aviva-bg border border-aviva-gold/25 rounded-2xl overflow-hidden">
      <div className="px-3.5 py-3 bg-aviva-gold/5 border-b border-aviva-gold/15">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-aviva-gold">ขั้นตอนงานรับจอง</p>
          <span className="text-xs font-bold text-aviva-text">{done}/{total} ขั้น</span>
        </div>
        <p className="text-xs text-aviva-secondary mt-1 leading-relaxed">
          {allDone
            ? "ครบทุกขั้นแล้ว — ส่งต่อเข้ากระบวนการทำสัญญาได้เลย"
            : cur ? <>ตอนนี้รอ: <b className="text-aviva-text">{cur.title}</b> ({OWNER_LABEL[cur.owner]})</> : "รอขั้นก่อนหน้าให้เสร็จก่อน"}
        </p>
        <div className="flex gap-1 mt-2">
          {steps.map(s => (
            <span key={s.key} className={clsx("h-1.5 flex-1 rounded-full",
              s.state === "done" ? "bg-green-400" : s.state === "current" ? "bg-aviva-gold" : "bg-aviva-gold/15")} />
          ))}
        </div>
      </div>

      {err && <p className="px-3.5 py-2 text-xs text-red-300 bg-red-500/10">{err}</p>}

      <ol className="divide-y divide-aviva-gold/10">
        {steps.map(s => (
          <li key={s.key} className={clsx("px-3.5 py-2.5", s.state === "current" && "bg-aviva-gold/[0.07]")}>
            <div className="flex items-start gap-2.5">
              {s.state === "done"
                ? <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                : s.state === "current"
                  ? <Clock size={16} className="text-aviva-gold flex-shrink-0 mt-0.5" />
                  : <Circle size={16} className="text-aviva-secondary/40 flex-shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className={clsx("text-xs font-semibold",
                  s.state === "waiting" ? "text-aviva-secondary/60" : "text-aviva-text")}>
                  {s.no}. {s.title}
                </p>
                <p className="text-[11px] text-aviva-secondary mt-0.5 leading-relaxed">
                  {s.detail ?? (s.auto ? OWNER_LABEL[s.owner] : `ผู้รับผิดชอบ: ${OWNER_LABEL[s.owner]}`)}
                </p>

                {/* ปุ่มของขั้นที่ถึงคิว — โชว์เฉพาะขั้นที่ทำได้ตอนนี้ */}
                {s.state === "current" && s.key === "slip" && (
                  <label className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-aviva-gold/10 border border-aviva-gold/40 text-aviva-gold text-xs font-bold cursor-pointer">
                    {busy === "แนบสลิป" ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
                    แนบสลิป + ยืนยันรับเงินจอง
                    <input type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) void uploadSlip(f); }} />
                  </label>
                )}
                {s.state === "current" && s.key === "approve" && (
                  <Link href={`/approvals?focus=${leadId}`}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-aviva-gold/10 border border-aviva-gold/40 text-aviva-gold text-xs font-bold">
                    <ExternalLink size={13} /> ไปหน้าอนุมัติ
                  </Link>
                )}
                {s.state === "current" && s.key === "doc" && (
                  <button type="button" disabled={busy === "ออกใบจอง"}
                    onClick={async () => { onPrintBooking?.(); await patchLead({ booking_doc_at: new Date().toISOString() }, "ออกใบจอง"); }}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-aviva-gold/10 border border-aviva-gold/40 text-aviva-gold text-xs font-bold disabled:opacity-50">
                    {busy === "ออกใบจอง" ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} พิมพ์ใบจอง + บันทึกว่าออกแล้ว
                  </button>
                )}
                {s.state === "current" && s.key === "posted" && (
                  <p className="mt-2 text-[11px] text-aviva-gold leading-relaxed">
                    ฝ่ายการเงินเปิด &ldquo;ตารางชำระเงินลูกค้า&rdquo; ด้านล่างนี้ → กด &ldquo;ชำระแล้ว&rdquo; ที่งวดจอง ระบบจะลงบัญชีรับเงินให้อัตโนมัติ
                  </p>
                )}
                {s.state === "current" && s.key === "contract_date" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="date" value={appointDate} min={thaiDateStr()} onChange={e => setAppointDate(e.target.value)}
                      className="flex-1 bg-aviva-card border border-aviva-gold/25 rounded-xl px-2.5 py-2 text-xs text-aviva-text outline-none focus:border-aviva-gold/50" />
                    <button type="button" disabled={!appointDate || busy === "บันทึกวันนัดทำสัญญา"}
                      onClick={() => patchLead({ contract_appointment_date: appointDate, next_follow_up_date: appointDate }, "บันทึกวันนัดทำสัญญา")}
                      className="px-3 py-2 rounded-xl bg-aviva-gold text-aviva-bg text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1.5">
                      {busy === "บันทึกวันนัดทำสัญญา" ? <Loader2 size={13} className="animate-spin" /> : <CalendarPlus size={13} />} บันทึก
                    </button>
                  </div>
                )}
                {s.key === "slip" && s.state === "done" && facts?.lead.deposit_slip_url && (
                  <a href={facts.lead.deposit_slip_url} target="_blank" rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-aviva-gold font-semibold">
                    <Paperclip size={11} /> ดูหลักฐานการรับเงิน
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
