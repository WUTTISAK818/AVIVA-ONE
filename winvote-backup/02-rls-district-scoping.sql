-- ============================================================
-- WinVote — RLS แยกตามเขต (district-scoped)  [แก้ช่องวิกฤต C2]
-- เดิม policy เป็น using(true) -> ใครล็อกอินก็เห็นข้อมูลประชาชนทุกเขต
-- ใหม่: admin/exec เห็นทุกเขต · สตาฟ/หัวหน้าทีม เห็นเฉพาะเขตที่ map ไว้
-- ⚠️ ต้องทดสอบด้วย JWT non-admin ยิง PostgREST ตรง ก่อนถือว่าใช้ได้
-- รันหลัง 01-voter-roll.sql
-- ============================================================

-- 1) map ผู้ใช้ -> เขตที่ดูได้
create table if not exists winvote.user_districts (
  user_id uuid not null references auth.users(id) on delete cascade,
  district_id uuid not null references winvote.districts(id) on delete cascade,
  primary key (user_id, district_id)
);
alter table winvote.user_districts enable row level security;
grant select, insert, update, delete on winvote.user_districts to authenticated, service_role;
drop policy if exists user_districts_self on winvote.user_districts;
create policy user_districts_self on winvote.user_districts for select to authenticated
  using (user_id = auth.uid() or (auth.jwt()->'user_metadata'->>'role') in ('admin','exec','ceo'));

-- 2) helper functions
create or replace function winvote.is_admin() returns boolean language sql stable as $$
  select coalesce((auth.jwt()->'user_metadata'->>'role') in ('admin','exec','ceo'), false);
$$;
create or replace function winvote.can_see_district(d uuid) returns boolean language sql stable as $$
  select winvote.is_admin() or exists (
    select 1 from winvote.user_districts ud where ud.user_id = auth.uid() and ud.district_id = d
  );
$$;

-- 3) แทนที่ policy using(true) เดิม ด้วย policy แยกเขต
-- districts (ฐานของทุกอย่าง)
drop policy if exists auth_all_districts on winvote.districts;
create policy districts_scoped on winvote.districts for all to authenticated
  using (winvote.can_see_district(id)) with check (true);

-- communities
drop policy if exists auth_all_communities on winvote.communities;
create policy communities_scoped on winvote.communities for all to authenticated
  using (winvote.can_see_district(district_id)) with check (true);

-- polling_units
drop policy if exists auth_all_polling_units on winvote.polling_units;
create policy polling_units_scoped on winvote.polling_units for all to authenticated
  using (winvote.can_see_district(district_id)) with check (true);

-- unit_results
drop policy if exists auth_all_unit_results on winvote.unit_results;
create policy unit_results_scoped on winvote.unit_results for all to authenticated
  using (winvote.can_see_district(district_id)) with check (true);

-- members (ผ่าน community -> district)
drop policy if exists auth_all_members on winvote.members;
create policy members_scoped on winvote.members for all to authenticated
  using (winvote.is_admin() or exists (
    select 1 from winvote.communities c
    where c.id = members.community_id and winvote.can_see_district(c.district_id)
  )) with check (true);

-- residents (ผ่าน member -> community -> district) — จุดที่สำคัญสุด (PII)
drop policy if exists auth_all_residents on winvote.residents;
create policy residents_scoped on winvote.residents for all to authenticated
  using (winvote.is_admin() or exists (
    select 1 from winvote.members m
    join winvote.communities c on c.id = m.community_id
    where m.id = residents.member_id and winvote.can_see_district(c.district_id)
  )) with check (true);

-- municipalities + phone_verifications: ยังคงเปิดให้ authenticated (ไม่ใช่ PII ระดับบุคคล / ผูก resident ผ่าน RLS อยู่แล้ว)
-- หมายเหตุ: ต้องเติม winvote.user_districts ให้สตาฟแต่ละคนก่อน ไม่งั้น non-admin จะไม่เห็นข้อมูลใดเลย
