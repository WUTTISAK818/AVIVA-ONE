/**
 * Database Schema Migration — Critical Gaps Infrastructure
 *
 * Add columns and tables needed for:
 * 1. Finance Auto-Sync
 * 2. Contractor Notification
 * 3. SLA Visual Alert
 * 4. Specification Lock
 */

-- ═════════════════════════════════════════════════════════════════════════════════
-- 1️⃣ FINANCE AUTO-SYNC Tables & Columns
-- ═════════════════════════════════════════════════════════════════════════════════

-- Add columns to construction_unit_progress for payment tracking
ALTER TABLE public.construction_unit_progress ADD COLUMN IF NOT EXISTS
  days_late INTEGER DEFAULT 0;

ALTER TABLE public.construction_unit_progress ADD COLUMN IF NOT EXISTS
  expected_completion_date DATE;

ALTER TABLE public.construction_unit_progress ADD COLUMN IF NOT EXISTS
  last_milestone_approved_at TIMESTAMP;

-- Payment Vouchers table
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  house_id UUID NOT NULL REFERENCES public.houses(id),
  contractor_id UUID NOT NULL,

  milestone_id UUID,
  stage_name VARCHAR(100),

  base_amount DECIMAL(12, 2) NOT NULL,
  days_late INTEGER DEFAULT 0,
  daily_penalty_rate DECIMAL(10, 2) DEFAULT 0,
  penalty_amount DECIMAL(12, 2) DEFAULT 0,

  gross_amount DECIMAL(12, 2) NOT NULL,
  tax_3percent DECIMAL(12, 2) DEFAULT 0,
  retention_rate DECIMAL(5, 2) DEFAULT 5.0,
  retention_amount DECIMAL(12, 2) DEFAULT 0,
  net_amount DECIMAL(12, 2) NOT NULL,

  status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, approved, paid, rejected
  submitted_by UUID,
  submitted_at TIMESTAMP,
  approved_by UUID,
  approved_at TIMESTAMP,
  rejected_reason TEXT,
  paid_at TIMESTAMP,
  paid_reference VARCHAR(100),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_status CHECK (status IN ('draft', 'submitted', 'approved', 'paid', 'rejected'))
);

CREATE INDEX idx_payment_vouchers_project ON public.payment_vouchers(project_id);
CREATE INDEX idx_payment_vouchers_contractor ON public.payment_vouchers(contractor_id);
CREATE INDEX idx_payment_vouchers_status ON public.payment_vouchers(status);

-- Contractor Contracts table
CREATE TABLE IF NOT EXISTS public.contractor_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  contractor_id UUID NOT NULL,

  contract_type VARCHAR(50) DEFAULT 'full', -- full, labor_only
  total_contract_value DECIMAL(12, 2),
  number_of_milestones INTEGER,
  payment_per_milestone DECIMAL(12, 2),

  contractual_days_per_stage INTEGER DEFAULT 30,
  daily_penalty_rate DECIMAL(10, 2) DEFAULT 0,
  retention_rate DECIMAL(5, 2) DEFAULT 5.0,

  contract_start_date DATE,
  contract_end_date DATE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contractor_contracts_project ON public.contractor_contracts(project_id);

-- ═════════════════════════════════════════════════════════════════════════════════
-- 2️⃣ CONTRACTOR NOTIFICATION Tables & Columns
-- ═════════════════════════════════════════════════════════════════════════════════

-- Contractor Contact Info
CREATE TABLE IF NOT EXISTS public.contractor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL,

  phone_number VARCHAR(20),
  email VARCHAR(255),
  line_user_id VARCHAR(255),
  line_display_name VARCHAR(255),

  notify_via_line BOOLEAN DEFAULT TRUE,
  notify_via_email BOOLEAN DEFAULT TRUE,
  notify_via_sms BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(contractor_id)
);

CREATE INDEX idx_contractor_contacts_contractor ON public.contractor_contacts(contractor_id);

