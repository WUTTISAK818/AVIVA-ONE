-- ═══════════════════════════════════════════════════════════════════════════════
-- AVIVA ONE - Internal Messaging System
-- ครอบคลุม: Direct Messages, Announcements, Task Assignments
-- Version: 1.0
-- ═══════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. MESSAGE CHANNELS (กลุ่มแชท)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.message_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  channel_type VARCHAR(50) NOT NULL, -- 'team', 'department', 'project', 'group'

  -- Context
  department VARCHAR(100),
  project_id UUID REFERENCES public.projects(id),

  -- Members
  member_ids UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Metadata
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channels_type ON public.message_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_channels_department ON public.message_channels(department);
CREATE INDEX IF NOT EXISTS idx_channels_project ON public.message_channels(project_id);

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. MESSAGES (Direct Messages + Group Chat)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sender info
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name VARCHAR(255),
  sender_avatar_url TEXT,

  -- Message type
  message_type VARCHAR(50) NOT NULL DEFAULT 'direct', -- 'direct', 'group', 'channel'

  -- Recipients
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- สำหรับ DM
  channel_id UUID REFERENCES public.message_channels(id) ON DELETE CASCADE, -- สำหรับ group/channel

  -- Content
  content TEXT NOT NULL,

  -- File attachments: [{url: string, name: string, type: string, size: number}]
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Engagement
  is_pinned BOOLEAN DEFAULT FALSE,
  read_by_ids UUID[] DEFAULT '{}', -- ผู้ที่อ่านแล้ว

  -- Soft delete
  is_deleted BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_type ON public.messages(message_type);

-- ════════════════════════════════════════════════════════════════════════════════
-- 3. ANNOUNCEMENTS (ประกาศ)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,

  -- Metadata
  announcement_type VARCHAR(50) NOT NULL DEFAULT 'info', -- 'urgent', 'info', 'update', 'policy'
  priority VARCHAR(50) DEFAULT 'medium', -- 'high', 'medium', 'low'

  -- Author
  announced_by UUID NOT NULL REFERENCES auth.users(id),
  announced_by_name VARCHAR(255),
  announced_by_role VARCHAR(100),

  -- Target audience
  target_roles VARCHAR(100)[] DEFAULT '{}', -- ['all', 'manager', 'sales', 'construction']
  target_departments VARCHAR(100)[] DEFAULT '{}',
  target_user_ids UUID[] DEFAULT '{}',

  -- File attachments
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Read tracking: {user_id: timestamp}
  read_by JSONB DEFAULT '{}'::jsonb,
  read_count INT DEFAULT 0,

  -- Timing
  published_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,

  -- Status
  is_archived BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_archived ON public.announcements(is_archived);

-- ════════════════════════════════════════════════════════════════════════════════
-- 4. TASK ASSIGNMENTS (สั่งงาน)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Task info
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Assignment
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_by_name VARCHAR(255),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  assigned_to_name VARCHAR(255),
  assigned_to_email VARCHAR(255),

  -- Priority & Timeline
  task_priority VARCHAR(50) DEFAULT 'medium', -- 'urgent', 'high', 'medium', 'low'
  status VARCHAR(50) DEFAULT 'assigned', -- 'assigned', 'in_progress', 'completed', 'cancelled'

  due_date DATE,
  due_time TIME,

  -- Tracking
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Related record (optional)
  related_record_id UUID,
  related_record_type VARCHAR(50), -- 'house', 'lead', 'payment_voucher', 'qc_defect'

  -- File attachments
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.task_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.task_assignments(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.task_assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.task_assignments(task_priority);

-- ════════════════════════════════════════════════════════════════════════════════
-- 5. TASK COMMENTS (ความเห็นในงาน)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  task_id UUID NOT NULL REFERENCES public.task_assignments(id) ON DELETE CASCADE,

  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_name VARCHAR(255),

  comment_text TEXT NOT NULL,

  attachments JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user ON public.task_comments(user_id);

-- ════════════════════════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ════════════════════════════════════════════════════════════════════════════════

-- Message Channels
ALTER TABLE public.message_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY channel_select ON public.message_channels
  FOR SELECT TO authenticated
  USING (auth.uid() = ANY(member_ids) OR auth.uid() = created_by);

CREATE POLICY channel_insert ON public.message_channels
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY channel_update ON public.message_channels
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

-- Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
    OR auth.uid() = ANY((SELECT member_ids FROM public.message_channels WHERE id = message_channels.id))
  );

