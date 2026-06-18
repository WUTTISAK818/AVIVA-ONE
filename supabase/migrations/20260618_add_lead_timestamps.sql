-- =====================================================================
-- Add lead visit tracking fields
-- =====================================================================
-- Purpose: Track when customers visit and who entered the data
--
-- New columns:
--   - visit_date (DATE, nullable)      — Date customer visited
--   - visit_time (TIME, nullable)      — Time customer visited
--   - reported_by (TEXT, nullable)     — Email/name of staff who entered data
--   - reported_at (TIMESTAMPTZ)        — Timestamp when data was recorded
--
-- This migration is idempotent — safe to re-run
-- =====================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS visit_date DATE;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS visit_time TIME;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS reported_by TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ DEFAULT now();

-- Create index for visit_date queries
CREATE INDEX IF NOT EXISTS idx_leads_visit_date
  ON public.leads(visit_date DESC NULLS LAST)
  WHERE visit_date IS NOT NULL;

-- Create index for reported_by queries (staff activity tracking)
CREATE INDEX IF NOT EXISTS idx_leads_reported_by
  ON public.leads(reported_by)
  WHERE reported_by IS NOT NULL;

-- =====================================================================
-- v6.33 checklist:
-- [x] leads — visit_date column (DATE, nullable)
-- [x] leads — visit_time column (TIME, nullable)
-- [x] leads — reported_by column (TEXT, nullable)
-- [x] leads — reported_at column (TIMESTAMPTZ, default=now())
-- [x] Index on visit_date for filtering
-- [x] Index on reported_by for staff activity tracking
-- =====================================================================
