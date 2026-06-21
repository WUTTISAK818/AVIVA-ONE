import { supabase } from "./supabase";
import { DEMO_MODE, demo } from "./demo-data";

// ===== Types =====
export interface WinVoteDistrictKpi {
  district_id: string;
  municipality_id: string;
  code: number;
  district_name: string;
  resident_target: number;
  community_count: number;
  team_count: number;
  polling_unit_count: number;
  resident_count: number;
  pct_of_target: number | null;
  verified_count?: number;
}

export interface WinVoteMunicipalitySummary {
  municipality_id: string;
  municipality_name: string;
  district_count: number;
  community_count: number;
  team_count: number;
  president_count: number;
  polling_unit_count: number;
  resident_count: number;
  total_target: number;
  verified_count?: number;
}

export interface WinVoteCommunityRollup {
  community_id: string;
  district_id: string;
  community_name: string;
  president_name: string | null;
  team_count: number;
  resident_count: number;
  verified_count?: number;
}

export interface WinVoteMemberLoad {
  member_id: string;
  community_id: string;
  full_name: string;
  member_role: "president" | "team";
  resident_quota: number;
  resident_count: number;
  quota_status: "under" | "ok" | "over";
  verified_count?: number;
}

export interface WinVoteCommunity {
  id: string;
  district_id: string;
  name: string;
}

export interface WinVoteMember {
  id: string;
  community_id: string;
  full_name: string;
  phone: string | null;
  member_role: "president" | "team";
  resident_quota: number;
}

export interface WinVotePollingUnit {
  id: string;
  district_id: string;
  unit_no: string;
  name: string | null;
  location: string | null;
}

export interface WinVoteResident {
  id: string;
  member_id: string;
  polling_unit_id: string | null;
  national_id: string;
  full_name: string;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  address: string | null;
  phone: string | null;
  phone_verified: boolean;
  selfie_path: string | null;
  capture_lat: number | null;
  capture_lng: number | null;
  captured_at: string | null;
  created_at: string;
}

// ===== Queries =====
export async function getMunicipalitySummary() {
  if (DEMO_MODE) return demo.getMunicipalitySummary();
  const { data } = await supabase.schema("winvote").from("municipality_summary").select("*").single();
  return data as WinVoteMunicipalitySummary | null;
}

export async function getDistrictKpi() {
  if (DEMO_MODE) return demo.getDistrictKpi();
  const { data } = await supabase.schema("winvote").from("district_kpi").select("*").order("code");
  return (data ?? []) as WinVoteDistrictKpi[];
}

export async function getCommunityRollup(districtId: string) {
  if (DEMO_MODE) return demo.getCommunityRollup(districtId);
  const { data } = await supabase
    .schema("winvote").from("community_rollup")
    .select("*")
    .eq("district_id", districtId)
    .order("community_name");
  return (data ?? []) as WinVoteCommunityRollup[];
}

export async function getMemberLoad(communityId: string) {
  if (DEMO_MODE) return demo.getMemberLoad(communityId);
  const { data } = await supabase
    .schema("winvote").from("member_load")
    .select("*")
    .eq("community_id", communityId);
  return (data ?? []) as WinVoteMemberLoad[];
}

export async function getCommunities(districtId: string) {
  if (DEMO_MODE) return demo.getCommunities(districtId);
  const { data } = await supabase
    .schema("winvote").from("communities")
    .select("*")
    .eq("district_id", districtId)
    .order("name");
  return (data ?? []) as WinVoteCommunity[];
}

export async function getMembers(communityId: string) {
  if (DEMO_MODE) return demo.getMembers(communityId);
  const { data } = await supabase
    .schema("winvote").from("members")
    .select("*")
    .eq("community_id", communityId)
    .order("member_role")
    .order("full_name");
  return (data ?? []) as WinVoteMember[];
}

export async function getPollingUnits(districtId: string) {
  if (DEMO_MODE) return demo.getPollingUnits(districtId);
  const { data } = await supabase
    .schema("winvote").from("polling_units")
    .select("*")
    .eq("district_id", districtId)
    .order("unit_no");
  return (data ?? []) as WinVotePollingUnit[];
}

export async function getResidents(memberId: string) {
  if (DEMO_MODE) return demo.getResidents(memberId);
  const { data } = await supabase
    .schema("winvote").from("residents")
    .select("*")
    .eq("member_id", memberId)
    .order("full_name");
  return (data ?? []) as WinVoteResident[];
}

// ===== M5: ผลเลือกตั้ง / กลยุทธ์ (จาก views winvote.district_strategy / unit_strategy) =====
export interface WinVoteDistrictStrategy {
  district_code: number;
  district_name: string;
  unit_count: number;
  eligible: number;
  voted: number;
  turnout_pct: number;
  our_votes: number;
  rival_votes: number;
  v3_votes: number;
  v4_votes: number;
  margin: number;
  margin_pct: number;
  our_share_pct: number;
  units_at_risk: number;
}

export interface WinVoteUnitStrategy {
  district_code: number;
  unit_no: string;
  unit_name: string | null;
  location: string | null;
  eligible: number;
  voted: number;
  our_votes: number;
  rival_votes: number;
  margin: number;
  margin_pct: number;
  status: "safe" | "close" | "at_risk";
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));

