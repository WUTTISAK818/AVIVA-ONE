"use client";

import { useState, useEffect } from "react";
import { X, Send, CheckCircle, Plus, Trash2, MapPin, ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";

export interface AutoReportItem {
  category: "activity" | "achievement" | "issue" | "plan";
  description: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  department: string;
  autoItems: AutoReportItem[];
  onSubmitted?: () => void;
}

const CATEGORY_OPTIONS = [
  { value: "activity",    label: "กิจกรรม" },
  { value: "achievement", label: "ผลสำเร็จ" },
  { value: "issue",       label: "ปัญหา/อุปสรรค" },
  { value: "plan",        label: "แผนพรุ่งนี้" },
] as const;

const CATEGORY_COLOR: Record<string, string> = {
  activity:    "text-blue-400",
  achievement: "text-green-400",
  issue:       "text-red-400",
  plan:        "text-yellow-400",
};

export default function ReportSubmitModal({ open, onClose, department, autoItems, onSubmitted }: Props) {
  const user = useCurrentUser();
  const today = new Date().toISOString().split("T")[0];

  const [items, setItems] = useState<AutoReportItem[]>([]);
  const [summary, setSummary] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user?.email) return;
    setSubmitted(false);
    setLoading(true);

    supabase.from("work_reports")
      .select("id, status, summary, work_location")
      .eq("user_email", user.email)
      .eq("report_date", today)
      .eq("report_type", "daily")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingId(data.id);
          setSummary(data.summary ?? "");
          setWorkLocation(data.work_location ?? "");
          if (data.status === "submitted" || data.status === "late") setSubmitted(true);
          // Load existing items
          supabase.from("work_report_items").select("category,description").eq("report_id", data.id)
            .then(({ data: its }) => {
              const mapped = (its ?? []).map(i => ({ category: i.category as AutoReportItem["category"], description: i.description }));
              setItems(mapped.length > 0 ? mapped : autoItems.length > 0 ? [...autoItems] : [{ category: "activity", description: "" }]);
              setLoading(false);
            });
        } else {
          setExistingId(null);
          setSummary("");
          setWorkLocation("");
          setItems(autoItems.length > 0 ? [...autoItems] : [{ category: "activity", description: "" }]);
          setLoading(false);
        }
      });
  }, [open, user?.email]);

  async function handleSubmit() {
    if (!user?.email) return;
    setSubmitting(true);

    const now = new Date();
    const status = now.getHours() >= 18 ? "late" : "submitted";
    const validItems = items.filter(i => i.description.trim());

    let reportId = existingId;

    if (!reportId) {
      const { data } = await supabase.from("work_reports").insert({
        user_email: user.email,
        employee_name: user.full_name ?? user.email,
        department,
        report_date: today,
        report_type: "daily",
        status,
        summary,
        work_location: workLocation,
        submitted_at: now.toISOString(),
      }).select("id").single();
      reportId = data?.id ?? null;
    } else {
      await supabase.from("work_reports").update({
        status,
        summary,
        work_location: workLocation,
        submitted_at: now.toISOString(),
      }).eq("id", reportId);
      await supabase.from("work_report_items").delete().eq("report_id", reportId);
    }

    if (reportId && validItems.length > 0) {
      await supabase.from("work_report_items").insert(
        validItems.map(i => ({
          report_id: reportId,
          category: i.category,
          description: i.description,
          source: department,
        }))
      );
    }

    setSubmitting(false);
    setSubmitted(true);
    onSubmitted?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-5 pb-10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-aviva-text">ส่งรายงานประจำวัน</h2>
            <p className="text-xs text-aviva-secondary">{department} · {new Date(today).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-aviva-secondary" /></button>
        </div>

        {submitted ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
            <CheckCircle size={44} className="text-green-400" />
            <p className="text-sm font-bold text-aviva-text">ส่งรายงานเรียบร้อยแล้ว</p>
            <p className="text-xs text-aviva-secondary/70 text-center">ผู้จัดการจะรับทราบรายงานของคุณในวันนี้</p>
            <button onClick={onClose} className="mt-3 px-8 py-2.5 bg-aviva-gold text-aviva-bg text-sm font-bold rounded-xl">ปิด</button>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Work location */}
              <div className="flex items-center gap-2 bg-aviva-bg/50 rounded-xl px-3 py-2.5 border border-aviva-gold/10">
                <MapPin size={13} className="text-aviva-gold flex-shrink-0" />
                <input
                  value={workLocation}
                  onChange={e => setWorkLocation(e.target.value)}
                  placeholder="สถานที่ทำงานวันนี้ เช่น ไซต์งาน, สำนักงาน"
                  className="flex-1 bg-transparent text-xs text-aviva-text placeholder:text-aviva-secondary/40 outline-none"
                />
              </div>

              {/* Items */}
              <div>
                <p className="text-[10px] text-aviva-secondary uppercase tracking-wider mb-2">รายการกิจกรรม</p>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="bg-aviva-bg/50 rounded-xl p-3 border border-aviva-gold/10">
                      <div className="flex items-center gap-2 mb-1.5">
                        <select
                          value={item.category}
                          onChange={e => setItems(prev => prev.map((it, idx) =>
                            idx === i ? { ...it, category: e.target.value as AutoReportItem["category"] } : it
                          ))}
                          className="bg-aviva-bg border border-aviva-gold/20 rounded-lg px-2 py-1 text-[10px] font-bold outline-none"
                          style={{ color: CATEGORY_COLOR[item.category] ?? "#999" }}
                        >
                          {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <button
                          onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                          className="ml-auto text-aviva-secondary/30 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <textarea
                        value={item.description}
                        onChange={e => setItems(prev => prev.map((it, idx) =>
                          idx === i ? { ...it, description: e.target.value } : it
                        ))}
                        placeholder="รายละเอียดกิจกรรม..."
                        rows={2}
                        className="w-full bg-transparent text-xs text-aviva-text placeholder:text-aviva-secondary/30 outline-none resize-none leading-relaxed"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setItems(prev => [...prev, { category: "activity", description: "" }])}
                    className="flex items-center gap-1.5 text-xs text-aviva-gold/60 hover:text-aviva-gold py-1 transition-colors"
                  >
                    <Plus size={13} /> เพิ่มรายการ
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div>
                <p className="text-[10px] text-aviva-secondary uppercase tracking-wider mb-1.5">สรุปภาพรวมวันนี้</p>
                <textarea
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  placeholder="สรุปผลการทำงานประจำวันโดยรวม..."
                  rows={3}
                  className="w-full bg-aviva-bg/50 border border-aviva-gold/15 rounded-xl px-3 py-2.5 text-xs text-aviva-text placeholder:text-aviva-secondary/30 outline-none focus:border-aviva-gold/40 resize-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-aviva-gold/10 mt-3">
              <button
                onClick={handleSubmit}
                disabled={submitting || items.every(i => !i.description.trim())}
                className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={14} />
                {submitting ? "กำลังส่ง..." : "ยืนยันส่งรายงาน"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
