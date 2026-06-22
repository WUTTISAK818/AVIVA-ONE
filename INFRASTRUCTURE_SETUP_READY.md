# 🔧 INFRASTRUCTURE SETUP - READY TO EXECUTE
## ทำให้เสร็จใน 30 นาที

**Status:** ✅ All commands prepared, copy-paste ready  
**Time:** 22 มิถุนายน 2569 | 19:30 น. (UTC+7)

---

## 📍 STEP 1: SUPABASE MIGRATIONS (15 นาที)

### Location:
```
https://app.supabase.com
→ Select: AVIVA ONE project
→ Go to: SQL Editor
```

### Migration 1 (Copy/Paste/Run)
**Name:** Receipt OCR System  
**Time:** 2 นาที  
**Size:** 11KB

```sql
-- Receipt OCR System (Phase 1)
-- Tables: documents, general_ledger, expenses

-- ============================================================================
-- 1. Documents table (for receipt/invoice/bill metadata)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  file_path text NOT NULL,
  file_name text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('receipt', 'invoice', 'bill')),
  extracted_data jsonb, -- { date, vendor_name, items, subtotal, vat, total, payment_method, vendor_tax_id, extracted_confidence, extraction_model, gl_suggestion }
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready_for_approval', 'review_needed', 'extraction_failed', 'upload_failed', 'pending_approval', 'saved')),
  linked_to uuid, -- expense_id or gl_entry_id
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_project ON public.documents(project_id);
CREATE INDEX idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);

-- RLS: Users can only see own documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT USING (uploaded_by = auth.uid() OR auth.jwt()->>'role' = 'admin');
CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT WITH CHECK (uploaded_by = auth.uid() AND auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director', 'accounting', 'finance'));
CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE USING (uploaded_by = auth.uid() OR auth.jwt()->>'role' = 'admin');

-- ============================================================================
-- 2. General Ledger table (for GL account entries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.general_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type text, -- 'receipt', 'invoice', 'transfer', etc.
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  account_code text NOT NULL, -- GL account code (e.g., '5201', '6100')
  description text NOT NULL,
  debit_amount numeric(12, 2) NOT NULL DEFAULT 0,
  credit_amount numeric(12, 2) NOT NULL DEFAULT 0,
  transaction_date date NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'cancelled')),
  approval_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approval_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_general_ledger_project ON public.general_ledger(project_id);
CREATE INDEX idx_general_ledger_account ON public.general_ledger(account_code);
CREATE INDEX idx_general_ledger_date ON public.general_ledger(transaction_date DESC);
CREATE INDEX idx_general_ledger_status ON public.general_ledger(status);
CREATE INDEX idx_general_ledger_document ON public.general_ledger(document_id);

-- RLS: Users can view if they have accounting role or are admin
ALTER TABLE public.general_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with accounting role can view GL" ON public.general_ledger
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director', 'accounting', 'finance')
  );
CREATE POLICY "Only accounting staff can insert GL" ON public.general_ledger
  FOR INSERT WITH CHECK (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'accounting', 'finance')
  );

-- ============================================================================
-- 3. Expenses table (for expense tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  gl_entry_id uuid REFERENCES public.general_ledger(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  expense_date date NOT NULL,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  vat numeric(12, 2) NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL,
  payment_method text CHECK (payment_method IN ('cash', 'card', 'bank', 'cheque')),
  project_id_linked uuid REFERENCES public.projects(id) ON DELETE SET NULL, -- for construction cost allocation
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'cancelled')),
  recorded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  approval_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_project ON public.expenses(project_id);
CREATE INDEX idx_expenses_vendor ON public.expenses(vendor_name);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX idx_expenses_status ON public.expenses(status);
CREATE INDEX idx_expenses_gl_entry ON public.expenses(gl_entry_id);

-- RLS: Users with accounting role can view expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with accounting role can view expenses" ON public.expenses
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director', 'accounting', 'finance')
  );
CREATE POLICY "Only accounting staff can insert expenses" ON public.expenses
  FOR INSERT WITH CHECK (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'accounting', 'finance')
  );

-- ============================================================================
-- 4. GL Account Master (for account code reference)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gl_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  account_code text NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  category text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, account_code)
);

CREATE INDEX idx_gl_accounts_project ON public.gl_accounts(project_id);
CREATE INDEX idx_gl_accounts_code ON public.gl_accounts(account_code);
CREATE INDEX idx_gl_accounts_type ON public.gl_accounts(account_type);

-- Insert default GL accounts for expenses
INSERT INTO public.gl_accounts (project_id, account_code, account_name, account_type, category, description, is_active)
VALUES
  -- Energy/Utilities
  ('aaaaaaaa-0000-0000-0000-000000000001', '5301', 'ค่าสาธารณูปโภค (Utilities)', 'expense', 'Utilities', 'Electricity, water, gas costs', true),
  -- Transportation
  ('aaaaaaaa-0000-0000-0000-000000000001', '5201', 'เชื้อเพลิง (Fuel)', 'expense', 'Transportation', 'Fuel and petrol expenses', true),
  -- Meals & Hospitality
  ('aaaaaaaa-0000-0000-0000-000000000001', '5202', 'อาหารและเครื่องดื่ม (Meals & Entertainment)', 'expense', 'Hospitality', 'Meals and entertainment expenses', true),
  -- Supplies
  ('aaaaaaaa-0000-0000-0000-000000000001', '5203', 'เครื่องเขียนสำนักงาน (Office Supplies)', 'expense', 'Supplies', 'Office supplies and stationery', true),
  -- Maintenance
  ('aaaaaaaa-0000-0000-0000-000000000001', '5204', 'ค่าซ่อมแซม (Maintenance)', 'expense', 'Maintenance', 'Repair and maintenance costs', true),
  -- Marketing
  ('aaaaaaaa-0000-0000-0000-000000000001', '5401', 'โฆษณา (Advertising)', 'expense', 'Marketing', 'Advertising and promotion expenses', true),
  -- Professional Services
  ('aaaaaaaa-0000-0000-0000-000000000001', '5402', 'ค่าบริการวิชาชีพ (Professional Services)', 'expense', 'Services', 'Legal, accounting, consulting fees', true),
  -- Construction Materials
  ('aaaaaaaa-0000-0000-0000-000000000001', '6001', 'วัสดุก่อสร้าง (Construction Materials)', 'expense', 'Construction', 'Building materials and supplies', true),
  -- Contractor Payment
  ('aaaaaaaa-0000-0000-0000-000000000001', '6100', 'ค่าจ้างเหมา (Contractor Payment)', 'expense', 'Construction', 'Subcontractor and service payments', true),
  -- Labor
  ('aaaaaaaa-0000-0000-0000-000000000001', '6200', 'ค่าแรงงาน (Labor)', 'expense', 'Construction', 'Direct labor and wages', true)
ON CONFLICT DO NOTHING;

-- Enable RLS for GL Accounts
ALTER TABLE public.gl_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view GL accounts" ON public.gl_accounts
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director', 'accounting', 'finance')
  );

-- GRANTS
GRANT SELECT, INSERT, UPDATE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.general_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.expenses TO authenticated;
GRANT SELECT ON public.gl_accounts TO authenticated;
```

