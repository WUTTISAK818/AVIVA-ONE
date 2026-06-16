"use client";
import { useState, useEffect, useCallback } from "react";
import { HardHat, Plus, X, Save, ArrowLeft, Phone, MessageCircle, Home, Hash, Link2 } from "lucide-react";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Contractor {
  id: string;
  name: string;
  phone: string | null;
  line_user_id: string | null;
  ref_code: string;
  created_at: string;
}

interface HouseLite {
  id: string;
  house_number: string;
  plot_number: number | null;
  contractor: string | null;
  contractor_line_id: string | null;
  progress: number | null;
  delayed_days: number | null;
  status: string | null;
}

const BLANK = { name: "", phone: "", ref_code: "" };

function genRefCode(): string {
  return "CT-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

export default function ContractorsPage() {
  const currentUser = useCurrentUser();
  const router = useRouter();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [houses, setHouses] = useState<HouseLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<Contractor | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [linkFor, setLinkFor] = useState<Contractor | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: cs }, { data: hs }] = await Promise.all([
      supabase.from("contractors").select("*").order("created_at", { ascending: false }),
      supabase.from("houses").select("id, house_number, plot_number, contractor, contractor_line_id, progress, delayed_days, status").order("plot_number"),
    ]);
    setContractors((cs as Contractor[]) ?? []);
    setHouses((hs as HouseLite[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (!currentUser.isManager) { router.replace("/dashboard"); return; }
    fetchAll();
  }, [currentUser, router, fetchAll]);

  function openAdd() {
    setEdit(null);
    setForm({ ...BLANK, ref_code: genRefCode() });
    setError("");
    setShowModal(true);
  }
  function openEdit(c: Contractor) {
    setEdit(c);
    setForm({ name: c.name, phone: c.phone ?? "", ref_code: c.ref_code });
    setError("");
    setShowModal(true);
  }

  async function submit() {
    if (!form.name.trim()) { setError("กรุณากรอกชื่อผู้รับเหมา"); return; }
    if (!form.ref_code.trim()) { setError("กรุณากรอกรหัสอ้างอิง (ref code)"); return; }
    setSaving(true); setError("");
    try {
      if (edit) {
        const { error: e } = await supabase.from("contractors")
          .update({ name: form.name.trim(), phone: form.phone.trim() || null, ref_code: form.ref_code.trim() })
          .eq("id", edit.id);
        if (e) throw new Error(e.message);
      } else {
        const { error: e } = await supabase.from("contractors")
          .insert({ name: form.name.trim(), phone: form.phone.trim() || null, ref_code: form.ref_code.trim() });
        if (e) throw new Error(e.message);
      }
      setShowModal(false);
      await fetchAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
    setSaving(false);
  }

  async function toggleHouse(h: HouseLite, refCode: string) {
    const linked = h.contractor_line_id === refCode;
    const newVal = linked ? null : refCode;
    setHouses(prev => prev.map(x => x.id === h.id ? { ...x, contractor_line_id: newVal } : x));
    await supabase.from("houses").update({ contractor_line_id: newVal }).eq("id", h.id);
  }

  const linkedCount = (refCode: string) => houses.filter(h => h.contractor_line_id === refCode).length;
  // Scorecard: ผลงานผู้รับเหมาจากแปลงที่ผูก (เฉลี่ย progress + จำนวนล่าช้า)
  const scoreOf = (refCode: string) => {
    const hs = houses.filter(h => h.contractor_line_id === refCode);
    if (!hs.length) return null;
    const avg = Math.round(hs.reduce((s, h) => s + (h.progress ?? 0), 0) / hs.length);
    const delayed = hs.filter(h => (h.delayed_days ?? 0) > 0).length;
    return { avg, delayed, total: hs.length };
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/settings" className="p-1.5 rounded-lg text-aviva-secondary hover:text-aviva-text transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <HardHat size={18} className="text-aviva-gold" />
              <h1 className="text-lg font-bold text-aviva-text">ผู้รับเหมา</h1>
            </div>
          </div>
          <button onClick={openAdd} className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-semibold px-3 py-2 rounded-lg">
            <Plus size={14} />เพิ่มผู้รับเหมา
          </button>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        <p className="text-xs text-aviva-secondary/70">
          จัดการผู้รับเหมาและผูกกับแปลง/ยูนิต เพื่อให้ระบบส่งแจ้งเตือน LINE/SMS และลิงก์ติดตามงานอัตโนมัติเมื่ออนุมัติ/จ่ายเงิน/ตีกลับงวดงาน
        </p>
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-aviva-gold/30 border-t-aviva-gold rounded-full animate-spin mx-auto mb-3" />
            <p className="text-aviva-secondary text-sm">กำลังโหลด...</p>
          </div>
        ) : contractors.length === 0 ? (
          <p className="text-center text-aviva-secondary text-sm py-8">ยังไม่มีผู้รับเหมา — กดเพิ่มผู้รับเหมาเพื่อเริ่มต้น</p>
        ) : (
          contractors.map(c => { const sc = scoreOf(c.ref_code); return (
            <GlassCard key={c.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-aviva-gold/10 border border-aviva-gold/20 flex items-center justify-center flex-shrink-0">
                  <HardHat size={14} className="text-aviva-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-aviva-text truncate">{c.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="text-[11px] text-aviva-secondary inline-flex items-center gap-1"><Hash size={10} />{c.ref_code}</span>
                    {c.phone && <span className="text-[11px] text-aviva-secondary inline-flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
                    <span className={`text-[11px] inline-flex items-center gap-1 ${c.line_user_id ? "text-green-400" : "text-aviva-secondary/50"}`}>
                      <MessageCircle size={10} />{c.line_user_id ? "ผูก LINE แล้ว" : "ยังไม่ผูก LINE"}
                    </span>
                    <span className="text-[11px] text-aviva-gold inline-flex items-center gap-1"><Home size={10} />{linkedCount(c.ref_code)} แปลง</span>
                  </div>
                </div>
              </div>
              {sc && (
                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-aviva-secondary">ความคืบหน้าเฉลี่ย {sc.avg}% ({sc.total} แปลง)</span>
                    {sc.delayed > 0
                      ? <span className="text-red-400 font-medium">⚠ ล่าช้า {sc.delayed} แปลง</span>
                      : <span className="text-green-400 font-medium">✓ ตรงเวลา</span>}
                  </div>
                  <div className="h-1.5 rounded-full bg-aviva-gold/10 overflow-hidden">
                    <div className={sc.delayed > 0 ? "h-full bg-red-400/80" : "h-full bg-green-400"} style={{ width: `${Math.min(100, Math.max(0, sc.avg))}%` }} />
                  </div>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button onClick={() => openEdit(c)} className="flex-1 text-xs text-aviva-secondary border border-aviva-gold/10 rounded-lg py-1.5 hover:border-aviva-gold/30 transition-all">แก้ไข</button>
                <button onClick={() => setLinkFor(c)} className="flex-1 text-xs text-aviva-gold border border-aviva-gold/20 bg-aviva-gold/5 rounded-lg py-1.5 hover:bg-aviva-gold/10 transition-all inline-flex items-center justify-center gap-1">
                  <Link2 size={12} /> ผูกแปลง
                </button>
              </div>
            </GlassCard>
          ); })
        )}
      </div>

      {/* Add / edit contractor */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
          <div className="bg-aviva-card w-full max-w-lg mx-auto rounded-t-2xl p-5 pb-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-aviva-text">{edit ? "แก้ไขผู้รับเหมา" : "เพิ่มผู้รับเหมา"}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อผู้รับเหมา</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="เช่น หจก. ก่อสร้างไทย" className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร (สำหรับ SMS)</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="08xxxxxxxx" inputMode="tel" className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">รหัสอ้างอิง (ref code) — ใช้กับลิงก์ติดตามงาน /track</label>
                <input value={form.ref_code} onChange={e => setForm(p => ({ ...p, ref_code: e.target.value.toUpperCase() }))}
                  placeholder="CT-XXXXX" className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-lg px-3 py-2 text-sm text-aviva-text focus:outline-none focus:border-aviva-gold/50 font-mono" />
              </div>
              {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              <button onClick={submit} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-aviva-gold text-aviva-bg font-semibold py-3 rounded-xl text-sm disabled:opacity-60">
                <Save size={14} />{saving ? "กำลังบันทึก..." : edit ? "บันทึกการแก้ไข" : "เพิ่มผู้รับเหมา"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link houses to a contractor */}
      {linkFor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
          <div className="bg-aviva-card w-full max-w-lg mx-auto rounded-t-2xl p-5 pb-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-aviva-text">ผูกแปลง — {linkFor.name}</h2>
              <button onClick={() => setLinkFor(null)}><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <p className="text-xs text-aviva-secondary/70 mb-4">เลือกแปลง/ยูนิตที่ผู้รับเหมารายนี้รับผิดชอบ (ref: {linkFor.ref_code})</p>
            <div className="space-y-2">
              {houses.length === 0 && <p className="text-sm text-aviva-secondary text-center py-6">ไม่มีข้อมูลแปลง</p>}
              {houses.map(h => {
                const linkedHere = h.contractor_line_id === linkFor.ref_code;
                const linkedOther = !!h.contractor_line_id && !linkedHere;
                return (
                  <button key={h.id} onClick={() => toggleHouse(h, linkFor.ref_code)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      linkedHere ? "border-aviva-gold/50 bg-aviva-gold/10" : "border-aviva-gold/10 hover:border-aviva-gold/30"}`}>
                    <div className="min-w-0">
                      <p className="text-sm text-aviva-text truncate">{h.house_number}{h.plot_number != null ? ` · แปลง ${h.plot_number}` : ""}</p>
                      {linkedOther && <p className="text-[10px] text-orange-400/80">ผูกกับ ref อื่น: {h.contractor_line_id}</p>}
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${linkedHere ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-bg text-aviva-secondary border border-aviva-gold/20"}`}>
                      {linkedHere ? "ผูกแล้ว" : "ผูก"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
