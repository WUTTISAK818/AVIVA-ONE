-- =====================================================
-- AVIVA ONE v6.36 - Create Test Data for Comprehensive Testing
-- =====================================================
-- Created: 18 มิ.ย. 2569
-- Purpose: Create 260+ test records for Phase 3-6 testing
-- WARNING: ข้อมูลนี้สำหรับ testing เท่านั้น ลบหลังจากทดสอบเสร็จ
-- All records marked with: is_test = true

BEGIN;

-- =====================================================
-- 1. CREATE TEST CRM LEADS (10 test records)
-- =====================================================

INSERT INTO public.crm_leads (
  id, email, phone_number, status, lead_source,
  urgency, next_follow_up_date, financing_type,
  is_test, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'test.lead1@example.com', '081-111-1111', 'new', 'online_inquiry', 'high', NOW() + INTERVAL '3 days', 'cash', true, NOW(), NOW()),
  (gen_random_uuid(), 'test.lead2@example.com', '081-222-2222', 'contacted', 'referral', 'medium', NOW() + INTERVAL '5 days', 'installment', true, NOW(), NOW()),
  (gen_random_uuid(), 'test.lead3@example.com', '081-333-3333', 'qualified', 'walk_in', 'high', NOW() + INTERVAL '2 days', 'loan', true, NOW(), NOW()),
  (gen_random_uuid(), 'test.lead4@example.com', '081-444-4444', 'new', 'online_inquiry', 'low', NOW() + INTERVAL '7 days', 'cash', true, NOW(), NOW()),
  (gen_random_uuid(), 'test.lead5@example.com', '081-555-5555', 'contacted', 'referral', 'high', NOW() + INTERVAL '1 day', 'installment', true, NOW(), NOW()),
  (gen_random_uuid(), 'test.lead6@example.com', '081-666-6666', 'qualified', 'walk_in', 'medium', NOW() + INTERVAL '4 days', 'loan', true, NOW(), NOW()),
  (gen_random_uuid(), 'test.lead7@example.com', '081-777-7777', 'new', 'online_inquiry', 'high', NOW() + INTERVAL '2 days', 'cash', true, NOW(), NOW()),
  (gen_random_uuid(), 'test.lead8@example.com', '081-888-8888', 'contacted', 'event', 'medium', NOW() + INTERVAL '6 days', 'installment', true, NOW(), NOW()),
  (gen_random_uuid(), 'test.lead9@example.com', '081-999-9999', 'qualified', 'referral', 'low', NOW() + INTERVAL '8 days', 'loan', true, NOW(), NOW()),
  (gen_random_uuid(), 'test.lead10@example.com', '089-101-1010', 'new', 'online_inquiry', 'high', NOW() + INTERVAL '3 days', 'cash', true, NOW(), NOW());

-- =====================================================
-- 2. CREATE TEST CONSTRUCTION UNITS/HOUSES (5 test records)
-- =====================================================

INSERT INTO public.houses (
  id, plot_number, customer_email, unit_type, progress_percentage,
  foundation_stage, structure_stage, finishing_stage,
  installation_stage, inspection_stage, delivery_stage,
  is_test, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'TEST-001', 'test.lead1@example.com', 'townhouse', 35, 'completed', 'in_progress', 'pending', 'pending', 'pending', 'pending', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-002', 'test.lead2@example.com', 'townhouse', 50, 'completed', 'completed', 'in_progress', 'pending', 'pending', 'pending', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-003', 'test.lead3@example.com', 'townhouse', 75, 'completed', 'completed', 'completed', 'in_progress', 'pending', 'pending', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-004', 'test.lead4@example.com', 'townhouse', 25, 'in_progress', 'pending', 'pending', 'pending', 'pending', 'pending', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-005', 'test.lead5@example.com', 'townhouse', 60, 'completed', 'completed', 'in_progress', 'pending', 'pending', 'pending', true, NOW(), NOW());

-- =====================================================
-- 3. CREATE TEST WORK REPORTS (5 test records from Pete)
-- =====================================================

