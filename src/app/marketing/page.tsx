"use client";

import { useEffect, useState } from "react";
import { Megaphone, TrendingUp, DollarSign, Users, Sparkles, Plus, X } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ProgressBar from "@/components/ProgressBar";
import AIInsightPanel from "@/components/AIInsightPanel";
import { supabase } from "@/lib/supabase";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface Campaign {
  id: string;
  name: string;
  platform: string;
  budget: number;
  spent: number;
  leads_generated: number;
  impressions: number;
  clicks: number;
  conversions: number;
  status: string;
}

const platformStyle: Record<string, { color: string; bg: string }> = {
  Facebook: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  TikTok:   { color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  Google:   { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
};

const statusStyle: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  paused: "bg-yellow-500/20 text-yellow-400",
  ended:  "bg-gray-500/20 text-gray-400",
};

const statusLabel: Record<string, string> = {
  active: "กำลังทำงาน",
  paused: "หยุดชั่วคราว",
  ended:  "สิ้นสุดแล้ว",
};

function roi(campaign: Campaign) {
  const avgHousePrice = 9_500_000;
  const revenue = campaign.conversions * avgHousePrice;
  return campaign.spent > 0 ? Math.round((revenue / campaign.spent) * 100) : 0;
}

function cpl(campaign: Campaign) {
  return campaign.leads_generated > 0
    ? Math.round(campaign.spent / campaign.leads_generated).toLocaleString()
    : "—";
}

const emptyForm = { name: "", platform: "Facebook", budget: "", start_date: "", end_date: "" };

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "Facebook" | "TikTok" | "Google">("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchCampaigns = () => {
    supabase.from("campaigns").select("*").eq("project_id", PROJECT_ID)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setCampaigns((data as Campaign[]) ?? []); setLoading(false); });
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const filtered = filter === "all" ? campaigns : campaigns.filter(c => c.platform === filter);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads_generated, 0);
  const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgROI = campaigns.length
    ? Math.round(campaigns.reduce((s, c) => s + roi(c), 0) / campaigns.length)
    : 0;

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    await supabase.from("campaigns").insert({
      project_id: PROJECT_ID,
      name: form.name,
      platform: form.platform,
      budget: Number(form.budget) || 0,
      spent: 0,
      leads_generated: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      status: "active",
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyForm);
    fetchCampaigns();
  };

  return (
    <>
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">Marketing & Ads</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : `${campaigns.length} แคมเปญ · Real-time`}
              </p>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
              <Plus size={14} /> สร้างแคมเปญ
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {/* KPI Summary */}
        <div className="grid grid-cols-2 gap-3">
          <GlassCard className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-aviva-gold" />
              <span className="text-xs text-aviva-secondary">Leads ทั้งหมด</span>
            </div>
            <p className="text-2xl font-bold text-aviva-text">{loading ? "—" : totalLeads}</p>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={14} className="text-aviva-gold" />
              <span className="text-xs text-aviva-secondary">งบที่ใช้</span>
            </div>
            <p className="text-2xl font-bold text-aviva-text">
              ฿{loading ? "—" : (totalSpent / 1000).toFixed(0)}K
            </p>
          </GlassCard>
          <GlassCard gold className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-aviva-gold" />
              <span className="text-xs text-aviva-secondary">Avg. ROI</span>
            </div>
            <p className="text-2xl font-bold text-aviva-gold">{loading ? "—" : `${avgROI}%`}</p>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone size={14} className="text-aviva-gold" />
              <span className="text-xs text-aviva-secondary">Conversions</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{loading ? "—" : totalConversions}</p>
          </GlassCard>
        </div>

        {/* AI Insight */}
        <AIInsightPanel
          type="success"
          priority="medium"
          title="AI: Facebook ROI สูงสุด"
          message="แคมเปญ Facebook มี ROI เฉลี่ยสูงสุด แนะนำเพิ่มงบอีก 20% และทดสอบ Creative ใหม่ในกลุ่มเป้าหมาย 35-50 ปีครับ"
        />

        {/* Platform Filter */}
        <div>
          <SectionHeader title="แคมเปญ" subtitle="กรองตาม Platform" />
          <div className="flex gap-2 mb-4">
            {(["all", "Facebook", "TikTok", "Google"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={clsx(
                  "flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                  filter === p
                    ? "bg-aviva-gold text-aviva-bg border-aviva-gold"
                    : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
                )}
              >
                {p === "all" ? "ทั้งหมด" : p}
              </button>
            ))}
          </div>

          {/* Campaign Cards */}
          <div className="space-y-3">
            {loading
              ? [1, 2, 3].map((i) => <div key={i} className="h-36 rounded-2xl bg-aviva-card/50 animate-pulse" />)
              : filtered.map((c) => {
                  const pStyle = platformStyle[c.platform] ?? { color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" };
                  const spentPct = Math.round((c.spent / (c.budget || 1)) * 100);
                  return (
                    <GlassCard key={c.id} className={clsx("p-4 border", pStyle.bg)}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-aviva-text">{c.name}</h3>
                            <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full", statusStyle[c.status])}>
                              {statusLabel[c.status]}
                            </span>
                          </div>
                          <span className={clsx("text-xs font-medium", pStyle.color)}>{c.platform}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-aviva-gold">{roi(c)}%</p>
                          <p className="text-[10px] text-aviva-secondary">ROI</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="text-center">
                          <p className="text-sm font-bold text-aviva-text">{c.leads_generated}</p>
                          <p className="text-[10px] text-aviva-secondary">Leads</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-aviva-text">฿{cpl(c)}</p>
                          <p className="text-[10px] text-aviva-secondary">CPL</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-green-400">{c.conversions}</p>
                          <p className="text-[10px] text-aviva-secondary">Conversion</p>
                        </div>
                      </div>

                      <ProgressBar
                        label={`ใช้ไป ฿${(c.spent / 1000).toFixed(0)}K / ฿${(c.budget / 1000).toFixed(0)}K`}
                        value={spentPct}
                        color={spentPct > 90 ? "red" : "gold"}
                      />
                    </GlassCard>
                  );
                })}
          </div>
        </div>
      </div>
    </div>

    {showModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-aviva-text">สร้างแคมเปญใหม่</h2>
            <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-aviva-secondary mb-1 block">ชื่อแคมเปญ *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น AVIVA — Facebook Q3 2026"
                className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">Platform</label>
                <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text outline-none focus:border-aviva-gold/60">
                  {["Facebook","TikTok","Google","LINE","อื่นๆ"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">งบประมาณ (บาท)</label>
                <input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  placeholder="50000"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันเริ่ม</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">วันสิ้นสุด</label>
                <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text outline-none focus:border-aviva-gold/60" />
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !form.name}
            className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "สร้างแคมเปญ"}
          </button>
        </div>
      </div>
    )}
  </>
  );
}
