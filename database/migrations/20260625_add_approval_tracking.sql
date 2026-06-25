-- Phase 3: Add Approval Tracking System
-- Author: ONE (Claude Code Agent)
-- Date: 2026-06-25
-- Purpose: Track approval history and send notifications

-- 1. Create approval_history table (audit log)
CREATE TABLE IF NOT EXISTS activity_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activity_logs(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'approved', 'rejected', 'pending', 'updated', 'sent_back'
  approved_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by_name VARCHAR(255),
  approval_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reason TEXT,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraint for valid actions
  CONSTRAINT approval_action_check CHECK (action IN ('approved', 'rejected', 'pending', 'updated', 'sent_back'))
);

-- 2. Add approval tracking columns to activity_logs
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(255);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS approved_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS approval_reason TEXT;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_approval_history_activity_id
  ON activity_approval_history(activity_id);

CREATE INDEX IF NOT EXISTS idx_activity_approval_history_approved_by
  ON activity_approval_history(approved_by);

CREATE INDEX IF NOT EXISTS idx_activity_approval_history_approval_date
  ON activity_approval_history(approval_date DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_review_status
  ON activity_logs(review_status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_approved_date
  ON activity_logs(approved_date DESC);

-- 4. Verify schema
SELECT
  'Approval Tracking System' as status,
  'Tables created:' as details,
  COUNT(DISTINCT table_name) as count
FROM information_schema.columns
WHERE table_name IN ('activity_approval_history', 'activity_logs');

-- List approval_history columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'activity_approval_history'
ORDER BY ordinal_position;
