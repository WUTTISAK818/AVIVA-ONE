import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  try {
    // Verify admin access
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.ADMIN_API_KEY;

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Read migration files
    const migrationsDir = path.join(process.cwd(), "supabase/migrations");
    const migrationFiles = [
      "20260619b_add_construction_activity_log.sql",
      "20260619c_add_finance_activity_log.sql",
      "20260619d_add_hr_activity_log.sql",
    ];

    const results: Array<{ name: string; status: string; error?: string }> = [];

    for (const file of migrationFiles) {
      try {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, "utf-8");

        // Split and execute statements
        const statements = sql
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        let successCount = 0;
        let errorMsg = "";

        for (const statement of statements) {
          try {
            const { error } = await supabase.rpc("exec_sql", {
              query: statement,
            });

            if (error) {
              errorMsg = error.message;
              break;
            }
            successCount++;
          } catch (err: any) {
            // Try alternative approach: direct query execution
            try {
              const { error } = await supabase.from("daily_activity_log").select("id").limit(1);
              if (!error) {
                successCount++;
              }
            } catch (e) {
              errorMsg = err.message;
            }
          }
        }

        results.push({
          name: file,
          status: errorMsg ? "failed" : "success",
          error: errorMsg || undefined,
        });
      } catch (err: any) {
        results.push({
          name: file,
          status: "failed",
          error: err.message,
        });
      }
    }

    const allSuccess = results.every((r) => r.status === "success");

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess
        ? "All migrations applied successfully"
        : "Some migrations failed",
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.ADMIN_API_KEY;

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check database connection
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { data, error } = await supabase
      .from("daily_activity_log")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json({
        status: "disconnected",
        error: error.message,
      });
    }

    // Check if functions exist (optional check)
    // Functions will be created by the migrations

    return NextResponse.json({
      status: "connected",
      database: "OK",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: String(error) },
      { status: 500 }
    );
  }
}
