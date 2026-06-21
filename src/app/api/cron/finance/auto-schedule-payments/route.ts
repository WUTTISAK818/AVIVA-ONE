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

    // Call the auto-schedule API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cronToken = process.env.CRON_SERVICE_TOKEN || "dev-token";

    const response = await fetch(`${baseUrl}/api/finance/payments/auto-schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronToken}`,
      },
      body: JSON.stringify({ projectId: "aaaaaaaa-0000-0000-0000-000000000001" }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Auto-schedule API error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to execute auto-schedule payments",
          details: error,
        },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: "Auto-schedule payments cron executed",
      status: "completed",
      result,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Auto-schedule cron error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Cron schedule: 0 9 * * * (Daily at 9 AM)
export const dynamic = "force-dynamic";
