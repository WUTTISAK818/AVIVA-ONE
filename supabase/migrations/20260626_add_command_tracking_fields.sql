-- Add command tracking fields to tasks_features table
ALTER TABLE tasks_features
ADD COLUMN IF NOT EXISTS command_type TEXT DEFAULT 'feature' CHECK (command_type IN ('feature', 'bugfix', 'enhancement', 'refactor', 'other')),
ADD COLUMN IF NOT EXISTS deploy_version TEXT,
ADD COLUMN IF NOT EXISTS deployed_date TIMESTAMP WITH TIME ZONE;

-- Add index for command_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_tasks_command_type ON tasks_features(command_type);
CREATE INDEX IF NOT EXISTS idx_tasks_deploy_version ON tasks_features(deploy_version);
CREATE INDEX IF NOT EXISTS idx_tasks_deployed_date ON tasks_features(deployed_date);

-- Comment on new columns for documentation
COMMENT ON COLUMN tasks_features.command_type IS 'Type of command: feature (new feature), bugfix (bug fix), enhancement (improvement), refactor (code improvement), other';
COMMENT ON COLUMN tasks_features.deploy_version IS 'Version number when deployed to production (e.g., v6.70, v6.71)';
COMMENT ON COLUMN tasks_features.deployed_date IS 'Timestamp when the feature was deployed to production';
