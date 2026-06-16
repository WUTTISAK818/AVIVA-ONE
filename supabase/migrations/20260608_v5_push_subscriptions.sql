-- v5.0 Phase 2: Web Push subscriptions
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_email  text not null,
  role        text,
  department  text,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_push_sub_dept on push_subscriptions(department);
create index if not exists idx_push_sub_email on push_subscriptions(user_email);

alter table push_subscriptions enable row level security;
create policy "owner can manage own push subscription"
  on push_subscriptions for all
  using (auth.jwt() ->> 'email' = user_email)
  with check (auth.jwt() ->> 'email' = user_email);
