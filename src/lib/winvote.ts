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
  const { data } = await supabase.from("winvote_municipality_summary").select("*").single();
  return data as WinVoteMunicipalitySummary | null;
}

export async function getDistrictKpi() {
  if (DEMO_MODE) return demo.getDistrictKpi();
  const { data } = await supabase.from("winvote_district_kpi").select("*").order("code");
  return (data ?? []) as WinVoteDistrictKpi[];
}

export async function getCommunityRollup(districtId: string) {
  if (DEMO_MODE) return demo.getCommunityRollup(districtId);
  const { data } = await supabase
    .from("winvote_community_rollup")
    .select("*")
    .eq("district_id", districtId)
    .order("community_name");
  return (data ?? []) as WinVoteCommunityRollup[];
}

export async function getMemberLoad(communityId: string) {
  if (DEMO_MODE) return demo.getMemberLoad(communityId);
  const { data } = await supabase
    .from("winvote_member_load")
    .select("*")
    .eq("community_id", communityId);
  return (data ?? []) as WinVoteMemberLoad[];
}

export async function getCommunities(districtId: string) {
  if (DEMO_MODE) return demo.getCommunities(districtId);
  const { data } = await supabase
    .from("winvote_communities")
    .select("*")
    .eq("district_id", districtId)
    .order("name");
  return (data ?? []) as WinVoteCommunity[];
}

export async function getMembers(communityId: string) {
  if (DEMO_MODE) return demo.getMembers(communityId);
  const { data } = await supabase
    .from("winvote_members")
    .select("*")
    .eq("community_id", communityId)
    .order("member_role")
    .order("full_name");
  return (data ?? []) as WinVoteMember[];
}

export async function getPollingUnits(districtId: string) {
  if (DEMO_MODE) return demo.getPollingUnits(districtId);
  const { data } = await supabase
    .from("winvote_polling_units")
    .select("*")
    .eq("district_id", districtId)
    .order("unit_no");
  return (data ?? []) as WinVotePollingUnit[];
}

export async function getResidents(memberId: string) {
  if (DEMO_MODE) return demo.getResidents(memberId);
  const { data } = await supabase
    .from("winvote_residents")
    .select("*")
    .eq("member_id", memberId)
    .order("full_name");
  return (data ?? []) as WinVoteResident[];
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
      .from("winvote_residents")
      .select("id", { count: "exact", head: true })
      .eq("national_id", opts.national_id);
    result.national_id = (count ?? 0) > 0;
  }
  if (opts.phone) {
    const { count } = await supabase
      .from("winvote_residents")
      .select("id", { count: "exact", head: true })
      .eq("phone", opts.phone);
    result.phone = (count ?? 0) > 0;
  }
  if (opts.full_name) {
    const { count } = await supabase
      .from("winvote_residents")
      .select("id", { count: "exact", head: true })
      .eq("full_name", opts.full_name);
    result.full_name = (count ?? 0) > 0;
  }
  return result;
}