// ข้อมูลตัวอย่างสำหรับโหมด DEMO (อิงผลรวมจริง 185 หน่วย เพื่อให้ preview เห็นหน้า M5)
const DEMO_DISTRICT_STRATEGY: WinVoteDistrictStrategy[] = [
  { district_code: 1, district_name: "เขต 1", unit_count: 52, eligible: 21123, voted: 10586, turnout_pct: 50.12, our_votes: 4748, rival_votes: 2362, v3_votes: 0, v4_votes: 0, margin: 2386, margin_pct: 22.54, our_share_pct: 44.85, units_at_risk: 7 },
  { district_code: 2, district_name: "เขต 2", unit_count: 45, eligible: 23017, voted: 11940, turnout_pct: 51.87, our_votes: 5307, rival_votes: 2215, v3_votes: 0, v4_votes: 0, margin: 3092, margin_pct: 25.90, our_share_pct: 44.45, units_at_risk: 1 },
  { district_code: 3, district_name: "เขต 3", unit_count: 47, eligible: 23291, voted: 11963, turnout_pct: 51.36, our_votes: 4988, rival_votes: 2893, v3_votes: 0, v4_votes: 0, margin: 2095, margin_pct: 17.51, our_share_pct: 41.70, units_at_risk: 4 },
  { district_code: 4, district_name: "เขต 4", unit_count: 41, eligible: 24570, voted: 12879, turnout_pct: 52.42, our_votes: 6000, rival_votes: 2766, v3_votes: 0, v4_votes: 0, margin: 3234, margin_pct: 25.11, our_share_pct: 46.59, units_at_risk: 3 },
];
const DEMO_AT_RISK: WinVoteUnitStrategy[] = ([
  [4,"015",44,90], [1,"006",16,55], [1,"028",24,44], [3,"010",25,42], [1,"015",39,51],
  [1,"043",61,71], [4,"036",50,59], [3,"013",68,77], [1,"033",36,43], [1,"041",37,43],
  [4,"002",62,66], [3,"004",73,76], [2,"012",42,43], [1,"009",50,51], [3,"037",79,79],
] as [number, string, number, number][]).map(([d, no, ours, rival]) => ({
  district_code: d, unit_no: no, unit_name: `หน่วยเลือกตั้งที่ ${Number(no)} เขต ${d}`, location: null,
  eligible: 0, voted: 0, our_votes: ours, rival_votes: rival, margin: ours - rival, margin_pct: 0,
  status: "at_risk" as const,
}));

/** สรุปกลยุทธ์รายเขต (185 หน่วย) — เบอร์ 2 = ฝั่งเรา, เบอร์ 1 = คู่แข่งหลัก */
export async function getDistrictStrategy() {
  if (DEMO_MODE) return DEMO_DISTRICT_STRATEGY;
  const { data } = await supabase.schema("winvote").from("district_strategy").select("*").order("district_code");
  return (data ?? []).map((r): WinVoteDistrictStrategy => ({
    district_code: num(r.district_code),
    district_name: r.district_name,
    unit_count: num(r.unit_count),
    eligible: num(r.eligible),
    voted: num(r.voted),
    turnout_pct: num(r.turnout_pct),
    our_votes: num(r.our_votes),
    rival_votes: num(r.rival_votes),
    v3_votes: num(r.v3_votes),
    v4_votes: num(r.v4_votes),
    margin: num(r.margin),
    margin_pct: num(r.margin_pct),
    our_share_pct: num(r.our_share_pct),
    units_at_risk: num(r.units_at_risk),
  }));
}

/** ผลรายหน่วย + สถานะ (safe/close/at_risk) — atRiskOnly=true เพื่อเอาเฉพาะหน่วยเสี่ยง */
export async function getUnitStrategy(opts?: { atRiskOnly?: boolean }) {
  if (DEMO_MODE) return DEMO_AT_RISK;
  let q = supabase.schema("winvote").from("unit_strategy").select("*");
  if (opts?.atRiskOnly) q = q.eq("status", "at_risk");
  const { data } = await q.order("margin", { ascending: true });
  return (data ?? []).map((r): WinVoteUnitStrategy => ({
    district_code: num(r.district_code),
    unit_no: r.unit_no,
    unit_name: r.unit_name ?? null,
    location: r.location ?? null,
    eligible: num(r.eligible),
    voted: num(r.voted),
    our_votes: num(r.our_votes),
    rival_votes: num(r.rival_votes),
    margin: num(r.margin),
    margin_pct: num(r.margin_pct),
    status: r.status,
  }));
}

// ===== Validation =====
/** ตรวจสอบเลขบัตรประชาชนไทย 13 หลัก (รวม checksum หลักสุดท้าย) */
export function validateThaiId(id: string): boolean {
  if (!/^[0-9]{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(id.charAt(i), 10) * (13 - i);
  }
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(id.charAt(12), 10);
}

export interface DuplicateWarning {
  national_id: boolean;
  phone: boolean;
  full_name: boolean;
}

/** เช็คข้อมูลซ้ำก่อนบันทึก (คืน warning ไม่บล็อก) */
export async function checkDuplicate(opts: {
  national_id?: string;
  phone?: string;
  full_name?: string;
}): Promise<DuplicateWarning> {
  const result: DuplicateWarning = { national_id: false, phone: false, full_name: false };
  if (DEMO_MODE) return result;
  if (opts.national_id) {
    const { count } = await supabase
      .schema("winvote").from("residents")
      .select("id", { count: "exact", head: true })
      .eq("national_id", opts.national_id);
    result.national_id = (count ?? 0) > 0;
  }
  if (opts.phone) {
    const { count } = await supabase
      .schema("winvote").from("residents")
      .select("id", { count: "exact", head: true })
      .eq("phone", opts.phone);
    result.phone = (count ?? 0) > 0;
  }
  if (opts.full_name) {
    const { count } = await supabase
      .schema("winvote").from("residents")
      .select("id", { count: "exact", head: true })
      .eq("full_name", opts.full_name);
    result.full_name = (count ?? 0) > 0;
  }
  return result;
}
