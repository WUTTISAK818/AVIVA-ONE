// ===== WinVote — Demo / Mockup data =====
// เปิดใช้งานด้วย env: NEXT_PUBLIC_DEMO_MODE=1
// ใช้สำหรับดู UI ผ่าน http โดยไม่ต้องเชื่อม Supabase จริง (เช่น Codespaces preview ตอน DB หลับ)
// โหมดนี้ "ไม่" ถูกเปิดใน production (Vercel) เพราะไม่ได้ตั้ง env ตัวนี้ไว้
import type {
  WinVoteMunicipalitySummary, WinVoteDistrictKpi, WinVoteCommunityRollup,
  WinVoteMemberLoad, WinVoteMember, WinVotePollingUnit, WinVoteResident, WinVoteCommunity,
} from "./winvote";
import { resolveRbac } from "./rbac";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

// ⚠️ ความปลอดภัย: DEMO_MODE ข้าม auth ทั้งหมด — ต้องไม่เปิดบน production เด็ดขาด
// เตือนดังๆ ใน console ถ้าถูกเปิด (เห็นได้ทันทีถ้าเผลอตั้งบน production)
if (DEMO_MODE && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn(
    "%c[WinVote] ⚠️ DEMO_MODE เปิดอยู่ — ข้ามการล็อกอิน/ใช้ข้อมูลจำลอง ห้ามใช้บน production กับข้อมูลจริง",
    "color:#f87171;font-weight:bold;font-size:14px"
  );
}

// ผู้ใช้จำลอง (ผู้บริหารระดับสูง) สำหรับผ่าน role gate ของหน้า WinVote
export const DEMO_USER = {
  id: "demo-admin",
  email: "demo.admin@aviva.th",
  full_name: "ผู้ดูแลระบบ (เดโม)",
  role: "exec",
  department: "ฝ่ายบริหาร",
  ...resolveRbac("exec"),
  isAdmin: true,
  isManager: true,
  isProjectManager: false,
};

const MUNI_ID = "demo-muni";

// 4 เขต — ตัวเลขล้อกับ seed จริง (เป้าหมายเขตละ 10,000)
const DISTRICTS: WinVoteDistrictKpi[] = [
  { district_id: "d1", municipality_id: MUNI_ID, code: 1, district_name: "เขต 1", resident_target: 10000, community_count: 25, team_count: 96, polling_unit_count: 47, resident_count: 6420, verified_count: 5100, pct_of_target: 51.0 },
  { district_id: "d2", municipality_id: MUNI_ID, code: 2, district_name: "เขต 2", resident_target: 10000, community_count: 24, team_count: 92, polling_unit_count: 46, resident_count: 3180, verified_count: 2400, pct_of_target: 24.0 },
  { district_id: "d3", municipality_id: MUNI_ID, code: 3, district_name: "เขต 3", resident_target: 10000, community_count: 25, team_count: 98, polling_unit_count: 47, resident_count: 10240, verified_count: 9800, pct_of_target: 98.0 },
  { district_id: "d4", municipality_id: MUNI_ID, code: 4, district_name: "เขต 4", resident_target: 10000, community_count: 24, team_count: 90, polling_unit_count: 45, resident_count: 4860, verified_count: 3600, pct_of_target: 36.0 },
];

const SUMMARY: WinVoteMunicipalitySummary = {
  municipality_id: MUNI_ID,
  municipality_name: "เทศบาล (เดโม)",
  district_count: 4,
  community_count: 98,
  team_count: 376,
  president_count: 98,
  polling_unit_count: 185,
  resident_count: DISTRICTS.reduce((s, d) => s + d.resident_count, 0),
  verified_count: DISTRICTS.reduce((s, d) => s + (d.verified_count ?? 0), 0),
  total_target: 40000,
};

const TH_FIRST = ["สมชาย", "สมหญิง", "ประเสริฐ", "วิไล", "อนุชา", "กนกพร", "ธนพล", "ศิริพร", "นพดล", "จันทร์เพ็ญ", "พิชัย", "อรทัย"];
const TH_LAST = ["ใจดี", "รักไทย", "ศรีสุข", "ทองคำ", "พันธุ์ดี", "มั่นคง", "เจริญสุข", "บุญมา", "วงศ์ไทย", "แสงทอง"];
function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }
function name(seed: number): string { return `${pick(TH_FIRST, seed)} ${pick(TH_LAST, seed * 3 + 1)}`; }

