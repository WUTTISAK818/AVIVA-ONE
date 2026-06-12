-- ================================================================
-- AVIVA ONE — Phase 0c (step 1): photo buckets เป็น private + signed URL
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP
-- ================================================================
-- bucket: activity-photos, crm-photos, installment-photos -> private
-- อ่านผ่าน signed URL (component SignedImg ใช้ toSignedUrl)
-- construction-daily-photos ยกไป step 2 (มีเคส print HTML)
-- ================================================================
update storage.buckets set public = false where id in ('activity-photos','crm-photos','installment-photos');

drop policy if exists "Public read activity-photos" on storage.objects;
create policy "Auth read activity-photos" on storage.objects for select to authenticated using (bucket_id='activity-photos');
drop policy if exists "Auth upload activity-photos" on storage.objects;
create policy "Auth upload activity-photos" on storage.objects for insert to authenticated with check (bucket_id='activity-photos');

drop policy if exists "Public read crm-photos" on storage.objects;
create policy "Auth read crm-photos" on storage.objects for select to authenticated using (bucket_id='crm-photos');
drop policy if exists "Auth upload crm-photos" on storage.objects;
create policy "Auth upload crm-photos" on storage.objects for insert to authenticated with check (bucket_id='crm-photos');

drop policy if exists "allow_public_read_photos" on storage.objects;
create policy "auth_read_installment_photos" on storage.objects for select to authenticated using (bucket_id='installment-photos');
