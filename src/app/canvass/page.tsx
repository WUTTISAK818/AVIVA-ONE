"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Network, Users, MapPin, Vote, ChevronRight, ChevronLeft, Plus, X,
  Crown, UserPlus, AlertTriangle, Building2, BarChart3, ChevronDown,
} from "lucide-react";
import clsx from "clsx";
import SectionHeader from "@/components/SectionHeader";
import GlassCard from "@/components/GlassCard";
import ProgressBar from "@/components/ProgressBar";
import Toast, { type ToastType } from "@/components/Toast";
import IdCardCapture, { type ExtractedIdFields } from "@/components/IdCardCapture";
import PresenceCapture, { type PresenceProof } from "@/components/PresenceCapture";
import { useCurrentUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import {
  getMunicipalitySummary, getDistrictKpi, getCommunityRollup, getMemberLoad,
  getMembers, getPollingUnits, getResidents, validateThaiId, checkDuplicate,
  type CanvassMunicipalitySummary, type CanvassDistrictKpi, type CanvassCommunityRollup,
  type CanvassMemberLoad, type CanvassPollingUnit, type CanvassResident,
} from "@/lib/canvass";

type Tab = "overview" | "polling" | "report";

const emptyResident = {
  national_id: "", full_name: "", date_of_birth: "", gender: "" as string,
  address: "", phone: "", polling_unit_id: "",
};

function kpiColor(pct: number | null): "green" | "gold" | "red" {
  const p = pct ?? 0;
  if (p >= 100) return "green";
  if (p >= 50) return "gold";
  return "red";
}

export default function CanvassPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  const [tab, setTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const showToast = (msg: string, type: ToastType = "success") => setToast({ msg, type });

  // ภาพรวม + drill-down
  const [summary, setSummary] = useState<CanvassMunicipalitySummary | null>(null);
  const [districts, setDistricts] = useState<CanvassDistrictKpi[]>([]);
  const [district, setDistrict] = useState<CanvassDistrictKpi | null>(null);
  const [communities, setCommunities] = useState<CanvassCommunityRollup[]>([]);
  const [community, setCommunity] = useState<CanvassCommunityRollup | null>(null);
  const [members, setMembers] = useState<CanvassMemberLoad[]>([]);
  const [member, setMember] = useState<CanvassMemberLoad | null>(null);
  const [residents, setResidents] = useState<CanvassResident[]>([]);
  const [pollingUnits, setPollingUnits] = useState<CanvassPollingUnit[]>([]);
  const [loading, setLoading] = useState(true);

  // role gate
  useEffect(() => {
    if (user === null) return; // ยังโหลดไม่เสร็จ
    if (!user.isAdmin && !user.isManager) {
      router.replace("/dashboard");
      return;
    }
    setAuthorized(true);
  }, [user, router]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    const [s, d] = await Promise.all([getMunicipalitySummary(), getDistrictKpi()]);
    setSummary(s);
    setDistricts(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authorized) loadOverview();
  }, [authorized, loadOverview]);

  // drill handlers
  const openDistrict = async (d: CanvassDistrictKpi) => {
    setDistrict(d);
    setCommunity(null);
    setMember(null);
    const [c, pu] = await Promise.all([getCommunityRollup(d.district_id), getPollingUnits(d.district_id)]);
    setCommunities(c);
    setPollingUnits(pu);
  };
  const openCommunity = async (c: CanvassCommunityRollup) => {
    setCommunity(c);
    setMember(null);
    setMembers(await getMemberLoad(c.community_id));
  };
  const openMember = async (m: CanvassMemberLoad) => {
    setMember(m);
    setResidents(await getResidents(m.member_id));
  };

  if (!authorized) {
    return <div className="min-h-screen bg-aviva-bg" />;
  }

  return (
    <div className="min-h-screen bg-aviva-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-aviva-bg/95 backdrop-blur-sm border-b border-aviva-gold/10">
        <div className="max-w-lg mx-auto px-4 pt-12 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Network size={22} className="text-aviva-gold" />
            <h1 className="text-xl font-bold text-aviva-text">เครือข่ายฐานเสียง</h1>
          </div>
          <div className="flex gap-1 bg-aviva-card rounded-2xl p-1">
            {([
              ["overview", "ภาพรวม", Building2],
              ["polling", "หน่วยเลือกตั้ง", Vote],
              ["report", "รายงาน", BarChart3],
            ] as [Tab, string, typeof Building2][]).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key)}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all",
                  tab === key ? "bg-aviva-gold text-aviva-bg" : "text-aviva-secondary"
                )}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {tab === "overview" && (
          <OverviewTab
            loading={loading} summary={summary} districts={districts}
            district={district} communities={communities} community={community}
            members={members} member={member} residents={residents} pollingUnits={pollingUnits}
            onOpenDistrict={openDistrict} onOpenCommunity={openCommunity} onOpenMember={openMember}
            onBack={(level) => {
              if (level === "district") setDistrict(null);
              if (level === "community") setCommunity(null);
              if (level === "member") setMember(null);
            }}
            onChanged={async () => {
              await loadOverview();
              if (district) {
                const fresh = (await getDistrictKpi()).find((x) => x.district_id === district.district_id);
                if (fresh) setDistrict(fresh);
                const c = await getCommunityRollup(district.district_id);
                setCommunities(c);
                if (community) {
                  const fc = c.find((x) => x.community_id === community.community_id);
                  if (fc) setCommunity(fc);
                  const ml = await getMemberLoad(community.community_id);
                  setMembers(ml);
                  if (member) {
                    const fm = ml.find((x) => x.member_id === member.member_id);
                    if (fm) setMember(fm);
                    setResidents(await getResidents(member.member_id));
                  }
                }
              }
            }}
            createdBy={user?.full_name ?? "system"}
            showToast={showToast}
          />
        )}

        {tab === "polling" && (
          <PollingTab districts={districts} showToast={showToast} />
        )}

        {tab === "report" && (
          <ReportTab summary={summary} districts={districts} />
        )}
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ===================== Overview / Drill-down =====================
function OverviewTab(props: {
  loading: boolean;
  summary: CanvassMunicipalitySummary | null;
  districts: CanvassDistrictKpi[];
  district: CanvassDistrictKpi | null;
  communities: CanvassCommunityRollup[];
  community: CanvassCommunityRollup | null;
  members: CanvassMemberLoad[];
  member: CanvassMemberLoad | null;
  residents: CanvassResident[];
  pollingUnits: CanvassPollingUnit[];
  onOpenDistrict: (d: CanvassDistrictKpi) => void;
  onOpenCommunity: (c: CanvassCommunityRollup) => void;
  onOpenMember: (m: CanvassMemberLoad) => void;
  onBack: (level: "district" | "community" | "member") => void;
  onChanged: () => Promise<void> | void;
  createdBy: string;
  showToast: (msg: string, type?: ToastType) => void;
}) {
  const {
    loading, summary, districts, district, communities, community,
    members, member, residents, pollingUnits, onOpenDistrict, onOpenCommunity,
    onOpenMember, onBack, onChanged, createdBy, showToast,
  } = props;

  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddResident, setShowAddResident] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-aviva-card/60 animate-pulse" />
        ))}
      </div>
    );
  }

  // --- Member level: resident list ---
  if (member) {
    return (
      <>
        <button onClick={() => onBack("member")} className="flex items-center gap-1 text-sm text-aviva-secondary mb-1">
          <ChevronLeft size={16} /> {community?.community_name}
        </button>
        <SectionHeader
          title={member.full_name}
          subtitle={`ชาวบ้านในความดูแล ${member.resident_count} คน (เป้า 30-50)`}
          action={
            <button onClick={() => setShowAddResident(true)}
              className="flex items-center gap-1 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
              <Plus size={14} /> เพิ่มชาวบ้าน
            </button>
          }
        />
        {member.quota_status !== "ok" && (
          <GlassCard className="p-3 flex items-center gap-2 mb-2 border-yellow-500/30 bg-yellow-500/5">
            <AlertTriangle size={16} className="text-yellow-400 shrink-0" />
            <p className="text-xs text-yellow-300">
              {member.quota_status === "under"
                ? `ยังไม่ถึงเป้า — มีชาวบ้าน ${member.resident_count} คน (ควร 30-50)`
                : `เกินเป้า — มีชาวบ้าน ${member.resident_count} คน (ควรไม่เกิน 50)`}
            </p>
          </GlassCard>
        )}
        {residents.length === 0 ? (
          <EmptyState text="ยังไม่มีชาวบ้านในความดูแล กดเพิ่มชาวบ้านเพื่อเริ่มเก็บข้อมูล" />
        ) : (
          <div className="space-y-2">
            {residents.map((r) => (
              <GlassCard key={r.id} className="p-3.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-aviva-text truncate">{r.full_name}</p>
                    <p className="text-[11px] text-aviva-secondary font-mono">{r.national_id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                    {r.phone && (
                      <span className={clsx("text-[10px] px-2 py-0.5 rounded-full",
                        r.phone_verified ? "bg-green-500/15 text-green-400" : "bg-aviva-gold/10 text-aviva-secondary")}>
                        {r.phone}{r.phone_verified ? " ✓" : ""}
                      </span>
                    )}
                    {r.selfie_path && (
                      <span className="text-[10px] text-green-400 flex items-center gap-0.5">
                        <MapPin size={9} /> ยืนยันพบตัว
                      </span>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
        {showAddResident && (
          <AddResidentModal
            memberId={member.member_id}
            pollingUnits={pollingUnits}
            createdBy={createdBy}
            onClose={() => setShowAddResident(false)}
            onSaved={async () => { setShowAddResident(false); await onChanged(); showToast("บันทึกชาวบ้านสำเร็จ"); }}
            showToast={showToast}
          />
        )}
      </>
    );
  }

  // --- Community level: members ---
  if (community) {
    return (
      <>
        <button onClick={() => onBack("community")} className="flex items-center gap-1 text-sm text-aviva-secondary mb-1">
          <ChevronLeft size={16} /> {district?.district_name}
        </button>
        <SectionHeader
          title={community.community_name}
          subtitle={`ทีมงาน ${community.team_count} คน · ชาวบ้านรวม ${community.resident_count} คน`}
          action={
            <button onClick={() => setShowAddMember(true)}
              className="flex items-center gap-1 bg-aviva-gold text-aviva-bg text-xs font-bold px-3 py-2 rounded-xl">
              <UserPlus size={14} /> เพิ่มสมาชิก
            </button>
          }
        />
        {members.length === 0 ? (
          <EmptyState text="ยังไม่มีประธาน/ทีมงาน กดเพิ่มสมาชิกเพื่อเริ่มต้น" />
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <GlassCard key={m.member_id} gold={m.member_role === "president"} className="p-3.5 cursor-pointer active:scale-[0.99]" onClick={() => onOpenMember(m)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {m.member_role === "president" && <Crown size={15} className="text-aviva-gold shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-aviva-text truncate">{m.full_name}</p>
                      <p className="text-[11px] text-aviva-secondary">
                        {m.member_role === "president" ? "ประธานชุมชน" : "ทีมงาน"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={clsx("text-xs font-bold px-2 py-1 rounded-lg",
                      m.quota_status === "ok" ? "bg-green-500/15 text-green-400"
                        : m.quota_status === "under" ? "bg-aviva-gold/10 text-aviva-gold"
                        : "bg-red-500/15 text-red-400")}>
                      {m.resident_count} คน
                    </span>
                    <ChevronRight size={16} className="text-aviva-secondary/50" />
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
        {showAddMember && (
          <AddMemberModal
            communityId={community.community_id}
            hasPresident={members.some((m) => m.member_role === "president")}
            createdBy={createdBy}
            onClose={() => setShowAddMember(false)}
            onSaved={async () => { setShowAddMember(false); await onChanged(); showToast("เพิ่มสมาชิกสำเร็จ"); }}
            showToast={showToast}
          />
        )}
      </>
    );
  }

  // --- District level: communities ---
  if (district) {
    return (
      <>
        <button onClick={() => onBack("district")} className="flex items-center gap-1 text-sm text-aviva-secondary mb-1">
          <ChevronLeft size={16} /> ภาพรวมเขต
        </button>
        <GlassCard gold className="p-4 mb-3">
          <ProgressBar
            label={`${district.district_name} — ชาวบ้าน ${district.resident_count.toLocaleString()} / ${district.resident_target.toLocaleString()}`}
            value={district.resident_count} max={district.resident_target}
            color={kpiColor(district.pct_of_target)}
            sublabel={`${district.community_count} ชุมชน · ${district.team_count} ทีมงาน · ${district.polling_unit_count} หน่วยเลือกตั้ง`}
          />
        </GlassCard>
        <SectionHeader title="ชุมชน" subtitle={`${communities.length} ชุมชนในเขตนี้`} />
        <div className="space-y-2">
          {communities.map((c) => (
            <GlassCard key={c.community_id} className="p-3.5 cursor-pointer active:scale-[0.99]" onClick={() => onOpenCommunity(c)}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-aviva-text truncate">{c.community_name}</p>
                  <p className="text-[11px] text-aviva-secondary truncate">
                    {c.president_name ? `ประธาน: ${c.president_name}` : "ยังไม่มีประธาน"} · {c.team_count} ทีมงาน
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-aviva-gold">{c.resident_count} คน</span>
                  <ChevronRight size={16} className="text-aviva-secondary/50" />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </>
    );
  }

  // --- Top: municipality summary + districts ---
  return (
    <>
      {summary && (
        <GlassCard gold className="p-4">
          <p className="text-xs text-aviva-secondary mb-1">{summary.municipality_name}</p>
          <div className="grid grid-cols-2 gap-3">
            <SummaryStat label="ชาวบ้านทั้งหมด" value={summary.resident_count.toLocaleString()} sub={`เป้ารวม ${(summary.total_target ?? 0).toLocaleString()}`} />
            <SummaryStat label="เขต / ชุมชน" value={`${summary.district_count} / ${summary.community_count}`} />
            <SummaryStat label="ประธาน / ทีมงาน" value={`${summary.president_count} / ${summary.team_count}`} />
            <SummaryStat label="หน่วยเลือกตั้ง" value={`${summary.polling_unit_count}`} />
          </div>
        </GlassCard>
      )}
      <SectionHeader title="เป้าหมายรายเขต" subtitle="แต่ละเขตต้องมีชาวบ้าน ≥ 10,000 คน" />
      <div className="space-y-3">
        {districts.map((d) => (
          <GlassCard key={d.district_id} className="p-4 cursor-pointer active:scale-[0.99]" onClick={() => onOpenDistrict(d)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-aviva-text">{d.district_name}</span>
              <ChevronRight size={16} className="text-aviva-secondary/50" />
            </div>
            <ProgressBar
              label={`${d.resident_count.toLocaleString()} / ${d.resident_target.toLocaleString()} คน`}
              value={d.resident_count} max={d.resident_target}
              color={kpiColor(d.pct_of_target)}
              sublabel={`${d.community_count} ชุมชน · ${d.team_count} ทีมงาน · ${d.polling_unit_count} หน่วย`}
            />
          </GlassCard>
        ))}
      </div>
    </>
  );
}

function SummaryStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-lg font-bold text-aviva-text">{value}</p>
      <p className="text-[11px] text-aviva-secondary">{label}</p>
      {sub && <p className="text-[10px] text-aviva-secondary/60">{sub}</p>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <GlassCard className="p-8 text-center">
      <p className="text-sm text-aviva-secondary">{text}</p>
    </GlassCard>
  );
}

// ===================== Add Member Modal =====================
function AddMemberModal(props: {
  communityId: string;
  hasPresident: boolean;
  createdBy: string;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type?: ToastType) => void;
}) {
  const { communityId, hasPresident, createdBy, onClose, onSaved, showToast } = props;
  const [form, setForm] = useState({ full_name: "", phone: "", member_role: "team", resident_quota: 50 });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.full_name.trim()) { showToast("กรุณากรอกชื่อ", "warning"); return; }
    setSaving(true);
    const { error } = await supabase.from("canvass_members").insert({
      community_id: communityId,
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      member_role: form.member_role,
      resident_quota: form.resident_quota,
      created_by: createdBy,
    });
    setSaving(false);
    if (error) {
      showToast(error.message.includes("canvass_one_president") ? "ชุมชนนี้มีประธานแล้ว" : "บันทึกไม่สำเร็จ", "error");
      return;
    }
    onSaved();
  };

  return (
    <ModalShell title="เพิ่มสมาชิก" onClose={onClose}>
      <Field label="บทบาท">
        <select value={form.member_role} onChange={(e) => setForm({ ...form, member_role: e.target.value })} className={inputCls}>
          <option value="team">ทีมงาน</option>
          <option value="president" disabled={hasPresident}>ประธานชุมชน{hasPresident ? " (มีแล้ว)" : ""}</option>
        </select>
      </Field>
      <Field label="ชื่อ-นามสกุล *">
        <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputCls} placeholder="เช่น นายสมชาย ใจดี" />
      </Field>
      <Field label="เบอร์โทร">
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} inputMode="tel" placeholder="08x-xxx-xxxx" />
      </Field>
      <SaveButton saving={saving} onClick={save} />
    </ModalShell>
  );
}

// ===================== Add Resident Modal =====================
function AddResidentModal(props: {
  memberId: string;
  pollingUnits: CanvassPollingUnit[];
  createdBy: string;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type?: ToastType) => void;
}) {
  const { memberId, pollingUnits, createdBy, onClose, onSaved, showToast } = props;
  const [form, setForm] = useState({ ...emptyResident });
  const [proof, setProof] = useState<PresenceProof | null>(null);
  const [dup, setDup] = useState<{ national_id: boolean; phone: boolean; full_name: boolean }>({ national_id: false, phone: false, full_name: false });
  const [saving, setSaving] = useState(false);

  const onExtracted = (f: ExtractedIdFields) => {
    setForm((prev) => ({
      ...prev,
      national_id: f.national_id ?? prev.national_id,
      full_name: f.full_name ?? prev.full_name,
      date_of_birth: f.date_of_birth ?? prev.date_of_birth,
      gender: f.gender ?? prev.gender,
      address: f.address ?? prev.address,
    }));
    showToast("อ่านข้อมูลจากบัตรแล้ว ตรวจสอบความถูกต้องก่อนบันทึก", "info");
  };

  const runDupCheck = async () => {
    const d = await checkDuplicate({
      national_id: form.national_id || undefined,
      phone: form.phone || undefined,
      full_name: form.full_name || undefined,
    });
    setDup(d);
  };

  const idValid = form.national_id === "" || validateThaiId(form.national_id);

  const save = async () => {
    if (!form.national_id || !form.full_name.trim()) { showToast("กรุณากรอกเลขบัตรและชื่อ", "warning"); return; }
    if (!validateThaiId(form.national_id)) { showToast("เลขบัตรประชาชนไม่ถูกต้อง (checksum)", "error"); return; }
    setSaving(true);
    const { error } = await supabase.from("canvass_residents").insert({
      member_id: memberId,
      polling_unit_id: form.polling_unit_id || null,
      national_id: form.national_id,
      full_name: form.full_name.trim(),
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      selfie_path: proof?.selfie_path ?? null,
      capture_lat: proof?.capture_lat ?? null,
      capture_lng: proof?.capture_lng ?? null,
      captured_at: proof?.captured_at ?? null,
      capture_method: "photo",
      created_by: createdBy,
    });
    setSaving(false);
    if (error) {
      showToast(error.message.includes("duplicate") || error.message.includes("unique")
        ? "เลขบัตรนี้มีในระบบแล้ว" : "บันทึกไม่สำเร็จ", "error");
      return;
    }
    onSaved();
  };

  return (
    <ModalShell title="เพิ่มชาวบ้าน" onClose={onClose}>
      <IdCardCapture onExtracted={onExtracted} onError={(m) => showToast(m, "error")} />

      <Field label="เลขประจำตัวประชาชน *">
        <input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value.replace(/\D/g, "").slice(0, 13) })}
          onBlur={runDupCheck} inputMode="numeric"
          className={clsx(inputCls, "font-mono", !idValid && "border-red-500/60")} placeholder="13 หลัก" />
        {!idValid && <p className="text-[11px] text-red-400 mt-1">เลขบัตรไม่ถูกต้อง (checksum)</p>}
        {dup.national_id && <p className="text-[11px] text-yellow-400 mt-1">⚠ เลขบัตรนี้มีในระบบแล้ว</p>}
      </Field>
      <Field label="ชื่อ-นามสกุล *">
        <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} onBlur={runDupCheck} className={inputCls} />
        {dup.full_name && <p className="text-[11px] text-yellow-400 mt-1">⚠ มีชื่อนี้ในระบบแล้ว (อาจเป็นคนละคน)</p>}
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="วันเกิด">
          <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className={inputCls} />
        </Field>
        <Field label="เพศ">
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={inputCls}>
            <option value="">-</option>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
            <option value="other">อื่นๆ</option>
          </select>
        </Field>
      </div>
      <Field label="ที่อยู่">
        <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className={clsx(inputCls, "resize-none")} />
      </Field>
      <Field label="เบอร์โทรศัพท์">
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} onBlur={runDupCheck} inputMode="tel" className={inputCls} placeholder="08x-xxx-xxxx" />
        {dup.phone && <p className="text-[11px] text-yellow-400 mt-1">⚠ เบอร์นี้มีในระบบแล้ว</p>}
      </Field>
      <Field label="หน่วยเลือกตั้ง">
        <select value={form.polling_unit_id} onChange={(e) => setForm({ ...form, polling_unit_id: e.target.value })} className={inputCls}>
          <option value="">- เลือกหน่วย -</option>
          {pollingUnits.map((pu) => (
            <option key={pu.id} value={pu.id}>หน่วยที่ {pu.unit_no}{pu.name ? ` (${pu.name})` : ""}</option>
          ))}
        </select>
      </Field>
      <Field label="ยืนยันการพบเจ้าของบัตรตัวจริง">
        <PresenceCapture refKey={form.national_id || "unknown"} onCaptured={setProof} onError={(m) => showToast(m, "error")} />
      </Field>

      <SaveButton saving={saving} onClick={save} />
    </ModalShell>
  );
}

// ===================== Polling Units Tab =====================
function PollingTab({ districts, showToast }: { districts: CanvassDistrictKpi[]; showToast: (m: string, t?: ToastType) => void }) {
  const [districtId, setDistrictId] = useState(districts[0]?.district_id ?? "");
  const [units, setUnits] = useState<(CanvassPollingUnit & { resident_count: number })[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!districtId) return;
    setLoading(true);
    (async () => {
      const pu = await getPollingUnits(districtId);
      // นับชาวบ้านต่อหน่วย
      const { data } = await supabase
        .from("canvass_residents")
        .select("polling_unit_id")
        .not("polling_unit_id", "is", null);
      const counts = new Map<string, number>();
      (data ?? []).forEach((r: { polling_unit_id: string }) => counts.set(r.polling_unit_id, (counts.get(r.polling_unit_id) ?? 0) + 1));
      setUnits(pu.map((u) => ({ ...u, resident_count: counts.get(u.id) ?? 0 })));
      setLoading(false);
    })().catch(() => { setLoading(false); showToast("โหลดหน่วยเลือกตั้งไม่สำเร็จ", "error"); });
  }, [districtId, showToast]);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {districts.map((d) => (
          <button key={d.district_id} onClick={() => setDistrictId(d.district_id)}
            className={clsx("shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium",
              districtId === d.district_id ? "bg-aviva-gold text-aviva-bg" : "bg-aviva-card text-aviva-secondary")}>
            {d.district_name}
          </button>
        ))}
      </div>
      <SectionHeader title="หน่วยเลือกตั้ง" subtitle={`${units.length} หน่วย`} />
      {loading ? (
        <div className="h-40 rounded-2xl bg-aviva-card/60 animate-pulse" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {units.map((u) => (
            <GlassCard key={u.id} className="p-3">
              <p className="text-sm font-bold text-aviva-text">หน่วยที่ {u.unit_no}</p>
              <p className="text-[11px] text-aviva-secondary truncate">{u.name}</p>
              <p className="text-xs text-aviva-gold font-semibold mt-1">{u.resident_count} ชาวบ้าน</p>
            </GlassCard>
          ))}
        </div>
      )}
    </>
  );
}

// ===================== Report Tab (hierarchical rollup) =====================
function ReportTab({ summary, districts }: { summary: CanvassMunicipalitySummary | null; districts: CanvassDistrictKpi[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rollup, setRollup] = useState<Record<string, CanvassCommunityRollup[]>>({});

  const toggle = async (d: CanvassDistrictKpi) => {
    if (expanded === d.district_id) { setExpanded(null); return; }
    setExpanded(d.district_id);
    if (!rollup[d.district_id]) {
      const c = await getCommunityRollup(d.district_id);
      setRollup((prev) => ({ ...prev, [d.district_id]: c }));
    }
  };

  return (
    <>
      <SectionHeader title="รายงานสรุปไล่ลำดับชั้น" subtitle="เทศบาล → เขต → ชุมชน → ทีมงาน" />
      {summary && (
        <GlassCard gold className="p-4 mb-2">
          <p className="text-sm font-bold text-aviva-text">{summary.municipality_name}</p>
          <p className="text-xs text-aviva-secondary mt-1">
            ชาวบ้านรวม {summary.resident_count.toLocaleString()} / เป้า {(summary.total_target ?? 0).toLocaleString()} ·
            {" "}{summary.district_count} เขต · {summary.community_count} ชุมชน · {summary.team_count} ทีมงาน
          </p>
        </GlassCard>
      )}
      <div className="space-y-2">
        {districts.map((d) => (
          <GlassCard key={d.district_id} className="p-0 overflow-hidden">
            <button onClick={() => toggle(d)} className="w-full flex items-center justify-between p-3.5">
              <div className="text-left">
                <p className="text-sm font-bold text-aviva-text">{d.district_name}</p>
                <p className="text-[11px] text-aviva-secondary">
                  {d.resident_count.toLocaleString()} / {d.resident_target.toLocaleString()} คน ({d.pct_of_target ?? 0}%) · {d.community_count} ชุมชน · {d.team_count} ทีมงาน
                </p>
              </div>
              <ChevronDown size={16} className={clsx("text-aviva-secondary/50 transition-transform", expanded === d.district_id && "rotate-180")} />
            </button>
            {expanded === d.district_id && (
              <div className="border-t border-aviva-gold/10 divide-y divide-aviva-gold/5">
                {(rollup[d.district_id] ?? []).map((c) => (
                  <div key={c.community_id} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-aviva-text truncate">{c.community_name}</p>
                      <p className="text-[10px] text-aviva-secondary truncate">
                        {c.president_name ? `ประธาน: ${c.president_name}` : "ไม่มีประธาน"} · {c.team_count} ทีมงาน
                      </p>
                    </div>
                    <span className="text-xs font-bold text-aviva-gold shrink-0 ml-2">{c.resident_count} คน</span>
                  </div>
                ))}
                {(rollup[d.district_id] ?? []).length === 0 && (
                  <p className="px-4 py-3 text-xs text-aviva-secondary">ไม่มีข้อมูลชุมชน</p>
                )}
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </>
  );
}

// ===================== Shared UI bits =====================
const inputCls = "w-full bg-aviva-bg border border-aviva-gold/20 rounded-xl px-4 py-3 text-sm text-aviva-text placeholder:text-aviva-secondary/40 outline-none focus:border-aviva-gold/60";

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-aviva-card rounded-t-3xl p-6 pb-10 space-y-3 mb-14 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between sticky -top-6 bg-aviva-card pt-1 pb-1 z-10">
          <h2 className="text-lg font-bold text-aviva-text">{title}</h2>
          <button onClick={onClose}><X size={20} className="text-aviva-secondary" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-aviva-secondary mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="w-full bg-aviva-gold text-aviva-bg font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50 mt-1">
      {saving ? "กำลังบันทึก..." : "บันทึก"}
    </button>
  );
}
