-- ================================================================
-- AVIVA ONE — Phase 0c (step 2): construction-daily-photos private + signed URL
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP
-- ================================================================
-- โค้ด: รายงานก่อสร้าง direct display ใช้ SignedImg, เคส print pre-sign URL
--   (เปิด window ก่อน await กัน popup blocker)
-- ================================================================
update storage.buckets set public = false where id = 'construction-daily-photos';

drop policy if exists "Public read construction-daily-photos" on storage.objects;
drop policy if exists "allow_public_read_construction" on storage.objects;
create policy "auth_read_construction_daily" on storage.objects
  for select to authenticated using (bucket_id='construction-daily-photos');

drop policy if exists "auth_upload_construction_daily" on storage.objects;
create policy "auth_upload_construction_daily" on storage.objects
  for insert to authenticated with check (bucket_id='construction-daily-photos');
