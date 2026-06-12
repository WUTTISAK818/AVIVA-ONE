-- ================================================================
-- AVIVA ONE — Phase 2: scope writes บนตารางการเงิน/HR อ่อนไหว
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP
-- ================================================================
-- เดิม: FOR ALL TO authenticated USING(true) = พนักงานคนไหนก็เขียนได้
-- verify write-path จากโค้ดก่อนทำ:
--   salary_records  : แอปไม่อ้างเลย -> จำกัดทุก op (admin/ceo/hr)
--   การเงิน register : เขียนจากหน้า accounting เท่านั้น -> SELECT เปิด, write จำกัด
--   เว้น mixed-writer: finance_transactions, revenue_recognition, approval_logs
--   (เขียนหลายแผนก office+crm+construction — scope จะพัง; approval_logs มี trigger คุมอยู่แล้ว)
-- ================================================================
drop policy if exists salary_authenticated_all on public.salary_records;
create policy salary_hr_only on public.salary_records for all to authenticated
  using  (public.auth_user_role(auth.uid()) in ('admin','ceo','hr'))
  with check (public.auth_user_role(auth.uid()) in ('admin','ceo','hr'));

-- payments / vat_register / wht_certificates / sbt_register / tax_invoices:
-- SELECT to authenticated USING(true); INSERT/UPDATE/DELETE จำกัด finance/accountant/admin/ceo
-- (ดูสคริปต์เต็มที่ applied ผ่าน MCP — pattern เดียวกันทุกตาราง)
