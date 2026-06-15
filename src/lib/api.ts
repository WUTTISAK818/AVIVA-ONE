// Shared error handling for write Route Handlers.
//
// Until the Phase-2 migration (supabase/migrations/20260611_phase2.sql) is run,
// writes fail in a few distinct ways — surface a single clear hint for all of them:
//   42501    — row violates RLS policy (no write policy yet)
//   42703    — column does not exist
//   PGRST204 — column not found in PostgREST schema cache (new column)
//   PGRST116 — update/select returned 0 rows (RLS silently blocked the write)
const MIGRATION_CODES = new Set(['42501', '42703', 'PGRST204', 'PGRST116'])

export interface DbError {
  message: string
  code?: string | null
}

export function dbErrorResponse(error: DbError): Response {
  const needsMigration = !!error.code && MIGRATION_CODES.has(error.code)
  return Response.json(
    {
      error: error.message,
      code: error.code,
      hint: needsMigration
        ? 'การเขียนถูกปฏิเสธ — ตรวจสอบว่าได้รัน migration Phase 2 (supabase/migrations/20260611_phase2.sql) บน Supabase แล้ว (เพิ่มคอลัมน์ + RLS policy สำหรับการเขียน)'
        : undefined,
    },
    { status: needsMigration ? 503 : 500 }
  )
}
