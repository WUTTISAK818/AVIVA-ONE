-- ============================================================
-- WinVote — schema แยกใน Supabase project "AVIVA PLUS" (azstncqpwyrabwvcuxjf)
-- รวม DDL ทั้งหมดที่ใช้สร้างระบบ WinVote บน schema `winvote`
-- (apply ผ่าน Supabase MCP เมื่อ 2026-06-21 — ไฟล์นี้เก็บไว้เพื่อ reproducibility)
--
-- ลำดับ:
--   1) schema + 8 ตาราง + constraints/indexes
--   2) grants + RLS + policies + เปิด exposed schema (PostgREST)
--   3) views (KPI 4 + strategy 2)
--   ตามด้วย seed-winvote-schema.sql (ข้อมูล 1 เทศบาล/4 เขต/98 ชุมชน/185 หน่วย/185 ผล)
-- ============================================================

-- ============================================================
-- 1) SCHEMA + TABLES
-- ============================================================
create schema if not exists winvote;

create table if not exists winvote.municipalities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists winvote.districts (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references winvote.municipalities(id) on delete cascade,
  code int not null,
  name text not null,
  resident_target int not null default 10000,
  created_at timestamptz not null default now(),
  created_by text,
  unique (municipality_id, code)
);

create table if not exists winvote.communities (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references winvote.districts(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  created_by text,
  unique (district_id, name)
);

create table if not exists winvote.polling_units (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references winvote.districts(id) on delete cascade,
  unit_no text not null,
  name text,
  location text,
  created_at timestamptz not null default now(),
  created_by text,
  unique (district_id, unit_no)
);

create table if not exists winvote.members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references winvote.communities(id) on delete cascade,
  full_name text not null,
  phone text,
  member_role text not null default 'team' check (member_role in ('president','team')),
  resident_quota int not null default 50,
  created_at timestamptz not null default now(),
  created_by text
);
-- 1 ชุมชน มีประธานได้คนเดียว (โค้ดแอปอ้างชื่อ constraint นี้ตรง ๆ ใน winvote/page.tsx)
create unique index if not exists winvote_one_president
  on winvote.members(community_id) where member_role = 'president';

create table if not exists winvote.residents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references winvote.members(id) on delete cascade,
  polling_unit_id uuid references winvote.polling_units(id) on delete set null,
  national_id text unique,
  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('male','female','other')),
  address text,
  phone text,
  phone_verified boolean not null default false,
  phone_verified_at timestamptz,
  phone_verify_channel text,
  line_user_id text,
  selfie_path text,
  capture_lat double precision,
  capture_lng double precision,
  captured_at timestamptz,
  capture_method text,
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists winvote_residents_member_idx on winvote.residents(member_id);
create index if not exists winvote_residents_pu_idx on winvote.residents(polling_unit_id);

create table if not exists winvote.unit_results (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references winvote.districts(id) on delete cascade,
  polling_unit_id uuid references winvote.polling_units(id) on delete cascade,
  unit_no int not null,
  election text not null default '2568',
  eligible int not null default 0,
  voted int not null default 0,
  v1 int not null default 0,
  v2 int not null default 0,
  v3 int not null default 0,
  v4 int not null default 0,
  created_at timestamptz not null default now(),
  unique (polling_unit_id, election)
);

create table if not exists winvote.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references winvote.residents(id) on delete cascade,
  phone text,
  token text unique,
  status text not null default 'pending' check (status in ('pending','verified','expired')),
  line_user_id text,
  verified_at timestamptz,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists winvote_pv_token_idx on winvote.phone_verifications(token);

-- ============================================================
-- 2) GRANTS + RLS + EXPOSE SCHEMA
-- ============================================================
grant usage on schema winvote to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema winvote to authenticated, service_role;
grant usage, select on all sequences in schema winvote to authenticated, service_role;
alter default privileges in schema winvote
  grant select, insert, update, delete on tables to authenticated, service_role;

alter table winvote.municipalities      enable row level security;
alter table winvote.districts           enable row level security;
alter table winvote.communities         enable row level security;
alter table winvote.polling_units       enable row level security;
alter table winvote.members             enable row level security;
alter table winvote.residents           enable row level security;
alter table winvote.unit_results        enable row level security;
alter table winvote.phone_verifications enable row level security;

-- ผู้ใช้ที่ login แล้ว (authenticated) เข้าถึงได้เต็ม — คุมสิทธิ์ระดับบทบาทที่ชั้นแอป
do $$
declare t text;
begin
  foreach t in array array[
    'municipalities','districts','communities','polling_units',
    'members','residents','unit_results','phone_verifications'
  ]
  loop
    execute format(
      'create policy %I on winvote.%I for all to authenticated using (true) with check (true);',
      'auth_all_'||t, t
    );
  end loop;
end $$;

