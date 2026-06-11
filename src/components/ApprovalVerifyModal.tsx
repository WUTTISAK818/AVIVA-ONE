import { useEffect, useState } from "react";
import Link from "next/link";
import { X, CheckCircle, XCircle, AlertTriangle, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import ApprovalRouteBar from "./ApprovalRouteBar";
import { type ApprovalSummaryInput } from "@/lib/approval-matrix";
import { fetchApprovalSource, buildVerification, type VerifyData } from "@/lib/approval-source";
import { formatNumber } from "@/lib/thai-baht";

export interface VerifyLog extends ApprovalSummaryInput {
  workflow_type: string;
  source_record_id: string | null;
  amount: number | null;
}

export default function ApprovalVerifyModal({
  log, onApprove, onReject, onClose, busy = false,
}: {
  log: VerifyLog;
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
