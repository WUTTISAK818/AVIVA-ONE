-- ================================================================
-- AVIVA ONE — Phase 3b: pin search_path=public ให้ฟังก์ชัน SECURITY INVOKER
-- วันที่: 12 มิ.ย. 2569 | applied ผ่าน Supabase MCP
-- ทั้งหมดเป็น INVOKER + อ้าง public objects -> ปลอดภัย, เคลียร์ 17 warning
-- ================================================================
alter function public.auth_role() set search_path = public;
alter function public.compile_daily_report(p_date date) set search_path = public;
alter function public.current_resident_id() set search_path = public;
alter function public.generate_employee_code() set search_path = public;
alter function public.generate_lead_code() set search_path = public;
alter function public.get_cash_flow_summary(p_days integer) set search_path = public;
alter function public.get_construction_progress() set search_path = public;
alter function public.get_sales_summary(p_year integer, p_month integer) set search_path = public;
alter function public.next_doc_number(p_workflow_type text) set search_path = public;
alter function public.normalize_plate(p text) set search_path = public;
alter function public.prevent_approval_log_delete() set search_path = public;
alter function public.set_grn_number() set search_path = public;
alter function public.set_po_number() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.submit_daily_report(p_report_id uuid) set search_path = public;
alter function public.trg_set_doc_number() set search_path = public;
alter function public.v9_audit_trigger() set search_path = public;
