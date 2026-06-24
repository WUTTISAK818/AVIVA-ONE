"use client";

import { useState, useEffect } from "react";
import { Home, Plus, X, DollarSign, Users, CheckCircle } from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";

interface CommunityMember {
  member_id: string;
  house_id: string | null;
  owner_name: string;
  owner_phone: string;
  area_sqw: number;
  annual_fee: number;
  fee_status: string;
  transferred_at: string | null;
}

function fmt(n: number) {
  return `฿${Number(n).toLocaleString("th-TH")}`;
}

const emptyForm = { owner_name: "", owner_phone: "", area_sqw: "" };

export default function CommunityPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "Paid" | "Unpaid">("all");

  useEffect(() => {
    if (!user) return;
    if (!user.isAdmin) {
      router.replace("/dashboard");
      return;
    }
    fetchMembers();
  }, [user, router]);

  const fetchMembers = () => {
    supabase.from("community_members").select("*").order("owner_name")
      .then(({ data }) => { setMembers((data as CommunityMember[]) ?? []); setLoading(false); });
  };

  const totalFee = members.reduce((s, m) => s + Number(m.annual_fee), 0);
  const paidCount = members.filter((m) => m.fee_status === "Paid").length;
  const unpaidCount = members.filter((m) => m.fee_status === "Unpaid").length;
  const collectedAmt = members.filter((m) => m.fee_status === "Paid").reduce((s, m) => s + Number(m.annual_fee || 0), 0);
  const outstandingAmt = members.filter((m) => m.fee_status === "Unpaid").reduce((s, m) => s + Number(m.annual_fee || 0), 0);
  const filtered = filterStatus === "all" ? members : members.filter((m) => m.fee_status === filterStatus);

  const handleAdd = async () => {
    if (!form.owner_name || !form.area_sqw) return;
    setSaving(true);
    await supabase.from("community_members").insert({
      owner_name: form.owner_name,
      owner_phone: form.owner_phone,
      area_sqw: Number(form.area_sqw),
      fee_status: "Unpaid",
    });
    setSaving(false);
    setShowModal(false);
    setForm(emptyForm);
    fetchMembers();
  };

  const handleMarkPaid = async (id: string) => {
    await supabase.from("community_members").update({ fee_status: "Paid" }).eq("member_id", id);
    fetchMembers();
  };

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      <div className="sticky top-0 z-40 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-aviva-text">นิติบุคคล</h1>
              <p className="text-xs text-aviva-secondary mt-0.5">
                {loading ? "กำลังโหลด..." : `${members.length} สมาชิก · ค่าส่วนกลางรวม ${fmt(totalFee)}`}
              </p>
            </div>
            <button onClick={() => { setForm(emptyForm); setShowModal(true); }}
              className="flex items-center gap-1.5 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
              <Plus size={14} /> เพิ่มสมาชิก
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <GlassCard className="p-3 text-center">
            <Users size={16} className="text-aviva-gold mx-auto mb-1" />
            <p className="text-xl font-bold text-aviva-text">{members.length}</p>
            <p className="text-[10px] text-aviva-secondary">สมาชิกทั้งหมด</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <CheckCircle size={16} className="text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-400">{paidCount}</p>
            <p className="text-[10px] text-aviva-secondary">ชำระแล้ว</p>
            <p className="text-[9px] text-green-400/70 mt-0.5">{fmt(collectedAmt)}</p>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <DollarSign size={16} className="text-red-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-red-400">{unpaidCount}</p>
            <p className="text-[10px] text-aviva-secondary">ค้างชำระ</p>
            <p className="text-[9px] text-red-400/70 mt-0.5">{fmt(outstandingAmt)}</p>
          </GlassCard>
        </div>

        <div className="flex gap-2">
          {[{ k: "all", l: "ทั้งหมด" }, { k: "Unpaid", l: "ค้างชำระ" }, { k: "Paid", l: "ชำระแล้ว" }].map(({ k, l }) => (
            <button key={k} onClick={() => setFilterStatus(k as "all" | "Paid" | "Unpaid")}
              className={clsx("flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                filterStatus === k ? "bg-aviva-gold text-aviva-bg border-aviva-gold" : "bg-aviva-card text-aviva-secondary border-aviva-gold/10"
              )}>{l}</button>
          ))}
        </div>

        <div className="space-y-3">
          <SectionHeader title="ทะเบียนสมาชิก" subtitle="ค่าส่วนกลาง = พื้นที่ × ฿30/ตร.ว." />
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-aviva-card/50 animate-pulse" />)
          ) : filtered.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <Home size={28} className="text-aviva-secondary/30 mx-auto mb-2" />
              <p className="text-aviva-secondary text-sm">ยังไม่มีสมาชิก</p>
            </GlassCard>
          ) : (
            filtered.map((m) => (
              <GlassCard key={m.member_id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-aviva-text">{m.owner_name}</p>
                    {m.owner_phone && <p className="text-xs text-aviva-secondary">{m.owner_phone}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-aviva-secondary">{m.area_sqw} ตร.ว.</span>
                      <span className="text-xs font-medium text-aviva-gold">{fmt(Number(m.annual_fee))}/ปี</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={clsx("text-[10px] px-2 py-0.5 rounded-full",
                      m.fee_status === "Paid" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    )}>
                      {m.fee_status === "Paid" ? "ชำระแล้ว" : "ค้างชำระ"}
                    </span>
                    {m.fee_status === "Unpaid" && (
                      <button onClick={() => handleMarkPaid(m.member_id)}
                        className="text-[10px] bg-aviva-gold/20 text-aviva-gold border border-aviva-gold/30 px-2 py-1 rounded-lg">
                        บันทึกรับชำระ
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-4 mb-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-aviva-text">เพิ่มสมาชิกใหม่</h2>
              <button onClick={() => setShowModal(false)} aria-label="ปิด"><X size={20} className="text-aviva-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">ชื่อเจ้าของ *</label>
                <input type="text" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                  placeholder="ชื่อ-นามสกุล"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">เบอร์โทร</label>
                <input type="tel" value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                  placeholder="0XX-XXX-XXXX"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
              </div>
              <div>
                <label className="text-xs text-aviva-secondary mb-1 block">พื้นที่ (ตร.ว.) *</label>
                <input type="number" value={form.area_sqw} onChange={(e) => setForm({ ...form, area_sqw: e.target.value })}
                  placeholder="50"
                  className="w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60" />
                {form.area_sqw && (
                  <p className="text-xs text-aviva-gold mt-1">ค่าส่วนกลางต่อปี: {fmt(Number(form.area_sqw) * 30)}</p>
                )}
              </div>
            </div>
            <button onClick={handleAdd} disabled={saving || !form.owner_name || !form.area_sqw}
              className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "เพิ่มสมาชิก"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
