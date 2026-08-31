import { supabase } from "./supabase";
import { DEMO_MODE } from "./demo-data";

// ===== ผลเลือกตั้งจริง (เทศบาลนครนครราชสีมา + ตำบล) 8 ก.พ. 2568 =====
export const ELECTION = "2568-02-08";

export interface Candidate {
  number: number;
  name: string;
  short_name: string | null;
  party: string | null;
  is_ours: boolean;
  color: string | null;
}

export interface OfficialResult {
  id: string;
  election: string;
  area_code: number;
  area_name: string;
  area_type: "municipal" | "tambon" | string;
  unit_no: number;
  location: string | null;
  eligible: number;
  voted: number;
  turnout_pct: number;
  v_chatr: number;     // ฉัตร เบอร์ 7
  v_kongkiat: number;  // ก้องเกียรติ เบอร์ 9
  v_prasert: number;   // ประเสริฐ เบอร์ 11
}

export interface AdvanceResult {
  set_no: number;
  ballots: number;
  v_chatr: number;
  v_kongkiat: number;
  v_prasert: number;
}

function logErr(where: string, error: unknown) {
  if (error) console.error(`[winvote] ${where}:`, (error as { message?: string })?.message ?? error);
}

export async function getCandidates(): Promise<Candidate[]> {
  if (DEMO_MODE) return [];
  const { data, error } = await supabase
    .schema("winvote").from("candidates").select("*").order("number");
  logErr("getCandidates", error);
  return (data ?? []) as Candidate[];
}

export async function getOfficialResults(): Promise<OfficialResult[]> {
  if (DEMO_MODE) return [];
  const { data, error } = await supabase
    .schema("winvote").from("results_official")
    .select("*")
    .eq("election", ELECTION)
    .order("area_code")
    .order("unit_no");
  logErr("getOfficialResults", error);
  return (data ?? []) as OfficialResult[];
}

export async function getAdvanceResults(): Promise<AdvanceResult[]> {
  if (DEMO_MODE) return [];
  const { data, error } = await supabase
    .schema("winvote").from("advance_results")
    .select("*")
    .eq("election", ELECTION)
    .order("set_no");
  logErr("getAdvanceResults", error);
  return (data ?? []) as AdvanceResult[];
}
