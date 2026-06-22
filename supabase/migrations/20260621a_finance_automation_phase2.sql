-- AVIVA ONE v6.55 - Finance Automation Phase 2 (FIXED)
-- Tables: payment_instructions, cash_flow_forecast, auto_approved_expenses, trusted_vendors

CREATE TABLE IF NOT EXISTS public.payment_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_voucher_id UUID REFERENCES public.payment_vouchers(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id),
  amount DECIMAL(12, 2) NOT NULL,
  to_account VARCHAR(50),
  to_bank VARCHAR(100),
  description TEXT,
  scheduled_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP,
  sent_reference VARCHAR(100),
  CONSTRAINT chk_payment_status CHECK (status IN ('pending', 'approved', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_payment_instructions_project ON public.payment_instructions(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_instructions_status ON public.payment_instructions(status);
CREATE INDEX IF NOT EXISTS idx_payment_instructions_scheduled_date ON public.payment_instructions(scheduled_date);

ALTER TABLE public.payment_instructions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_instructions_select ON public.payment_instructions;
CREATE POLICY payment_instructions_select ON public.payment_instructions
  FOR SELECT USING (auth.jwt()->>'role' IN ('finance', 'ceo', 'coo', 'admin'));

DROP POLICY IF EXISTS payment_instructions_insert ON public.payment_instructions;
CREATE POLICY payment_instructions_insert ON public.payment_instructions
  FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('finance', 'ceo', 'coo', 'admin'));

-- ========================================
-- Cash Flow Forecast Table
-- ========================================
CREATE TABLE IF NOT EXISTS public.cash_flow_forecast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  forecast_date DATE NOT NULL,
  week_number INTEGER NOT NULL,
  week_start_date DATE NOT NULL,
  expected_inflow DECIMAL(12, 2) DEFAULT 0,
  expected_outflow DECIMAL(12, 2) DEFAULT 0,
  net_position DECIMAL(12, 2) DEFAULT 0,
  has_negative_position BOOLEAN DEFAULT FALSE,
  large_outflow_flag BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, forecast_date, week_number)
);

CREATE INDEX IF NOT EXISTS idx_cash_flow_project ON public.cash_flow_forecast(project_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_forecast_date ON public.cash_flow_forecast(forecast_date DESC);

ALTER TABLE public.cash_flow_forecast ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_flow_select ON public.cash_flow_forecast;
CREATE POLICY cash_flow_select ON public.cash_flow_forecast
  FOR SELECT USING (auth.jwt()->>'role' IN ('finance', 'ceo', 'coo', 'admin'));

DROP POLICY IF EXISTS cash_flow_insert ON public.cash_flow_forecast;
CREATE POLICY cash_flow_insert ON public.cash_flow_forecast
  FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('finance', 'ceo', 'coo', 'admin'));

-- ========================================
-- Auto-Approved Expenses Log
-- ========================================
CREATE TABLE IF NOT EXISTS public.auto_approved_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  vendor_name VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  invoice_number VARCHAR(100),
  invoice_date DATE,
  gl_account_code VARCHAR(50),
  status VARCHAR(50) DEFAULT 'auto_approved',
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_expense_status CHECK (status IN ('auto_approved', 'posted', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_auto_approved_expenses_project ON public.auto_approved_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_auto_approved_expenses_status ON public.auto_approved_expenses(status);

ALTER TABLE public.auto_approved_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auto_approved_expenses_select ON public.auto_approved_expenses;
CREATE POLICY auto_approved_expenses_select ON public.auto_approved_expenses
  FOR SELECT USING (auth.jwt()->>'role' IN ('finance', 'accounting', 'ceo', 'coo', 'admin'));

DROP POLICY IF EXISTS auto_approved_expenses_insert ON public.auto_approved_expenses;
CREATE POLICY auto_approved_expenses_insert ON public.auto_approved_expenses
  FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('finance', 'accounting', 'ceo', 'coo', 'admin'));

-- ========================================
-- Trusted Vendors Whitelist
-- ========================================
CREATE TABLE IF NOT EXISTS public.trusted_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  vendor_name VARCHAR(255) NOT NULL,
  vendor_tax_id VARCHAR(50),
  max_auto_approve_amount DECIMAL(12, 2) DEFAULT 50000,
  is_trusted BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, vendor_name)
);

CREATE INDEX IF NOT EXISTS idx_trusted_vendors_project ON public.trusted_vendors(project_id);
CREATE INDEX IF NOT EXISTS idx_trusted_vendors_trusted ON public.trusted_vendors(is_trusted) WHERE is_trusted = TRUE;

ALTER TABLE public.trusted_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trusted_vendors_select ON public.trusted_vendors;
CREATE POLICY trusted_vendors_select ON public.trusted_vendors
  FOR SELECT USING (auth.jwt()->>'role' IN ('finance', 'accounting', 'ceo', 'coo', 'admin'));

DROP POLICY IF EXISTS trusted_vendors_insert ON public.trusted_vendors;
CREATE POLICY trusted_vendors_insert ON public.trusted_vendors
  FOR INSERT WITH CHECK (auth.jwt()->>'role' IN ('finance', 'ceo', 'coo', 'admin'));

DROP POLICY IF EXISTS trusted_vendors_update ON public.trusted_vendors;
CREATE POLICY trusted_vendors_update ON public.trusted_vendors
  FOR UPDATE USING (auth.jwt()->>'role' IN ('finance', 'ceo', 'coo', 'admin'));

GRANT SELECT, INSERT, UPDATE ON public.payment_instructions TO authenticated;
GRANT SELECT, INSERT ON public.cash_flow_forecast TO authenticated;
GRANT SELECT, INSERT ON public.auto_approved_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trusted_vendors TO authenticated;