**After running:** Check that 4 tables created (documents, general_ledger, expenses, gl_accounts) ✅

---

### Migration 2 (Copy/Paste/Run)
**Name:** Finance Automation Phase 2  
**Time:** 2 นาที  
**Size:** 8KB

```sql
-- Finance Automation Phase 2
-- Tables: payment_instructions, cash_flow_forecast, auto_approved_expenses, trusted_vendors

-- ============================================================================
-- 1. Payment Instructions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  inst_id uuid REFERENCES public.inst(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  payment_date date NOT NULL,
  payment_method text CHECK (payment_method IN ('bank', 'cheque', 'cash')),
  to_account text, -- contractor bank account
  to_bank text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending_approval', 'approved', 'executed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  approval_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_instructions_project ON public.payment_instructions(project_id);
CREATE INDEX idx_payment_instructions_payment_date ON public.payment_instructions(payment_date);
CREATE INDEX idx_payment_instructions_status ON public.payment_instructions(status);

ALTER TABLE public.payment_instructions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff can view payments" ON public.payment_instructions
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'finance', 'accounting')
  );
CREATE POLICY "Finance staff can create payments" ON public.payment_instructions
  FOR INSERT WITH CHECK (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'finance')
  );

-- ============================================================================
-- 2. Cash Flow Forecast
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cash_flow_forecast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  forecast_week integer NOT NULL,
  forecast_date date NOT NULL,
  projected_inflow numeric(12, 2) NOT NULL DEFAULT 0,
  projected_outflow numeric(12, 2) NOT NULL DEFAULT 0,
  net_flow numeric(12, 2) GENERATED ALWAYS AS (projected_inflow - projected_outflow) STORED,
  projected_balance numeric(12, 2) NOT NULL,
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_flags jsonb, -- array of risk descriptions
  confidence_score numeric(3, 2) DEFAULT 0.85,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_flow_project ON public.cash_flow_forecast(project_id);
CREATE INDEX idx_cash_flow_date ON public.cash_flow_forecast(forecast_date);
CREATE INDEX idx_cash_flow_risk ON public.cash_flow_forecast(risk_level);

ALTER TABLE public.cash_flow_forecast ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff can view forecast" ON public.cash_flow_forecast
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'finance')
  );

-- ============================================================================
-- 3. Auto Approved Expenses
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.auto_approved_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  approval_reason text,
  auto_approved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auto_approved_project ON public.auto_approved_expenses(project_id);
CREATE INDEX idx_auto_approved_vendor ON public.auto_approved_expenses(vendor_name);

ALTER TABLE public.auto_approved_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff can view auto approvals" ON public.auto_approved_expenses
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'finance', 'accounting')
  );

-- ============================================================================
-- 4. Trusted Vendors
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trusted_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  auto_approve_limit numeric(12, 2) NOT NULL DEFAULT 50000,
  is_trusted boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, vendor_name)
);

CREATE INDEX idx_trusted_vendors_project ON public.trusted_vendors(project_id);
CREATE INDEX idx_trusted_vendors_name ON public.trusted_vendors(vendor_name);

ALTER TABLE public.trusted_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff can view trusted vendors" ON public.trusted_vendors
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'finance')
  );
CREATE POLICY "Finance staff can manage trusted vendors" ON public.trusted_vendors
  FOR INSERT WITH CHECK (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'finance')
  );

GRANT SELECT, INSERT, UPDATE ON public.payment_instructions TO authenticated;
GRANT SELECT ON public.cash_flow_forecast TO authenticated;
GRANT SELECT ON public.auto_approved_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trusted_vendors TO authenticated;
```

