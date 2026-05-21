"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Clock, Plus, X, ClipboardList, Pencil, Bug } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ProgressBar from "@/components/ProgressBar";
import { supabase } from "@/lib/supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

type HouseStatus = "complete" | "on-track" | "delayed";
type Tab = "units" | "reports" | "defects";

interface House {
  id: string;
  house_number: string;
  status: HouseStatus;
  progress: number;
  contractor: string;
  phase: string;
  delayed_days: number;
}

interface Report {
  id: string;
  house_id: string;
  work_detail: string;
  progress: number;
  issue: string;
  created_at: string;
}

interface Defect {
  defect_id: string;
  house_id: string | null;
  defect_category: string;
  description: string;
  status: string;
  reported_at: string;
  resolved_at: string | null;
}

const statusConfig = {
  complete: { label: "เสร็จแล้ว", icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  "on-track": { label: "ตามแผน", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  delayed: { label: "ล่าช้า", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
};

const defectStatusConfig: Record<string, { label: string; color: string }> = {
  Open: { label: "พบปัญหา", color: "bg-red-500/20 text-red-400" },
  "In Progress": { label: "กำลังแก้ไข", color: "bg-yellow-500/20 text-yellow-400" },
  Resolved: { label: "แก้ไขแล้ว", color: "bg-green-500/20 text-green-400" },
};

const DEFECT_CATEGORIES = ["งานสี", "งานฝ้า", "งานพื้น", "งานประตู-หน้าต่าง", "งานระบบน้ำ", "งานไฟฟ้า", "อื่นๆ"];

const progressColor = (pct: number): "gold" | "green" | "red" =>
  pct === 100 ? "green" : pct < 50 ? "red" : "gold";

export default function ConstructionPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | HouseStatus>("all");
  const [tab, setTab] = useState<Tab>("units");
  const [showModal, setShowModal] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [showHouseEditModal, setShowHouseEditModal] = useState(false);
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectHouse, setDefectHouse] = useState<House | null>(null);
  const [houseForm, setHouseForm] = useState({
    house_number: "", contractor: "", phase: "", delayed_days: "",
    status: "on-track" as HouseStatus, progress: "",
  });
  const [form, setForm] = useState({
    house_id: "", work_detail: "", progress: "", issue: "", new_status: "on-track" as HouseStatus,
  });
  const [defectForm, setDefectForm] = useState({
    house_id: "", defect_category: "งานสี", description: "",
  });

  const fetchData = () => {
    Promise.all([
      supabase.from("houses").select("*").eq("project_id", PROJECT_ID).order("house_number"),
      supabase.from("construction_reports").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("defects").select("*").order("reported_at", { ascending: false }).limit(50),
    ]).then(([hRes, rRes, dRes]) => {
      setHouses((hRes.data as House[]) ?? []);
      setReports((rRes.data as Report[]) ?? []);
      setDefects((dRes.data as Defect[]) ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  const counts = {
    complete: houses.filter((h) => h.status === "complete").length,
    "on-track": houses.filter((h) => h.status === "on-track").length,
    delayed: houses.filter((h) => h.status === "delayed").length,
  };
  const overallProgress = houses.length
    ? Math.round(houses.reduce((s, h) => s + h.progress, 0) / houses.length)
    : 0;
  const filtered = filter === "all" ? houses : houses.filter((h) => h.status === filter);
  const openDefects = defects.filter((d) => d.status === "Open").length;

  const openReport = (house: House) => {
    setSelectedHouse(house);
    setEditingReport(null);
    setForm({ house_id: house.id, work_detail: "", progress: String(house.progress), issue: "", new_status: house.status });
    setShowModal(true);
  };

  const openEditReport = (report: Report, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingReport(report);
    setSelectedHouse(null);
    setForm({ house_id: report.house_id, work_detail: report.work_detail, progress: String(report.progress), issue: report.issue ?? "", new_status: "on-track" });
    setShowModal(true);
  };

  const openEditHouse = (house: House, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingHouse(house);
    setHouseForm({
      house_number: house.house_number, contractor: house.contractor ?? "",
      phase: house.phase ?? "", delayed_days: String(house.delayed_days ?? 0),
      status: house.status, progress: String(house.progress),
    });
    setShowHouseEditModal(true);
  };

  const openDefectModal = (house: House, e: React.MouseEvent) => {
    e.stopPropagation();
    setDefectHouse(house);
    setDefectForm({ house_id: house.id, defect_category: "งานสี", description: "" });
    setShowDefectModal(true);
  };

  const handleSaveHouse = async () => {
    if (!editingHouse) return;
    setSaving(true);
    await supabase.from("houses").update({
      house_number: houseForm.house_number, contractor: houseForm.contractor,
      phase: houseForm.phase, delayed_days: Number(houseForm.delayed_days) || 0,
      status: houseForm.status, progress: Number(houseForm.progress) || 0,
      updated_at: new Date().toISOString(),
    }).eq("id", editingHouse.id);
    setSaving(false);
    setShowHouseEditModal(false);
    setEditingHouse(null);
    fetchData();
  };

  const handleSave = async () => {
    if (!form.work_detail) return;
    setSaving(true);
    if (editingReport) {
      await supabase.from("construction_reports").update({
        work_detail: form.work_detail, progress: Number(form.progress) || 0,
        issue: form.issue, updated_at: new Date().toISOString(),
      }).eq("id", editingReport.id);
    } else {
      if (!form.house_id) { setSaving(false); return; }
      await supabase.from("construction_reports").insert({
        house_id: form.house_id, work_detail: form.work_detail,
        progress: Number(form.progress) || 0, issue: form.issue,
      });
      await supabase.from("houses").update({
        progress: Number(form.progress) || 0, status: form.new_status,
      }).eq("id", form.house_id);
    }
    setSaving(false);
    setShowModal(false);
    setSelectedHouse(null);
    setEditingReport(null);
    fetchData();
  };

  const handleSaveDefect = async () => {
    if (!defectForm.description || !defectForm.house_id) return;
    setSaving(true);
    await supabase.from("defects").insert({
      house_id: defectForm.house_id,
      defect_category: defectForm.defect_category,
      description: defectForm.description,
      status: "Open",
    });
    setSaving(false);
    setShowDefectModal(false);
    setDefectHouse(null);
    setDefectForm({ house_id: "", defect_category: "งานสี", description: "" });
    fetchData();
  };

  const updateDefectStatus = async (id: string, newStatus: string) => {
    const update: Record<string, string> = { status: newStatus };
    if (newStatus === "Resolved") update.resolved_at = new Date().toISOString();
    await supabase.from("defects").update(update).eq("defect_id", id);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">การก่อสร้าง</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : `${houses.length} ยูนิต · แตะยูนิตเพื่อบันทึก`}
              </p>
            </div>
            <button onClick={() => { setSelectedHouse(null); setEditingReport(null); setForm({ house_id: "", work_detail: "", progress: "", issue: "", new_status: "on-track" }); setShowModal(true); }}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
              <Plus size={14} /> รายงาน
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <GlassCard gold className="p-4">
          <SectionHeader title="ภาพรวมการก่อสร้าง" />
          {houses.length === 0 ? (
            <p className="text-aviva-secondary text-sm text-center py-4">ยังไม่มีข้อมูลยูนิต</p>
          ) : (
            <ProgressBar label="ความคืบหน้าโดยรวม" value={overallProgress} sublabel={`${houses.length} ยูนิต`} />
          )}
        </GlassCard>

        <div className="grid grid-cols-3 gap-3">
          {(["complete", "on-track", "delayed"] as HouseStatus[]).map((s) => {
            const { label, icon: Icon, color, bg } = statusConfig[s];
            return (
              <button key={s} onClick={() => setFilter(filter === s ? "all" : s)}
                className={clsx("rounded-2xl border p-3 flex flex-col items-center gap-1.5 transition-all", bg, filter === s && "ring-2 ring-aviva-gold/50")}>
                <Icon size={18} className={color} />
                <span className={clsx("text-xl font-bold", color)}>{loading ? "—" : counts[s]}</span>
                <span className="text-[10px] text-aviva-secondary">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          {[
            { k: "units", l: "ยูนิต" },
            { k: "reports", l: `รายงาน (${reports.length})` },
            { k: "defects", l: `Defects${openDefects > 0 ? ` (${openDefects})` : ""}` },
          ].map(({ k, l }) => (
            <button key={k} onClick={() => setTab(k as Tab)}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                tab === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>{l}</button>
          ))}
        </div>

        {tab === "units" && (
          <>
            <div className="flex gap-2">
              {(["all", "complete", "on-track", "delayed"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                    filter === f ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                  )}>
                  {f === "all" ? "ทั้งหมด" : statusConfig[f].label}
                </button>
              ))}
            </div>

            <div>
              <SectionHeader title={`ยูนิต (${filtered.length})`} subtitle="แตะเพื่อบันทึกรายงาน" />
              {loading ? (
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-2xl bg-aviva-card/50 animate-pulse" />)}
                </div>
              ) : filtered.length === 0 ? (
                <GlassCard className="p-8 text-center">
                  <p className="text-aviva-secondary text-sm">ยังไม่มีข้อมูล</p>
                </GlassCard>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filtered.map((house) => {
                    const { label, icon: Icon, color, bg } = statusConfig[house.status] ?? statusConfig["on-track"];
                    return (
                      <GlassCard key={house.id} className={clsx("p-3 border cursor-pointer active:scale-[0.97] transition-transform", bg)}
                        onClick={() => openReport(house)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-aviva-text">{house.house_number}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={(e) => openDefectModal(house, e)}
                              className="p-1 rounded-lg bg-aviva-bg/50 hover:bg-aviva-bg transition-all">
                              <Bug size={11} className="text-orange-400" />
                            </button>
                            <button onClick={(e) => openEditHouse(house, e)}
                              className="p-1 rounded-lg bg-aviva-bg/50 hover:bg-aviva-bg transition-all">
                              <Pencil size={11} className="text-aviva-secondary" />
                            </button>
                            <Icon size={14} className={color} />
                          </div>
                        </div>
                        <ProgressBar label="" value={house.progress} showPercent={false} color={progressColor(house.progress)} />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-aviva-secondary truncate">{house.phase ?? label}</span>
                          <span className={clsx("text-xs font-bold", color)}>{house.progress}%</span>
                        </div>
                        {house.delayed_days > 0 && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <AlertTriangle size={10} className="text-red-400" />
                            <span className="text-[10px] text-red-400">ล่าช้า {house.delayed_days} วัน</span>
                          </div>
                        )}
                      </GlassCard>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "reports" && (
          <div className="space-y-3">
            <SectionHeader title="รายงานประจำวัน" subtitle="ล่าสุด 30 รายการ" />
            {reports.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <ClipboardList size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีข้อมูล</p>
                <p className="text-aviva-secondary/60 text-xs mt-1">แตะยูนิตหรือกดปุ่ม + เพื่อบันทึก</p>
              </GlassCard>
            ) : (
              reports.map((r) => {
                const house = houses.find((h) => h.id === r.house_id);
                return (
                  <GlassCard key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-aviva-gold">{house?.house_number ?? "—"}</span>
                          <span className="text-[10px] text-aviva-secondary">{new Date(r.created_at).toLocaleDateString("th-TH")}</span>
                        </div>
                        <p className="text-sm text-aviva-text mt-0.5">{r.work_detail}</p>
                        {r.issue && <p className="text-xs text-red-400 mt-0.5">⚠ {r.issue}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={(e) => openEditReport(r, e)}
                          className="p-1.5 rounded-lg bg-aviva-bg border border-aviva-gold/10 hover:border-aviva-gold/40 transition-all">
                          <Pencil size={12} className="text-aviva-secondary" />
                        </button>
                        <div className="text-right">
                          <p className="text-lg font-bold text-aviva-gold">{r.progress}%</p>
                          <p className="text-[10px] text-aviva-secondary">ความคืบหน้า</p>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })
            )}
          </div>
        )}

        {tab === "defects" && (
          <div className="space-y-3">
            <SectionHeader title="Defect Tracking" subtitle="ปัญหาที่ตรวจพบจากการตรวจรับ" />
            {defects.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <Bug size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
                <p className="text-aviva-secondary text-sm">ยังไม่มีรายการ Defect</p>
                <p className="text-aviva-secondary/60 text-xs mt-1">กดไอคอน 🐛 บนยูนิตเพื่อบันทึก</p>
              </GlassCard>
            ) : (
              defects.map((d) => {
                const house = houses.find((h) => h.id === d.house_id);
                const ds = defectStatusConfig[d.status] ?? defectStatusConfig["Open"];
                return (
                  <GlassCard key={d.defect_id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-aviva-gold">{house?.house_number ?? "—"}</span>
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">{d.defect_category}</span>
                        </div>
                        <p className="text-sm text-aviva-text mt-0.5">{d.description}</p>
                        <p className="text-[10px] text-aviva-secondary">{new Date(d.reported_at).toLocaleDateString("th-TH")}</p>
                      </div>
                      <span className={clsx("text-[10px] px-2 py-0.5 rounded-full flex-shrink-0", ds.color)}>{ds.label}</span>
                    </div>
                    {d.status !== "Resolved" && (
                      <div className="flex gap-2">
                        {d.status === "Open" && (
                          <button onClick={() => updateDefectStatus(d.defect_id, "In Progress")}
                            className="flex-1 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-[10px] font-medium">
                            เริ่มแก้ไข
                          </button>
                        )}
                        <button onClick={() => updateDefectStatus(d.defect_id, "Resolved")}
                          className="flex-1 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-[10px] font-medium">
                          แก้ไขแล้ว
                        </button>
                      </div>
                    )}
                  </GlassCard>
                );
              })
            )}
          </div>
        )}
      </div>

      {showDefectModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">
                บันทึก Defect{defectHouse ? ` — ${defectHouse.house_number}` : ""}
              </h2>
              <button onClick={() => { setShowDefectModal(false); setDefectHouse(null); }}>
                <X size={20} className="text-aviva-secondary" />
              </button>
            </div>
            <div className="space-y-3">
              {!defectHouse && (
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เลือกยูนิต *</label>
                  <select value={defectForm.house_id} onChange={(e) => setDefectForm({ ...defectForm, house_id: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="">-- เลือกยูนิต --</option>
                    {houses.map((h) => <option key={h.id} value={h.id}>{h.house_number}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ประเภทปัญหา</label>
                <select value={defectForm.defect_category} onChange={(e) => setDefectForm({ ...defectForm, defect_category: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {DEFECT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รายละเอียด *</label>
                <textarea value={defectForm.description} onChange={(e) => setDefectForm({ ...defectForm, description: e.target.value })}
                  placeholder="อธิบายปัญหาที่พบ..." rows={3}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
            </div>
            <button onClick={handleSaveDefect}
              disabled={saving || !defectForm.description || (!defectHouse && !defectForm.house_id)}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึก Defect"}
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">
                {editingReport ? "แก้ไขรายงาน" : selectedHouse ? `บันทึกรายงาน — ${selectedHouse.house_number}` : "บันทึกรายงานประจำวัน"}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingReport(null); }}>
                <X size={20} className="text-aviva-secondary" />
              </button>
            </div>

            <div className="space-y-3">
              {!selectedHouse && !editingReport && (
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">เลือกยูนิต *</label>
                  <select value={form.house_id} onChange={(e) => setForm({ ...form, house_id: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="">-- เลือกยูนิต --</option>
                    {houses.map((h) => <option key={h.id} value={h.id}>{h.house_number} ({h.progress}%)</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">งานที่ทำวันนี้ *</label>
                <textarea value={form.work_detail} onChange={(e) => setForm({ ...form, work_detail: e.target.value })}
                  placeholder="อธิบายงานที่ดำเนินการ..." rows={3}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ความคืบหน้า (%)</label>
                  <input type="number" min="0" max="100" value={form.progress}
                    onChange={(e) => setForm({ ...form, progress: e.target.value })}
                    placeholder="0-100"
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                </div>
                {!editingReport && (
                  <div>
                    <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                    <select value={form.new_status} onChange={(e) => setForm({ ...form, new_status: e.target.value as HouseStatus })}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                      <option value="on-track">ตามแผน</option>
                      <option value="delayed">ล่าช้า</option>
                      <option value="complete">เสร็จแล้ว</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ปัญหา / ข้อสังเกต</label>
                <input type="text" value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })}
                  placeholder="ถ้าไม่มีปัญหาให้เว้นว่าง"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
            </div>

            <button onClick={handleSave}
              disabled={saving || !form.work_detail || (!selectedHouse && !editingReport && !form.house_id)}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : editingReport ? "บันทึกการแก้ไข" : "บันทึกรายงาน"}
            </button>
          </div>
        </div>
      )}

      {showHouseEditModal && editingHouse && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">แก้ไขยูนิต — {editingHouse.house_number}</h2>
              <button onClick={() => { setShowHouseEditModal(false); setEditingHouse(null); }}>
                <X size={20} className="text-aviva-secondary" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">หมายเลขยูนิต</label>
                  <input type="text" value={houseForm.house_number}
                    onChange={(e) => setHouseForm({ ...houseForm, house_number: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">สถานะ</label>
                  <select value={houseForm.status} onChange={(e) => setHouseForm({ ...houseForm, status: e.target.value as HouseStatus })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                    <option value="on-track">ตามแผน</option>
                    <option value="delayed">ล่าช้า</option>
                    <option value="complete">เสร็จแล้ว</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ผู้รับเหมา</label>
                <input type="text" value={houseForm.contractor}
                  onChange={(e) => setHouseForm({ ...houseForm, contractor: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เฟส / ขั้นตอน</label>
                <input type="text" value={houseForm.phase}
                  onChange={(e) => setHouseForm({ ...houseForm, phase: e.target.value })}
                  placeholder="เช่น งานโครงสร้าง"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ความคืบหน้า (%)</label>
                  <input type="number" min="0" max="100" value={houseForm.progress}
                    onChange={(e) => setHouseForm({ ...houseForm, progress: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
                <div>
                  <label className="text-xs text-aviva-secondary mb-1 block">ล่าช้า (วัน)</label>
                  <input type="number" min="0" value={houseForm.delayed_days}
                    onChange={(e) => setHouseForm({ ...houseForm, delayed_days: e.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
                </div>
              </div>
            </div>
            <button onClick={handleSaveHouse} disabled={saving}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}