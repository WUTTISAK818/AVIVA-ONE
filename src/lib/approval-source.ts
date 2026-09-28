import { supabase } from "./supabase";
import { formatNumber } from "./thai-baht";
import { PAYMENT_PLAN } from "./payment-plan";

// ── ดึงเอกสารต้นเรื่องของคำขออนุมัติ ตามประเภท workflow ──
const SOURCE: Record<string, { table: string; select: string }> = {
  Booking_Deposit:    { table: "leads",                  select: "id,customer_name,phone,plot_number,budget,booking_date,financing_type" },
  Contract_Approval:  { table: "leads",                  select: "id,customer_name,phone,plot_number,budget,contract_price,contract_signed_date,delivery_date" },
  Finance_Approval:   { table: "approvals",              select: "id,description,amount,requested_by,note,reference_type,created_at" },
  Marketing_Budget:   { table: "approvals",              select: "id,description,amount,requested_by,note,reference_type,created_at" },
  Material_Purchase:  { table: "purchase_orders",        select: "id,po_number,supplier_name,items,total_amount,requested_by,notes" },
  Leave_Request:      { table: "leave_requests",         select: "id,employee_name,employee_dept,leave_type,date_from,date_to,days_count,reason" },
  Installment_Review: { table: "contractor_installments", select: "id,name,installment_no,amount,labor_cost,material_cost,contractor_notes,created_by_name" },
  Document_Approval:  { table: "documents",              select: "id,name,category,file_url,doc_number,uploaded_by,description" },
};

export async function fetchApprovalSource(workflowType: string, recordId: string | null): Promise<Record<string, unknown> | null> {
  const cfg = SOURCE[workflowType];
  if (!cfg || !recordId) return null;
  const { data } = await supabase.from(cfg.table).select(cfg.select).eq("id", recordId).maybeSingle();
  return (data as unknown as Record<string, unknown>) ?? null;
}

export interface VerifyRow { label: string; value: string; strong?: boolean; }
export interface VerifyItem { name: string; qty: number; unit: string; unitPrice: number; total: number; }
export interface VerifyData {
  rows: VerifyRow[];
  items?: VerifyItem[];
  itemsTotal?: number;
  warnings: string[];
  checklist: string[];
  fullDocHref?: string;
  fileUrl?: string;
}

const baht = (n: unknown) => `฿${formatNumber(Number(n) || 0)}`;
const thDate = (d: unknown) =>
  d ? new Date(String(d)).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "—";
const txt = (v: unknown) => (v == null || v === "" ? "—" : String(v));

