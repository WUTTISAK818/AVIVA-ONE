-- Receipt OCR System (Phase 1)
-- Tables: documents, general_ledger, expenses

-- ============================================================================
-- 1. Receipt Documents table (for receipt/invoice/bill metadata - OCR System)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.receipt_documents (
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

CREATE INDEX idx_receipt_documents_project ON public.receipt_documents(project_id);
CREATE INDEX idx_receipt_documents_uploaded_by ON public.receipt_documents(uploaded_by);
CREATE INDEX idx_receipt_documents_status ON public.receipt_documents(status);
CREATE INDEX idx_receipt_documents_created_at ON public.receipt_documents(created_at DESC);

-- RLS: Users can only see own receipt documents
ALTER TABLE public.receipt_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own receipt documents" ON public.receipt_documents
  FOR SELECT USING (uploaded_by = auth.uid() OR auth.jwt()->>'role' = 'admin');
CREATE POLICY "Users can insert own receipt documents" ON public.receipt_documents
  FOR INSERT WITH CHECK (uploaded_by = auth.uid() AND auth.jwt()->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director', 'accounting', 'finance'));
CREATE POLICY "Users can update own receipt documents" ON public.receipt_documents
  FOR UPDATE USING (uploaded_by = auth.uid() OR auth.jwt()->>'role' = 'admin');

-- ============================================================================
-- 2. General Ledger table (for GL account entries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.general_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type text, -- 'receipt', 'invoice', 'transfer', etc.
  document_id uuid REFERENCES public.receipt_documents(id) ON DELETE SET NULL,
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

-- ============================================================================
-- 5. Notification updates (if table exists, add receipt notification types)
-- ============================================================================
-- Note: This assumes notifications table already exists
-- If not, create it separately

GRANT SELECT, INSERT, UPDATE ON public.receipt_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.general_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.expenses TO authenticated;
GRANT SELECT ON public.gl_accounts TO authenticated;

-- Create storage bucket for receipts if it doesn't exist
-- This will be done via Supabase dashboard: Storage > New Bucket > receipts (Private)
