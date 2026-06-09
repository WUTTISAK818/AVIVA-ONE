"use client";
import { useState, useEffect, useCallback } from "react";
import { Bot, ArrowLeft, Save, Sparkles, KeyRound, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { DEFAULT_EXPERTS, EXPERT_DEPTS, DEPT_LABEL, DEFAULT_MODEL, type DeptExpert } from "@/lib/ai-experts";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const MODELS = [
  { id: "claude-opus-4-8", label: "Opus 4.8 (ฉลาดสุด)" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 (สมดุล)" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 (เร็ว/ประหยัด)" },
];

// การ์ดเชื่อมต่อ Claude AI — ตั้ง API key จากมือถือได้ ไม่ต้องแตะ Vercel
function ApiKeyCard() {
  const [keyStatus, setKeyStatus] = useState<{ configured: boolean; suffix: string | null } | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const callApi = async (body: Record<string, string>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ key: "ANTHROPIC_API_KEY", ...body }),
    });
    return res.json();
  };

  useEffect(() => {
    callApi({ action: "status" }).then(s => setKeyStatus({ configured: !!s.configured, suffix: s.suffix ?? null })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveKey = async () => {
    const v = keyInput.trim();
    if (!v) return;
    setBusy(true); setResult(null);
    const setRes = await callApi({ action: "set", value: v });
    if (setRes.error) {
      setResult({ ok: false, msg: setRes.error });
      setBusy(false);
      return;
    }
    const testRes = await callApi({ action: "test" });
    if (testRes.ok) {
      setResult({ ok: true, msg: "เชื่อมต่อสำเร็จ — AI พร้อมใช้งานแล้วค่ะ 🎉" });
      setKeyStatus({ configured: true, suffix: v.slice(-6) });
      setKeyInput("");
    } else {
      setResult({ ok: false, msg: `บันทึกแล้วแต่ทดสอบไม่ผ่าน: ${testRes.error ?? "เชื่อมต่อไม่สำเร็จ"} — ตรวจสอบ key อีกครั้งค่ะ` });
    }
    setBusy(false);
  };

  return (
    <GlassCard className="p-4 space-y-3 border border-aviva-gold/25">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-aviva-text flex items-center gap-2"><KeyRound size={15} className="text-aviva-gold" /> เชื่อมต่อ Claude AI</p>
        {keyStatus && (
          keyStatus.configured ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/30 flex items-center gap-1">
              <CheckCircle size={10} /> เชื่อมต่อแล้ว{keyStatus.suffix ? ` (…${keyStatus.suffix})` : ""}
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 flex items-center gap-1">
              <AlertTriangle size={10} /> ยังไม่ได้ตั้ง key
            </span>
          )
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={keyInput}
          onChange={e => setKeyInput(e.target.value)}
          placeholder="วาง API key (sk-ant-...)"
          autoComplete="off"
          className="flex-1 bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2.5 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60"
        />
        <button onClick={saveKey} disabled={busy || !keyInput.trim()}
          className="bg-aviva-gold text-aviva-bg font-bold px-4 py-2.5 rounded-xl text-sm disabled:opacity-50 flex-shrink-0">
          {busy ? "กำลังทดสอบ..." : "บันทึก"}
        </button>
      </div>
      {result && (
        <p className={clsx("text-xs flex items-center gap-1.5", result.ok ? "text-green-400" : "text-red-400")}>
          {result.ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />} {result.msg}
        </p>
      )}
      <div className="text-[11px] text-aviva-secondary leading-relaxed space-y-1">
        <p className="font-semibold text-aviva-secondary/90">ยังไม่มี key? สมัครจากมือถือได้:</p>
        <p>1. เปิด <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-aviva-gold underline inline-flex items-center gap-0.5">console.anthropic.com <ExternalLink size={10} /></a> แล้วสมัคร/ล็อกอิน</p>
        <p>2. เติมเครดิต (เมนู Billing) ขั้นต่ำ $5</p>
        <p>3. ไปที่ API Keys → Create Key → คัดลอก key ที่ขึ้นต้นด้วย sk-ant-</p>
        <p>4. กลับมาวางในช่องด้านบนแล้วกดบันทึก — ระบบจะทดสอบการเชื่อมต่อให้อัตโนมัติ</p>
      </div>
    </GlassCard>
  );
}

export default function AIExpertsPage() {
  const currentUser = useCurrentUser();
  const router = useRouter();
  const [experts, setExperts] = useState<Record<string, DeptExpert>>(DEFAULT_EXPERTS);
  const [loading, setLoading] = useState(true);
  const [savingDept, setSavingDept] = useState<string | null>(null);
  const [savedDept, setSavedDept] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("ai_experts").select("*");
    const merged: Record<string, DeptExpert> = JSON.parse(JSON.stringify(DEFAULT_EXPERTS));
    (data ?? []).forEach((row: Record<string, unknown>) => {
      const dept = row.dept as string;
      if (merged[dept]) {
        merged[dept] = {
          dept,
          expert_name: (row.expert_name as string) || merged[dept].expert_name,
          focus: (row.focus as string) || merged[dept].focus,
          persona: (row.persona as string) || merged[dept].persona,
          model: (row.model as string) || DEFAULT_MODEL,
          is_active: (row.is_active as boolean) ?? true,
        };
      }
    });
    setExperts(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (!currentUser.isManager) { router.replace("/dashboard"); return; }
    fetchAll();
  }, [currentUser, router, fetchAll]);

  const update = (dept: string, patch: Partial<DeptExpert>) =>
    setExperts(prev => ({ ...prev, [dept]: { ...prev[dept], ...patch } }));

  const save = async (dept: string) => {
    setSavingDept(dept);
    const e = experts[dept];
    await supabase.from("ai_experts").upsert({
      project_id: PROJECT_ID,
      dept,
      expert_name: e.expert_name,
      focus: e.focus,
      persona: e.persona,
      model: e.model,
      is_active: e.is_active,
      updated_by: currentUser?.full_name ?? currentUser?.email ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "project_id,dept" });
    setSavingDept(null);
    setSavedDept(dept);
    setTimeout(() => setSavedDept(s => (s === dept ? null : s)), 1500);
  };

  return (
    <div className="min-h-screen bg-aviva-bg">
      <div className="sticky top-0 z-30 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Link href="/settings" className="text-aviva-gold hover:text-aviva-gold/80"><ArrowLeft size={20} /></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-aviva-text flex items-center gap-2"><Bot size={16} className="text-aviva-gold" /> ผู้เชี่ยวชาญ AI ประจำฝ่าย</h1>
            <p className="text-[11px] text-aviva-secondary">ตั้งชื่อ บทบาท และน้ำเสียงของ AI ผู้ช่วยแต่ละฝ่าย</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        <ApiKeyCard />
        <GlassCard gold className="p-3">
          <p className="text-xs text-aviva-secondary leading-relaxed flex items-start gap-2">
            <Sparkles size={14} className="text-aviva-gold flex-shrink-0 mt-0.5" />
            ผู้เชี่ยวชาญแต่ละฝ่ายจะวิเคราะห์ข้อมูลจริงของฝ่าย แล้วสร้าง “บรีฟเชิงรุก” (เรื่องที่ควรสนใจ + แผนสัปดาห์/เดือน) ให้พนักงาน และส่งสรุปรวมเสนอผู้บริหารอัตโนมัติ
          </p>
        </GlassCard>

        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-aviva-card/50 animate-pulse" />)
        ) : (
          EXPERT_DEPTS.map(dept => {
            const e = experts[dept];
            return (
              <GlassCard key={dept} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <SectionHeader title={DEPT_LABEL[dept]} />
                  <button
                    onClick={() => update(dept, { is_active: !e.is_active })}
                    className={clsx("text-[10px] px-2.5 py-1 rounded-full border font-medium",
                      e.is_active ? "bg-green-500/15 text-green-300 border-green-500/30" : "bg-gray-500/15 text-gray-400 border-gray-500/30")}
                  >
                    {e.is_active ? "เปิดใช้งาน" : "ปิด"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-aviva-secondary mb-1 block">ชื่อผู้เชี่ยวชาญ</label>
                    <input value={e.expert_name} onChange={ev => update(dept, { expert_name: ev.target.value })}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text" />
                  </div>
                  <div>
                    <label className="text-[11px] text-aviva-secondary mb-1 block">โมเดล</label>
                    <select value={e.model} onChange={ev => update(dept, { model: ev.target.value })}
                      className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text">
                      {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-aviva-secondary mb-1 block">หน้าที่/จุดโฟกัส</label>
                  <input value={e.focus} onChange={ev => update(dept, { focus: ev.target.value })}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text" />
                </div>
                <div>
                  <label className="text-[11px] text-aviva-secondary mb-1 block">น้ำเสียง/บทบาท (persona)</label>
                  <textarea value={e.persona} onChange={ev => update(dept, { persona: ev.target.value })} rows={2}
                    className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-3 py-2 text-sm text-aviva-text resize-none" />
                </div>
                <button onClick={() => save(dept)} disabled={savingDept === dept}
                  className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
                  <Save size={14} />
                  {savingDept === dept ? "กำลังบันทึก..." : savedDept === dept ? "บันทึกแล้ว ✓" : "บันทึก"}
                </button>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
