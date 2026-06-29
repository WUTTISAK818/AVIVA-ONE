-- Add command tracking columns to tasks_features table
-- Track deployment version, type, and timestamp for audit purposes

ALTER TABLE tasks_features
ADD COLUMN IF NOT EXISTS command_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS deploy_version VARCHAR(20),
ADD COLUMN IF NOT EXISTS deployed_date TIMESTAMP WITH TIME ZONE;

-- Add indexes for command tracking queries
CREATE INDEX IF NOT EXISTS idx_tasks_deploy_version ON tasks_features(deploy_version);
CREATE INDEX IF NOT EXISTS idx_tasks_deployed_date ON tasks_features(deployed_date);
CREATE INDEX IF NOT EXISTS idx_tasks_command_type ON tasks_features(command_type);

-- Add comments for documentation
COMMENT ON COLUMN tasks_features.command_type IS 'Type of command/operation (e.g., deploy, schema_change, feature_flag)';
COMMENT ON COLUMN tasks_features.deploy_version IS 'Version number when this task was deployed (e.g., v6.71, v6.72)';
COMMENT ON COLUMN tasks_features.deployed_date IS 'Timestamp when this task was deployed to production';
