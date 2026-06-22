-- ═══════════════════════════════════════════════════════════════════════════════
-- AVIVA ONE - Employee Badges & Activity Comments
-- ระบบสำหรับให้เหรียญ gamification และสนับสนุนความเห็น
-- ═══════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. EMPLOYEE BADGES (เหรียญของพนักงาน)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.employee_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Employee
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Badge type
  badge_type VARCHAR(50) NOT NULL,
  -- 'gold' (50+ activities/month)
  -- 'silver' (30-49 activities)
  -- 'bronze' (10-29 activities)
  -- 'onfire' (5+ days consecutive)
  -- 'speedemon' (10+ activities in a day)
  -- 'targetmaster' (3+ weeks achieved goal)

  -- Details
  description TEXT,
  badge_icon VARCHAR(10), -- Emoji like 🥇 🥈 🥉 🔥 ⚡ 🎯

  -- Timeline
  earned_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_badges_employee ON public.employee_badges(employee_id);
CREATE INDEX IF NOT EXISTS idx_badges_type ON public.employee_badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_badges_earned ON public.employee_badges(earned_at DESC);

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. ACTIVITY COMMENTS (ความเห็นในกิจกรรม)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.activity_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  activity_id UUID NOT NULL REFERENCES public.daily_activity_log(id) ON DELETE CASCADE,

  -- Author
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name VARCHAR(255),

  -- Content
  comment_text TEXT NOT NULL,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_activity ON public.activity_comments(activity_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.activity_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON public.activity_comments(created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.employee_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS badges_select ON public.employee_badges;
CREATE POLICY badges_select ON public.employee_badges FOR SELECT TO authenticated USING (TRUE);

ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comments_select ON public.activity_comments;
CREATE POLICY comments_select ON public.activity_comments FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS comments_insert ON public.activity_comments;
CREATE POLICY comments_insert ON public.activity_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS comments_update ON public.activity_comments;
CREATE POLICY comments_update ON public.activity_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' IN ('admin', 'ceo', 'coo')))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' IN ('admin', 'ceo', 'coo')));

-- ════════════════════════════════════════════════════════════════════════════════
-- END: EMPLOYEE BADGES & ACTIVITY COMMENTS
-- ════════════════════════════════════════════════════════════════════════════════