// ชุมชน (rollup) ต่อเขต — แสดงตัวอย่างเขตละ 6 ชุมชนพอให้ drill-down ได้
function communitiesFor(districtId: string): WinVoteCommunityRollup[] {
  const d = DISTRICTS.find((x) => x.district_id === districtId);
  const code = d?.code ?? 1;
  return Array.from({ length: 6 }, (_, i) => ({
    community_id: `${districtId}-c${i + 1}`,
    district_id: districtId,
    community_name: `ชุมชนเขต${code}-${String(i + 1).padStart(2, "0")}`,
    president_name: name(code * 10 + i),
    team_count: 3 + (i % 3),
    resident_count: 80 + ((code * 7 + i * 13) % 220),
  }));
}

// สมาชิกทีม (load) ต่อชุมชน — 1 ประธาน + ทีม
function membersLoadFor(communityId: string): WinVoteMemberLoad[] {
  const base = communityId.length;
  const list: WinVoteMemberLoad[] = [
    { member_id: `${communityId}-m0`, community_id: communityId, full_name: name(base), member_role: "president", resident_quota: 50, resident_count: 38 + (base % 20), quota_status: "ok" },
  ];
  for (let i = 1; i <= 3; i++) {
    const count = 20 + ((base * i * 7) % 45);
    const quota = 40;
    list.push({
      member_id: `${communityId}-m${i}`, community_id: communityId, full_name: name(base + i * 5),
      member_role: "team", resident_quota: quota, resident_count: count,
      quota_status: count > quota ? "over" : count >= quota * 0.8 ? "ok" : "under",
    });
  }
  return list;
}

function membersFor(communityId: string): WinVoteMember[] {
  return membersLoadFor(communityId).map((m) => ({
    id: m.member_id, community_id: communityId, full_name: m.full_name,
    phone: `08${(1000000 + m.member_id.length * 137) % 90000000}`.slice(0, 10),
    member_role: m.member_role, resident_quota: m.resident_quota,
  }));
}

function communitiesPlainFor(districtId: string): WinVoteCommunity[] {
  return communitiesFor(districtId).map((c) => ({ id: c.community_id, district_id: districtId, name: c.community_name }));
}

function pollingUnitsFor(districtId: string): WinVotePollingUnit[] {
  const d = DISTRICTS.find((x) => x.district_id === districtId);
  const code = d?.code ?? 1;
  return Array.from({ length: 6 }, (_, i) => ({
    id: `${districtId}-pu${i + 1}`, district_id: districtId,
    unit_no: String(i + 1), name: `หน่วยเลือกตั้งที่ ${i + 1}`,
    location: `โรงเรียน/วัด เขต${code} จุดที่ ${i + 1}`,
  }));
}

function residentsFor(memberId: string): WinVoteResident[] {
  const seed = memberId.length;
  const n = 5 + (seed % 6);
  return Array.from({ length: n }, (_, i) => {
    const s = seed + i;
    return {
      id: `${memberId}-r${i + 1}`, member_id: memberId, polling_unit_id: null,
      national_id: `1${String(1000000000000 + s * 8675309).slice(0, 12)}`,
      full_name: name(s), date_of_birth: `19${70 + (s % 30)}-0${1 + (s % 9)}-1${s % 9}`,
      gender: i % 2 === 0 ? "male" : "female",
      address: `บ้านเลขที่ ${10 + s} หมู่ ${1 + (s % 12)}`,
      phone: `09${(2000000 + s * 311) % 90000000}`.slice(0, 10),
      phone_verified: i % 3 === 0, selfie_path: null,
      capture_lat: null, capture_lng: null, captured_at: null,
      created_at: new Date().toISOString(),
    };
  });
}

export const demo = {
  getMunicipalitySummary: (): WinVoteMunicipalitySummary => SUMMARY,
  getDistrictKpi: (): WinVoteDistrictKpi[] => DISTRICTS,
  getCommunityRollup: (districtId: string) => communitiesFor(districtId),
  getMemberLoad: (communityId: string) => membersLoadFor(communityId),
  getCommunities: (districtId: string) => communitiesPlainFor(districtId),
  getMembers: (communityId: string) => membersFor(communityId),
  getPollingUnits: (districtId: string) => pollingUnitsFor(districtId),
  getResidents: (memberId: string) => residentsFor(memberId),
};
