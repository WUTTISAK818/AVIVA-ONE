-- Activity Goals RLS
ALTER TABLE IF EXISTS public.activity_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_goals_select ON public.activity_goals;
CREATE POLICY activity_goals_select ON public.activity_goals
  FOR SELECT USING (auth.uid() = created_by OR auth.jwt()->>'role' = 'admin');

DROP POLICY IF EXISTS activity_goals_insert ON public.activity_goals;
CREATE POLICY activity_goals_insert ON public.activity_goals
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Note: activity_badges table creation skipped - ensure it exists before running this
-- If needed, create with: CREATE TABLE public.activity_badges (id uuid PRIMARY KEY, ...);

GRANT SELECT, INSERT, UPDATE ON public.activity_goals TO authenticated;
