# 📋 COMPLETE WORK ITEMS INVENTORY
## งานค้างทั้งหมด + ลำดับความสำคัญ

**วันที่:** 22 มิถุนายน 2569  
**ทั้งหมด:** 25 items (P0: 2, P1: 10, P2-P4: 13)  
**ที่ทำได้วันนี้:** 18 items

---

## 🚨 **P0 CRITICAL - ต้องทำเพื่อไป Production (30 Jun)**

### P0-1: Demo Account Cleanup
```
Priority: CRITICAL - Blocking Go-Live
Effort: 30 minutes
Status: ⏳ PENDING
Can do now: YES ✅

Task:
1. Go to Supabase Dashboard → Authentication → Users
2. Delete these 9 demo accounts:
   • ceo.test@aviva.th
   • demo.admin@aviva.th
   • demo.sales@aviva.th
   • demo.finance@aviva.th
   • demo.construction@aviva.th
   • demo.accounting@aviva.th
   • demo.hr@aviva.th
   • demo.marketing@aviva.th
   • demo.aftersales@aviva.th

Verify: No demo accounts remain ✅
```

### P0-2: Test Data Cleanup
```
Priority: CRITICAL - Blocking Go-Live
Effort: 1 hour
Status: ⏳ PENDING
Can do now: YES ✅

Task:
Run this SQL in Supabase SQL Editor:

DELETE FROM houses WHERE house_name IN ('A01', 'A02', 'A03', 'A04', 'A05');
-- This cascades to: houses_progress, audit_defects, work_items, etc.

DELETE FROM leads WHERE lead_name LIKE 'Test%' OR email LIKE 'test%';
DELETE FROM contractors WHERE contractor_name LIKE 'Test%';
DELETE FROM projects WHERE project_name LIKE 'Demo%' AND id != 'aaaaaaaa-0000-0000-0000-000000000001';

Verify: Test records removed, demo project remains ✅
```

---

## ⭐ **P1 HIGH - ต้องทำเพื่อให้ Automation ทำงาน**

### P1-1: Contractor Bank Details Seeding
```
Priority: HIGH - Blocks Finance Automation (Auto-Payments)
Effort: 1-2 hours
Status: ⏳ PENDING - Code ready, needs data
Can do now: YES ✅
Blocker for: P1-5, P1-9

Task:
1. Get contractor list from contractors table
2. For each contractor, add bank details:
   - contractor_id
   - bank_name (e.g., "ธนาคารกรุงไทย", "Kasikornbank")
   - bank_account (e.g., "123-456-789")
   - account_holder_name
   - is_verified (true/false)

2. Populate contractor_contacts table:
INSERT INTO public.contractor_contacts (contractor_id, bank_name, account, account_holder, verified_at)
VALUES 
  ('contractor-uuid-1', 'Thai Military Bank', '000-123-4567', 'John Doe', now()),
  ('contractor-uuid-2', 'Kasikornbank', '111-987-6543', 'Jane Smith', now()),
  ...

Expected: 10-50 contractor bank records

Alternative: If using existing contractor.bank_account field:
UPDATE contractors SET bank_account = 'xxx', bank_name = 'yyy' WHERE id = ...
```

