-- AVIVA ONE v6.55 - Marketing Automation Phase 3 (FIXED)
-- Tables: marketing_campaigns, marketing_messages, campaign_analytics, message_templates

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  lead_status_filter VARCHAR(100),
  sequence_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  campaign_start_date DATE,
  campaign_end_date DATE,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_project ON public.marketing_campaigns(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_active ON public.marketing_campaigns(is_active) WHERE is_active = TRUE;

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketing_campaigns_select ON public.marketing_campaigns;
CREATE POLICY marketing_campaigns_select ON public.marketing_campaigns
  FOR SELECT USING (auth.jwt()->>'role' IN ('marketing', 'sales', 'ceo', 'coo', 'admin'));

DROP POLICY IF EXISTS marketing_campaigns_insert ON public.marketing_campaigns;
CREATE POLICY marketing_campaigns_insert ON public.marketing_campaigns
  FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('marketing', 'ceo', 'coo', 'admin'));

DROP POLICY IF EXISTS marketing_campaigns_update ON public.marketing_campaigns;
CREATE POLICY marketing_campaigns_update ON public.marketing_campaigns
  FOR UPDATE USING (auth.jwt()->>'role' IN ('marketing', 'ceo', 'coo', 'admin'));

-- Marketing Messages
CREATE TABLE IF NOT EXISTS public.marketing_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  lead_id UUID NOT NULL,
  lead_name VARCHAR(255),
  lead_phone VARCHAR(20),
  lead_email VARCHAR(255),
  message_type VARCHAR(50) NOT NULL,
  subject VARCHAR(255),
  content TEXT NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'scheduled',
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_message_type CHECK (message_type IN ('sms', 'email', 'line_message', 'call')),
  CONSTRAINT chk_message_status CHECK (status IN ('scheduled', 'sending', 'sent', 'failed', 'bounced'))
);

CREATE INDEX IF NOT EXISTS idx_marketing_messages_campaign ON public.marketing_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_messages_status ON public.marketing_messages(status);

ALTER TABLE public.marketing_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketing_messages_select ON public.marketing_messages;
CREATE POLICY marketing_messages_select ON public.marketing_messages
  FOR SELECT USING (auth.jwt()->>'role' IN ('marketing', 'sales', 'ceo', 'coo', 'admin'));

DROP POLICY IF EXISTS marketing_messages_insert ON public.marketing_messages;
CREATE POLICY marketing_messages_insert ON public.marketing_messages
  FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('marketing', 'ceo', 'coo', 'admin'));

-- Campaign Analytics
CREATE TABLE IF NOT EXISTS public.campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_messages_sent INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  response_rate DECIMAL(5, 2) DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign ON public.campaign_analytics(campaign_id);

ALTER TABLE public.campaign_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_analytics_select ON public.campaign_analytics;
CREATE POLICY campaign_analytics_select ON public.campaign_analytics
  FOR SELECT USING (auth.jwt()->>'role' IN ('marketing', 'sales', 'ceo', 'coo', 'admin'));

-- Message Templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  template_name VARCHAR(255) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,
  variables JSONB,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, template_name)
);

CREATE INDEX IF NOT EXISTS idx_message_templates_project ON public.message_templates(project_id);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS message_templates_select ON public.message_templates;
CREATE POLICY message_templates_select ON public.message_templates
  FOR SELECT USING (auth.jwt()->>'role' IN ('marketing', 'sales', 'ceo', 'coo', 'admin'));

DROP POLICY IF EXISTS message_templates_insert ON public.message_templates;
CREATE POLICY message_templates_insert ON public.message_templates
  FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('marketing', 'ceo', 'coo', 'admin'));

GRANT SELECT, INSERT, UPDATE ON public.marketing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketing_messages TO authenticated;
GRANT SELECT, INSERT ON public.campaign_analytics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.message_templates TO authenticated;
