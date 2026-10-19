import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isClosedLost } from "./mock-data";

// ตรวจคำสั่งงานอัตโนมัติจากข้อมูลจริง — ใช้ตอนผู้สั่งงานจะกด "ตรวจรับ · ปิดจ็อบ"
//
// ปัญหาที่แก้ (Pom แจ้ง 19 ต.ค. 69): พนักงานกด "ทำเสร็จแล้ว" พร้อมเขียนรายงานสั้น ๆ
// แต่หน้าจอมีแค่ไทม์ไลน์สถานะ ไม่มีหลักฐานว่างานเสร็จจริงไหม ผู้สั่งต้องเชื่อคำบอกเล่าอย่างเดียว
//
// หลักการ: เทียบ "สิ่งที่พนักงานบอก" กับ "สิ่งที่อยู่ในฐานข้อมูลตอนนี้"
// - ตรวจได้ชัด        -> บอกตัวเลขจริงให้ผู้สั่งเห็น
// - ตรวจได้บางส่วน     -> บอกว่าอะไรครบ อะไรยังขาด
// - ตรวจอัตโนมัติไม่ได้ -> บอกตรง ๆ ว่าต้องให้คนดูเอง ห้ามเดาว่าเสร็จ
//
// ⚠️ ผลตรวจนี้เป็นแค่ "ข้อมูลประกอบการตัดสินใจ" การตรวจรับยังเป็นอำนาจของผู้สั่งงานเสมอ
// (หลัก Maker-Checker: ผู้ทำกับผู้ตรวจต้องไม่ใช่คนเดียวกัน และระบบไม่ใช่ผู้ตรวจรับ)

/** เพดานแถวที่ดึงมาตรวจ — PostgREST ตัดที่ 1000 แถวโดยปริยาย ถ้าไม่ระบุจะนับไม่ครบเงียบ ๆ เมื่อข้อมูลโตขึ้น
 *  (มาตรฐานโค้ดส่วน D: ลิสต์ข้อมูลต้องมี .limit() เสมอ) */
const LEAD_QUERY_LIMIT = 5000;

export type VerifyVerdict = "pass" | "partial" | "fail" | "unknown";

export interface VerifyCheck {
  label: string;
  value: string;
  /** true = ผ่าน · false = ยังไม่ผ่าน · null = เป็นข้อมูลประกอบ ไม่ใช่เกณฑ์ตัดสิน */
  ok: boolean | null;
}

export interface VerifyResult {
  /** ชื่อกฎที่ใช้ตรวจ — บอกผู้สั่งว่าระบบตรวจด้วยอะไร */
  rule: string;
  verdict: VerifyVerdict;
  /** ประโยคสรุปสั้น ๆ สำหรับผู้สั่งงาน */
  headline: string;
  checks: VerifyCheck[];
  /** ข้อสังเกตที่ระบบตรวจแทนคนไม่ได้ หรือเรื่องที่ผู้สั่งควรรู้ก่อนกดปิดจ็อบ */
  notes: string[];
  checkedAt: string;
}

export interface DirectiveForVerify {
  id: string;
  message: string | null;
  reference_note: string | null;
  response_note: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_at: string;
  done_at: string | null;
}

type Db = SupabaseClient;

interface LeadRow {
  lead_code: string | null;
  customer_name: string | null;
  status: string | null;
  next_follow_up_date: string | null;
  assigned_to: string | null;
  plot_number: number | null;
  contract_price: number | string | null;
  booking_deposit: number | string | null;
  contract_signed_date: string | null;
  loan_approved_date: string | null;
  transfer_appointment_date: string | null;
}
interface HouseRow {
  plot_code: string | null;
  house_number: string | null;
  progress: number | null;
  construction_status: string | null;
  updated_at: string | null;
}
interface LineLinkRow { user_email: string | null; linked_at: string | null }
interface WorkReportRow { report_date: string | null; status: string | null; submitted_at: string | null }

