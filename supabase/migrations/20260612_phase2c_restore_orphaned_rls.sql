-- ================================================================
-- AVIVA ONE — Phase 2c: คืน policy ตารางที่ RLS เปิดแต่ไม่มี policy
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP
-- ================================================================
-- 13 ตาราง RLS-on + 0 policy = authenticated เข้าไม่ได้ (ฟีเจอร์พังเงียบ)
-- verify จากซอร์ส: เพิ่ม policy เฉพาะตารางที่ client/แอปเรียกจริง
-- ตารางที่แอปไม่อ้างถึง (accounting_entries/construction_logs/payroll_runs/
--   stock_transactions) คงล็อกไว้ — ปลอดภัย โดยเฉพาะ payroll_runs (HR)
-- ================================================================
create policy customer_installments_auth on public.customer_installments for all to authenticated using (true) with check (true);
create policy purchase_orders_auth        on public.purchase_orders        for all to authenticated using (true) with check (true);
create policy installment_inspections_auth on public.installment_inspections for all to authenticated using (true) with check (true);
create policy installment_templates_auth  on public.installment_templates  for all to authenticated using (true) with check (true);
create policy installment_work_items_auth on public.installment_work_items for all to authenticated using (true) with check (true);
create policy leave_requests_auth         on public.leave_requests         for all to authenticated using (true) with check (true);
create policy goods_receipts_auth         on public.goods_receipts         for all to authenticated using (true) with check (true);
create policy entity_documents_auth       on public.entity_documents       for all to authenticated using (true) with check (true);
-- ai_rate_limits: API route (ai-chat) ใช้ anon-key client
create policy ai_rate_limits_rw on public.ai_rate_limits for all to anon, authenticated using (true) with check (true);