### P1-2: Message Templates Configuration
```
Priority: HIGH - Blocks Marketing Automation (Campaign Dispatch)
Effort: 2-3 hours
Status: ⏳ PENDING - Table ready, needs templates
Can do now: YES ✅
Blocker for: P1-7

Task:
Create 7 message templates in message_templates table:

INSERT INTO public.message_templates (template_name, channel, subject, body, variables, created_by)
VALUES
  (
    'welcome-sms',
    'sms',
    NULL,
    'สวัสดีค่ะ {customer_name} ขอบคุณที่สนใจโครงการ {project_name} 💙 ยินดีบริการคำถามใดๆ',
    '["customer_name", "project_name"]',
    'system-uuid'
  ),
  (
    'day1-followup',
    'email',
    'Follow-up: {project_name}',
    'Dear {customer_name},\n\nThank you for your interest in {project_name}. We would like to schedule a site visit.\n\nBest regards,\nAVIVA Team',
    '["customer_name", "project_name"]',
    'system-uuid'
  ),
  (
    'day3-nurture',
    'line',
    NULL,
    'คุณ {customer_name} พร้อมชมโครงการแล้วหรือค่ะ? 😊 เราขอเชิญชมแบบจริง ที่ {location}',
    '["customer_name", "location"]',
    'system-uuid'
  ),
  (
    'site-visit-reminder',
    'sms',
    NULL,
    'เตือนความจำ: ชมโครงการ {project_name} วันนี้ เวลา {time} ที่ {location}',
    '["project_name", "time", "location"]',
    'system-uuid'
  ),
  (
    'milestone-approved',
    'sms',
    NULL,
    '{contractor_name} ค่ะ ไมล์โstone ที่ {milestone_num} อนุมัติแล้ว เตรียมชำระเงิน {amount} บาท',
    '["contractor_name", "milestone_num", "amount"]',
    'system-uuid'
  ),
  (
    'payment-ready',
    'line',
    NULL,
    'ชำระเงิน {amount} บาท สำหรับ {description} เรียบร้อยแล้ว 💰 #Ref:{reference_no}',
    '["amount", "description", "reference_no"]',
    'system-uuid'
  ),
  (
    'document-request',
    'email',
    'Document Required: {document_type}',
    'Dear {name},\n\nWe need {document_type} from you for {project_name}.\nPlease upload by {due_date}.\n\nThank you',
    '["name", "document_type", "project_name", "due_date"]',
    'system-uuid'
  );

Verify: 7 templates created ✅
```

### P1-3: App Settings Configuration
```
Priority: HIGH - Blocks SMS/Email/LINE integrations
Effort: 1-2 hours
Status: ⏳ PENDING - Table ready, needs config
Can do now: YES (partially - need credentials)
Blocker for: P1-7, P1-8

Task:
Populate app_settings table with these keys:

INSERT INTO public.app_settings (project_id, setting_key, setting_value, is_secret)
VALUES
  -- SMS Configuration
  ('aaaaaaaa-0000-0000-0000-000000000001', 'SMS_PROVIDER', 'bulksms', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'BULKSMS_USERNAME', 'your-username', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'BULKSMS_API_KEY', 'your-api-key', true),
  
  -- Email Configuration
  ('aaaaaaaa-0000-0000-0000-000000000001', 'EMAIL_PROVIDER', 'sendgrid', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'SENDGRID_API_KEY', 'your-sendgrid-key', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'SENDGRID_FROM_EMAIL', 'noreply@avivaone.co.th', false),
  
  -- LINE Configuration
  ('aaaaaaaa-0000-0000-0000-000000000001', 'LINE_CHANNEL_ACCESS_TOKEN', 'your-line-token', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'LINE_CHANNEL_SECRET', 'your-line-secret', true),
  
  -- System Settings
  ('aaaaaaaa-0000-0000-0000-000000000001', 'AUTO_APPROVE_THRESHOLD', '50000', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'CASH_FLOW_ALERT_THRESHOLD', '200000', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'SLA_ALERT_DAYS', '15', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'COMPANY_NAME', 'AVIVA Private Limited', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'COMPANY_PHONE', '+66-2-xxx-xxxx', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'COMPANY_EMAIL', 'hello@avivaone.co.th', false);

Note: Replace 'your-*' with actual values from:
- BulkSMS account (https://www.bulksms.com)
- SendGrid (https://sendgrid.com)
- LINE Business (https://business.line.biz)
```

