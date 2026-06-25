-- Phase 3: Add indexes for activity search and filtering performance
-- Author: Vee (Claude Cowork Agent)
-- Date: 2026-06-25
-- Purpose: Optimize queries for search, filter, and sort operations

-- Create indexes for search functionality
CREATE INDEX IF NOT EXISTS idx_activity_logs_title_fts
ON activity_logs USING GIN(to_tsvector('english', title));

CREATE INDEX IF NOT EXISTS idx_activity_logs_detail_fts
ON activity_logs USING GIN(to_tsvector('english', detail));

-- Create indexes for filter operations
CREATE INDEX IF NOT EXISTS idx_activity_logs_category
ON activity_logs(category);

CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_date_desc
ON activity_logs(activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
ON activity_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_department
ON activity_logs(department);

-- For review status filtering (will be used in Week 2)
CREATE INDEX IF NOT EXISTS idx_activity_logs_review_status
ON activity_logs(review_status);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_activity_logs_date_category
ON activity_logs(activity_date DESC, category);

CREATE INDEX IF NOT EXISTS idx_activity_logs_date_department
ON activity_logs(activity_date DESC, department);

-- Verify indexes were created
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE tablename = 'activity_logs'
ORDER BY indexname;