CREATE POLICY message_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY message_delete ON public.messages
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- Announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcement_select ON public.announcements
  FOR SELECT TO authenticated
  USING (TRUE); -- ทุกคนเห็นประกาศ

CREATE POLICY announcement_insert ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director')
    )
  );

CREATE POLICY announcement_update ON public.announcements
  FOR UPDATE TO authenticated
  USING (auth.uid() = announced_by);

-- Task Assignments
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_select ON public.task_assignments
  FOR SELECT TO authenticated
  USING (
    auth.uid() = assigned_to
    OR auth.uid() = assigned_by
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director')
    )
  );

CREATE POLICY task_insert ON public.task_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = assigned_by
    AND (
      auth.uid() = ANY(SELECT member_ids FROM public.message_channels LIMIT 1)
      OR EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_app_meta_data->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director')
      )
    )
  );

CREATE POLICY task_update ON public.task_assignments
  FOR UPDATE TO authenticated
  USING (auth.uid() = assigned_to OR auth.uid() = assigned_by);

-- Task Comments
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_comment_select ON public.task_comments
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT assigned_to FROM public.task_assignments WHERE id = task_id
      UNION
      SELECT assigned_by FROM public.task_assignments WHERE id = task_id
    )
  );

CREATE POLICY task_comment_insert ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════════
-- 7. HELPER FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════════════

-- Function: Mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_read(
  p_message_ids UUID[],
  p_user_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE public.messages
  SET
    read_by_ids = array_append(read_by_ids, p_user_id),
    updated_at = NOW()
  WHERE id = ANY(p_message_ids)
  AND NOT p_user_id = ANY(read_by_ids);
END;
$$ LANGUAGE plpgsql;

-- Function: Mark announcement as read
CREATE OR REPLACE FUNCTION public.mark_announcement_read(
  p_announcement_id UUID,
  p_user_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE public.announcements
  SET
    read_by = read_by || jsonb_build_object(p_user_id::text, NOW()::text),
    read_count = read_count + 1,
    updated_at = NOW()
  WHERE id = p_announcement_id
  AND NOT read_by ? p_user_id::text;
END;
$$ LANGUAGE plpgsql;

-- Function: Get unread message count
CREATE OR REPLACE FUNCTION public.get_unread_count(p_user_id UUID)
RETURNS TABLE (unread_messages INT, unread_tasks INT, unread_announcements INT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT m.id)::INT as unread_messages,
    COUNT(DISTINCT t.id)::INT as unread_tasks,
    COUNT(DISTINCT a.id)::INT as unread_announcements
  FROM public.messages m
  FULL OUTER JOIN public.task_assignments t ON t.assigned_to = p_user_id AND t.status != 'completed'
  FULL OUTER JOIN public.announcements a ON NOT a.read_by ? p_user_id::text AND a.expires_at IS NULL OR a.expires_at > NOW()
  WHERE (m.recipient_id = p_user_id AND NOT p_user_id = ANY(m.read_by_ids))
  OR (t.assigned_to = p_user_id)
  OR (a.id IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════════════════════════
-- 8. DEFAULT CHANNELS (สร้างทีม/แผนกหลัก)
-- ════════════════════════════════════════════════════════════════════════════════

-- Insert default channels (run after auth.users table has admin user)
-- These will be populated via application startup script
INSERT INTO public.message_channels (name, description, channel_type, department, created_by, member_ids)
VALUES
  ('general', 'ข้อความทั่วไป และประกาศ', 'team', NULL, (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' LIMIT 1), '{}'),
  ('sales', 'ฝ่ายขาย - ประสานงาน', 'department', 'sales', (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' LIMIT 1), '{}'),
  ('construction', 'ฝ่ายก่อสร้าง - ประสานงาน', 'department', 'construction', (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' LIMIT 1), '{}'),
  ('finance', 'ฝ่ายการเงิน - ประสานงาน', 'department', 'finance', (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' LIMIT 1), '{}'),
  ('hr', 'ฝ่ายบุคคล - ประสานงาน', 'department', 'hr', (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' LIMIT 1), '{}'),
  ('announcements', 'ประกาศจากผู้บริหาร', 'team', NULL, (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' LIMIT 1), '{}')
ON CONFLICT (name) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════════
-- END: INTERNAL MESSAGING SYSTEM MIGRATION
-- ════════════════════════════════════════════════════════════════════════════════