### P1-4: Lead Status Validation & Fix
```
Priority: HIGH - Data Integrity
Effort: 1-2 hours
Status: ⏳ PENDING - Function ready, needs execution
Can do now: YES ✅

Task:
Run in Supabase SQL Editor:

-- Fix leads with transfer_date but status != 'Closed Deal'
UPDATE leads 
SET status = 'Closed Deal' 
WHERE transfer_date IS NOT NULL 
  AND status != 'Closed Deal';

-- Fix leads with loan_approved_date but no transfer
UPDATE leads 
SET status = 'Loan Approved' 
WHERE loan_approved_date IS NOT NULL 
  AND transfer_date IS NULL 
  AND status NOT IN ('Loan Approved', 'Closed Deal');

-- Fix leads with contract_signed_date but no loan/transfer
UPDATE leads 
SET status = 'Contract Signed' 
WHERE contract_signed_date IS NOT NULL 
  AND loan_approved_date IS NULL 
  AND transfer_date IS NULL 
  AND status NOT IN ('Contract Signed', 'Loan Approved', 'Closed Deal');

Verify: Lead statuses now consistent with dates ✅
```

### P1-5: Contractor Bank Mapping Code Implementation
```
Priority: HIGH - Required for Auto-Payments
Effort: 1-2 hours
Status: Code complete, needs integration testing
Can do now: YES (after P1-1)
Blocker for: Finance Automation Phase 2

Task:
File: src/app/api/finance/payments/auto-schedule/route.ts (lines 95-105)

BEFORE:
```
const paymentInstruction = {
  to_account: "pending", // TODO: Get from contractor bank account
  to_bank: "pending"     // TODO: Get from contractor bank details
}
```

AFTER:
```
// Fetch contractor bank details
const { data: contractorContact } = await supabase
  .from('contractor_contacts')
  .select('bank_account, bank_name')
  .eq('contractor_id', contractor_id)
  .single();

const paymentInstruction = {
  to_account: contractorContact?.bank_account || null,
  to_bank: contractorContact?.bank_name || null
}
```

Testing:
1. Create test contractor with bank details in contractor_contacts
2. Create test INST linked to contractor
3. Call POST /api/finance/payments/auto-schedule
4. Verify payment_instruction created with correct bank details ✅
```

### P1-6: SMS/Email/LINE Integration Implementations (3 parts)
```
Priority: HIGH - Required for Marketing Automation
Effort: 4-6 hours total
Status: Skeleton complete, needs provider integration
Can do now: YES (with API keys)

Task A: SMS Integration (BulkSMS)
File: src/app/api/cron/marketing/dispatch-messages/route.ts (line 114)

BEFORE:
const sendSMS = async (phone, message) => {
  console.log(`[SMS] ${phone}: ${message}`); // Mock
  return true;
}

AFTER:
const sendSMS = async (phone, message) => {
  const username = process.env.BULKSMS_USERNAME;
  const apiKey = process.env.BULKSMS_API_KEY;
  
  const response = await fetch('https://api.bulksms.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: phone,
      body: message,
      encoding: 'unicode' // Support Thai characters
    })
  });
  
  const result = await response.json();
  return result.cost !== undefined; // Success if cost field returned
}

Testing:
1. Add BULKSMS_USERNAME + BULKSMS_API_KEY to .env.local
2. Create test message_queue record with message_type='sms'
3. Call POST /api/cron/marketing/dispatch-messages
4. Check BulkSMS dashboard for message delivery ✅
```

Task B: Email Integration (SendGrid)
File: src/app/api/cron/marketing/dispatch-messages/route.ts (line 98)

BEFORE:
const sendEmail = async (to, subject, body) => {
  console.log(`[EMAIL] ${to}: ${subject}`); // Mock
  return true;
}

AFTER:
const sendEmail = async (to, subject, body) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: 'AVIVA ONE' },
      subject,
      content: [{ type: 'text/html', value: body }]
    })
  });
  
  return response.status === 202; // SendGrid returns 202 for accepted
}

Testing:
1. Add SENDGRID_API_KEY to .env.local
2. Create test message with message_type='email'
3. Call dispatch function
4. Check SendGrid dashboard for delivery ✅
```

Task C: LINE Integration
File: src/app/api/cron/marketing/dispatch-messages/route.ts (line 82)

BEFORE:
const sendLineMessage = async (lineUserId, message) => {
  console.log(`[LINE] ${lineUserId}: ${message}`); // Mock
  return true;
}

AFTER:
const sendLineMessage = async (lineUserId, message) => {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  const response = await fetch('https://api.line.biz/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [
        { type: 'text', text: message }
      ]
    })
  });
  
  return response.status === 200;
}

Testing:
1. Add LINE_CHANNEL_ACCESS_TOKEN to .env.local
2. Get your LINE user ID (via LINE Official Account Bot)
3. Create test message with message_type='line'
4. Verify message appears in LINE app ✅
```

