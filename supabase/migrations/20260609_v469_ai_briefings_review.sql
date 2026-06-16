-- v4.69 Phase 2: ผู้บริหารรับทราบ/สั่งการบนบรีฟ + ให้แก้ไขสถานะได้
alter table ai_briefings add column if not exists status      text not null default 'new'; -- 'new' | 'acknowledged' | 'actioned'
alter table ai_briefings add column if not exists reviewed_by text;
alter table ai_briefings add column if not exists reviewed_at timestamptz;
alter table ai_briefings add column if not exists exec_note   text;

create policy "auth update ai_briefings" on ai_briefings for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
