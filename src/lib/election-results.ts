// ===== ผลเลือกตั้งจริง + ผู้รับผิดชอบ (ข้อมูลนิ่ง โหลดจากไฟล์ static — ไม่พึ่ง DB) =====
// เลือกตั้งสมาชิกสภาเทศบาลนครนครราชสีมา 8 ก.พ. 2568
// เป็นข้อมูลอ้างอิงที่ไม่เปลี่ยน จึง bundle เป็นไฟล์ (เร็ว + ไม่หายเมื่อ DB pause)

export const ELECTION = "2568-02-08";

export interface Candidate {
  number: number; name: string; short_name: string | null;
  party: string | null; is_ours: boolean; color: string;
}
export interface OfficialResult {
  area_code: number; area_name: string; area_type: "municipal" | "tambon" | string;
  unit_no: number; location: string | null;
  eligible: number; voted: number; turnout_pct: number;
  v_chatr: number; v_kongkiat: number; v_prasert: number;
}
export interface AdvanceResult {
  set_no: number; ballots: number; v_chatr: number; v_kongkiat: number; v_prasert: number;
}
export interface Responsible {
  reg_code: string; full_name: string; nickname: string | null;
  role_title: string | null; level: "head" | "assistant";
  area_code: number; community: string | null;
}
export interface UnitResponsible {
  reg_code: string; area_code: number; unit_no: number; capacity: number | null;
}
export interface ElectionData {
  election: string; election_label: string;
  candidates: Candidate[]; results: OfficialResult[]; advance: AdvanceResult[];
  responsibles: Responsible[]; unitResponsibles: UnitResponsible[];
  grade_thresholds: { A: number; B: number };
}

let _cache: ElectionData | null = null;
let _inflight: Promise<ElectionData> | null = null;

export async function loadElectionData(): Promise<ElectionData> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = fetch("/winvote/election-data.json", { cache: "force-cache" })
    .then((r) => {
      if (!r.ok) throw new Error("load election-data failed");
      return r.json();
    })
    .then((d: ElectionData) => { _cache = d; return d; })
    .finally(() => { _inflight = null; });
  return _inflight;
}