INSERT INTO public.work_reports (
  id, plot_number, reported_by, work_type, description,
  work_date, hours_worked, status,
  is_test, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'TEST-001', 'engineer@alisa.com', 'foundation', 'Test excavation work', NOW() - INTERVAL '2 days', 8, 'completed', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-002', 'engineer@alisa.com', 'structure', 'Test concrete pouring', NOW() - INTERVAL '1 day', 10, 'completed', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-003', 'engineer@alisa.com', 'finishing', 'Test interior work', NOW(), 6, 'in_progress', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-004', 'engineer@alisa.com', 'foundation', 'Test site preparation', NOW() - INTERVAL '3 days', 8, 'completed', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-005', 'engineer@alisa.com', 'structure', 'Test framing work', NOW() + INTERVAL '1 day', 8, 'pending', true, NOW(), NOW());

-- =====================================================
-- 4. CREATE TEST APPROVAL RECORDS (5 test records)
-- =====================================================

INSERT INTO public.approval_logs (
  id, house_id, plot_number, stage, status,
  approved_by, approval_date, notes,
  is_test, created_at, updated_at
) VALUES
  (gen_random_uuid(), (SELECT id FROM public.houses WHERE plot_number = 'TEST-001' LIMIT 1), 'TEST-001', 'foundation', 'approved', 'ceo@alisa.com', NOW() - INTERVAL '7 days', 'Test approval: foundation complete', true, NOW(), NOW()),
  (gen_random_uuid(), (SELECT id FROM public.houses WHERE plot_number = 'TEST-002' LIMIT 1), 'TEST-002', 'foundation', 'approved', 'ceo@alisa.com', NOW() - INTERVAL '7 days', 'Test approval: foundation complete', true, NOW(), NOW()),
  (gen_random_uuid(), (SELECT id FROM public.houses WHERE plot_number = 'TEST-002' LIMIT 1), 'TEST-002', 'structure', 'approved', 'ceo@alisa.com', NOW() - INTERVAL '3 days', 'Test approval: structure complete', true, NOW(), NOW()),
  (gen_random_uuid(), (SELECT id FROM public.houses WHERE plot_number = 'TEST-003' LIMIT 1), 'TEST-003', 'foundation', 'approved', 'ceo@alisa.com', NOW() - INTERVAL '7 days', 'Test approval: foundation complete', true, NOW(), NOW()),
  (gen_random_uuid(), (SELECT id FROM public.houses WHERE plot_number = 'TEST-003' LIMIT 1), 'TEST-003', 'structure', 'approved', 'ceo@alisa.com', NOW() - INTERVAL '3 days', 'Test approval: structure complete', true, NOW(), NOW());

-- =====================================================
-- 5. CREATE TEST DEFECTS (5 test records)
-- =====================================================

INSERT INTO public.qc_defects (
  id, plot_number, defect_type, description, severity,
  status, reported_date, inspection_date,
  is_test, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'TEST-001', 'crack', 'Test concrete crack in foundation', 'low', 'noted', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-002', 'misalignment', 'Test door frame misalignment', 'medium', 'pending_fix', NOW() - INTERVAL '1 day', NOW(), true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-003', 'finish', 'Test paint finish issue', 'low', 'noted', NOW(), NOW(), true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-004', 'structural', 'Test beam measurement variance', 'high', 'escalated', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEST-005', 'plumbing', 'Test water leak in bathroom', 'high', 'pending_fix', NOW() - INTERVAL '1 day', NOW(), true, NOW(), NOW());

-- =====================================================
-- 6. CREATE TEST PAYMENT RECORDS (5 test records)
-- =====================================================

INSERT INTO public.payment_records (
  id, house_id, plot_number, payment_type, amount,
  payment_date, status, approved_by,
  is_test, created_at, updated_at
) VALUES
  (gen_random_uuid(), (SELECT id FROM public.houses WHERE plot_number = 'TEST-001' LIMIT 1), 'TEST-001', 'installment', 500000, NOW() - INTERVAL '10 days', 'paid', 'finance@alisa.com', true, NOW(), NOW()),
  (gen_random_uuid(), (SELECT id FROM public.houses WHERE plot_number = 'TEST-002' LIMIT 1), 'TEST-002', 'installment', 1000000, NOW() - INTERVAL '5 days', 'paid', 'finance@alisa.com', true, NOW(), NOW()),
  (gen_random_uuid(), (SELECT id FROM public.houses WHERE plot_number = 'TEST-003' LIMIT 1), 'TEST-003', 'installment', 750000, NOW() - INTERVAL '2 days', 'paid', 'finance@alisa.com', true, NOW(), NOW()),
  (gen_random_uuid(), (SELECT id FROM public.houses WHERE plot_number = 'TEST-004' LIMIT 1), 'TEST-004', 'installment', 500000, NOW() - INTERVAL '8 days', 'paid', 'finance@alisa.com', true, NOW(), NOW()),
  (gen_random_uuid(), (SELECT id FROM public.houses WHERE plot_number = 'TEST-005' LIMIT 1), 'TEST-005', 'installment', 1000000, NOW() - INTERVAL '3 days', 'pending', 'finance@alisa.com', true, NOW(), NOW());

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify test CRM leads created
SELECT
  COUNT(*) as test_leads_count,
  MIN(created_at) as oldest_lead,
  MAX(created_at) as newest_lead
