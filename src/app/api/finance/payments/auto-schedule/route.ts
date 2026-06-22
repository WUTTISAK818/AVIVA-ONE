import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MANAGER_ROLES } from "@/lib/roles";

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

    // Query approved vouchers due within 7 days
    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: vouchers, error: vouchersError } = await supabase
      .from("payment_vouchers")
      .select(
        `
        id,
        project_id,
        contractor_id,
        net_amount,
        status,
        approved_at,
        contractor:contractor_id(
          id,
          contractor_name,
          email,
          phone_number,
          bank_account,
          bank_name,
          account_holder
        )
        `
      )
      .eq("status", "approved")
      .gte("approved_at", today.toISOString())
      .lte("approved_at", sevenDaysFromNow.toISOString())
      .order("approved_at", { ascending: true });

    if (vouchersError) {
      console.error("Error fetching vouchers:", vouchersError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch payment vouchers" },
        { status: 500 }
      );
    }

    if (!vouchers || vouchers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No vouchers due within 7 days",
        processed: 0,
        payment_instructions: [],
      });
    }

    // Create payment instructions for each voucher
    const paymentInstructions = [];
    const scheduledDate = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000); // Schedule for tomorrow

    for (const voucher of vouchers) {
      // Check if contractor has bank details
      const contractor = voucher.contractor as any;
      if (!contractor?.bank_account || !contractor?.bank_name) {
        console.warn(
          `Contractor ${contractor?.contractor_name} missing bank details, skipping`
        );
        continue;
      }

      const instruction = {
        payment_voucher_id: voucher.id,
        project_id: voucher.project_id,
        amount: voucher.net_amount,
        to_account: contractor.bank_account,
        to_bank: contractor.bank_name,
        description: `Payment for ${contractor.contractor_name} - Voucher ${voucher.id}`,
        scheduled_date: scheduledDate.toISOString().split("T")[0],
        status: "pending",
        created_by: user.user.id,
      };

      paymentInstructions.push(instruction);
    }

    // Insert payment instructions
    const { data: created, error: insertError } = await supabase
      .from("payment_instructions")
      .insert(paymentInstructions)
      .select("id");

    if (insertError) {
      console.error("Error creating payment instructions:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to create payment instructions" },
        { status: 500 }
      );
    }

    // Log to activity
    await supabase
      .from("daily_activity_log")
      .insert({
        project_id: vouchers[0]?.project_id,
        activity_date: new Date().toISOString().split("T")[0],
        activity_type: "finance_automation",
        category: "payment_scheduling",
        performer_id: user.user.id,
        performer_name: "System",
        performer_department: "Finance",
        description: `Auto-scheduled ${created?.length || 0} payment instructions`,
        created_by: user.user.id,
      });

    return NextResponse.json({
      success: true,
      message: `Successfully scheduled ${created?.length || 0} payments`,
      processed: created?.length || 0,
      payment_instructions: created?.map((p) => p.id) || [],
    });
  } catch (error) {
    console.error("Auto-schedule payments error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
