-- Create tasks_features table for tracking feature requests and tasks
CREATE TABLE IF NOT EXISTS tasks_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,

  -- Relationships
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),

  -- Status & Priority
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'approved', 'rejected')) DEFAULT 'pending',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',

  -- Timeline
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date DATE,
  started_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  approved_date TIMESTAMP WITH TIME ZONE,

  -- Progress tracking
  progress_pct INTEGER CHECK (progress_pct >= 0 AND progress_pct <= 100) DEFAULT 0,
  expected_complete_date DATE,

  -- Related commits/PRs
  related_commits TEXT[] DEFAULT '{}',
  related_pr_url TEXT,

  -- Notes and feedback
  developer_notes TEXT,
  manager_notes TEXT,

  -- Metadata
  department TEXT,
  category TEXT,
  estimated_hours DECIMAL(5,2),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_tasks_status ON tasks_features(status);
CREATE INDEX idx_tasks_assigned_to ON tasks_features(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks_features(created_by);
CREATE INDEX idx_tasks_priority ON tasks_features(priority);
CREATE INDEX idx_tasks_due_date ON tasks_features(due_date);

-- Create task_comments table for discussion/feedback
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks_features(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);

-- Create task_history for audit trail
CREATE TABLE IF NOT EXISTS task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks_features(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_task_history_task_id ON task_history(task_id);

-- RLS Policies
ALTER TABLE tasks_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

-- Allow users to see all tasks (managers can see everything, devs can see assigned)
CREATE POLICY "Users can view tasks" ON tasks_features
  FOR SELECT USING (
    auth_role() IN ('admin', 'ceo', 'coo', 'manager', 'director')
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

-- Allow task creators and managers to update
CREATE POLICY "Users can update own or assigned tasks" ON tasks_features
  FOR UPDATE USING (
    auth_role() IN ('admin', 'ceo', 'coo', 'manager', 'director')
    OR assigned_to = auth.uid()
  );

-- Allow managers and admins to create tasks
CREATE POLICY "Managers can create tasks" ON tasks_features
  FOR INSERT WITH CHECK (
    auth_role() IN ('admin', 'ceo', 'coo', 'manager', 'director')
  );

-- Similar policies for comments and history
CREATE POLICY "Users can view task comments" ON task_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create task comments" ON task_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view task history" ON task_history
  FOR SELECT USING (true);