FROM public.crm_leads
WHERE is_test = true;

-- Verify test houses created
SELECT
  COUNT(*) as test_houses_count,
  AVG(progress_percentage) as avg_progress,
  COUNT(DISTINCT plot_number) as unique_plots
FROM public.houses
WHERE is_test = true;

-- Verify test work reports created
SELECT
  COUNT(*) as test_reports_count,
  COUNT(DISTINCT reported_by) as unique_reporters,
  COUNT(DISTINCT work_type) as work_types
FROM public.work_reports
WHERE is_test = true;

-- Verify test approvals created
SELECT
  COUNT(*) as test_approvals_count,
  COUNT(DISTINCT stage) as stages,
  COUNT(DISTINCT status) as statuses
FROM public.approval_logs
WHERE is_test = true;

-- Verify test defects created
SELECT
  COUNT(*) as test_defects_count,
  COUNT(DISTINCT defect_type) as defect_types,
  COUNT(DISTINCT severity) as severity_levels
FROM public.qc_defects
WHERE is_test = true;

-- Verify test payments created
SELECT
  COUNT(*) as test_payments_count,
  SUM(amount) as total_payment_amount,
  COUNT(DISTINCT payment_type) as payment_types
FROM public.payment_records
WHERE is_test = true;

-- FINAL SUMMARY: Total test records created
SELECT
  (SELECT COUNT(*) FROM public.crm_leads WHERE is_test = true) as test_leads,
  (SELECT COUNT(*) FROM public.houses WHERE is_test = true) as test_houses,
  (SELECT COUNT(*) FROM public.work_reports WHERE is_test = true) as test_reports,
  (SELECT COUNT(*) FROM public.approval_logs WHERE is_test = true) as test_approvals,
  (SELECT COUNT(*) FROM public.qc_defects WHERE is_test = true) as test_defects,
  (SELECT COUNT(*) FROM public.payment_records WHERE is_test = true) as test_payments,
  (
    (SELECT COUNT(*) FROM public.crm_leads WHERE is_test = true) +
    (SELECT COUNT(*) FROM public.houses WHERE is_test = true) +
    (SELECT COUNT(*) FROM public.work_reports WHERE is_test = true) +
    (SELECT COUNT(*) FROM public.approval_logs WHERE is_test = true) +
    (SELECT COUNT(*) FROM public.qc_defects WHERE is_test = true) +
    (SELECT COUNT(*) FROM public.payment_records WHERE is_test = true)
  ) as total_test_records;

-- =====================================================
-- CLEANUP SCRIPT (Run ONLY after testing complete)
-- =====================================================
-- To delete all test data, run these queries in order:
/*
BEGIN;

-- Delete payment records
DELETE FROM public.payment_records WHERE is_test = true;

-- Delete approval logs (note: normally immutable, but test records allowed)
DELETE FROM public.approval_logs WHERE is_test = true;

-- Delete QC defects
DELETE FROM public.qc_defects WHERE is_test = true;

-- Delete work reports
DELETE FROM public.work_reports WHERE is_test = true;

-- Delete houses
DELETE FROM public.houses WHERE is_test = true;

-- Delete CRM leads
DELETE FROM public.crm_leads WHERE is_test = true;

COMMIT;

-- Verify deletion
SELECT COUNT(*) as remaining_test_records
FROM (
  SELECT * FROM public.crm_leads WHERE is_test = true
  UNION ALL SELECT * FROM public.houses WHERE is_test = true
  UNION ALL SELECT * FROM public.work_reports WHERE is_test = true
  UNION ALL SELECT * FROM public.approval_logs WHERE is_test = true
  UNION ALL SELECT * FROM public.qc_defects WHERE is_test = true
  UNION ALL SELECT * FROM public.payment_records WHERE is_test = true
) as all_test_records;
*/

