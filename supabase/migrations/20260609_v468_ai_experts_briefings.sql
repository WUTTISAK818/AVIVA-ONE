-- v4.68 — AI ผู้ช่วยเชิงรุกประจำฝ่าย (Phase 1) + รองรับ council/executive (Phase 2)

-- ผู้เชี่ยวชาญ AI ประจำฝ่าย (ตั้งค่าได้ใน settings)
create table if not exists ai_experts (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid,
  dept        text not null,
  expert_name text not null default '',
  focus       text not null default '',
  persona     text not null default '',
  model       text not null default 'claude-opus-4-8',
  is_active   boolean not null default true,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  unique (project_id, dept)
);
alter table ai_experts enable row level security;
create policy "auth read ai_experts"   on ai_experts for select using (auth.role() = 'authenticated');
create policy "auth write ai_experts"  on ai_experts for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- บรีฟที่ AI สร้าง (เก็บประวัติ + ใช้ใน cron/หน้าแสดงผล)
create table if not exists ai_briefings (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid,
  scope        text not null default 'dept',        -- 'dept' | 'executive'
  dept         text,                                  -- null เมื่อ scope='executive'
  period_type  text not null default 'adhoc',        -- 'daily' | 'weekly' | 'monthly' | 'adhoc'
  title        text not null default '',
  summary      text not null default '',
  highlights   jsonb not null default '[]'::jsonb,    -- รายการน่าสนใจ
  weekly_plan  jsonb not null default '[]'::jsonb,    -- แผนสัปดาห์
  monthly_plan jsonb not null default '[]'::jsonb,    -- แผนเดือน
  raw          jsonb,                                 -- payload เต็มจาก AI
  model        text,
  generated_by text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_ai_briefings_dept    on ai_briefings(dept, created_at desc);
create index if not exists idx_ai_briefings_scope   on ai_briefings(scope, created_at desc);
alter table ai_briefings enable row level security;
create policy "auth read ai_briefings"  on ai_briefings for select using (auth.role() = 'authenticated');
create policy "auth write ai_briefings" on ai_briefings for insert with check (auth.role() = 'authenticated');