-- เปิดให้ PostgREST (Data API) มองเห็น schema winvote (additive — คงของเดิมไว้)
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, winvote';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- ============================================================
-- 3) VIEWS (security_invoker=on เพื่อเคารพ RLS)
-- ============================================================
create or replace view winvote.municipality_summary with (security_invoker=on) as
select
  mu.id   as municipality_id,
  mu.name as municipality_name,
  (select count(*) from winvote.districts d where d.municipality_id=mu.id) as district_count,
  (select count(*) from winvote.communities c join winvote.districts d on d.id=c.district_id where d.municipality_id=mu.id) as community_count,
  (select count(*) from winvote.members m join winvote.communities c on c.id=m.community_id join winvote.districts d on d.id=c.district_id where d.municipality_id=mu.id and m.member_role='team') as team_count,
  (select count(*) from winvote.members m join winvote.communities c on c.id=m.community_id join winvote.districts d on d.id=c.district_id where d.municipality_id=mu.id and m.member_role='president') as president_count,
  (select count(*) from winvote.polling_units pu join winvote.districts d on d.id=pu.district_id where d.municipality_id=mu.id) as polling_unit_count,
  (select count(*) from winvote.residents r join winvote.members m on m.id=r.member_id join winvote.communities c on c.id=m.community_id join winvote.districts d on d.id=c.district_id where d.municipality_id=mu.id) as resident_count,
  (select coalesce(sum(d.resident_target),0) from winvote.districts d where d.municipality_id=mu.id) as total_target,
  (select count(*) from winvote.residents r join winvote.members m on m.id=r.member_id join winvote.communities c on c.id=m.community_id join winvote.districts d on d.id=c.district_id where d.municipality_id=mu.id and r.phone_verified) as verified_count
from winvote.municipalities mu;

create or replace view winvote.district_kpi with (security_invoker=on) as
select
  d.id            as district_id,
  d.municipality_id,
  d.code,
  d.name          as district_name,
  d.resident_target,
  (select count(*) from winvote.communities c where c.district_id=d.id) as community_count,
  (select count(*) from winvote.members m join winvote.communities c on c.id=m.community_id where c.district_id=d.id and m.member_role='team') as team_count,
  (select count(*) from winvote.polling_units pu where pu.district_id=d.id) as polling_unit_count,
  (select count(*) from winvote.residents r join winvote.members m on m.id=r.member_id join winvote.communities c on c.id=m.community_id where c.district_id=d.id) as resident_count,
  round((select count(*)::numeric from winvote.residents r join winvote.members m on m.id=r.member_id join winvote.communities c on c.id=m.community_id where c.district_id=d.id) / nullif(d.resident_target,0) * 100, 2) as pct_of_target,
  (select count(*) from winvote.residents r join winvote.members m on m.id=r.member_id join winvote.communities c on c.id=m.community_id where c.district_id=d.id and r.phone_verified) as verified_count
from winvote.districts d;

create or replace view winvote.community_rollup with (security_invoker=on) as
select
  c.id          as community_id,
  c.district_id,
  c.name        as community_name,
  (select m.full_name from winvote.members m where m.community_id=c.id and m.member_role='president' limit 1) as president_name,
  (select count(*) from winvote.members m where m.community_id=c.id and m.member_role='team') as team_count,
  (select count(*) from winvote.residents r join winvote.members m on m.id=r.member_id where m.community_id=c.id) as resident_count,
  (select count(*) from winvote.residents r join winvote.members m on m.id=r.member_id where m.community_id=c.id and r.phone_verified) as verified_count
from winvote.communities c;

create or replace view winvote.member_load with (security_invoker=on) as
select
  m.id          as member_id,
  m.community_id,
  m.full_name,
  m.member_role,
  m.resident_quota,
  (select count(*) from winvote.residents r where r.member_id=m.id) as resident_count,
  case
    when (select count(*) from winvote.residents r where r.member_id=m.id) >  m.resident_quota then 'over'
    when (select count(*) from winvote.residents r where r.member_id=m.id) >= ceil(m.resident_quota*0.8) then 'ok'
    else 'under'
  end as quota_status,
  (select count(*) from winvote.residents r where r.member_id=m.id and r.phone_verified) as verified_count
from winvote.members m;

-- ===== M5 Strategy views (จากผลคะแนนรายหน่วย) — เบอร์ 2 = ฝั่งเรา, เบอร์ 1 = คู่แข่งหลัก =====
create or replace view winvote.district_strategy with (security_invoker=on) as
select
  d.code                                                              as district_code,
  d.name                                                              as district_name,
  count(*)                                                            as unit_count,
  sum(ur.eligible)                                                    as eligible,
  sum(ur.voted)                                                       as voted,
  round(sum(ur.voted)::numeric / nullif(sum(ur.eligible),0) * 100, 2) as turnout_pct,
  sum(ur.v2)                                                          as our_votes,
  sum(ur.v1)                                                          as rival_votes,
  sum(ur.v3)                                                          as v3_votes,
  sum(ur.v4)                                                          as v4_votes,
  sum(ur.v2) - sum(ur.v1)                                             as margin,
  round((sum(ur.v2)-sum(ur.v1))::numeric / nullif(sum(ur.voted),0) * 100, 2) as margin_pct,
  round(sum(ur.v2)::numeric / nullif(sum(ur.voted),0) * 100, 2)       as our_share_pct,
  count(*) filter (where ur.v2 <= ur.v1)                             as units_at_risk
from winvote.districts d
join winvote.unit_results ur on ur.district_id = d.id
group by d.code, d.name;

create or replace view winvote.unit_strategy with (security_invoker=on) as
select
  d.code                       as district_code,
  pu.unit_no,
  pu.name                      as unit_name,
  pu.location,
  ur.eligible,
  ur.voted,
  ur.v2                        as our_votes,
  ur.v1                        as rival_votes,
  ur.v2 - ur.v1                as margin,
  round((ur.v2-ur.v1)::numeric / nullif(ur.voted,0) * 100, 2) as margin_pct,
  case
    when ur.v2 <= ur.v1 then 'at_risk'
    when (ur.v2-ur.v1)::numeric / nullif(ur.voted,0) < 0.10 then 'close'
    else 'safe'
  end                          as status
from winvote.unit_results ur
join winvote.polling_units pu on pu.id = ur.polling_unit_id
join winvote.districts     d  on d.id  = ur.district_id;

grant select on all tables in schema winvote to authenticated, service_role;