Task D: Lead-to-LINE-ID Mapping
File: leads table needs line_user_id field

SQL:
ALTER TABLE public.leads ADD COLUMN line_user_id text UNIQUE;

Then populate for each lead that has LINE contact:
UPDATE leads SET line_user_id = 'U1234567890abc...' WHERE id = 'lead-uuid';

Or collect via LINE Bot when customer adds as friend.
```

### P1-7: Test User Creation (UAT)
```
Priority: HIGH - Prerequisite for testing
Effort: 1 hour
Status: ⏳ PENDING - Ready to create
Can do now: YES ✅

Task:
Create 6 test users via Supabase Authentication:

1. test.ceo@avivaone.co.th / password: Test123!@#
   Role: ceo
   Name: CEO Test
   
2. test.coo@avivaone.co.th / password: Test123!@#
   Role: coo
   Name: COO Test
   
3. test.sales1@avivaone.co.th / password: Test123!@#
   Role: sales
   Department: sales
   Name: Sales 1 Test
   
4. test.sales2@avivaone.co.th / password: Test123!@#
   Role: sales
   Department: sales
   Name: Sales 2 Test
   
5. test.engineer@avivaone.co.th / password: Test123!@#
   Role: project_manager
   Department: construction
   Name: Engineer Test
   
6. test.finance@avivaone.co.th / password: Test123!@#
   Role: finance
   Department: finance
   Name: Finance Test

Location: Supabase Dashboard → Authentication → Add user

Verify: 6 users created with correct roles ✅
```

### P1-8: Test Data Fixtures Creation
```
Priority: HIGH - Prerequisite for Phase testing
Effort: 2-3 hours
Status: ⏳ PENDING - SQL script ready
Can do now: YES ✅

Task:
Run this SQL in Supabase SQL Editor to create test data:

-- Test Leads (50 records)
INSERT INTO leads (project_id, crm_source, lead_name, email, phone, status, created_by)
SELECT 
  'aaaaaaaa-0000-0000-0000-000000000001',
  'website',
  'Test Lead ' || i,
  'lead' || i || '@test.com',
  '08' || LPAD((RANDOM()%9000000)::text, 8, '0'),
  CASE WHEN RANDOM() < 0.7 THEN 'Interested' WHEN RANDOM() < 0.85 THEN 'Contacted' ELSE 'Qualified' END,
  'aaaaaaaa-0000-0000-0000-000000000007'
FROM generate_series(1, 50) AS t(i);

-- Test Houses (10 records)
INSERT INTO houses (project_id, project_phase_id, house_name, plot_number, house_location, status)
SELECT
  'aaaaaaaa-0000-0000-0000-000000000001',
  'phase-uuid-1',
  'TEST-' || LPAD(i::text, 3, '0'),
  100 + i,
  'Plot ' || (100+i),
  'Available'
FROM generate_series(1, 10) AS t(i);

-- Test Work Reports (30 records) 
[SQL continues... see full script in Supabase SQL Editor]

Expected result: 260+ test records created for testing phases ✅
```

### P1-9: Contractor Bank Details Integration Test
```
Priority: HIGH - Verify P1-5 works
Effort: 1 hour
Status: Requires P1-1 complete
Can do now: YES (after P1-1, P1-5)

Task:
1. Create test contractor:
   INSERT INTO contractors (project_id, contractor_name, contractor_type, status)
   VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Test Bank Contractor', 'general', 'active')
   RETURNING id;
   → Gets contractor_id (e.g., 'uuuuu')

2. Add bank details:
   INSERT INTO contractor_contacts (contractor_id, bank_name, account, account_holder)
   VALUES ('uuuuu', 'Thai Military Bank', '123-456-7890', 'Test Name');