**After running:** Check 4 tables created ✅

---

### Migration 3 (Copy/Paste/Run)
**Name:** Marketing Automation Phase 3  
**Time:** 2 นาที  
**Size:** 12KB

```sql
-- Marketing Automation Phase 3
-- Tables: marketing_campaigns, marketing_messages, campaign_analytics

-- ============================================================================
-- 1. Marketing Campaigns
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  sequence_type text NOT NULL CHECK (sequence_type IN ('NEW_LEAD', 'SITE_VISIT', 'NO_RESPONSE_3D', 'CUSTOM')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_campaigns_project ON public.marketing_campaigns(project_id);
CREATE INDEX idx_marketing_campaigns_status ON public.marketing_campaigns(status);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing staff can view campaigns" ON public.marketing_campaigns
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'marketing', 'sales')
  );
CREATE POLICY "Marketing staff can create campaigns" ON public.marketing_campaigns
  FOR INSERT WITH CHECK (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'marketing')
  );

-- ============================================================================
-- 2. Marketing Messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketing_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('sms', 'email', 'line', 'call')),
  message_content text NOT NULL,
  scheduled_time timestamptz NOT NULL,
  sent_time timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sending', 'sent', 'failed', 'bounced')),
  response_received boolean DEFAULT false,
  response_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_messages_campaign ON public.marketing_messages(campaign_id);
CREATE INDEX idx_marketing_messages_lead ON public.marketing_messages(lead_id);
CREATE INDEX idx_marketing_messages_status ON public.marketing_messages(status);
CREATE INDEX idx_marketing_messages_scheduled_time ON public.marketing_messages(scheduled_time);

ALTER TABLE public.marketing_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing staff can view messages" ON public.marketing_messages
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'marketing', 'sales')
  );
CREATE POLICY "Marketing staff can create messages" ON public.marketing_messages
  FOR INSERT WITH CHECK (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'marketing')
  );

-- ============================================================================
-- 3. Campaign Analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_messages_sent integer DEFAULT 0,
  total_responses integer DEFAULT 0,
  response_rate numeric(5, 2) DEFAULT 0,
  conversion_count integer DEFAULT 0,
  conversion_value numeric(12, 2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, date)
);

CREATE INDEX idx_campaign_analytics_project ON public.campaign_analytics(project_id);
CREATE INDEX idx_campaign_analytics_campaign ON public.campaign_analytics(campaign_id);
CREATE INDEX idx_campaign_analytics_date ON public.campaign_analytics(date);

ALTER TABLE public.campaign_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing staff can view analytics" ON public.campaign_analytics
  FOR SELECT USING (
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'marketing', 'sales')
  );

GRANT SELECT, INSERT, UPDATE ON public.marketing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketing_messages TO authenticated;
GRANT SELECT, INSERT ON public.campaign_analytics TO authenticated;
```