-- Notification Log
CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  recipient_type VARCHAR(50), -- contractor, engineer, project_manager, director, ceo
  recipient_id UUID,

  event_type VARCHAR(100), -- milestone_approved, milestone_rejected, payment_approved, sla_alert, spec_changed

  project_id UUID REFERENCES public.projects(id),
  house_id UUID REFERENCES public.houses(id),
  construction_progress_id UUID,
  payment_voucher_id UUID,

  subject VARCHAR(255),
  message TEXT,

  channel VARCHAR(50), -- line, email, sms, in_app
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, read

  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notification_log_recipient ON public.notification_log(recipient_id);
CREATE INDEX idx_notification_log_event ON public.notification_log(event_type);
CREATE INDEX idx_notification_log_status ON public.notification_log(status);

-- ═════════════════════════════════════════════════════════════════════════════════
-- 3️⃣ SLA VISUAL ALERT Tables & Columns
-- ═════════════════════════════════════════════════════════════════════════════════

-- Already have days_late in construction_unit_progress (added above)

-- SLA Alert History
CREATE TABLE IF NOT EXISTS public.sla_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  construction_progress_id UUID NOT NULL,
  house_id UUID NOT NULL,
  project_id UUID NOT NULL,

  alert_level VARCHAR(50), -- yellow (8-14 days), red (15-30 days), critical (31+ days)
  days_late INTEGER,

  notified_to_roles TEXT[], -- {project_manager, director, ceo}
  notified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sla_alert_house ON public.sla_alert_history(house_id);
CREATE INDEX idx_sla_alert_level ON public.sla_alert_history(alert_level);

-- ═════════════════════════════════════════════════════════════════════════════════
-- 4️⃣ SPECIFICATION LOCK Tables & Columns
-- ═════════════════════════════════════════════════════════════════════════════════

-- Add columns to houses table for spec lock
ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS
  spec_locked_at TIMESTAMP;

ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS
  spec_locked_by UUID;

-- Specification Change Order (CO) table
CREATE TABLE IF NOT EXISTS public.spec_change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  house_id UUID NOT NULL REFERENCES public.houses(id),

  change_order_number VARCHAR(50) UNIQUE, -- CO-2569-001

  requested_by UUID NOT NULL,
  requested_at TIMESTAMP DEFAULT NOW(),

  description TEXT NOT NULL,
  reason TEXT,
  impact_on_price DECIMAL(12, 2),
  impact_on_timeline SMALLINT, -- days

  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, implemented
  approved_by UUID,
  approved_at TIMESTAMP,
  rejected_reason TEXT,

  implemented_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_co_status CHECK (status IN ('pending', 'approved', 'rejected', 'implemented'))
);

CREATE INDEX idx_spec_change_orders_house ON public.spec_change_orders(house_id);
CREATE INDEX idx_spec_change_orders_status ON public.spec_change_orders(status);

-- Specification Audit Log
CREATE TABLE IF NOT EXISTS public.spec_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  house_id UUID NOT NULL REFERENCES public.houses(id),

  field_changed VARCHAR(100), -- material_type, color, layout, etc.
  old_value TEXT,
  new_value TEXT,

  changed_by UUID NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW(),

  change_type VARCHAR(50), -- edit, lock, unlock, change_order
  change_order_id UUID REFERENCES public.spec_change_orders(id),

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_spec_audit_log_house ON public.spec_audit_log(house_id);

-- ═════════════════════════════════════════════════════════════════════════════════
-- Permissions & RLS Policies (optional - กำหนดตามที่ต้อง)
-- ═════════════════════════════════════════════════════════════════════════════════

-- ให้ contractor เห็นเฉพาะของตัวเอง
CREATE POLICY contractor_payment_vouchers ON payment_vouchers
  FOR SELECT USING (contractor_id = auth.uid());

-- ให้ finance เห็น payment vouchers ที่ status != draft
CREATE POLICY finance_payment_vouchers ON payment_vouchers
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('admin', 'finance_manager', 'coo', 'ceo')
  );