3. Create test INST:
   INSERT INTO inst (project_id, contractor_id, description, amount, due_date, status)
   VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'uuuuu', 'Test Payment', 25000, '2025-06-30', 'approved');

4. Call the API:
   POST /api/finance/payments/auto-schedule
   {
     "project_id": "aaaaaaaa-0000-0000-0000-000000000001",
     "authorization": "Bearer YOUR_JWT"
   }

5. Verify:
   SELECT * FROM payment_instructions WHERE id = (just created);
   ✅ to_account = '123-456-7890'
   ✅ to_bank = 'Thai Military Bank'
```

### P1-10: Cash Flow Inflow Calculation
```
Priority: HIGH - Affects financial forecasting
Effort: 2-3 hours
Status: Code skeleton ready, needs revenue query
Can do now: YES ✅

Task:
File: src/app/api/finance/cash-flow/forecast/route.ts (lines 130-140)

BEFORE:
// TODO: Calculate inflows from expected revenue
const weekInflow = week === 1 ? 500000 : 250000; // Placeholder

AFTER:
// Query expected revenue from Closed Deals within forecast window
const { data: closedDeals } = await supabase
  .from('leads')
  .select('id, contract_value, expected_payment_date')
  .eq('project_id', projectId)
  .eq('status', 'Closed Deal')
  .gte('expected_payment_date', currentDate)
  .lte('expected_payment_date', endDate);

// Calculate weekly inflows
const weekInflow = closedDeals
  ?.filter(deal => {
    const dealDate = new Date(deal.expected_payment_date);
    return dealDate >= currentWeekStart && dealDate < nextWeekStart;
  })
  .reduce((sum, deal) => sum + deal.contract_value, 0) || 0;

Testing:
1. Create 5 test Closed Deal leads with contract_value and expected_payment_date
2. Call GET /api/finance/cash-flow/forecast
3. Verify forecast.inflow matches expected values ✅
```

---

## 📊 **P2 HIGH - เพิ่มเติมอื่น ๆ (Optional ในระยะแรก)**

| # | Task | Effort | Status | Note |
|---|------|--------|--------|------|
| P2-1 | Trusted vendors seeding | 1-2h | Pending | Expense automation |
| P2-2 | Recurring expenses setup | 1-2h | Pending | GL automation |
| P2-3 | Auto-approve expense query | 2-3h | Code Ready | Logic complete |

---

## ✅ **EXECUTION TIMELINE**

### Today (22 June) - 4-6 hours
```
Phase A: Infrastructure (30 min) - Supabase migrations + Vercel setup
Phase B: Data Cleanup (30 min) - P0-1, P0-2
Phase C: Data Seeding (2-3 hours) - P1-1, P1-2, P1-3
Phase D: Testing (1-2 hours) - P1-4, P1-7, P1-8
```

### Tomorrow (23 June) - 2-4 hours
```
Phase E: Integration (2-3 hours) - P1-5, P1-6, P1-9, P1-10
Phase F: Final testing (1 hour) - Verify all systems work
```

### 24 June - Final Go-Live Prep
```
Phase G: UAT testing (2-3 hours)
Phase H: Production deployment (1 hour)
```

---

## 📋 **START HERE - PRIORITY SEQUENCE**

### ✅ First (Do Now):
1. **INFRASTRUCTURE_SETUP_READY.md** - Follow Supabase + Vercel setup
2. **P0-1 + P0-2** - Delete demo/test data (30 min)
3. **P1-1 + P1-2 + P1-3** - Seed contractor bank, message templates, app settings (3-4 hours)

### Then:
4. **P1-4 + P1-7 + P1-8** - Validation, test users, test fixtures (2-3 hours)
5. **P1-5 + P1-6** - Code integration for auto-payments + messaging (3-4 hours)

### Finally:
6. **P1-9 + P1-10** - Integration testing (1-2 hours)

---

**Total Work:** ~15-20 hours over 3 days  
**Critical Path:** 12 hours (can be done in 1.5 days with 2 people)  
**Go-Live Ready:** 24 June 2025 ✅