**After running:** Check 3 tables created ✅

---

### Migration 4 (Copy/Paste/Run)
**Name:** Activity Tables RLS  
**Time:** 1 นาที  
**Size:** 1.4KB

```sql
-- Add RLS policies for activity tables with department isolation

-- Activity Goals RLS
ALTER TABLE public.activity_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Department can view own activity goals" ON public.activity_goals
  FOR SELECT USING (
    department = (SELECT department FROM auth.users WHERE id = auth.uid())
    OR auth.jwt()->>'role' = 'admin'
  );

-- Activity Badges RLS
ALTER TABLE public.activity_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Department can view own activity badges" ON public.activity_badges
  FOR SELECT USING (
    department = (SELECT department FROM auth.users WHERE id = auth.uid())
    OR auth.jwt()->>'role' = 'admin'
  );

GRANT SELECT ON public.activity_goals TO authenticated;
GRANT SELECT ON public.activity_badges TO authenticated;
```

**After running:** Policies applied ✅

---

## 📍 STEP 2: SUPABASE STORAGE (5 นาที)

### Location:
```
https://app.supabase.com
→ Select: AVIVA ONE project
→ Go to: Storage
```

### Action:
```
1. Click blue "Create bucket" button
2. Name: receipts
3. Privacy: Private ⚠️ (IMPORTANT: NOT Public)
4. Click "Create bucket"

Expected result: "receipts" bucket appears in list with lock icon 🔒
```

---

## 📍 STEP 3: VERCEL ENVIRONMENT VARIABLES (10 นาที)

### Location:
```
https://vercel.com/dashboard
→ Select: AVIVA ONE project
→ Settings → Environment Variables
```

### Add These Variables:

```
CRON_SECRET = (generate random 32 character string)

SMS_PROVIDER = bulksms
BULKSMS_USERNAME = (your BulkSMS username, if you have account)
BULKSMS_API_KEY = (your BulkSMS API key, if you have account)

EMAIL_PROVIDER = sendgrid
SENDGRID_API_KEY = (your SendGrid API key, if you have account)
SENDGRID_FROM_EMAIL = noreply@avivaone.co.th

LINE_CHANNEL_ACCESS_TOKEN = (your LINE channel access token, if you have)
LINE_CHANNEL_SECRET = (your LINE channel secret, if you have)
LINE_WEBHOOK_URL = https://aviva-one.vercel.app/api/line/webhook

ANTHROPIC_API_KEY = (your Anthropic API key for Claude Vision)
```

### For Minimum Setup:
At least add these 2:
```
CRON_SECRET = (any random string)
ANTHROPIC_API_KEY = (from https://console.anthropic.com)
```

---

## 📍 STEP 4: VERCEL REDEPLOY (5 นาที)

### Location:
```
https://vercel.com/dashboard
→ AVIVA ONE project
→ Deployments tab
```

### Action:
```
1. Find latest deployment (should show commit fb39c8e or later)
2. Click ⋮ (three dots menu)
3. Select "Redeploy"
4. Wait for green checkmark (2-3 minutes)

Expected result: Green status, no errors in logs
```

---

## ✅ VERIFICATION CHECKLIST

After completing all steps:

```
☐ Migration 1: 4 tables created (documents, general_ledger, expenses, gl_accounts)
☐ Migration 2: 4 tables created (payment_instructions, cash_flow_forecast, etc)
☐ Migration 3: 3 tables created (marketing_campaigns, marketing_messages, etc)
☐ Migration 4: RLS policies applied
☐ Storage: "receipts" bucket exists (Private)
☐ Vercel: Environment variables added (at least CRON_SECRET + ANTHROPIC_API_KEY)
☐ Vercel: Deployment green status
☐ Vercel: Logs show no errors
```

---

**Status:** Ready to execute ✅  
**Estimated Time:** 30-40 นาที
