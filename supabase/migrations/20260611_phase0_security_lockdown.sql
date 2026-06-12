-- ================================================================
-- AVIVA ONE — Phase 0 Security Lockdown (RLS anon access)
-- วันที่: 11 มิ.ย. 2569 | ใช้แล้วผ่าน Supabase MCP apply_migration
-- ================================================================
-- บริบท: ผลตรวจคณะทำงานพบว่าตาราง PII/การเงิน/HR เปิดให้ anon (ไม่ล็อกอิน)
--   อ่าน/เขียนได้ผ่าน anon key — ละเมิด PDPA ม.37 และมาตรฐานบริษัทมหาชน
-- หลักการแก้: ตัดสิทธิ์ anon/public ออก คงสิทธิ์ authenticated เดิมทุกประการ
--   (หน้า public /track ใช้ service-role bypass RLS จึงไม่กระทบ)
-- ================================================================

-- A) ตัด anonymous SELECT บนตาราง PII/การเงิน (มี policy authenticated รองรับแล้ว)
DROP POLICY IF EXISTS anon_read ON public.leads;
DROP POLICY IF EXISTS anon_read ON public.customers;
DROP POLICY IF EXISTS anon_read ON public.users;
DROP POLICY IF EXISTS anon_read ON public.finance_transactions;
DROP POLICY IF EXISTS anon_read ON public.houses;
DROP POLICY IF EXISTS anon_read ON public.projects;
DROP POLICY IF EXISTS anon_read ON public.construction_reports;

-- B) แปลง policy {public} ALL using(true) -> authenticated เท่านั้น (พฤติกรรม authenticated เหมือนเดิม)
DROP POLICY IF EXISTS allow_all_approvals ON public.approvals;
CREATE POLICY approvals_authenticated_all ON public.approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_audit ON public.audit_log;
CREATE POLICY audit_authenticated_all ON public.audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_commissions ON public.commissions;
CREATE POLICY commissions_authenticated_all ON public.commissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_contracts ON public.contracts;
CREATE POLICY contracts_authenticated_all ON public.contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_employees ON public.employees;
CREATE POLICY employees_authenticated_all ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_invoices ON public.invoices;
CREATE POLICY invoices_authenticated_all ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_journal ON public.journal_entries;
CREATE POLICY journal_authenticated_all ON public.journal_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS marketing_budgets_all ON public.marketing_budgets;
CREATE POLICY marketing_budgets_authenticated_all ON public.marketing_budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_payments ON public.payments;
CREATE POLICY payments_authenticated_all ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_receipts ON public.receipts;
CREATE POLICY receipts_authenticated_all ON public.receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_salary ON public.salary_records;
CREATE POLICY salary_authenticated_all ON public.salary_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- C) ตารางที่มีแต่ anon_read -> ให้ authenticated เต็มสิทธิ์ + ตัด anon
DROP POLICY IF EXISTS anon_read ON public.sales_activities;
CREATE POLICY sales_activities_auth_all ON public.sales_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS anon_read ON public.qc_defects;
CREATE POLICY qc_defects_auth_all ON public.qc_defects FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS anon_read ON public.ai_logs;
CREATE POLICY ai_logs_auth_all ON public.ai_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- คงเหลือสำหรับ Phase 1 (ต้องตรวจ read-path ก่อน):
--   - contractor_installments / installment_tasks : {public} SELECT true (ยอดจ่ายผู้รับเหมา)
--   - events : {public} SELECT true (ปฏิทิน)
--   - Storage buckets : เปลี่ยนเป็น private + signed URL (กระทบโค้ดแสดงรูป)
--   - RLS scoping ตาม project_id/role + RPC อนุมัติฝั่ง DB + ผูก user_id
-- ================================================================
