import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const AUTO_APPROVE_THRESHOLD = 50000; // THB
const TRUSTED_VENDOR_MULTIPLIER = 100000; // Higher limit for trusted vendors

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid authorization" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify token and get user
    const { data: user, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user.user) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    // Check role
    const { data: userData, error: roleError } = await supabase
      .from("app_users")
      .select("role")
      .eq("id", user.user.id)
      .single();

    const userRole = userData?.role?.toLowerCase() || "";
    const isFinanceRole = ["finance", "ceo", "coo", "admin"].includes(userRole);

    if (!isFinanceRole) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions. Finance role required." },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId") || "aaaaaaaa-0000-0000-0000-000000000001";

    // TODO: Query from expense/purchase request table (once created)
    // For now, return placeholder response
    const autoApprovedExpenses: string[] = [];
    const skippedExpenses: Array<{ id: string; reason: string }> = [];

    // Placeholder logic - would need actual expense table
    // Sample implementation:
    /*
    const { data: expenses } = await supabase
      .from("expenses")
      .select("id, vendor_name, amount, gl_account")
      .eq("project_id", projectId)
      .eq("status", "pending")
      .lt("amount", AUTO_APPROVE_THRESHOLD);

    for (const expense of expenses || []) {
      // Check if vendor is trusted
      const { data: trustedVendor } = await supabase
        .from("trusted_vendors")
        .select("id, max_auto_approve_amount")
        .eq("vendor_name", expense.vendor_name)
        .eq("is_trusted", true)
        .single();

      const approvalLimit = trustedVendor?.max_auto_approve_amount || AUTO_APPROVE_THRESHOLD;

      if (expense.amount <= approvalLimit && expense.gl_account) {
        // Auto-approve
        await supabase
          .from("expenses")
          .update({ status: "approved", approved_by: user.user.id, approved_at: new Date() })
          .eq("id", expense.id);

        autoApprovedExpenses.push(expense.id);

        // Create GL posting
        const jvNumber = `JV-${Date.now()}`;
        await supabase.from("gl_postings").insert({
          jv_number: jvNumber,
          reference_id: expense.id,
          reference_type: "expense",
          created_by: user.user.id,
        });
      } else {
        skippedExpenses.push({
          id: expense.id,
          reason: !trustedVendor ? "Unknown vendor" : "Amount exceeds threshold",
        });
      }
    }
    */

    // Log activity
    if (autoApprovedExpenses.length > 0) {
      await supabase
        .from("daily_activity_log")
        .insert({
          project_id: projectId,
          activity_date: new Date().toISOString().split("T")[0],
          activity_type: "finance_automation",
          category: "expense_approval",
          performer_id: user.user.id,
          performer_name: "System",
          performer_department: "Finance",
          description: `Auto-approved ${autoApprovedExpenses.length} expenses`,
          created_by: user.user.id,
        });
    }

    return NextResponse.json({
      success: true,
      message: `Processed expenses: ${autoApprovedExpenses.length} approved, ${skippedExpenses.length} skipped`,
      approved_count: autoApprovedExpenses.length,
      skipped_count: skippedExpenses.length,
      approved_expenses: autoApprovedExpenses,
      skipped_expenses: skippedExpenses,
    });
  } catch (error) {
    console.error("Auto-approve expenses error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
