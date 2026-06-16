"use client";
// Purchase Request — logic กลางสำหรับ "สร้างคำขอซื้อ"
// ใช้ร่วมกันระหว่าง PurchaseRequestPanel (ฟอร์ม) และน้อง Viva (Action Mode)
// กันโค้ด drift: แก้ flow ที่เดียว ทั้งสองทางได้เหมือนกัน
import { supabase } from "@/lib/supabase";
import { generateDocNumber } from "@/lib/doc-numbers";
import { submitApprovalQueue } from "@/lib/workflow-events";
import { createNotification } from "@/lib/notify";
import { logAction } from "@/lib/audit";

export const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
export const PR_THRESHOLD = 2000; // เกณฑ์ที่ต้องขออนุมัติก่อนซื้อ

export const PR_CATEGORIES = [
  "ฟิล์มกรองแสง/ตกแต่งสำนักงาน",
  "อุปกรณ์สำนักงาน",
  "ไอที/คอมพิวเตอร์",
  "ซ่อมบำรุง",
  "การตลาด/สื่อ",
  "อื่น ๆ",
] as const;

export const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

// แมปหมวดที่ AI เดามาให้ตรงกับรายการจริง (กันค่าหลุด list)
export function normalizePRCategory(raw: string | null | undefined): string {
  const c = (raw ?? "").trim();
  if ((PR_CATEGORIES as readonly string[]).includes(c)) return c;
  const low = c.toLowerCase();
  if (low.includes("ไอที") || low.includes("it") || low.includes("คอม") || low.includes("มือถือ") || low.includes("phone") || low.includes("computer")) return "ไอที/คอมพิวเตอร์";
  if (low.includes("ฟิล์ม") || low.includes("ตกแต่ง")) return "ฟิล์มกรองแสง/ตกแต่งสำนักงาน";
  if (low.includes("สำนักงาน") || low.includes("office") || low.includes("เครื่องเขียน")) return "อุปกรณ์สำนักงาน";
  if (low.includes("ซ่อม") || low.includes("บำรุง") || low.includes("repair")) return "ซ่อมบำรุง";
  if (low.includes("ตลาด") || low.includes("สื่อ") || low.includes("marketing") || low.includes("โฆษณา")) return "การตลาด/สื่อ";
  return "อื่น ๆ";
}

export interface CreatePRInput {
  category: string;
  item: string;
  reason?: string | null;
  amount: number;
  quoteUrl?: string | null;
  requester: string;
  requesterDept?: string | null;
  requesterRole?: string | null;
}

export interface CreatePRResult {
  id: string;
  prNumber: string;
  needsApproval: boolean;
}

// สร้างคำขอซื้อ + ส่งเข้าสายอนุมัติ (≥ THRESHOLD) หรืออนุมัติอัตโนมัติ (ต่ำกว่าเกณฑ์)
// คืน pr_number + needsApproval ให้ผู้เรียกไปแสดงผลต่อ
export async function createPurchaseRequest(input: CreatePRInput): Promise<CreatePRResult> {
  const item = input.item.trim();
  const amt = Number(input.amount);
  if (!item) throw new Error("กรุณาระบุรายการที่จะซื้อ");
  if (!amt || amt <= 0) throw new Error("กรุณาระบุราคาประมาณที่ถูกต้อง");

  const category = normalizePRCategory(input.category);
  const reason = (input.reason ?? "").trim() || null;
  const dept = input.requesterDept || null;
  const who = input.requester;
  const needsApproval = amt >= PR_THRESHOLD;
  const prNo = await generateDocNumber("PR");

  const { data: inserted, error } = await supabase
    .from("purchase_requests")
    .insert({
      project_id: PROJECT_ID,
      pr_number: prNo,
      category,
      item,
      reason,
      estimated_amount: amt,
      quote_url: (input.quoteUrl ?? "").trim() || null,
      requester: who,
      requester_dept: dept,
      needs_approval: needsApproval,
      status: needsApproval ? "pending" : "approved",
      approver: needsApproval ? null : "ระบบ (ต่ำกว่าเกณฑ์)",
      approved_at: needsApproval ? null : new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !inserted) throw new Error("บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง");

  if (needsApproval) {
    await submitApprovalQueue({
      workflowType: "Purchase_Request",
      sourceRecordId: inserted.id,
      docIndex: prNo,
      title: `${prNo} · ${item} (${baht(amt)})`,
      amount: amt,
      actorName: who,
      actorRole: input.requesterRole ?? null,
    });
    await createNotification({
      type: "approval",
      title: "ขออนุมัติก่อนซื้อ",
      message: `${prNo} · ${item} ${baht(amt)} — รออนุมัติ`,
      from_dept: dept || undefined,
      to_dept: "ฝ่ายบริหาร",
      record_id: inserted.id,
      link: "/office?tab=finance",
    });
  }
  await logAction("office", "pr_create",
    `เปิดคำขอซื้อ ${prNo} — ${item} ${baht(amt)}${needsApproval ? " (รออนุมัติ)" : " (ต่ำกว่าเกณฑ์ อนุมัติอัตโนมัติ)"}`,
    inserted.id);

  return { id: inserted.id, prNumber: prNo, needsApproval };
}
