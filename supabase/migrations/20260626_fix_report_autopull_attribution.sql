-- Fix per-user attribution so daily-report auto-pull works for Sales + Construction.
-- Problem: sales_activities.created_by and construction_reports.created_by were never
-- populated (no default, inserts only set the *_name text column), so any query that
-- filters by created_by = current user matched 0 rows.
-- Solution: mirror the pattern already used by activity_logs.user_id and
-- crm_logs.created_by_id, which default to auth.uid() and work reliably.
ALTER TABLE sales_activities     ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE construction_reports ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Note: existing rows are left as-is (no reliable historical author to backfill).
-- All rows created from now on will carry the correct creator automatically.

COMMENT ON COLUMN sales_activities.created_by IS 'Creator user id (defaults to auth.uid()); used to auto-pull a salesperson''s own activities into their daily work report';
COMMENT ON COLUMN construction_reports.created_by IS 'Creator user id (defaults to auth.uid()); used to auto-pull a worker''s own construction reports into their daily work report';
