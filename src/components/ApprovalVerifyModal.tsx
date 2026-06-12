import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, CheckCircle, XCircle, AlertTriangle, ExternalLink, Loader2, ShieldCheck, Paperclip, FileText } from "lucide-react";
import clsx from "clsx";
import ApprovalRouteBar from "./ApprovalRouteBar";
import { type ApprovalSummaryInput } from "@/lib/approval-matrix";
import { fetchApprovalSource, buildVerification, type VerifyData } from "@/lib/approval-source";
import { attachDocumentToEntity, getEntityDocuments } from "@/lib/doc-attach";
import { toSignedUrl } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { formatNumber } from "@/lib/thai-baht";

const isImg = (u: string | null) => !!u && /\.(jpg|jpeg|png|gif|webp)$/i.test(u.split("?")[0]);

export interface VerifyLog extends ApprovalSummaryInput {
  workflow_type: string;
  source_record_id: string | null;
  amount: number | null;
}

export default function ApprovalVerifyModal({
  log, logId, attachedBy = "ผู้ใช้", onApprove, onReject, onClose, busy = false,
}: {
  log: VerifyLog;
  logId?: string;
  attachedBy?: string;
  onApprove: (verifiedItems: string[]) => void | Promise<void>;
  onReject: (comment: string) => void | Promise<void>;
  onClose: () => void;
  busy?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifyData | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [attachments, setAttachments] = useState<{ id: string; file_url: string | null; file_name: string | null; signed?: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAttachments = async (id: string) => {
    const rows = await getEntityDocuments("approval_log", id);
    const signed = await Promise.all(rows.map(async (r) => ({ ...r, signed: await toSignedUrl(r.file_url) })));
    setAttachments(signed);
  };

  useEffect(() => {
    let alive = true;
    fetchApprovalSource(log.workflow_type, log.source_record_id).then((row) => {
      if (!alive) return;
      const v = buildVerification(log.workflow_type, row, log.amount ?? null);
      setData(v);
      setChecked(new Array(v.checklist.length).fill(false));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [log.workflow_type, log.source_record_id, log.amount]);

  useEffect(() => {
    if (logId) loadAttachments(logId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId]);

  const uploadReceipt = async (file: File) => {
    if (!logId) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `entity-docs/approval_log/${logId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("document-attachments").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("document-attachments").getPublicUrl(path);
      await attachDocumentToEntity("approval_log", logId, publicUrl, file.name, attachedBy);
      await loadAttachments(logId);
    }
    setUploading(false);
  };

  const allChecked = (data?.checklist.length ?? 0) === 0 || checked.every(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 max-h-[90vh] overflow-y-auto mb-14 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-aviva-text flex items-center gap-1.5">
            <ShieldCheck size={18} className="text-aviva-gold" /> ตรวจสอบเอกสารก่อนอนุมัติ
          </h2>
          <button onClick={onClose}><X size={20} className="text-aviva-secondary" /></button>
        </div>

        <ApprovalRouteBar log={log} />

        {loading ? (
          <div className="flex items-center justify-center py-8 text-aviva-secondary gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" /> กำลังโหลดเอกสาร...
          </div>
        ) : data ? (
          <>
            {/* คำเตือนอัตโนมัติ */}
            {data.warnings.length > 0 && (
              <div className="space-y-1.5">
                {data.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-[11px] text-red-400">
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* รายละเอียดเอกสาร */}
            {data.rows.length > 0 && (
              <div className="bg-aviva-bg/50 border border-aviva-gold/10 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-aviva-secondary/70 uppercase">รายละเอียดเอกสาร</p>
                {data.rows.map((r, i) => (
                  <div key={i} className="flex justify-between gap-3 text-xs">
                    <span className="text-aviva-secondary flex-shrink-0">{r.label}</span>
                    <span className={clsx("text-right", r.strong ? "text-aviva-gold font-bold" : "text-aviva-text")}>{r.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ตารางสินค้า (PO) */}
            {data.items && data.items.length > 0 && (
              <div className="bg-aviva-bg/50 border border-aviva-gold/10 rounded-xl p-3">
                <p className="text-[10px] font-bold text-aviva-secondary/70 uppercase mb-1.5">รายการสินค้า</p>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-aviva-secondary/70 border-b border-aviva-gold/10">
                      <th className="text-left font-medium py-1">รายการ</th>
                      <th className="text-right font-medium">จำนวน</th>
                      <th className="text-right font-medium">ราคา/หน่วย</th>
                      <th className="text-right font-medium">รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((it, i) => (
                      <tr key={i} className="border-b border-aviva-gold/5">
                        <td className="py-1 text-aviva-text">{it.name}</td>
                        <td className="text-right text-aviva-secondary">{it.qty} {it.unit}</td>
                        <td className="text-right text-aviva-secondary">{formatNumber(it.unitPrice)}</td>
                        <td className="text-right text-aviva-text font-medium">{formatNumber(it.total)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="text-right py-1.5 text-aviva-secondary font-medium">ยอดรวมรายการ</td>
                      <td className="text-right text-aviva-gold font-bold">{formatNumber(data.itemsTotal ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ลิงก์ดูเอกสารฉบับเต็ม / ไฟล์แนบ */}
            {data.fullDocHref && (
              <Link href={data.fullDocHref} className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-aviva-gold/30 bg-aviva-gold/10 text-aviva-gold">
                <ExternalLink size={13} /> ดูเอกสารฉบับเต็ม
              </Link>
            )}
            {data.fileUrl && (
              <a href={data.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-aviva-gold/30 bg-aviva-gold/10 text-aviva-gold">
                <ExternalLink size={13} /> เปิดไฟล์แนบ
              </a>
            )}

            {/* ใบเสร็จ/สลิป/เอกสารแนบ */}
            {logId && (
              <div className="bg-aviva-bg/50 border border-aviva-gold/10 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-aviva-secondary/70 uppercase">ใบเสร็จ / สลิป / เอกสารแนบ</p>
                  <label className="cursor-pointer text-[10px] text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg flex items-center gap-1">
                    {uploading ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />} แนบไฟล์
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReceipt(f); }} />
                  </label>
                </div>
                {attachments.length === 0 ? (
                  <p className="text-[11px] text-aviva-secondary/60">ยังไม่มีไฟล์แนบ — แตะ &ldquo;แนบไฟล์&rdquo; เพื่ออัปโหลด</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((a) => (
                      <a key={a.id} href={a.signed ?? a.file_url ?? "#"} target="_blank" rel="noreferrer" className="block">
                        {isImg(a.file_url) ? (
                          <img src={a.signed ?? a.file_url!} alt={a.file_name ?? "img"} className="w-16 h-16 object-cover rounded-lg border border-aviva-gold/20" />
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-aviva-gold border border-aviva-gold/20 rounded-lg px-2 py-2.5">
                            <FileText size={12} /> {a.file_name ?? "ไฟล์แนบ"}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Checklist บังคับ */}
            {data.checklist.length > 0 && (
              <div className="bg-aviva-bg/50 border border-aviva-gold/10 rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-bold text-aviva-text">ยืนยันการตรวจสอบ <span className="text-aviva-secondary font-normal">(ติ๊กให้ครบก่อนอนุมัติ)</span></p>
                {data.checklist.map((item, i) => (
                  <button key={i} onClick={() => setChecked((p) => p.map((c, j) => (j === i ? !c : c)))}
                    className="flex items-center gap-2 w-full text-left">
                    <span className={clsx("w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                      checked[i] ? "bg-aviva-gold border-aviva-gold" : "border-aviva-secondary/40")}>
                      {checked[i] && <CheckCircle size={12} className="text-aviva-bg" />}
                    </span>
                    <span className={clsx("text-xs", checked[i] ? "text-aviva-text" : "text-aviva-secondary")}>{item}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}

        {/* ปุ่มดำเนินการ */}
        {rejecting ? (
          <div className="space-y-2">
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ระบุเหตุผลการปฏิเสธ..." rows={3}
              className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setRejecting(false)} className="flex-1 py-2.5 rounded-xl text-xs font-medium border border-aviva-gold/20 text-aviva-secondary">ย้อนกลับ</button>
              <button onClick={() => onReject(comment)} disabled={busy || !comment.trim()}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">
                {busy ? "กำลังบันทึก..." : "ยืนยันการปฏิเสธ"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => onApprove(data?.checklist ?? [])} disabled={busy || loading || !allChecked}
              className="flex-1 py-3 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
              <CheckCircle size={15} /> {allChecked ? "อนุมัติ" : "ติ๊กตรวจสอบให้ครบ"}
            </button>
            <button onClick={() => setRejecting(true)} disabled={busy || loading}
              className="flex-1 py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
              <XCircle size={15} /> ปฏิเสธ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
