import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized cron request" },
        { status: 401 }
      );
    }

    // Call the cash flow forecast API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cronToken = process.env.CRON_SERVICE_TOKEN || "dev-token";

    const response = await fetch(
      `${baseUrl}/api/finance/cash-flow/forecast?projectId=aaaaaaaa-0000-0000-0000-000000000001&days=30`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Cash flow forecast API error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch cash flow forecast",
          details: error,
        },
        { status: 500 }
      );
    }

    const forecastData = await response.json();

    // Check for high-risk alerts
    const highRiskAlerts = (forecastData.risks || []).filter((r: any) => r.type === "negative_cash");

    if (highRiskAlerts.length > 0) {
      // TODO: Send notifications to finance department
      console.log(`[ALERT] High-risk cash flow alerts detected: ${highRiskAlerts.length}`);

      // Example: Send push notification
      // await createNotification({
      //   title: 'Cash Flow Alert',
      //   message: `${highRiskAlerts.length} high-risk cash flow periods detected`,
      //   recipients: ['finance@company.com'],
      //   priority: 'high'
      // });
    }

    return NextResponse.json({
      success: true,
      message: "Cash flow alerts cron executed",
      status: "completed",
      high_risk_alerts: highRiskAlerts.length,
      forecast_summary: forecastData.summary,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cash flow alerts cron error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Cron schedule: 0 7 * * * (Daily at 7 AM)
export const dynamic = "force-dynamic";
