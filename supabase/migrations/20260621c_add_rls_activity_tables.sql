-- Add RLS policies for activity_goals and activity_badges tables
-- Ensure department isolation

-- Enable RLS on activity_goals
ALTER TABLE activity_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_goals_department_isolation ON activity_goals
  FOR SELECT USING (
    auth.jwt()->>'department' = department OR
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo')
  );

CREATE POLICY activity_goals_manager_only_insert ON activity_goals
  FOR INSERT WITH CHECK (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'director', 'manager')
  );

CREATE POLICY activity_goals_manager_only_update ON activity_goals
  FOR UPDATE USING (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'director') OR
    auth.jwt()->>'id' = created_by
  );

-- Enable RLS on activity_badges
ALTER TABLE activity_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_badges_department_isolation ON activity_badges
  FOR SELECT USING (
    auth.jwt()->>'department' = department OR
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo')
  );

CREATE POLICY activity_badges_manager_only_insert ON activity_badges
  FOR INSERT WITH CHECK (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'director', 'manager')
  );

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('activity_goals', 'activity_badges');
