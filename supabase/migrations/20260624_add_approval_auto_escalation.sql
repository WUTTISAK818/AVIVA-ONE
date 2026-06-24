-- Phase 2.2: Auto-Escalation for Overdue Approvals
-- ตัดปัญหา: SLA exceeded → no auto-escalation, approvals stuck 2-3 days

-- ================================
-- 1. Add escalation tracking to approval_logs
-- ================================
alter table if exists public.approval_logs
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_count integer default 0,
  add column if not exists escalated_to_role text;

-- ================================
-- 2. Create escalation_history table
-- ================================
create table if not exists public.approval_escalation_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  approval_id uuid not null references public.approval_logs(approval_id) on delete cascade,
  escalation_number integer not null, -- 1st, 2nd, 3rd escalation
  escalated_from_role text not null, -- manager
  escalated_to_role text not null,   -- admin
  escalation_reason text, -- 'SLA_EXCEEDED_8H', 'SLA_EXCEEDED_24H'
  escalation_time timestamptz default now(),
  notification_sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_approval_escalation_history
  on public.approval_escalation_history(project_id, approval_id, escalation_time desc);

alter table public.approval_escalation_history enable row level security;

drop policy if exists approval_escalation_history_select on public.approval_escalation_history;
create policy approval_escalation_history_select on public.approval_escalation_history
  for select to authenticated using (project_id = 'aaaaaaaa-0000-0000-0000-000000000001');

-- ================================
-- 3. Function: Auto-escalate overdue approvals
-- ================================
create or replace function public.fn_auto_escalate_overdue_approvals()
returns table(
  approval_id uuid,
  workflow_type text,
  escalation_reason text,
  escalated_at timestamptz
)
language plpgsql
security definer
as $$
declare
  v_approval record;
  v_sla_due_at timestamptz;
  v_hours_overdue numeric;
  v_escalation_reason text;
  v_escalation_number integer;
begin
  -- Find approvals past SLA with no escalation yet
  for v_approval in
    select
      al.approval_id,
      al.workflow_type,
      al.submitted_at,
      al.sla_due_at,
      al.action_taken,
      al.escalation_count
    from public.approval_logs al
    where al.project_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and al.action_taken is null
      and al.sla_due_at < now()
      and al.escalation_count < 3 -- Max 3 escalations
  loop
    v_hours_overdue := (extract(epoch from (now() - v_approval.sla_due_at)) / 3600)::numeric;

    -- Determine escalation reason
    if v_hours_overdue > 24 then
      v_escalation_reason := 'SLA_EXCEEDED_24H';
    elsif v_hours_overdue > 8 then
      v_escalation_reason := 'SLA_EXCEEDED_8H';
    else
      v_escalation_reason := 'SLA_EXCEEDED';
    end if;

    v_escalation_number := v_approval.escalation_count + 1;

    -- Record escalation
    insert into public.approval_escalation_history (
      project_id,
      approval_id,
      escalation_number,
      escalated_from_role,
      escalated_to_role,
      escalation_reason
    ) values (
      'aaaaaaaa-0000-0000-0000-000000000001',
      v_approval.approval_id,
      v_escalation_number,
      'manager',
      'admin',
      v_escalation_reason
    );

    -- Update approval_logs
    update public.approval_logs
    set
      escalated_at = now(),
      escalation_count = v_escalation_number,
      escalated_to_role = 'admin'
    where approval_id = v_approval.approval_id;

    -- Return result for notification
    return query select
      v_approval.approval_id,
      v_approval.workflow_type,
      v_escalation_reason,
      now()::timestamptz;
  end loop;
end;
$$;

-- ================================
-- 4. Scheduled job (Cron): Run escalation check daily at 9:00 AM
-- ================================
-- Note: Supabase uses pg_cron extension
-- This runs the escalation function daily
-- In production, configure via Supabase UI: Database > Cron Jobs

-- INSERT INTO cron.job (
--   schedule,
--   command,
--   jobname
-- ) VALUES (
--   '0 9 * * *', -- Every day at 9 AM
--   'SELECT public.fn_auto_escalate_overdue_approvals();',
--   'auto_escalate_overdue_approvals'
-- ) ON CONFLICT (jobname) DO UPDATE
-- SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ================================
-- 5. Function: Send escalation notification
-- ================================
create or replace function public.fn_notify_escalation(
  p_approval_id uuid,
  p_workflow_type text,
  p_escalation_reason text
)
returns void
language plpgsql
security definer
as $$
declare
  v_admin_email text;
  v_title text;
  v_message text;
begin
  v_title := p_workflow_type || ' - Escalated (Overdue)';
  v_message := 'Approval ' || p_approval_id || ' escalated due to ' || p_escalation_reason;

  -- Send notification to admin work_queue
  insert into public.work_queue (
    project_id,
    workflow_type,
    source_record_id,
    source_doc_index,
    title,
    amount,
    assigned_role,
    priority,
    sla_due_at,
    created_at
  ) values (
    'aaaaaaaa-0000-0000-0000-000000000001',
    p_workflow_type,
    p_approval_id,
    null,
    v_title,
    null,
    'admin',
    'high', -- Escalated = high priority
    now() + interval '1 day',
    now()
  )
  on conflict do nothing;

  -- Create notification
  insert into public.notifications (
    project_id,
    type,
    title,
    message,
    link,
    is_read,
    created_at
  ) values (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'approval',
    v_title,
    v_message,
    '/approvals?filter=escalated',
    false,
    now()
  );
end;
$$;

-- ================================
-- 6. Index for performance
-- ================================
create index if not exists idx_approval_logs_sla_check
  on public.approval_logs(action_taken, sla_due_at)
  where action_taken is null;
