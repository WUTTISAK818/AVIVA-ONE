-- บันทึกคำถาม-คำตอบของผู้ช่วย AI (AVIVA Copilot) — ย้อนดู + สถิติผู้บริหาร
create table if not exists public.ai_chat_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  user_email text,
  user_name text,
  user_dept text,
  question text not null,
  answer text,
  source text not null default 'copilot',
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_chat_logs_created on public.ai_chat_logs(project_id, created_at desc);

alter table public.ai_chat_logs enable row level security;
drop policy if exists ai_logs_read on public.ai_chat_logs;
drop policy if exists ai_logs_insert on public.ai_chat_logs;
create policy ai_logs_read on public.ai_chat_logs for select to authenticated using (true);
create policy ai_logs_insert on public.ai_chat_logs for insert to authenticated with check (true);
