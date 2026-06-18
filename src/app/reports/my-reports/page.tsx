"use client";
import { useState, useEffect } from "react";
import { FileText, Eye, Pencil, Trash2, Calendar, MapPin, AlertCircle, CheckCircle, Clock, Plus } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface MyReport {
  id: string;
  reported_by: string;
  work_detail: string;
  progress: number;
  issue: string;
  work_type: string | null;
  photo_url: string | null;
  created_at: string;
  house_id: string | null;
  house_number?: string;
  contractor?: string;
}

interface MyConstructionLog {
  id: string;
  log_date: string;
  logged_by: string;
  work_description: string;
  progress_percent: number;
  category: string;
  photo_urls: string[] | null;
  compiled_to_report: string | null;
  submit_status: string | null;
  house_model: string | null;
  plot_no: string | null;
  notes: string | null;
  draft_report: string | null;
}

export default function MyReportsPage() {
  const user = useCurrentUser();
  const [reports, setReports] = useState<MyReport[]>([]);
  const [logs, setLogs] = useState<MyConstructionLog[]>([]);
  const [selectedReport, setSelectedReport] = useState<MyReport | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<MyConstructionLog[]>([]);
  const [tab, setTab] = useState<"submitted" | "drafts">("submitted");
  const [loading, setLoading] = useState(false);
  const [editingDraft, setEditingDraft] = useState<{
    reportId: string;
    workDetail: string;
    issue: string;
  } | null>(null);

  useEffect(() => {
    if (!user || user.department !== "ฝ่ายก่อสร้าง") return;
    loadReports();
  }, [user, tab]);

  async function loadReports() {
    if (!user) return;
    setLoading(true);

    try {
      if (tab === "submitted") {
        // ดูรายงานที่ส่งแล้ว — ลองดึง construction_reports ก่อน
        const { data: rpts, error: err } = await supabase
          .from("construction_reports")
          .select("*, houses(house_number, contractor)")
          .eq("reported_by", user.full_name)
          .order("created_at", { ascending: false })
          .limit(50);

        if (err || !rpts || rpts.length === 0) {
          // ถ้า construction_reports ว่าง ให้ดึงจาก work_reports แทน
          const { data: workRpts } = await supabase
            .from("work_reports")
            .select("*")
            .eq("user_email", user.email)
            .eq("department", "ฝ่ายก่อสร้าง")
            .in("status", ["submitted", "late"])
            .order("created_at", { ascending: false })
            .limit(50);

          const typed = (workRpts ?? []).map((r: any) => ({
            id: r.id,
            reported_by: r.employee_name,
            work_detail: r.summary,
            progress: 0,
            issue: "",
            work_type: r.report_type,
            photo_url: null,
            created_at: r.submitted_at || r.created_at,
            house_id: null,
            house_number: undefined,
            contractor: undefined,
          }));
          setReports(typed as MyReport[]);
        } else {
          const typed = (rpts ?? []).map((r: any) => ({
            ...r,
            house_number: r.houses?.house_number,
            contractor: r.houses?.contractor,
          }));
          setReports(typed as MyReport[]);
        }
        setSelectedReport(null);
      } else {
        // ดู construction_logs ที่ยังไม่ส่ง
        const { data: lgz } = await supabase
          .from("construction_logs")
          .select("*")
          .eq("logged_by", user.full_name)
          .eq("submit_status", "draft")
          .order("log_date", { ascending: false })
          .limit(50);

        setLogs((lgz ?? []) as MyConstructionLog[]);
        setSelectedReport(null);
      }
    } catch (error) {
      console.error("Error loading reports:", error);
      showToast("เกิดข้อผิดพลาดในการโหลด", "error");
    }

    setLoading(false);
  }

  function showToast(msg: string, type: "success" | "error" = "success") {
    // Simple toast notification
    alert(msg);
  }

  async function handleViewReport(report: MyReport) {
    setSelectedReport(report);
    // ดึง logs ที่เชื่อมกับรายงาน
    const { data: linked } = await supabase
      .from("construction_logs")
      .select("*")
      .eq("compiled_to_report", report.id);
    setSelectedLogs((linked ?? []) as MyConstructionLog[]);
  }

  async function handleEditDraft(log: MyConstructionLog) {
    setEditingDraft({
      reportId: log.id,
      workDetail: log.work_description,
      issue: log.notes || "",
    });
  }

  async function handleSaveDraft() {
    if (!editingDraft) return;
    await supabase
      .from("construction_logs")
      .update({
        work_description: editingDraft.workDetail,
        notes: editingDraft.issue,
      })
      .eq("id", editingDraft.reportId);
    setEditingDraft(null);
    loadReports();
  }

  async function handleDeleteDraft(logId: string) {
    if (!confirm("ลบบันทึกนี้หรือไม่?")) return;
    await supabase.from("construction_logs").delete().eq("id", logId);
    loadReports();
  }

  if (!user || user.department !== "ฝ่ายก่อสร้าง") {
    return (
      <div className="min-h-screen bg-aviva-bg flex items-center justify-center px-4">
        <GlassCard className="p-6 text-center">
          <p className="text-aviva-secondary text-sm">เฉพาะฝ่ายก่อสร้างเท่านั้น</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} className="text-aviva-gold" />
            <h1 className="text-lg font-bold text-aviva-text">รายงานของฉัน</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("submitted")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === "submitted"
                  ? "bg-aviva-gold text-aviva-bg"
                  : "bg-aviva-bg border border-aviva-gold/20 text-aviva-secondary"
              }`}
            >
              📤 ส่งแล้ว ({reports.length})
            </button>
            <button
              onClick={() => setTab("drafts")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === "drafts"
                  ? "bg-aviva-gold text-aviva-bg"
                  : "bg-aviva-bg border border-aviva-gold/20 text-aviva-secondary"
              }`}
            >
              ✏️ ร่าง ({logs.length})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {loading && <p className="text-center text-aviva-secondary">กำลังโหลด...</p>}

        {/* Submitted Reports */}
        {tab === "submitted" && !loading && (
          <>
            {reports.length === 0 ? (
              <GlassCard className="p-6 text-center">
                <p className="text-aviva-secondary">ยังไม่มีรายงานที่ส่งแล้ว</p>
              </GlassCard>
            ) : (
              reports.map((report) => (
                <GlassCard
                  key={report.id}
                  className="p-4 border border-aviva-gold/20 hover:border-aviva-gold/50 transition-all cursor-pointer"
                  onClick={() => handleViewReport(report)}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-aviva-secondary">
                            {new Date(report.created_at).toLocaleDateString("th-TH")}
                          </p>
                          <p className="text-sm font-semibold text-aviva-text">
                            {report.work_type || "บันทึกงาน"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">ส่งแล้ว</span>
                    </div>

                    {report.house_number && (
                      <p className="text-xs text-aviva-secondary flex items-center gap-1">
                        <MapPin size={12} /> {report.house_number} ({report.contractor})
                      </p>
                    )}

                    <p className="text-sm text-aviva-text line-clamp-2">{report.work_detail}</p>

                    {report.progress > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex-1 bg-aviva-bg/50 rounded-full h-1.5">
                          <div
                            className="bg-aviva-gold h-1.5 rounded-full"
                            style={{ width: `${report.progress}%` }}
                          />
                        </div>
                        <span className="text-aviva-secondary">{report.progress}%</span>
                      </div>
                    )}
                  </div>
                </GlassCard>
              ))
            )}
          </>
        )}

        {/* Draft Logs */}
        {tab === "drafts" && !loading && (
          <>
            {logs.length === 0 ? (
              <GlassCard className="p-6 text-center">
                <p className="text-aviva-secondary mb-4">ยังไม่มีบันทึกร่าง</p>
                <a
                  href="/construction"
                  className="inline-flex items-center gap-2 bg-aviva-gold text-aviva-bg font-semibold px-4 py-2 rounded-xl"
                >
                  <Plus size={16} /> เพิ่มบันทึกใหม่
                </a>
              </GlassCard>
            ) : (
              logs.map((log) => (
                <GlassCard
                  key={log.id}
                  className="p-4 border border-aviva-gold/20 hover:border-aviva-gold/50 transition-all"
                >
                  {editingDraft?.reportId === log.id ? (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-aviva-text">แก้ไขบันทึก</h3>
                      <textarea
                        value={editingDraft.workDetail}
                        onChange={(e) =>
                          setEditingDraft({ ...editingDraft, workDetail: e.target.value })
                        }
                        placeholder="รายละเอียดงาน..."
                        className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl p-3 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50"
                        rows={3}
                      />
                      <textarea
                        value={editingDraft.issue}
                        onChange={(e) =>
                          setEditingDraft({ ...editingDraft, issue: e.target.value })
                        }
                        placeholder="หมายเหตุ/ปัญหา..."
                        className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl p-3 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveDraft}
                          className="flex-1 bg-aviva-gold text-aviva-bg font-semibold py-2 rounded-xl text-sm"
                        >
                          💾 บันทึก
                        </button>
                        <button
                          onClick={() => setEditingDraft(null)}
                          className="flex-1 bg-aviva-bg border border-aviva-gold/20 text-aviva-secondary py-2 rounded-xl text-sm"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-yellow-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-aviva-secondary">
                              {new Date(log.log_date).toLocaleDateString("th-TH")}
                            </p>
                            <p className="text-sm font-semibold text-aviva-text">{log.category}</p>
                          </div>
                        </div>
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">ร่าง</span>
                      </div>

                      {log.plot_no && (
                        <p className="text-xs text-aviva-secondary flex items-center gap-1">
                          <MapPin size={12} /> แปลง {log.plot_no} ({log.house_model})
                        </p>
                      )}

                      <p className="text-sm text-aviva-text line-clamp-2">{log.work_description}</p>

                      {log.progress_percent > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex-1 bg-aviva-bg/50 rounded-full h-1.5">
                            <div
                              className="bg-yellow-400 h-1.5 rounded-full"
                              style={{ width: `${log.progress_percent}%` }}
                            />
                          </div>
                          <span className="text-aviva-secondary">{log.progress_percent}%</span>
                        </div>
                      )}

                      {log.photo_urls && log.photo_urls.length > 0 && (
                        <p className="text-xs text-aviva-secondary">📷 {log.photo_urls.length} รูป</p>
                      )}

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleEditDraft(log)}
                          className="flex-1 flex items-center justify-center gap-1 bg-aviva-gold/20 text-aviva-gold text-xs font-semibold py-1.5 rounded-lg hover:bg-aviva-gold/30 transition-colors"
                        >
                          <Pencil size={12} /> แก้ไข
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(log.id)}
                          className="flex-1 flex items-center justify-center gap-1 bg-red-500/20 text-red-400 text-xs font-semibold py-1.5 rounded-lg hover:bg-red-500/30 transition-colors"
                        >
                          <Trash2 size={12} /> ลบ
                        </button>
                      </div>
                    </div>
                  )}
                </GlassCard>
              ))
            )}
          </>
        )}

        {/* Report Detail */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-aviva-bg w-full max-h-[80vh] overflow-y-auto rounded-t-2xl p-4 space-y-4">
              <div className="sticky top-0 bg-aviva-bg pb-2 border-b border-aviva-gold/10">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-aviva-secondary hover:text-aviva-text text-sm"
                >
                  ✕ ปิด
                </button>
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-bold text-aviva-text">รายละเอียดรายงาน</h2>

                <div className="bg-aviva-bg/50 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-aviva-secondary uppercase">วันที่ส่ง</p>
                  <p className="text-sm text-aviva-text">
                    {new Date(selectedReport.created_at).toLocaleString("th-TH")}
                  </p>
                </div>

                {selectedReport.work_type && (
                  <div className="bg-aviva-bg/50 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-aviva-secondary uppercase">ประเภท</p>
                    <p className="text-sm text-aviva-text">{selectedReport.work_type}</p>
                  </div>
                )}

                {selectedReport.house_number && (
                  <div className="bg-aviva-bg/50 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-aviva-secondary uppercase flex items-center gap-1">
                      <MapPin size={12} /> ตำแหน่ง
                    </p>
                    <p className="text-sm text-aviva-text">{selectedReport.house_number}</p>
                    {selectedReport.contractor && (
                      <p className="text-xs text-aviva-secondary">ผู้รับเหมา: {selectedReport.contractor}</p>
                    )}
                  </div>
                )}

                <div className="bg-aviva-bg/50 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-aviva-secondary uppercase">รายละเอียดงาน</p>
                  <p className="text-sm text-aviva-text">{selectedReport.work_detail}</p>
                </div>

                {selectedReport.issue && (
                  <div className="bg-red-500/10 rounded-xl p-3 space-y-2 border border-red-500/20">
                    <p className="text-xs text-red-400 uppercase">⚠️ ปัญหา/อุปสรรค</p>
                    <p className="text-sm text-aviva-text">{selectedReport.issue}</p>
                  </div>
                )}

                {selectedReport.progress > 0 && (
                  <div className="bg-aviva-bg/50 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-aviva-secondary uppercase">ความคืบหน้า</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-aviva-bg rounded-full h-2">
                        <div
                          className="bg-aviva-gold h-2 rounded-full"
                          style={{ width: `${selectedReport.progress}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-aviva-text">{selectedReport.progress}%</span>
                    </div>
                  </div>
                )}

                {selectedLogs.length > 0 && (
                  <div className="bg-aviva-bg/50 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-aviva-secondary uppercase">🔗 บันทึกที่เชื่อมโยง</p>
                    <div className="space-y-2">
                      {selectedLogs.map((log) => (
                        <div key={log.id} className="bg-aviva-bg rounded-lg p-2 text-xs text-aviva-secondary">
                          • {new Date(log.log_date).toLocaleDateString("th-TH")} - {log.work_description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
