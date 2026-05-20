"use client";

import { useEffect, useState } from "react";
import { FolderOpen, CheckCircle, Clock, XCircle, Upload, Search, X, ExternalLink } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface Document {
  id: string;
  name: string;
  category: string;
  status: "pending" | "approved" | "rejected";
  uploaded_by: string;
  approved_by: string | null;
  created_at: string;
}

type FilterCat = "all" | "Contract" | "Loan" | "Permit" | "Utility";

const statusConfig = {
  approved: { label: "อนุมัติแล้ว", icon: CheckCircle, color: "text-green-400", bg: "border-green-400/20" },
  pending:  { label: "รออนุมัติ",   icon: Clock,        color: "text-yellow-400", bg: "border-yellow-400/20" },
  rejected: { label: "ปฏิเสธ",      icon: XCircle,      color: "text-red-400",    bg: "border-red-400/20" },
};

const categoryStyle: Record<string, string> = {
  Contract: "bg-purple-500/20 text-purple-400",
  Loan:     "bg-blue-500/20 text-blue-400",
  Permit:   "bg-orange-500/20 text-orange-400",
  Utility:  "bg-teal-500/20 text-teal-400",
  Other:    "bg-gray-500/20 text-gray-400",
};

const categoryTh: Record<string, string> = {
  Contract: "สัญญา",
  Loan:     "สินเชื่อ",
  Permit:   "ใบอนุญาต",
  Utility:  "สาธารณูปโภค",
  Other:    "อื่นๆ",
};

const emptyDocForm = { name: "", category: "Contract", uploaded_by: "Admin", file_url: "" };

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterCat>("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyDocForm);
  const [saving, setSaving] = useState(false);

  const fetchDocs = () => {
    supabase.from("documents").select("*").eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setDocs((data as Document[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchDocs(); }, []);

  const counts = {
    approved: docs.filter(d => d.status === "approved").length,
    pending:  docs.filter(d => d.status === "pending").length,
    rejected: docs.filter(d => d.status === "rejected").length,
  };

  const filtered = docs.filter(
    d => (filter === "all" || d.category === filter) &&
      (search === "" || d.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    await supabase.from("documents").insert({
      project_id: PROJECT_ID,
      name: form.name,
      category: form.category,
      uploaded_by: form.uploaded_by,
      file_url: form.file_url || null,
      status: "pending",
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyDocForm);
    fetchDocs();
  };

  const handleApprove = async (id: string, approve: boolean) => {
    await supabase.from("documents").update({
      status: approve ? "approved" : "rejected",
      approved_by: "Admin",
    }).eq("id", id);
    fetchDocs();
  };

  return (
    <>
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">เอกสาร & อนุมัติ</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : `${docs.length} ไฟล์ · Real-time Supabase`}
              </p>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
              <Upload size={13} /> เพิ่มเอกสาร
            </button>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary" />
            <input
              type="text"
              placeholder="ค้นหาเอกสาร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-aviva-card border border-aviva-gold/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/50 outline-none focus:border-aviva-gold/40"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-3 text-center">
            <CheckCircle size={16} className="text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-400">{loading ? "—" : counts.approved}</p>
            <p className="text-[10px] text-aviva-secondary">อนุมัติแล้ว</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <Clock size={16} className="text-yellow-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-yellow-400">{loading ? "—" : counts.pending}</p>
            <p className="text-[10px] text-aviva-secondary">รออนุมัติ</p>
          </GlassCard>
          <GlassCard gold className="p-3 text-center">
            <FolderOpen size={16} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-xl font-bold text-aviva-gold">{loading ? "—" : docs.length}</p>
            <p className="text-[10px] text-aviva-secondary">ทั้งหมด</p>
          </GlassCard>
        </div>

        {/* Category Filter */}
        <div>
          <SectionHeader title="หมวดหมู่" />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["all", "Contract", "Loan", "Permit", "Utility"] as FilterCat[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={clsx(
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  filter === cat
                    ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                    : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                )}
              >
                {cat === "all" ? "ทั้งหมด" : categoryTh[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Documents List */}
        <div>
          <SectionHeader title={`เอกสาร (${filtered.length})`} />
          <div className="space-y-2">
            {loading
              ? [1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-aviva-card/50 animate-pulse" />)
              : filtered.length === 0
              ? (
                <GlassCard className="p-8 text-center">
                  <p className="text-aviva-secondary text-sm">ไม่พบเอกสาร</p>
                </GlassCard>
              )
              : filtered.map((doc) => {
                  const sConf = statusConfig[doc.status] ?? statusConfig.pending;
                  const Icon = sConf.icon;
                  return (
                    <GlassCard key={doc.id} className={clsx("p-3 border", sConf.bg)}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-aviva-card flex items-center justify-center flex-shrink-0">
                          <FolderOpen size={16} className="text-aviva-gold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aviva-text font-medium truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", categoryStyle[doc.category])}>
                              {categoryTh[doc.category] ?? doc.category}
                            </span>
                            <span className="text-[10px] text-aviva-secondary">{doc.uploaded_by}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <Icon size={14} className={sConf.color} />
                          <span className={clsx("text-[10px] font-medium", sConf.color)}>{sConf.label}</span>
                        </div>
                      </div>
                      {doc.status === "pending" && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleApprove(doc.id, true)}
                            className="flex-1 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium">
                            อนุมัติ
                          </button>
                          <button onClick={() => handleApprove(doc.id, false)}
                            className="flex-1 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium">
                            ปฏิเสธ
                          </button>
                        </div>
                      )}
                    </GlassCard>
                  );
                })}
          </div>
        </div>
      </div>
    </div>

    {/* Add Document Modal */}
    {showModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-aviva-text">เพิ่มเอกสาร</h2>
            <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ชื่อเอกสาร *</label>
              <input type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น สัญญาจะซื้อจะขาย บ้านเลข A-01"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">หมวดหมู่</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {["Contract","Loan","Permit","Utility","Other"].map(c =>
                    <option key={c} value={c}>{categoryTh[c] ?? c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">อัปโหลดโดย</label>
                <input type="text" value={form.uploaded_by}
                  onChange={(e) => setForm({ ...form, uploaded_by: e.target.value })}
                  placeholder="ชื่อผู้อัปโหลด"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ลิงค์ไฟล์ (Google Drive / URL)</label>
              <input type="url" value={form.file_url}
                onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                placeholder="https://drive.google.com/..."
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !form.name}
            className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "เพิ่มเอกสาร"}
          </button>
        </div>
      </div>
    )}
    </>
  );
}
