-- Create notification_rules table
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Trigger condition
  event_type TEXT NOT NULL, -- 'daily', 'time_based', 'task_based', 'deadline'
  trigger_time TIME, -- for daily reminders (e.g., 06:00, 17:30)
  trigger_condition JSONB, -- { taskType: 'sales_follow_up', priority: 'high', daysOverdue: 3 }
  
  -- Recipient
  recipients_role TEXT[], -- ['manager', 'director', 'sales_lead'] or specific user
  recipients_department TEXT[], -- ['sales', 'construction', 'accounting']
  
  -- Notification content
  title_template TEXT, -- "{{ daysOverdue }} tasks pending"
  message_template TEXT, -- "You have {{ count }} tasks overdue"
  
  -- Channels
  send_to_app BOOLEAN DEFAULT true,
  send_to_line BOOLEAN DEFAULT false,
  send_to_email BOOLEAN DEFAULT false,
  
  -- Importance
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  is_active BOOLEAN DEFAULT true,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table (sent notifications history)
CREATE TABLE IF NOT EXISTS notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES notification_rules(id),
  
  recipient_id UUID REFERENCES auth.users(id),
  recipient_email TEXT,
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  channels_sent TEXT[], -- ['app', 'line', 'email']
  
  read_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  action_url TEXT,
  
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_preferences table (user can customize)
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES notification_rules(id),
  
  enabled BOOLEAN DEFAULT true,
  mute_until TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notification_rules_active ON notification_rules(is_active);
CREATE INDEX idx_notification_rules_event_type ON notification_rules(event_type);
CREATE INDEX idx_notifications_sent_recipient ON notifications_sent(recipient_id);
CREATE INDEX idx_notifications_sent_rule ON notifications_sent(rule_id);
CREATE INDEX idx_notifications_sent_sent_at ON notifications_sent(sent_at);
CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

-- RLS
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view notification rules" ON notification_rules
  FOR SELECT USING (true);

CREATE POLICY "Only admins can create/update rules" ON notification_rules
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'ceo', 'coo', 'manager', 'director'));

CREATE POLICY "Users can view own notifications" ON notifications_sent
  FOR SELECT USING (recipient_id = auth.uid() OR auth_role() IN ('admin', 'ceo', 'coo'));

CREATE POLICY "Users can update own notification preferences" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());
