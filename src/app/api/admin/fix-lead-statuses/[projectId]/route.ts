import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateLeadStatuses, autoFixLeadStatuses, generateReport } from "@/lib/lead-status-fix";
import { isManagerRole } from "@/lib/roles";
export const dynamic = 'force-dynamic';

async function verifyAdminAccess(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return false;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return !!(profile && isManagerRole(profile.role));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const isAdmin = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { projectId } = await params;

    // Validate all leads first
    const issues = await validateLeadStatuses(projectId, supabase as any);

    if (issues.length === 0) {
      return NextResponse.json({
        success: true,
        message: "ไม่พบปัญหา - สถานะลูกค้าทั้งหมดถูกต้อง",
        fixed: 0,
        issues: [],
        report: generateReport(issues),
      });
    }

    // Auto-fix the issues
    const fixResult = await autoFixLeadStatuses(projectId, supabase as any);

    return NextResponse.json({
      success: true,
      message: "แก้ไขสถานะลูกค้าเรียบร้อย",
      fixed: fixResult.fixed,
      errors: fixResult.errors,
      issues: issues.map(issue => ({
        id: issue.id,
        customer_name: issue.customer_name,
        current_status: issue.current_status,
        expected_status: issue.expected_status,
        has_contract: issue.has_contract,
        has_loan_approval: issue.has_loan_approval,
        has_transfer: issue.has_transfer,
        issue_description: issue.issue_description,
      })),
      report: generateReport(issues),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const isAdmin = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { projectId } = await params;

    // Check all leads without fixing
    const issues = await validateLeadStatuses(projectId, supabase as any);

    return NextResponse.json({
      success: true,
      issues_found: issues.length,
      issues: issues.map(issue => ({
        id: issue.id,
        customer_name: issue.customer_name,
        current_status: issue.current_status,
        expected_status: issue.expected_status,
        has_contract: issue.has_contract,
        has_loan_approval: issue.has_loan_approval,
        has_transfer: issue.has_transfer,
        issue_description: issue.issue_description,
      })),
      report: generateReport(issues),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