/** สร้างข้อมูลตรวจสอบ (รายละเอียด + checklist + คำเตือน) จากเอกสารต้นเรื่อง */
export function buildVerification(
  workflowType: string,
  row: Record<string, unknown> | null,
  expectedAmount: number | null
): VerifyData {
  if (!row) {
    return {
      rows: [],
      warnings: ["ไม่พบข้อมูลเอกสารต้นเรื่อง — โปรดตรวจสอบกับผู้ส่งก่อนอนุมัติ"],
      checklist: ["ตรวจสอบข้อมูลกับผู้ส่งเรียบร้อย"],
    };
  }

  switch (workflowType) {
    case "Booking_Deposit": {
      // เอกสารนี้คือ "อนุมัติเงินจอง" — ตัวเลขเด่นต้องเป็นยอดเงินจองที่ลูกค้าต้องชำระ
      // ไม่ใช่ "งบประมาณลูกค้า" (ตัวเลขที่ลูกค้าบอกว่าจ่ายไหว ใช้คัดกรอง/จับคู่แปลงเท่านั้น)
      const warnings: string[] = [];
      const contractPrice = Number(row.contract_price) || 0;
      const customerBudget = Number(row.budget) || 0;
      const salePrice = contractPrice || customerBudget;          // ยังไม่กรอกราคาขาย → ใช้งบลูกค้าชั่วคราว
      const deposit = Math.round(salePrice * PAYMENT_PLAN.booking); // เงินจอง = 1% ตามแผนชำระเงินมาตรฐาน
      const pct = `${(PAYMENT_PLAN.booking * 100).toFixed(0)}%`;

      if (!row.plot_number) warnings.push("ยังไม่ได้ระบุแปลงในเอกสาร");
      if (salePrice === 0)
        warnings.push("ยังไม่มีราคาขายและงบประมาณลูกค้า — คำนวณยอดเงินจองไม่ได้ ให้ฝ่ายขายกรอก 'ราคาขายที่ตกลง' ก่อนอนุมัติ");
      else if (!contractPrice)
        warnings.push(`ยังไม่ได้กรอก "ราคาขายที่ตกลง" — ยอดเงินจองคำนวณจากงบประมาณลูกค้า (${baht(customerBudget)}) ชั่วคราว`);
      if (expectedAmount != null && deposit > 0 && Number(expectedAmount) !== deposit)
        warnings.push(`ยอดที่ขออนุมัติ (${baht(expectedAmount)}) ไม่ตรงกับเงินจอง ${pct} ของราคาขาย (${baht(deposit)})`);

      const rows: VerifyRow[] = [
        { label: "ลูกค้า", value: txt(row.customer_name) },
        { label: "เบอร์โทร", value: txt(row.phone) },
        { label: "แปลง", value: txt(row.plot_number) },
        { label: `ยอดเงินจอง (${pct} ของราคาขาย)`, value: baht(deposit), strong: true },
        { label: "ราคาขายที่ตกลง", value: contractPrice ? baht(contractPrice) : "ยังไม่ระบุ" },
      ];
      // งบประมาณลูกค้าเป็นข้อมูลอ้างอิง แสดงเมื่อมีค่าจริงเท่านั้น (ศูนย์ = ยังไม่ได้ถาม ไม่ใช่ "งบศูนย์บาท")
      if (customerBudget > 0) rows.push({ label: "งบประมาณลูกค้า (อ้างอิง)", value: baht(customerBudget) });
      rows.push({ label: "วันจอง", value: thDate(row.booking_date) });

      return {
        rows,
        warnings,
        checklist: [`ยอดเงินจองถูกต้อง (${baht(deposit)})`, "ข้อมูลลูกค้า/แปลงถูกต้อง"],
        fullDocHref: `/documents/generate?lead=${row.id}&type=booking${row.plot_number ? `&plot=${row.plot_number}` : ""}`,
      };
    }
    case "Contract_Approval": {
      const warnings: string[] = [];
      if (!row.contract_price) warnings.push("ยังไม่ได้ระบุราคาสัญญา");
      if (!row.delivery_date) warnings.push("ยังไม่กำหนดวันโอนกรรมสิทธิ์");
      return {
        rows: [
          { label: "ลูกค้า", value: txt(row.customer_name) },
          { label: "แปลง", value: txt(row.plot_number) },
          // เดิมตกมาใช้ "งบประมาณลูกค้า" เงียบ ๆ ทำให้ผู้อนุมัติเข้าใจว่าเป็นราคาสัญญาจริง
          { label: "ราคาสัญญา", value: row.contract_price ? baht(row.contract_price) : "ยังไม่ระบุ", strong: true },
          { label: "วันทำสัญญา", value: thDate(row.contract_signed_date) },
          { label: "กำหนดโอน", value: thDate(row.delivery_date) },
        ],
        warnings,
        checklist: ["ราคาสัญญาถูกต้อง", "ข้อมูลลูกค้า/แปลงครบถ้วน", "วันโอนกำหนดแล้ว"],
        fullDocHref: `/documents/generate?lead=${row.id}&type=contract${row.plot_number ? `&plot=${row.plot_number}` : ""}`,
      };
    }
    case "Finance_Approval":
    case "Marketing_Budget": {
      const warnings: string[] = [];
      const docAmt = Number(row.amount) || 0;
      if (expectedAmount != null && docAmt !== expectedAmount)
        warnings.push(`ยอดในเอกสาร (${baht(docAmt)}) ไม่ตรงกับยอดที่ขออนุมัติ (${baht(expectedAmount)})`);
      return {
        rows: [
          { label: "รายละเอียด", value: txt(row.description) },
          { label: "จำนวนเงิน", value: baht(row.amount), strong: true },
          { label: "ผู้ขอ", value: txt(row.requested_by) },
          { label: "หมายเหตุ", value: txt(row.note) },
        ],
        warnings,
        checklist: ["ยอดเงินถูกต้อง", "รายละเอียดรายจ่ายครบถ้วน"],
      };
    }
    case "Material_Purchase": {
      const rawItems = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : [];
      const items: VerifyItem[] = rawItems.map((it) => {
        const qty = Number(it.qty) || 0;
        const unitPrice = Number(it.unit_price) || 0;
        return { name: txt(it.name), qty, unit: txt(it.unit), unitPrice, total: qty * unitPrice };
      });
      const itemsTotal = items.reduce((s, i) => s + i.total, 0);
      const total = Number(row.total_amount) || 0;
      const warnings: string[] = [];
      if (items.length === 0) warnings.push("ไม่มีรายการสินค้าในใบสั่งซื้อ");
      if (items.length > 0 && itemsTotal !== total)
        warnings.push(`ยอดรวมรายการ (${baht(itemsTotal)}) ไม่ตรงกับยอดใบสั่งซื้อ (${baht(total)})`);
      return {
        rows: [
          { label: "เลขที่ PO", value: txt(row.po_number) },
          { label: "ผู้ขาย", value: txt(row.supplier_name) },
          { label: "ยอดรวม", value: baht(row.total_amount), strong: true },
        ],
        items,
        itemsTotal,
        warnings,
        checklist: ["จำนวน/ราคาสินค้าถูกต้อง", "ยอดรวมถูกต้อง", "ผู้ขายถูกต้อง"],
      };
    }
    case "Leave_Request": {
      return {
        rows: [
          { label: "พนักงาน", value: txt(row.employee_name) },
          { label: "ฝ่าย", value: txt(row.employee_dept) },
          { label: "ประเภทลา", value: txt(row.leave_type) },
          { label: "ช่วงวันที่", value: `${thDate(row.date_from)} – ${thDate(row.date_to)}` },
          { label: "จำนวนวัน", value: `${txt(row.days_count)} วัน`, strong: true },
          { label: "เหตุผล", value: txt(row.reason) },
        ],
        warnings: [],
        checklist: ["ข้อมูลการลาถูกต้อง", "จำนวนวันถูกต้อง"],
      };
    }
    case "Installment_Review": {
      return {
        rows: [
          { label: "งวดที่", value: txt(row.installment_no) },
          { label: "งาน", value: txt(row.name) },
          { label: "ค่าแรง", value: baht(row.labor_cost) },
          { label: "ค่าวัสดุ", value: baht(row.material_cost) },
          { label: "จำนวนเงินงวด", value: baht(row.amount), strong: true },
          { label: "หมายเหตุผู้รับเหมา", value: txt(row.contractor_notes) },
        ],
        warnings: [],
        checklist: ["รายละเอียดงวดงานถูกต้อง", "จำนวนเงินถูกต้อง"],
      };
    }
    case "Document_Approval": {
      const warnings: string[] = [];
      if (!row.file_url) warnings.push("ไม่มีไฟล์แนบในเอกสาร");
      return {
        rows: [
          { label: "ชื่อเอกสาร", value: txt(row.name) },
          { label: "หมวด", value: txt(row.category) },
          { label: "เลขเอกสาร", value: txt(row.doc_number) },
          { label: "ผู้อัปโหลด", value: txt(row.uploaded_by) },
          { label: "รายละเอียด", value: txt(row.description) },
        ],
        warnings,
        checklist: ["รายละเอียดเอกสารครบถ้วน", "ไฟล์แนบถูกต้อง"],
        fileUrl: row.file_url ? String(row.file_url) : undefined,
      };
    }
    default:
      return {
        rows: [],
        warnings: [],
        checklist: ["ตรวจสอบรายละเอียดเรียบร้อย"],
      };
  }
}