/** ดึงแถวจาก query แล้วคืนเป็นชนิดที่ระบุ — รวมการกัน null ไว้ที่เดียว */
async function rowsOf<T>(q: PromiseLike<{ data: unknown }>): Promise<T[]> {
  const { data } = await q;
  return (data ?? []) as T[];
}

function haystack(d: DirectiveForVerify): string {
  return `${d.message ?? ""} ${d.reference_note ?? ""}`;
}

function thaiToday(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

function thaiDate(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────
// กฎที่ 1 — งานเคลียร์ลูกค้าที่เลยนัดติดตาม
// ตรวจว่า "คิวเลยนัด" ของพนักงานคนนั้นเหลือเท่าไหร่จริง ๆ ตอนนี้
// ─────────────────────────────────────────────────────────────
async function verifyOverdueFollowups(db: Db, d: DirectiveForVerify): Promise<VerifyResult> {
  const today = thaiToday();
  const name = d.assigned_to_name ?? "";

  const mine = await rowsOf<LeadRow>(
    db.from("leads").select("lead_code, customer_name, status, next_follow_up_date, assigned_to")
      .eq("assigned_to", name).limit(LEAD_QUERY_LIMIT),
  );

  // ไม่มีลูกค้าในระบบเลย = ตรวจไม่ได้ ไม่ใช่ "ผ่าน"
  // ของเดิมจะได้ overdue = 0 แล้วสรุปว่า "เรียบร้อย" ซึ่งเป็นการบอกผู้สั่งงานผิด
  // (เกิดได้จริงเมื่อชื่อผู้รับคำสั่งไม่ตรงกับชื่อเจ้าของลูกค้า หรือสั่งคนที่ไม่ได้ถือลูกค้า)
  if (mine.length === 0) {
    return {
      rule: "คิวลูกค้าเลยนัดติดตาม",
      verdict: "unknown",
      headline: `ตรวจอัตโนมัติไม่ได้ — ไม่พบลูกค้าที่ ${name || "ผู้รับคำสั่ง"} ดูแลอยู่ในระบบเลย`,
      checks: [],
      notes: [
        "อาจเป็นเพราะชื่อผู้รับคำสั่งไม่ตรงกับชื่อเจ้าของลูกค้าใน CRM หรือพนักงานคนนี้ไม่ได้ถือลูกค้า",
        "กรุณาตรวจงานนี้ด้วยตาเอง — ระบบไม่มีข้อมูลพอจะยืนยันว่าเสร็จหรือยัง",
      ],
      checkedAt: new Date().toISOString(),
    };
  }
  const overdue = mine.filter(
    (l) => l.next_follow_up_date && l.next_follow_up_date < today
      && l.status !== "Closed Deal" && !isClosedLost(l.status),
  );
  const noDate = mine.filter((l) => !l.next_follow_up_date);

  // นับว่ามีวันนัดก้อนใหญ่กองอยู่วันเดียวกันไหม — เป็นร่องรอยของการ "เลื่อนนัดทีเดียวทั้งชุด"
  // ซึ่งทำให้คิวว่างได้โดยที่ยังไม่ได้ติดต่อลูกค้าจริง ผู้สั่งควรเห็นก่อนกดปิดจ็อบ
  const byDate = new Map<string, number>();
  for (const l of mine) {
    if (l.next_follow_up_date && l.next_follow_up_date >= today) {
      byDate.set(l.next_follow_up_date, (byDate.get(l.next_follow_up_date) ?? 0) + 1);
    }
  }
  const clusters = [...byDate.entries()].filter(([, n]) => n >= 10).sort((a, b) => b[1] - a[1]);

  const checks: VerifyCheck[] = [
    { label: `ลูกค้าของ ${name} ที่ยังเลยนัดติดตามอยู่ตอนนี้`, value: `${overdue.length} ราย`, ok: overdue.length === 0 },
    { label: "ลูกค้าที่ไม่มีวันนัดติดตามเลย", value: `${noDate.length} ราย`, ok: noDate.length === 0 },
    { label: `ลูกค้าในมือ ${name} ทั้งหมด`, value: `${mine.length} ราย`, ok: null },
  ];

  const notes: string[] = [];
  for (const [date, n] of clusters.slice(0, 3)) {
    notes.push(`มีลูกค้า ${n} รายถูกตั้งวันนัดติดตามเป็นวันเดียวกัน (${thaiDate(date)}) — ลักษณะนี้มักเกิดจากการเลื่อนนัดทีเดียวทั้งชุด ไม่ใช่การติดต่อรายคน`);
  }
  if (overdue.length > 0) {
    notes.push(`ยังเหลือเลยนัด: ${overdue.slice(0, 5).map((l) => `${l.lead_code ?? ""} ${l.customer_name ?? ""}`.trim()).join(" · ")}${overdue.length > 5 ? ` และอีก ${overdue.length - 5} ราย` : ""}`);
  }

  const verdict: VerifyVerdict = overdue.length > 0 ? "fail" : clusters.length > 0 ? "partial" : "pass";
  return {
    rule: "คิวลูกค้าเลยนัดติดตาม",
    verdict,
    headline:
      overdue.length > 0
        ? `ยังไม่เรียบร้อย — ลูกค้าของ ${name} ยังเลยนัดอยู่ ${overdue.length} ราย`
        : clusters.length > 0
          ? `คิวเลยนัดว่างแล้ว แต่ดูเหมือนเกิดจากการเลื่อนวันนัดเป็นชุด ไม่ใช่การติดต่อรายคน`
          : `เรียบร้อย — ไม่มีลูกค้าของ ${name} ค้างเลยนัดแล้ว`,
    checks,
    notes,
    checkedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// กฎที่ 2 — งานกรอกข้อมูลแปลง/ลูกค้าให้ครบ (เช่น ก่อนนัดโอน)
// ตรวจทีละช่องว่ากรอกครบตามที่สั่งหรือยัง
// ─────────────────────────────────────────────────────────────
async function verifyPlotRecord(db: Db, d: DirectiveForVerify): Promise<VerifyResult> {
  const text = haystack(d);
  const codeMatch = text.match(/CRM-\d+/);
  const plotMatch = text.match(/แปลง\s*(?:ที่\s*)?(\d+)/);

  const cols = "lead_code, customer_name, plot_number, status, contract_price, booking_deposit, contract_signed_date, loan_approved_date, transfer_appointment_date";
  const base = db.from("leads").select(cols);

  // อ้างด้วยเลขที่ลูกค้า -> ตรงตัว · อ้างด้วยเลขแปลง -> ต้องเลือกให้ถูกคน
  // 1 แปลงมีลูกค้าผูกอยู่หลายรายได้ (ต.ค. 69: แปลง 15 มี 10 ราย · แปลง 7 มี 8 ราย)
  // เพราะ plot_number ถูกใช้หมายถึง "สนใจแปลงนี้" ไม่ใช่ "เป็นเจ้าของแปลงนี้"
  // ถ้าหยิบมาแถวเดียวแบบไม่เรียงลำดับ จะได้คนที่แค่มาเยี่ยมชม แล้วรายงานผิดคนให้ผู้สั่งงาน
  const candidates = codeMatch
    ? await rowsOf<LeadRow>(base.eq("lead_code", codeMatch[0]).limit(1))
    : await rowsOf<LeadRow>(base.eq("plot_number", Number(plotMatch![1])).limit(LEAD_QUERY_LIMIT));

  // คนที่ "ถือแปลงจริง" = เดินหน้าถึงขั้นจองขึ้นไป · เรียงจากขั้นที่ไกลที่สุดก่อน
  const OWNER_RANK: Record<string, number> = {
    "Closed Deal": 0, Transfer: 1, "Loan Approved": 2, Contract: 3, Booking: 4,
  };
  const owners = candidates
    .filter((l) => OWNER_RANK[l.status ?? ""] !== undefined)
    .sort((a, b) => OWNER_RANK[a.status ?? ""] - OWNER_RANK[b.status ?? ""]);
  const lead = owners[0] ?? candidates[0];

  if (!lead) {
    return {
      rule: "ความครบถ้วนของข้อมูลแปลง",
      verdict: "unknown",
      headline: "ตรวจอัตโนมัติไม่ได้ — หาแปลง/ลูกค้าที่คำสั่งนี้อ้างถึงไม่เจอในระบบ",
      checks: [],
      notes: ["กรุณาเปิดดูในหน้าขาย → ผังโครงการ แล้วตรวจด้วยตาเอง"],
      checkedAt: new Date().toISOString(),
    };
  }

  const checks: VerifyCheck[] = [
    { label: "สถานะลูกค้า", value: lead.status ?? "—", ok: ["Contract", "Loan Approved", "Transfer", "Closed Deal"].includes(lead.status ?? "") },
    { label: "ราคาขายที่ตกลง", value: lead.contract_price ? `฿${Number(lead.contract_price).toLocaleString("th-TH")}` : "ยังไม่กรอก", ok: Number(lead.contract_price) > 0 },
    { label: "เงินจองที่รับจริง", value: lead.booking_deposit != null ? `฿${Number(lead.booking_deposit).toLocaleString("th-TH")}` : "ยังไม่กรอก", ok: lead.booking_deposit != null },
    { label: "วันเซ็นสัญญา", value: thaiDate(lead.contract_signed_date), ok: !!lead.contract_signed_date },
    { label: "วันอนุมัติสินเชื่อ", value: thaiDate(lead.loan_approved_date), ok: !!lead.loan_approved_date },
    { label: "วันนัดโอน", value: thaiDate(lead.transfer_appointment_date), ok: !!lead.transfer_appointment_date },
  ];

  const missing = checks.filter((c) => c.ok === false);
  const notes: string[] = [];

  // ผังก่อสร้างของแปลงนี้ — ถ้าโอนแล้วแต่ผังยังไม่ 100% แปลว่าข้อมูลสองที่ไม่ตรงกัน
  if (lead.plot_number) {
    const h = (await rowsOf<HouseRow>(
      db.from("houses").select("plot_code, house_number, progress, construction_status, updated_at").eq("plot_number", lead.plot_number).limit(1),
    ))[0];
    if (h) {
      checks.push({ label: "ความคืบหน้าก่อสร้างในผัง", value: `${h.progress ?? 0}%`, ok: null });
      if ((h.progress ?? 0) < 100 && ["Transfer", "Closed Deal"].includes(lead.status ?? "")) {
        notes.push(`ลูกค้าขึ้นสถานะโอนแล้ว แต่ผังก่อสร้างยังอยู่ที่ ${h.progress ?? 0}% — ต้องให้ฝ่ายก่อสร้างอัปเดตผังให้ตรงความจริง`);
      }
    }
  }
  if (!codeMatch && candidates.length > 1) {
    notes.push(`แปลงนี้มีลูกค้าผูกอยู่ ${candidates.length} ราย — ระบบตรวจของ “${lead.customer_name ?? "-"}” (${lead.lead_code ?? "-"}) ซึ่งเป็นรายที่เดินหน้าไกลที่สุด${owners.length === 0 ? " (ยังไม่มีใครถึงขั้นจอง จึงอาจไม่ใช่เจ้าของแปลงจริง)" : ""}`);
  }
  notes.push("ระบบตรวจได้แค่ว่า “กรอกครบไหม” — ตัวเลขที่กรอกตรงกับเอกสารจริงหรือไม่ ต้องให้คนตรวจกับสัญญา/สลิป");

  return {
    rule: "ความครบถ้วนของข้อมูลแปลง",
    verdict: missing.length === 0 ? "pass" : "partial",
    headline:
      missing.length === 0
        ? `ข้อมูล ${lead.lead_code ?? ""} (แปลง ${lead.plot_number ?? "—"}) กรอกครบทุกช่องแล้ว`
        : `ยังขาด ${missing.length} ช่อง: ${missing.map((m) => m.label).join(" · ")}`,
    checks,
    notes,
    checkedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// กฎที่ 3 — งานอัปเดตผังก่อสร้างให้ตรงหน้างาน
// ─────────────────────────────────────────────────────────────
async function verifyConstructionProgress(db: Db, d: DirectiveForVerify): Promise<VerifyResult> {
  const all = await rowsOf<HouseRow>(
    db.from("houses").select("plot_code, house_number, progress, construction_status, updated_at").limit(LEAD_QUERY_LIMIT),
  );
  const since = new Date(d.created_at).getTime();
  const updatedSince = all.filter((h) => h.updated_at && new Date(h.updated_at).getTime() >= since);
  const stillZero = all.filter((h) => (h.progress ?? 0) === 0);

  const checks: VerifyCheck[] = [
    { label: "แปลงที่ถูกอัปเดตหลังได้รับคำสั่ง", value: `${updatedSince.length} แปลง`, ok: updatedSince.length > 0 },
    { label: "แปลงที่ยังขึ้น 0%", value: `${stillZero.length} แปลง`, ok: null },
    { label: "แปลงทั้งหมดในผัง", value: `${all.length} แปลง`, ok: null },
  ];
  const notes: string[] = [];
  if (stillZero.length > 0) {
    notes.push(`ยังขึ้น 0%: ${stillZero.slice(0, 8).map((h) => h.plot_code ?? h.house_number ?? "—").join(" · ")}${stillZero.length > 8 ? ` และอีก ${stillZero.length - 8} แปลง` : ""}`);
  }
  notes.push("ระบบเทียบได้แค่ว่ามีการแก้ตัวเลขในระบบ — ตัวเลขตรงกับหน้างานจริงไหม ต้องให้คนไปดูหรือดูรูปถ่าย");

  return {
    rule: "การอัปเดตผังก่อสร้าง",
    verdict: updatedSince.length > 0 ? "partial" : "fail",
    headline:
      updatedSince.length > 0
        ? `มีการอัปเดต ${updatedSince.length} แปลงหลังได้รับคำสั่ง — แต่ต้องให้คนยืนยันว่าตรงหน้างาน`
        : "ยังไม่พบการแก้ไขผังก่อสร้างเลยหลังได้รับคำสั่งนี้",
    checks,
    notes,
    checkedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// กฎที่ 4 — งานผูกบัญชี LINE
// ─────────────────────────────────────────────────────────────
async function verifyLineLink(db: Db, d: DirectiveForVerify): Promise<VerifyResult> {
  const linked = (await rowsOf<LineLinkRow>(
    db.from("line_links").select("user_email, linked_at").eq("user_email", d.assigned_to ?? "").not("linked_at", "is", null).limit(1),
  ))[0];

  return {
    rule: "การผูกบัญชี LINE",
    verdict: linked ? "pass" : "fail",
    headline: linked
      ? `ผูก LINE เรียบร้อยแล้ว (${thaiDate(linked.linked_at)})`
      : `ยังไม่พบการผูก LINE ของ ${d.assigned_to_name ?? d.assigned_to}`,
    checks: [{ label: "สถานะการผูก LINE", value: linked ? "ผูกแล้ว" : "ยังไม่ผูก", ok: !!linked }],
    notes: linked ? [] : ["ถ้าปิดจ็อบทั้งที่ยังไม่ผูก พนักงานคนนี้จะไม่ได้รับแจ้งเตือนทาง LINE ต่อไป"],
    checkedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// กฎที่ 5 — งานส่งรายงานการปฏิบัติงาน
// ─────────────────────────────────────────────────────────────
async function verifyWorkReport(db: Db, d: DirectiveForVerify): Promise<VerifyResult> {
  const since = new Date(d.created_at).toISOString().slice(0, 10);
  const reports = await rowsOf<WorkReportRow>(
    db.from("work_reports").select("report_date, status, submitted_at")
      .eq("user_email", d.assigned_to ?? "").gte("report_date", since)
      .order("report_date", { ascending: false }).limit(LEAD_QUERY_LIMIT),
  );

  return {
    rule: "การส่งรายงานการปฏิบัติงาน",
    verdict: reports.length > 0 ? "pass" : "fail",
    headline:
      reports.length > 0
        ? `ส่งรายงานแล้ว ${reports.length} ฉบับ นับจากวันที่ได้รับคำสั่ง`
        : "ยังไม่พบรายงานที่ส่งหลังได้รับคำสั่งนี้",
    checks: [
      { label: "จำนวนรายงานหลังได้รับคำสั่ง", value: `${reports.length} ฉบับ`, ok: reports.length > 0 },
      { label: "ฉบับล่าสุด", value: reports[0] ? thaiDate(reports[0].report_date) : "—", ok: null },
      { label: "ส่งล่าช้า", value: `${reports.filter((r) => r.status === "late").length} ฉบับ`, ok: null },
    ],
    notes: ["ระบบตรวจได้แค่ว่ามีรายงานส่งเข้ามา — เนื้อหาตรงกับงานที่สั่งไหม ต้องให้ผู้สั่งอ่านเอง"],
    checkedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────

const RULES: { id: string; test: (t: string) => boolean; run: (db: Db, d: DirectiveForVerify) => Promise<VerifyResult> }[] = [
  { id: "overdue_followups", test: (t) => /เลยนัด|เกินนัด|คิวติดตาม/.test(t), run: verifyOverdueFollowups },
  { id: "line_link", test: (t) => /ผูก\s*(บัญชี\s*)?LINE|LINE.*ยังไม่ได้ผูก|not-linked/i.test(t), run: verifyLineLink },
  { id: "construction_progress", test: (t) => /ผังก่อสร้าง|ความคืบหน้าแปลง|อัปเดตความคืบหน้า/.test(t), run: verifyConstructionProgress },
  { id: "plot_record", test: (t) => /CRM-\d+|แปลง\s*(ที่\s*)?\d+/.test(t), run: verifyPlotRecord },
  { id: "work_report", test: (t) => /รายงาน(ประจำวัน|การปฏิบัติงาน)|ส่งรายงาน/.test(t), run: verifyWorkReport },
];

/** ตรวจคำสั่งงาน 1 ใบ — คืนผลที่ผู้สั่งงานใช้ประกอบการตรวจรับ
 *  กฎไหนก็ไม่เข้า -> บอกตรง ๆ ว่าตรวจอัตโนมัติไม่ได้ (ไม่เดาว่าเสร็จ) */
export async function verifyDirective(db: Db, d: DirectiveForVerify): Promise<VerifyResult> {
  const text = haystack(d);
  const rule = RULES.find((r) => r.test(text));
  if (!rule) {
    return {
      rule: "—",
      verdict: "unknown",
      headline: "งานนี้ระบบตรวจอัตโนมัติไม่ได้ — ต้องให้ผู้สั่งงานตรวจเอง",
      checks: [],
      notes: [
        "คำสั่งนี้ไม่ได้อ้างถึงข้อมูลที่ระบบวัดผลได้ (เช่น แปลง เลขที่ลูกค้า คิวติดตาม รายงาน)",
        "แนะนำ: อ่านรายงานผลงานของพนักงานประกอบกับหลักฐานที่ส่งมา ก่อนกดตรวจรับ",
      ],
      checkedAt: new Date().toISOString(),
    };
  }
  try {
    return await rule.run(db, d);
  } catch (e) {
    return {
      rule: rule.id,
      verdict: "unknown",
      headline: "ตรวจอัตโนมัติไม่สำเร็จ — ต้องให้ผู้สั่งงานตรวจเอง",
      checks: [],
      notes: [e instanceof Error ? e.message : "เกิดข้อผิดพลาดระหว่างตรวจ"],
      checkedAt: new Date().toISOString(),
    };
  }
}
