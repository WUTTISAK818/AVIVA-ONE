-- Add Hikvision mapping column to employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS hikvision_person_id TEXT UNIQUE;

-- Create sync logs table for tracking Hikvision syncs
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'hikvision', 'tapo_camera', etc.
  sync_date TIMESTAMP NOT NULL DEFAULT NOW(),
  records_processed INTEGER DEFAULT 0,
  records_success INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for sync logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_source ON sync_logs(source);
CREATE INDEX IF NOT EXISTS idx_sync_logs_date ON sync_logs(sync_date);

-- Add device_id column to attendance_records if not exists
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Index for device tracking
CREATE INDEX IF NOT EXISTS idx_attendance_device ON attendance_records(device_id);

-- Add hikvision_event_id to prevent duplicate processing
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS hikvision_event_id TEXT UNIQUE;

-- RLS Policies for sync_logs
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view sync logs" ON sync_logs
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin can insert sync logs" ON sync_logs
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Grant access to service_role for API operations
GRANT SELECT, INSERT, UPDATE ON sync_logs TO service_role;
GRANT SELECT, INSERT, UPDATE ON attendance_records TO service_role;
GRANT SELECT ON employees TO service_role;
