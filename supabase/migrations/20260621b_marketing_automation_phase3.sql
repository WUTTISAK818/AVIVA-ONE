-- AVIVA ONE v6.55
-- Marketing Automation Phase 3
-- Lead nurturing campaigns, scheduled messages, campaign analytics

-- ========================================
-- TABLE 1: MARKETING CAMPAIGNS
-- ========================================
-- Define lead nurturing campaign sequences
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES public.projects(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Campaign trigger
  lead_status_filter VARCHAR(100),         -- NEW_LEAD, SITE_VISIT, NO_RESPONSE_3D, etc.

  -- Sequence configuration (JSON format)
  -- Example: {"messages": [{"delay_hours": 1, "type": "sms", "template": "welcome"}, ...]}
  sequence_config JSONB NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT FALSE,
  campaign_start_date DATE,
  campaign_end_date DATE,

  -- Metadata
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_project
  ON public.marketing_campaigns(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_active
  ON public.marketing_campaigns(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status_filter
  ON public.marketing_campaigns(lead_status_filter);

-- Enable RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS marketing_campaigns_select ON public.marketing_campaigns
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'sales', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS marketing_campaigns_insert ON public.marketing_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS marketing_campaigns_update ON public.marketing_campaigns
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'ceo', 'coo', 'admin')
    )
  );

-- ========================================
-- TABLE 2: MARKETING MESSAGES
-- ========================================
-- Scheduled and sent marketing messages to leads
CREATE TABLE IF NOT EXISTS public.marketing_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES public.projects(id),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,

  -- Lead being targeted
  lead_id UUID NOT NULL,  -- No FK constraint to allow flexible data structure
  lead_name VARCHAR(255),
  lead_phone VARCHAR(20),
  lead_email VARCHAR(255),

  -- Message details
  message_type VARCHAR(50) NOT NULL,       -- sms, email, line_message, call
  subject VARCHAR(255),                    -- For email only
  content TEXT NOT NULL,

  -- Scheduling
  scheduled_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending',    -- pending, sent, delivered, failed, bounced
  error_message TEXT,

  -- Engagement tracking
  response_received BOOLEAN DEFAULT FALSE,
  response_at TIMESTAMP,
  click_count INTEGER DEFAULT 0,
  clicked_at TIMESTAMP,

  -- Metadata
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_message_type CHECK (message_type IN ('sms', 'email', 'line_message', 'call')),
  CONSTRAINT chk_message_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced'))
);

CREATE INDEX IF NOT EXISTS idx_marketing_messages_campaign
  ON public.marketing_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_messages_lead
  ON public.marketing_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_marketing_messages_project
  ON public.marketing_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_messages_scheduled
  ON public.marketing_messages(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_marketing_messages_status
  ON public.marketing_messages(status);
CREATE INDEX IF NOT EXISTS idx_marketing_messages_created
  ON public.marketing_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.marketing_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS marketing_messages_select ON public.marketing_messages
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'sales', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS marketing_messages_insert ON public.marketing_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'sales', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS marketing_messages_update ON public.marketing_messages
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'sales', 'ceo', 'coo', 'admin')
    )
  );

-- ========================================
-- TABLE 3: CAMPAIGN ANALYTICS
-- ========================================
-- Performance metrics for marketing campaigns
CREATE TABLE IF NOT EXISTS public.campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES public.projects(id),
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,

  -- Date metrics (daily rollup)
  analytics_date DATE NOT NULL,

  -- Message statistics
  messages_sent INT DEFAULT 0,
  messages_delivered INT DEFAULT 0,
  messages_failed INT DEFAULT 0,
  messages_bounced INT DEFAULT 0,

  -- Engagement metrics
  response_count INT DEFAULT 0,
  click_count INT DEFAULT 0,

  -- Conversion metrics
  lead_status_changes INT DEFAULT 0,
  conversion_count INT DEFAULT 0,       -- Leads moved to 'Booking' or better

  -- Revenue impact
  revenue_generated DECIMAL(12, 2) DEFAULT 0,

  -- Calculated metrics
  delivery_rate DECIMAL(5, 2),          -- delivered / sent * 100
  engagement_rate DECIMAL(5, 2),        -- (responses + clicks) / delivered * 100
  conversion_rate DECIMAL(5, 2),        -- conversions / sent * 100

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, campaign_id, analytics_date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_analytics_project
  ON public.campaign_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign
  ON public.campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_date
  ON public.campaign_analytics(analytics_date DESC);

-- Enable RLS
ALTER TABLE public.campaign_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS campaign_analytics_select ON public.campaign_analytics
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS campaign_analytics_insert ON public.campaign_analytics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS campaign_analytics_update ON public.campaign_analytics
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'ceo', 'coo', 'admin')
    )
  );

-- ========================================
-- TABLE 4: MESSAGE TEMPLATES
-- ========================================
-- Reusable message templates for campaigns
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES public.projects(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,

  message_type VARCHAR(50) NOT NULL,      -- sms, email, line_message
  subject VARCHAR(255),                   -- For email
  body TEXT NOT NULL,

  -- Template variables e.g. {customer_name}, {project_name}
  variables TEXT,  -- JSON array of variable names

  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, name),
  CONSTRAINT chk_template_type CHECK (message_type IN ('sms', 'email', 'line_message', 'call'))
);

CREATE INDEX IF NOT EXISTS idx_message_templates_project
  ON public.message_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_type
  ON public.message_templates(message_type);
CREATE INDEX IF NOT EXISTS idx_message_templates_active
  ON public.message_templates(is_active) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS message_templates_select ON public.message_templates
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS message_templates_insert ON public.message_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS message_templates_update ON public.message_templates
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'ceo', 'coo', 'admin')
    )
  );

-- ========================================
-- TABLE 5: LEAD CAMPAIGN ENROLLMENT
-- ========================================
-- Track which leads are enrolled in which campaigns
CREATE TABLE IF NOT EXISTS public.lead_campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL,

  -- Enrollment status
  enrolled_at TIMESTAMP DEFAULT NOW(),
  last_message_sent_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Status: active, paused, completed, unsubscribed
  status VARCHAR(50) DEFAULT 'active',

  -- Sequence progress
  current_message_index INT DEFAULT 0,
  messages_sent_count INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(campaign_id, lead_id),
  CONSTRAINT chk_enrollment_status CHECK (status IN ('active', 'paused', 'completed', 'unsubscribed'))
);

CREATE INDEX IF NOT EXISTS idx_lead_campaign_enrollments_campaign
  ON public.lead_campaign_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lead_campaign_enrollments_lead
  ON public.lead_campaign_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_campaign_enrollments_status
  ON public.lead_campaign_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_lead_campaign_enrollments_active
  ON public.lead_campaign_enrollments(campaign_id, status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.lead_campaign_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS lead_campaign_enrollments_select ON public.lead_campaign_enrollments
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'sales', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS lead_campaign_enrollments_insert ON public.lead_campaign_enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'sales', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS lead_campaign_enrollments_update ON public.lead_campaign_enrollments
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('marketing', 'sales', 'ceo', 'coo', 'admin')
    )
  );
