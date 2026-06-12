-- ================================================================
-- AVIVA ONE — Phase 0b: Private buckets for financial/document files
-- วันที่: 11 มิ.ย. 2569 | applied ผ่าน Supabase MCP apply_migration
-- ================================================================
-- บริบท: bucket การเงิน/เอกสาร เป็น public → ใครมี URL เปิดดูได้ (ใบเสร็จ/สัญญา/สลิป)
-- แก้: เปลี่ยนเป็น private + อ่านผ่าน signed URL (authenticated เท่านั้น)
-- โค้ดฝั่งแอปแปลง file_url -> signed URL ด้วย src/lib/storage.ts (toSignedUrl)
-- จุด display ที่อัปเดต: AttachDocButton, ApprovalVerifyModal, reports/page
-- ================================================================

update storage.buckets set public = false
where id in ('document-attachments','aviva-slips','aviva-parcels','aviva-incidents');

drop policy if exists "Public read document-attachments" on storage.objects;
create policy "Auth read document-attachments" on storage.objects
  for select to authenticated using (bucket_id = 'document-attachments');

drop policy if exists "Auth upload document-attachments" on storage.objects;
create policy "Auth upload document-attachments" on storage.objects
  for insert to authenticated with check (bucket_id = 'document-attachments');

drop policy if exists "aviva uploads read" on storage.objects;
create policy "aviva uploads read auth" on storage.objects
  for select to authenticated
  using (bucket_id = any (array['aviva-slips','aviva-parcels','aviva-incidents']));

-- ================================================================
-- คงเหลือ Phase 1: photo buckets (activity-photos, crm-photos, installment-photos,
--   construction-daily-photos) ยัง public — ความอ่อนไหวต่ำกว่า ทำต่อภายหลัง
-- ================================================================
