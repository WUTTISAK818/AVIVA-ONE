import { User2, FileText, CornerDownRight } from "lucide-react";
import { summarizeApproval, type ApprovalSummaryInput } from "@/lib/approval-matrix";

// หัวสรุปคำขออนุมัติ: มาจากใคร → ขออนุมัติเรื่องอะไร → ส่งต่อไปไหน/ขั้นถัดไป
// ใช้ร่วมกันทุกหน้าที่แสดงคำขออนุมัติ เพื่อให้ผู้บริหาร/ผู้ปฏิบัติเห็นภาพรวมทันที
export default function ApprovalRouteBar({ log }: { log: ApprovalSummaryInput }) {
  const s = summarizeApproval(log);
  return (
    <div className="rounded-lg bg-aviva-bg/40 border border-aviva-gold/10 px-2.5 py-2 space-y-1">
      <Row icon={<User2 size={11} />} label="จาก">
        <span className="text-aviva-secondary">[{s.fromDept}]</span>{" "}
        <span className="text-aviva-text font-medium">{s.fromName}</span>
      </Row>
      <Row icon={<FileText size={11} />} label="เรื่อง">
        <span className="text-aviva-text font-medium">{s.subject}</span>
        {s.desc && <span className="text-aviva-secondary"> · {s.desc}</span>}
      </Row>
      <Row icon={<CornerDownRight size={11} />} label="ที่ไป">
        <span className="text-aviva-text">{s.currentApprover}พิจารณา</span>
        {s.pending && s.nextStep ? (
          <span className="text-aviva-gold"> → ส่งต่อ {s.nextStep}</span>
        ) : s.pending ? (
          <span className="text-aviva-secondary"> → อนุมัติแล้วเสร็จสิ้น</span>
        ) : null}
      </Row>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-[11px] leading-snug">
      <span className="text-aviva-gold/70 mt-0.5 flex-shrink-0">{icon}</span>
      <span className="text-aviva-secondary/70 w-8 flex-shrink-0">{label}</span>
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}
