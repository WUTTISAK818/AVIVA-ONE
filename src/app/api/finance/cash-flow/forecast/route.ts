import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface ForecastWeek {
  week_number: number;
  week_start_date: string;
  expected_inflow: number;
  expected_outflow: number;
  net_position: number;
  cumulative_position: number;
  risk_level: "low" | "medium" | "high";
  risk_reason?: string;
}

interface CashFlowRisk {
  type: string;
  date: string;
  impact: number;
  description: string;
}

interface ForecastResponse {
  success: boolean;
  forecast: ForecastWeek[];
  risks: CashFlowRisk[];
  summary: {
    total_outflow_30d: number;
    total_inflow_30d: number;
    net_position_30d: number;
    total_outflow_90d: number;
    total_inflow_90d: number;
    net_position_90d: number;
    min_position: number;
    min_position_date: string;
  };
}

export async function GET(request: NextRequest) {
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
    const days = parseInt(searchParams.get("days") || "90", 10);

    // Calculate week boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

    // Get approved payment vouchers for the forecast period
    const { data: vouchers, error: vouchersError } = await supabase
      .from("payment_vouchers")
      .select(
        `
        id,
        net_amount,
        approved_at,
        paid_at
        `
      )
      .eq("project_id", projectId)
      .eq("status", "approved")
      .gte("approved_at", today.toISOString())
      .lte("approved_at", endDate.toISOString());

    if (vouchersError) {
      console.error("Error fetching vouchers:", vouchersError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch vouchers" },
        { status: 500 }
      );
    }

    // Generate 13-week forecast
    const forecast: ForecastWeek[] = [];
    const risks: CashFlowRisk[] = [];
    let cumulativePosition = 0;
    let minPosition = 0;
    let minPositionDate = today.toISOString().split("T")[0];

    for (let week = 1; week <= 13; week++) {
      const weekStart = new Date(today.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Calculate outflows (payments to contractors)
      let weekOutflow = 0;
      const weekVouchers = (vouchers || []).filter((v) => {
        const approvalDate = new Date(v.approved_at);
        return approvalDate >= weekStart && approvalDate < weekEnd;
      });

      weekVouchers.forEach((v) => {
        weekOutflow += parseFloat(v.net_amount as any) || 0;
      });

      // TODO: Get actual inflows from Closed Deal leads/revenue
      const weekInflow = week === 1 ? 500000 : 250000; // Placeholder

      const netPosition = weekInflow - weekOutflow;
      cumulativePosition += netPosition;

      // Detect risks
      let riskLevel: "low" | "medium" | "high" = "low";
      let riskReason: string | undefined;

      if (cumulativePosition < 0) {
        riskLevel = "high";
        riskReason = "Negative cash position";
        risks.push({
          type: "negative_cash",
          date: weekStart.toISOString().split("T")[0],
          impact: cumulativePosition,
          description: `Cumulative cash position turns negative: ${cumulativePosition.toLocaleString()}`,
        });
      } else if (cumulativePosition < 500000) {
        riskLevel = "medium";
        riskReason = "Low cash reserves";
      }

      if (weekOutflow > 1000000) {
        riskLevel = "high";
        riskReason = "Large outflow week";
        risks.push({
          type: "large_outflow",
          date: weekStart.toISOString().split("T")[0],
          impact: weekOutflow,
          description: `Large payment outflow expected: ${weekOutflow.toLocaleString()}`,
        });
      }

      if (cumulativePosition < minPosition) {
        minPosition = cumulativePosition;
        minPositionDate = weekStart.toISOString().split("T")[0];
      }

      forecast.push({
        week_number: week,
        week_start_date: weekStart.toISOString().split("T")[0],
        expected_inflow: weekInflow,
        expected_outflow: weekOutflow,
        net_position: netPosition,
        cumulative_position: cumulativePosition,
        risk_level: riskLevel,
        risk_reason: riskReason,
      });
    }

    // Calculate 30-day totals
    const thirtyDayForecast = forecast.slice(0, Math.ceil(30 / 7));
    const total30Inflow = thirtyDayForecast.reduce((sum, w) => sum + w.expected_inflow, 0);
    const total30Outflow = thirtyDayForecast.reduce((sum, w) => sum + w.expected_outflow, 0);
    const total90Inflow = forecast.reduce((sum, w) => sum + w.expected_inflow, 0);
    const total90Outflow = forecast.reduce((sum, w) => sum + w.expected_outflow, 0);

    const response: ForecastResponse = {
      success: true,
      forecast,
      risks,
      summary: {
        total_outflow_30d: total30Outflow,
        total_inflow_30d: total30Inflow,
        net_position_30d: total30Inflow - total30Outflow,
        total_outflow_90d: total90Outflow,
        total_inflow_90d: total90Inflow,
        net_position_90d: total90Inflow - total90Outflow,
        min_position: minPosition,
        min_position_date: minPositionDate,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Cash flow forecast error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
