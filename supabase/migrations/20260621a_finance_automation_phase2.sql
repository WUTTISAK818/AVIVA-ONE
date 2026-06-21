-- AVIVA ONE v6.55
-- Finance Automation Phase 2
-- Auto-schedule payments, Cash flow forecasting, Auto-approve expenses

-- ========================================
-- TABLE 1: PAYMENT INSTRUCTIONS
-- ========================================
-- Scheduled payment records created from approved payment vouchers
CREATE TABLE IF NOT EXISTS public.payment_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to payment voucher
  payment_voucher_id UUID NOT NULL REFERENCES public.payment_vouchers(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id),

  -- Payment details
  amount DECIMAL(12, 2) NOT NULL,
  to_account VARCHAR(50) NOT NULL,           -- Bank account number
  to_bank VARCHAR(100) NOT NULL,             -- Bank name
  description TEXT,

  -- Scheduling
  scheduled_date DATE NOT NULL,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending',      -- pending, approved, sent, failed
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP,
  sent_reference VARCHAR(100),               -- Reference from bank/payment system

  CONSTRAINT chk_payment_status CHECK (status IN ('pending', 'approved', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_payment_instructions_voucher
  ON public.payment_instructions(payment_voucher_id);
CREATE INDEX IF NOT EXISTS idx_payment_instructions_project
  ON public.payment_instructions(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_instructions_status
  ON public.payment_instructions(status);
CREATE INDEX IF NOT EXISTS idx_payment_instructions_scheduled_date
  ON public.payment_instructions(scheduled_date);

-- Enable RLS
ALTER TABLE public.payment_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS payment_instructions_select ON public.payment_instructions
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('finance', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS payment_instructions_insert ON public.payment_instructions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('finance', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS payment_instructions_update ON public.payment_instructions
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('finance', 'ceo', 'coo', 'admin')
    )
  );

-- ========================================
-- TABLE 2: CASH FLOW FORECAST
-- ========================================
-- Weekly cash flow forecast and risk analysis
CREATE TABLE IF NOT EXISTS public.cash_flow_forecast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES public.projects(id),
  forecast_date DATE NOT NULL,              -- Date forecast was generated

  -- Weekly breakdown (1-13 weeks ahead)
  week_number INTEGER NOT NULL,             -- 1-13
  week_start_date DATE NOT NULL,

  -- Flows
  expected_inflow DECIMAL(12, 2) DEFAULT 0,    -- Revenue from closed deals
  expected_outflow DECIMAL(12, 2) DEFAULT 0,   -- Payments to contractors
  net_position DECIMAL(12, 2) DEFAULT 0,       -- Inflow - Outflow

  -- Risk flags
  has_negative_position BOOLEAN DEFAULT FALSE,
  large_outflow_flag BOOLEAN DEFAULT FALSE,
  collection_delay_flag BOOLEAN DEFAULT FALSE,

  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, forecast_date, week_number)
);

CREATE INDEX IF NOT EXISTS idx_cash_flow_project
  ON public.cash_flow_forecast(project_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_forecast_date
  ON public.cash_flow_forecast(forecast_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_flow_week
  ON public.cash_flow_forecast(week_number);

-- Enable RLS
ALTER TABLE public.cash_flow_forecast ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS cash_flow_select ON public.cash_flow_forecast
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('finance', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS cash_flow_insert ON public.cash_flow_forecast
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('finance', 'ceo', 'coo', 'admin')
    )
  );

-- ========================================
-- TABLE 3: AUTO-APPROVED EXPENSES LOG
-- ========================================
-- Track expenses that were auto-approved and GL postings
CREATE TABLE IF NOT EXISTS public.auto_approved_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES public.projects(id),

  -- Expense details
  vendor_name VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  invoice_number VARCHAR(100),
  invoice_date DATE,

  -- GL Account
  gl_account_code VARCHAR(50),
  gl_account_name VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'auto_approved',  -- auto_approved, posted, failed

  -- GL Posting reference
  jv_number VARCHAR(100),                   -- Journal Voucher number if posted
  posted_at TIMESTAMP,

  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_expense_status CHECK (status IN ('auto_approved', 'posted', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_auto_approved_expenses_project
  ON public.auto_approved_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_auto_approved_expenses_status
  ON public.auto_approved_expenses(status);
CREATE INDEX IF NOT EXISTS idx_auto_approved_expenses_date
  ON public.auto_approved_expenses(created_at DESC);

-- Enable RLS
ALTER TABLE public.auto_approved_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS auto_approved_expenses_select ON public.auto_approved_expenses
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('finance', 'accounting', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS auto_approved_expenses_insert ON public.auto_approved_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('finance', 'accounting', 'ceo', 'coo', 'admin')
    )
  );

-- ========================================
-- TABLE 4: TRUSTED VENDORS WHITELIST
-- ========================================
-- List of vendors eligible for auto-approval
CREATE TABLE IF NOT EXISTS public.trusted_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES public.projects(id),

  vendor_name VARCHAR(255) NOT NULL,
  vendor_tax_id VARCHAR(50),

  -- Auto-approval settings
  max_auto_approve_amount DECIMAL(12, 2) DEFAULT 50000,
  is_trusted BOOLEAN DEFAULT TRUE,

  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, vendor_name)
);

CREATE INDEX IF NOT EXISTS idx_trusted_vendors_project
  ON public.trusted_vendors(project_id);
CREATE INDEX IF NOT EXISTS idx_trusted_vendors_trusted
  ON public.trusted_vendors(is_trusted) WHERE is_trusted = TRUE;

-- Enable RLS
ALTER TABLE public.trusted_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS trusted_vendors_select ON public.trusted_vendors
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('finance', 'accounting', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS trusted_vendors_insert ON public.trusted_vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('finance', 'ceo', 'coo', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS trusted_vendors_update ON public.trusted_vendors
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.app_users WHERE role IN ('finance', 'ceo', 'coo', 'admin')
    )
  );
