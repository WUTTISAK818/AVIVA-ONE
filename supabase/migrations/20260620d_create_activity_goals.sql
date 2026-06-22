-- ═══════════════════════════════════════════════════════════════════════════════
-- AVIVA ONE - Activity Goals & Alerts System
-- ตารางสำหรับตั้งเป้าหมาย และจัดการ alerts อัตโนมัติ
-- ═══════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. ACTIVITY GOALS
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.activity_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target
  department VARCHAR(100),
  activity_type VARCHAR(50), -- 'construction' | 'finance' | 'hr' | 'sales'
  category VARCHAR(100),

  -- Goal settings
  target_count INT NOT NULL,
  actual_count INT DEFAULT 0,
  period VARCHAR(50) DEFAULT 'weekly', -- 'weekly' | 'monthly'

  -- Timeline
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  achieved BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_department ON public.activity_goals(department);
CREATE INDEX IF NOT EXISTS idx_goals_period ON public.activity_goals(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_goals_achieved ON public.activity_goals(achieved);

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. ACTIVITY ALERTS
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.activity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Alert metadata
  alert_type VARCHAR(50) NOT NULL, -- 'milestone' | 'anomaly' | 'overdue' | 'idle' | 'goal_at_risk'
  severity VARCHAR(50) DEFAULT 'medium', -- 'high' | 'medium' | 'low'

  -- Related data
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.daily_activity_log(id) ON DELETE CASCADE,

  -- Message
  message TEXT NOT NULL,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  dismissed BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_employee ON public.activity_alerts(employee_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON public.activity_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.activity_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON public.activity_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON public.activity_alerts(created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.activity_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS goals_select ON public.activity_goals;
CREATE POLICY goals_select ON public.activity_goals FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS goals_insert ON public.activity_goals;
CREATE POLICY goals_insert ON public.activity_goals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director')));

ALTER TABLE public.activity_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alerts_select ON public.activity_alerts;
CREATE POLICY alerts_select ON public.activity_alerts FOR SELECT TO authenticated
  USING (auth.uid() = employee_id OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director')));

DROP POLICY IF EXISTS alerts_update ON public.activity_alerts;
CREATE POLICY alerts_update ON public.activity_alerts FOR UPDATE TO authenticated
  USING (auth.uid() = employee_id OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director')))
  WITH CHECK (auth.uid() = employee_id OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director')));

-- ════════════════════════════════════════════════════════════════════════════════
-- END: ACTIVITY GOALS & ALERTS
-- ════════════════════════════════════════════════════════════════════════════════
