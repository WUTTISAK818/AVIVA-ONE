-- v5.0 Phase 4: workflow events log (for SLA reminders / escalation audit)
create table if not exists workflow_events (
  id          uuid primary key default gen_random_uuid(),
  log_id      text,
  event_type  text not null,
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_wf_events_log on workflow_events(log_id);
create index if not exists idx_wf_events_created on workflow_events(created_at);
alter table workflow_events enable row level security;
create policy "auth can read workflow_events"
  on workflow_events for select using (auth.role() = 'authenticated');
