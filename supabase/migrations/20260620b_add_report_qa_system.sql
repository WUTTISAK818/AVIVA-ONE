-- ═══════════════════════════════════════════════════════════════════════════════
-- AVIVA ONE - Report Q&A System
-- ผู้บริหารสามารถถามคำถามในรายงานของพนักงาน และพนักงานตอบกลับได้
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.report_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to report
  report_id VARCHAR(255) NOT NULL,
  report_date DATE NOT NULL,
  report_author_id UUID NOT NULL REFERENCES auth.users(id),
  report_author_name VARCHAR(255),
  report_author_email VARCHAR(255),

  -- Question
  question_by_id UUID NOT NULL REFERENCES auth.users(id),
  question_by_name VARCHAR(255),
  question_by_role VARCHAR(100),
  question_text TEXT NOT NULL,

  -- Thread of answers
  answers JSONB DEFAULT '[]'::jsonb, -- [{id, user_id, user_name, text, created_at}, ...]

  -- Status
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_questions_report ON public.report_questions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_questions_author ON public.report_questions(report_author_id);
CREATE INDEX IF NOT EXISTS idx_report_questions_asker ON public.report_questions(question_by_id);
CREATE INDEX IF NOT EXISTS idx_report_questions_resolved ON public.report_questions(is_resolved);
CREATE INDEX IF NOT EXISTS idx_report_questions_date ON public.report_questions(report_date DESC);

-- ════════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.report_questions ENABLE ROW LEVEL SECURITY;

-- Everyone can view Q&A in reports
DROP POLICY IF EXISTS report_questions_select ON public.report_questions;
CREATE POLICY report_questions_select ON public.report_questions
  FOR SELECT TO authenticated
  USING (TRUE);

-- Only managers and above can ask questions
DROP POLICY IF EXISTS report_questions_insert ON public.report_questions;
CREATE POLICY report_questions_insert ON public.report_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_app_meta_data->>'role' IN ('admin', 'ceo', 'coo', 'manager', 'director'))
  );

-- Report author and question asker can update (mark as resolved, add answers)
DROP POLICY IF EXISTS report_questions_update ON public.report_questions;
CREATE POLICY report_questions_update ON public.report_questions
  FOR UPDATE TO authenticated
  USING (auth.uid() = report_author_id OR auth.uid() = question_by_id)
  WITH CHECK (auth.uid() = report_author_id OR auth.uid() = question_by_id);

-- ════════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTION: Add answer to question
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.add_question_answer(
  p_question_id UUID,
  p_user_id UUID,
  p_user_name VARCHAR,
  p_answer_text TEXT
)
RETURNS public.report_questions AS $$
DECLARE
  v_new_answer JSONB;
  v_updated_record public.report_questions;
BEGIN
  v_new_answer := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'user_id', p_user_id::text,
    'user_name', p_user_name,
    'text', p_answer_text,
    'created_at', NOW()::text
  );

  UPDATE public.report_questions
  SET
    answers = answers || jsonb_build_array(v_new_answer),
    updated_at = NOW()
  WHERE id = p_question_id
  RETURNING * INTO v_updated_record;

  RETURN v_updated_record;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════════════════════════
-- END: REPORT Q&A SYSTEM MIGRATION
-- ════════════════════════════════════════════════════════════════════════════════
