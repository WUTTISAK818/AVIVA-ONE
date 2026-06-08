-- v5.0 Phase 3: LINE links, contractors, contractor contact on houses

create table if not exists line_links (
  id          uuid primary key default gen_random_uuid(),
  user_email  text,
  line_user_id text unique,
  link_code   text,
  linked      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_line_links_code on line_links(link_code);

create table if not exists contractors (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null default 'aaaaaaaa-0000-0000-0000-000000000001',
  name          text not null,
  phone         text,
  line_user_id  text,
  ref_code      text unique,
  created_at    timestamptz not null default now()
);
create index if not exists idx_contractors_ref on contractors(ref_code);

alter table houses add column if not exists contractor_phone   text;
alter table houses add column if not exists contractor_line_id text;

alter table line_links  enable row level security;
alter table contractors enable row level security;

create policy "auth can manage line_links"
  on line_links for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth can read contractors"
  on contractors for select using (auth.role() = 'authenticated');
create policy "auth can manage contractors"
  on contractors for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
