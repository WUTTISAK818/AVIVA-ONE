"use client";
import { useState, useEffect } from "react";
import { Moon, Sun, Monitor, Settings, Users, Building2, ChevronRight, User, Save, Check, BookOpen, FileText, GitBranch, ClipboardList, HardHat, Bot } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { useTheme } from "@/lib/theme-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import PushSetupCard from "@/components/PushSetupCard";
import LineLinkCard from "@/components/LineLinkCard";
import Link from "next/link";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface ProjectForm {
  project_name: string;
  total_units: string;
  sold_units: string;
  available_units: string;
  revenue_target: string;
  construction_progress: string;
  sellout_forecast: string;
}

export default function SettingsPage() {
  const user = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const [projectForm, setProjectForm] = useState<ProjectForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.isAdmin) return;
    supabase.from("projects").select("*").eq("id", PROJECT_ID).single().then(({ data }) => {
      setProjectForm({
        project_name: data?.project_name ?? "",
        total_units: String(data?.total_units ?? 0),
        sold_units: String(data?.sold_units ?? 0),
        available_units: String(data?.available_units ?? 0),
        revenue_target: String(data?.revenue_target ?? 0),
        construction_progress: String(data?.construction_progress ?? 0),
        sellout_forecast: data?.sellout_forecast ?? "",
      });
    });
  }, [user]);

  async function saveProject() {
    if (!projectForm) return;
    setSaving(true); setSaveError(null);
    const { error } = await supabase.from("projects").update({
      project_name: projectForm.project_name,
      total_units: Number(projectForm.total_units),
      sold_units: Number(projectForm.sold_units),
      available_units: Number(projectForm.total_units) - Number(projectForm.sold_units),
      revenue_target: Number(projectForm.revenue_target),
      construction_progress: Number(projectForm.construction_progress),
      sellout_forecast: projectForm.sellout_forecast,
    }).eq("id", PROJECT_ID);
    setSaving(false);
    if (error) { setSaveError("บันทึกไม่สำเร็จ: " + error.message); }
    else {
      setSavedOk(true);
      setProjectForm(prev => prev ? { ...prev, available_units: String(Number(prev.total_units) - Number(prev.sold_units)) } : prev);
      setTimeout(() => setSavedOk(false), 2500);
    }
  }

  const themeOptions = [
    { val: "dark" as const, label: "กลางคืน", Icon: Moon },
    { val: "light" as const, label: "กลางวัน", Icon: Sun },
    { val: "auto" as const, label: "อัตโนมัติ", Icon: Monitor },
  ];

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Settings size={18} className="text-aviva-gold" />
          <h1 className="text-lg font-bold text-aviva-text">ตั้งค่า</h1>
        </div>
      </div>
      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-aviva-gold/10 border border-aviva-gold/30 flex items-center justify-center">
              <User size={18} className="text-aviva-gold" />
            </div>
            <div>
              <p className="text-sm font-semibold text-aviva-text">{user?.full_name ?? "-"}</p>
              <p className="text-xs text-aviva-secondary">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div className="bg-aviva-bg/50 rounded-lg p-2"><p className="text-aviva-secondary">ตำแหน่ง</p><p className="text-aviva-text font-medium mt-0.5 capitalize">{user?.role ?? "-"}</p></div>
            <div className="bg-aviva-bg/50 rounded-lg p-2"><p className="text-aviva-secondary">ฝ่าย</p><p className="text-aviva-text font-medium mt-0.5">{user?.department ?? "-"}</p></div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-sm font-semibold text-aviva-text mb-3">การแสดงหน้าจอ</p>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(({ val, label, Icon }) => (
              <button key={val} onClick={() => setTheme(val)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  theme === val ? "border-aviva-gold bg-aviva-gold/10 text-aviva-gold" : "border-aviva-gold/10 text-aviva-secondary"
                }`}>
                <Icon size={18} />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        </GlassCard>
        <PushSetupCard />
        <LineLinkCard />
        <GlassCard className="p-0 overflow-hidden">
          <p className="text-xs font-semibold text-aviva-secondary/70 px-4 pt-4 pb-2 uppercase tracking-wider">ข้อมูลองค์กร</p>
          <Link href="/settings/manual" className="flex items-center gap-3 px-4 py-3 hover:bg-aviva-gold/5 transition-all border-t border-aviva-gold/10">
            <div className="w-8 h-8 rounded-full bg-aviva-gold/10 border border-aviva-gold/20 flex items-center justify-center"><BookOpen size={14} className="text-aviva-gold" /></div>
            <div className="flex-1"><p className="text-sm text-aviva-text">คู่มือการใช้งาน</p><p className="text-xs text-aviva-secondary">วิธีใช้แอปทุกฝ่าย แบบละเอียด</p></div>
            <ChevronRight size={16} className="text-aviva-secondary/50" />
          </Link>
          <Link href="/settings/doc-index" className="flex items-center gap-3 px-4 py-3 hover:bg-aviva-gold/5 transition-all border-t border-aviva-gold/10">
            <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center"><FileText size={14} className="text-purple-400" /></div>
            <div className="flex-1"><p className="text-sm text-aviva-text">ดรรชนีเอกสาร</p><p className="text-xs text-aviva-secondary">รหัสเอกสาร (FIN, PO, WR...) และรูปแบบเลขที่</p></div>
            <ChevronRight size={16} className="text-aviva-secondary/50" />
          </Link>
          <Link href="/settings/org-chart" className="flex items-center gap-3 px-4 py-3 hover:bg-aviva-gold/5 transition-all border-t border-aviva-gold/10">
            <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center"><GitBranch size={14} className="text-teal-400" /></div>
            <div className="flex-1"><p className="text-sm text-aviva-text">โครงสร้างองค์กร</p><p className="text-xs text-aviva-secondary">สายบังคับบัญชา Matrix การอนุมัติ</p></div>
            <ChevronRight size={16} className="text-aviva-secondary/50" />
          </Link>
          <Link href="/settings/forms" className="flex items-center gap-3 px-4 py-3 hover:bg-aviva-gold/5 transition-all border-t border-aviva-gold/10">
            <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center"><ClipboardList size={14} className="text-orange-400" /></div>
            <div className="flex-1"><p className="text-sm text-aviva-text">แบบฟอร์มมาตรฐาน</p><p className="text-xs text-aviva-secondary">8 แบบฟอร์ม FIN / INST / PO / WR / LEAVE / MKTG / BOOK / DOC</p></div>
            <ChevronRight size={16} className="text-aviva-secondary/50" />
          </Link>
        </GlassCard>

        {user?.isManager && (
          <GlassCard className="p-0 overflow-hidden">
            <p className="text-xs font-semibold text-aviva-secondary/70 px-4 pt-4 pb-2 uppercase tracking-wider">จัดการระบบ</p>
            <Link href="/settings/users" className="flex items-center gap-3 px-4 py-3 hover:bg-aviva-gold/5 transition-all border-t border-aviva-gold/10">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><Users size={14} className="text-blue-400" /></div>
              <div className="flex-1"><p className="text-sm text-aviva-text">จัดการผู้ใช้</p><p className="text-xs text-aviva-secondary">เพิ่ม / แก้ไขผู้ใช้งานในระบบ</p></div>
              <ChevronRight size={16} className="text-aviva-secondary/50" />
            </Link>
            <Link href="/settings/ai-experts" className="flex items-center gap-3 px-4 py-3 hover:bg-aviva-gold/5 transition-all border-t border-aviva-gold/10">
              <div className="w-8 h-8 rounded-full bg-aviva-gold/10 border border-aviva-gold/20 flex items-center justify-center"><Bot size={14} className="text-aviva-gold" /></div>
              <div className="flex-1"><p className="text-sm text-aviva-text">ผู้เชี่ยวชาญ AI ประจำฝ่าย</p><p className="text-xs text-aviva-secondary">ตั้งชื่อ บทบาท น้ำเสียง และโมเดลของ AI แต่ละฝ่าย</p></div>
              <ChevronRight size={16} className="text-aviva-secondary/50" />
            </Link>
            <Link href="/settings/contractors" className="flex items-center gap-3 px-4 py-3 hover:bg-aviva-gold/5 transition-all border-t border-aviva-gold/10">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><HardHat size={14} className="text-amber-400" /></div>
              <div className="flex-1"><p className="text-sm text-aviva-text">ผู้รับเหมา</p><p className="text-xs text-aviva-secondary">จัดการผู้รับเหมา + ผูกแปลง สำหรับแจ้งเตือน LINE/SMS</p></div>
              <ChevronRight size={16} className="text-aviva-secondary/50" />
            </Link>
          </GlassCard>
        )}
        {user?.isAdmin && projectForm && (
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={16} className="text-aviva-gold" />
              <p className="text-sm font-semibold text-aviva-text">ข้อมูลโครงการ</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อโครงการ</label>
                <input value={projectForm.project_name}
                  onChange={e => setProjectForm(prev => prev ? { ...prev, project_name: e.target.value } : prev)}
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ["total_units", "จำนวนยูนิตทั้งหมด", "number"],
                  ["sold_units", "ยูนิตที่ขายแล้ว", "number"],
                  ["construction_progress", "ความคืบหน้าก่อสร้าง (%)", "number"],
                  ["revenue_target", "เป้ารายได้ (บาท)", "number"],
                  ["sellout_forecast", "คาดว่าขายหมด", "text"],
                ] as const).map(([field, label, type]) => (
                  <div key={field}>
                    <label className="text-xs text-aviva-secondary mb-1 block">{label}</label>
                    <input type={type} value={projectForm[field]}
                      onChange={e => setProjectForm(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                      placeholder={field === "sellout_forecast" ? "Q3 2026" : undefined}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50" />
                  </div>
                ))}
              </div>
              {saveError && <p className="text-xs text-red-400">{saveError}</p>}
              <button onClick={saveProject} disabled={saving}
                className="w-full bg-aviva-gold text-aviva-bg font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {savedOk ? <><Check size={14} /> บันทึกแล้ว</> : saving ? "กำลังบันทึก..." : <><Save size={14} /> บันทึกข้อมูลโครงการ</>}
              </button>
            </div>
          </GlassCard>
        )}
        <div className="pt-2 pb-4 text-center space-y-1">
          <p className="text-xs font-bold text-aviva-gold tracking-widest">AVIVA ONE</p>
          <p className="text-[11px] text-aviva-secondary/60">Version 4.72</p>
          <p className="text-[10px] text-aviva-secondary/30">Built with ❤️ by AVIVA Team</p>
        </div>
      </div>
    </div>
  );
}
