import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Read and combine all migration files
    const fs = await import("fs");
    const path = await import("path");

    const migrationsDir = path.join(process.cwd(), "supabase/migrations");
    const files = [
      "critical_gaps_schema.sql",
      "20260619a_create_daily_activity_log.sql",
      "20260619b_add_construction_activity_log.sql",
      "20260619c_add_finance_activity_log.sql",
      "20260619d_add_hr_activity_log.sql",
    ];

    let combinedSQL = "";
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, "utf-8");
        combinedSQL += "\n\n" + sql;
      }
    }

    if (!combinedSQL) {
      return NextResponse.json(
        { success: false, error: "No migration files found" },
        { status: 404 }
      );
    }

    // Execute all migrations at once
    const statements = combinedSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let successCount = 0;
    let errors: string[] = [];

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc("exec_sql", {
          query: statement,
        });

        if (error) {
          errors.push(error.message);
        } else {
          successCount++;
        }
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: `Applied ${successCount} statements${
        errors.length > 0 ? `, ${errors.length} errors` : ""
      }`,
      successCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : [],
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
  return NextResponse.json({
    message: "Migration API ready",
    method: "POST",
    docs: "Send POST request to apply migrations",
  });
}
