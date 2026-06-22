import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MANAGER_ROLES } from "@/lib/roles";
import { serverDb } from "@/lib/server-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

interface ExpenseData {
  documentId: string;
  vendor_name: string;
  expense_date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  vat: number;
  total: number;
  gl_account: string;
  payment_method: "cash" | "card" | "bank";
  project_id?: string;
  contractor_id?: string;
  notes?: string;
}

interface RecordResponse {
  success?: boolean;
  entryId?: string;
  status?: string;
  approval_required?: boolean;
  error?: string;
  message?: string;
}

// Record expense to GL and expenses table
export async function POST(req: NextRequest): Promise<NextResponse<RecordResponse>> {
  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = serverDb(token);

    // Verify user role - must be accounting/finance/admin
    const { data: dbUser } = await db
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = dbUser?.role ?? "";
    const allowedRoles = [...MANAGER_ROLES, "accounting", "finance"];
    if (!allowedRoles.includes(userRole.toLowerCase())) {
      return NextResponse.json(
        { error: "Forbidden: Only accounting/finance staff can record expenses" },
        { status: 403 }
      );
    }

    // Parse request body
    const expenseData = await req.json() as ExpenseData;

    // Validate required fields
    if (!expenseData.documentId || !expenseData.vendor_name || !expenseData.total || !expenseData.gl_account) {
      return NextResponse.json(
        { error: "Missing required fields (documentId, vendor_name, total, gl_account)" },
        { status: 400 }
      );
    }

    // Determine if approval is needed (> 50,000 baht)
    const needsApproval = expenseData.total > 50_000;
    const status = needsApproval ? "pending_approval" : "approved";

    // Record to general_ledger table
    const { data: glData, error: glError } = await db
      .from("general_ledger")
      .insert({
        project_id: PROJECT_ID,
        document_type: "receipt",
        document_id: expenseData.documentId,
        account_code: expenseData.gl_account,
        description: expenseData.description || expenseData.vendor_name,
        debit_amount: 0, // Expense is credit to cash, debit to expense account
        credit_amount: expenseData.total,
        transaction_date: expenseData.expense_date,
        created_by: user.id,
        status: status,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (glError) {
      console.error("GL record error:", glError);
      return NextResponse.json(
        { error: `GL record failed: ${glError.message}` },
        { status: 500 }
      );
    }

    // Record to expenses table
    const { data: expenseRecord, error: expenseError } = await db
      .from("expenses")
      .insert({
        project_id: PROJECT_ID,
        gl_entry_id: glData?.id,
        vendor_name: expenseData.vendor_name,
        expense_date: expenseData.expense_date,
        description: expenseData.description || expenseData.vendor_name,
        amount: expenseData.amount,
        vat: expenseData.vat,
        total_amount: expenseData.total,
        payment_method: expenseData.payment_method,
        project_id_linked: expenseData.project_id || null,
        contractor_id: expenseData.contractor_id || null,
        status: status,
        recorded_by: user.id,
        notes: expenseData.notes || null,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (expenseError) {
      console.error("Expense record error:", expenseError);
      return NextResponse.json(
        { error: `Expense record failed: ${expenseError.message}` },
        { status: 500 }
      );
    }

    // Link document to expense record
    await db
      .from("documents")
      .update({
        status: status === "approved" ? "saved" : "pending_approval",
        linked_to: expenseRecord?.id,
      })
      .eq("id", expenseData.documentId);

    // Send notification
    const notificationTitle = needsApproval
      ? `ใบเสร็จ ${expenseData.vendor_name} รอการอนุมัติ (${expenseData.total.toLocaleString()} บาท)`
      : `ใบเสร็จ ${expenseData.vendor_name} บันทึกเรียบร้อย`;

    await db
      .from("notifications")
      .insert({
        project_id: PROJECT_ID,
        type: needsApproval ? "pending_approval" : "success",
        to_dept: needsApproval ? "ผู้บริหาร" : "บัญชี",
        title: notificationTitle,
        message: `${expenseData.vendor_name}: ${expenseData.total.toLocaleString()} บาท (GL: ${expenseData.gl_account})`,
        is_read: false,
      });

    return NextResponse.json({
      success: true,
      entryId: expenseRecord?.id,
      status: status,
      approval_required: needsApproval,
      message: needsApproval
        ? "Expense recorded and sent for approval"
        : "Expense auto-approved and recorded",
    });
  } catch (err) {
    console.error("Record expense error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
