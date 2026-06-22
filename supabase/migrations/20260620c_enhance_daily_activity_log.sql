-- ═══════════════════════════════════════════════════════════════════════════════
-- AVIVA ONE - Enhance Daily Activity Log with References and Alerts
-- เพิ่ม columns สำหรับ reference tracking, URLs, และ alert management
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add columns to daily_activity_log if they don't exist
ALTER TABLE public.daily_activity_log
ADD COLUMN IF NOT EXISTS reference_id UUID,
ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50), -- 'lead' | 'house' | 'payment_voucher' | 'qc_defect' | 'leave'
ADD COLUMN IF NOT EXISTS reference_url TEXT,
ADD COLUMN IF NOT EXISTS is_alert_created BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS alert_type VARCHAR(50); -- 'milestone' | 'anomaly' | 'overdue' | 'idle'

-- Create index for reference lookups
CREATE INDEX IF NOT EXISTS idx_activity_reference ON public.daily_activity_log(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_activity_alert_type ON public.daily_activity_log(alert_type);

-- ═══════════════════════════════════════════════════════════════════════════════
-- END: ENHANCE DAILY ACTIVITY LOG
-- ═══════════════════════════════════════════════════════════════════════════════
