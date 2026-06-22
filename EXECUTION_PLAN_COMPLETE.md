# 🚀 AVIVA ONE v6.55 - COMPLETE EXECUTION PLAN
## ทำทั้งหมดวันนี้ให้เสร็จ (วันที่ 20-25 มิถุนายน รวมกัน)

**วันที่:** 22 มิถุนายน 2569  
**เวลา:** 19:00+ น. (UTC+7)  
**เป้าหมาย:** ระบบลง Production + ทดสอบสำเร็จ ✅

---

## 📋 MASTER CHECKLIST - ทำตามลำดับ

### ✅ PHASE 1: ตรวจสอบความพร้อม (5 นาที)

- [x] Code complete: ✅ 100%
- [x] All 8 APIs implemented: ✅
- [x] All 4 migrations ready: ✅
- [x] Build passes: ✅ Zero TypeScript errors
- [x] Documentation complete: ✅ 6 ไฟล์
- [x] Security fixes applied: ✅ 8/8 P0 issues

**STATUS: ✅ READY TO PROCEED**

---

### ⏳ PHASE 2: Infrastructure Setup (30 นาที)

#### Step 2.1: Supabase - Run Migrations (15 นาที)

**ที่ต้องทำ:**
```
1. เข้า https://app.supabase.com
2. เลือก project: AVIVA ONE
3. ไปที่ SQL Editor
4. Copy/Paste/Run ทั้ง 4 migration ตามลำดับ:
```

**Migration 1 - Receipt OCR System:**
```
File: supabase/migrations/20260621_receipt_ocr_system.sql
Size: 11K
Contains: documents, general_ledger, expenses, gl_accounts tables
RLS Policies: 3 (document access control)
Action: Copy entire file → Paste in SQL Editor → Run
Expected: ✅ Success (no errors)
Verify: Check tables created in "Tables" tab
```

**Migration 2 - Finance Automation:**
```
File: supabase/migrations/20260621a_finance_automation_phase2.sql
Size: 8K
Contains: payment_instructions, cash_flow_forecast, auto_approved_expenses, trusted_vendors
RLS Policies: 15+ (finance access control)
Action: Copy entire file → Paste in SQL Editor → Run
Expected: ✅ Success (no errors)
Verify: Check tables created
```

**Migration 3 - Marketing Automation:**
```
File: supabase/migrations/20260621b_marketing_automation_phase3.sql
Size: 12K
Contains: marketing_campaigns, marketing_messages, campaign_analytics, etc.
RLS Policies: 20+ (marketing access control)
Action: Copy entire file → Paste in SQL Editor → Run
Expected: ✅ Success (no errors)
Verify: Check tables created
```

**Migration 4 - Activity Tables RLS:**
```
File: supabase/migrations/20260621c_add_rls_activity_tables.sql
Size: 1.4K
Contains: RLS policies for activity_goals, activity_badges
Action: Copy entire file → Paste in SQL Editor → Run
Expected: ✅ Success (no errors)
Verify: Check policies added
```

**⚠️ IMPORTANT: Run in exact order!**
```
1️⃣  20260621_receipt_ocr_system.sql
2️⃣  20260621a_finance_automation_phase2.sql
3️⃣  20260621b_marketing_automation_phase3.sql
4️⃣  20260621c_add_rls_activity_tables.sql
```

#### Step 2.2: Supabase - Create Storage Bucket (5 นาที)

**ที่ต้องทำ:**
```
1. Supabase Dashboard → Storage
2. Click "Create bucket" (ปุ่มสีน้ำเงิน)
3. Name: receipts
4. Privacy: Private ⚠️ (NOT Public)
5. Click "Create bucket"
```

**Verify:**
```
✅ Bucket "receipts" appears in list
✅ Privacy = "Private"
```

#### Step 2.3: Vercel - Environment Variables (10 นาที)

**ที่ต้องทำ:**
```
1. เข้า https://vercel.com/dashboard
2. Select AVIVA ONE project
3. Settings → Environment Variables
4. Add variables ตามด้านล่าง:
```

**Environment Variables to Add:**

```bash
# Security
CRON_SECRET=your-random-secret-32-chars-here

# SMS Provider (BulkSMS) - Optional but recommended
SMS_PROVIDER=bulksms
BULKSMS_USERNAME=your_bulksms_username
BULKSMS_API_KEY=your_bulksms_api_key

# Email Provider (SendGrid) - Optional but recommended
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@avivaone.co.th

# LINE Bot - Optional
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_WEBHOOK_URL=https://aviva-one.vercel.app/api/line/webhook

# Anthropic API (for Claude Vision OCR)
ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Where to get credentials:**
- 🔐 **CRON_SECRET**: Generate random 32 chars (any secure string)
- 📱 **BulkSMS**: https://www.bulksms.com → Account Settings → API Credentials
- 📧 **SendGrid**: https://sendgrid.com → Settings → API Keys
- 💬 **LINE**: https://business.line.biz → Create/Edit Bot → Channel Settings
- 🤖 **Anthropic**: https://console.anthropic.com → Account → API Keys

#### Step 2.4: Vercel - Redeploy (3 นาที)

**ที่ต้องทำ:**
```
1. Vercel Dashboard → Deployments
2. Find latest deployment (should be from commit fb39c8e)
3. Click ⋮ (three dots) → Redeploy
4. Wait for green status (2-3 minutes)
```

**Verify:**
```
✅ Status = "Ready"
✅ Logs show no errors
✅ Build time ~2-3 minutes
```

---

### 🧪 PHASE 3: Local Testing (30 นาที)

#### Step 3.1: Start Dev Server (2 นาที)

```bash
npm run dev
# Wait for: ready - started server on 0.0.0.0:3000
```

#### Step 3.2: Test Receipt OCR System (8 นาที)

**Test 2.1: Document Upload**
```bash
# Test file upload endpoint
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "project_id": "aaaaaaaa-0000-0000-0000-000000000001",
    "document_type": "receipt",
    "file_name": "receipt_sample.jpg"
  }'

Expected Response:
{
  "success": true,
  "document_id": "uuid",
  "status": "uploaded"
}
```

**Test 2.2: OCR Processing**
```bash
# Test OCR extraction
curl -X POST http://localhost:3000/api/documents/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "document_id": "uuid-from-above",
    "file_path": "receipts/sample.jpg"
  }'

Expected Response:
{
  "success": true,
  "extracted_data": {
    "vendor_name": "...",
    "date": "2025-06-22",
    "items": [...],
    "total": 1500,
    "vat": 105,
    "confidence": 87
  },
  "gl_suggestion": {
    "account_code": "5301",
    "account_name": "Utilities",
    "confidence": 92
  }
}
```

**Test 2.3: Expense Recording**
```bash
curl -X POST http://localhost:3000/api/accounting/record-expense \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "project_id": "aaaaaaaa-0000-0000-0000-000000000001",
    "document_id": "uuid",
    "vendor_name": "Sample Vendor",
    "amount": 1500,
    "vat": 105,
    "account_code": "5301",
    "expense_date": "2025-06-22"
  }'

Expected Response:
{
  "success": true,
  "expense_id": "uuid",
  "gl_entry_id": "uuid",
  "status": "approved" (if < 50000) or "pending_approval"
}
```

#### Step 3.3: Test Finance Automation (10 นาที)

**Test 3.1: Cash Flow Forecast**
```bash
curl -X GET "http://localhost:3000/api/finance/cash-flow/forecast" \
  -H "Authorization: Bearer test-token"

Expected Response:
{
  "success": true,
  "forecast": [
    {
      "week": 1,
      "date": "2025-06-22",
      "inflow": 500000,
      "outflow": 250000,
      "net": 250000,
      "balance": 250000,
      "risk_flags": []
    },
    {
      "week": 2,
      "date": "2025-06-29",
      "inflow": 250000,
      "outflow": 300000,
      "net": -50000,
      "balance": 200000,
      "risk_flags": ["negative_weekly_net"]
    },
    ...
  ],
  "risks_detected": 3,
  "critical_weeks": [4, 8]
}
```

**Test 3.2: Auto-Schedule Payments**
```bash
curl -X POST http://localhost:3000/api/finance/payments/auto-schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "project_id": "aaaaaaaa-0000-0000-0000-000000000001"
  }'

Expected Response:
{
  "success": true,
  "scheduled_count": 5,
  "payments_scheduled": [
    {
      "inst_id": "uuid",
      "vendor": "...",
      "amount": 50000,
      "payment_date": "2025-06-28",
      "status": "scheduled"
    },
    ...
  ]
}
```

#### Step 3.4: Test Marketing Automation (8 นาที)

**Test 4.1: Campaign Scheduling**
```bash
curl -X POST http://localhost:3000/api/marketing/campaigns/schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "project_id": "aaaaaaaa-0000-0000-0000-000000000001",
    "sequence_type": "NEW_LEAD",
    "lead_ids": ["lead-uuid-1", "lead-uuid-2"],
    "channels": ["sms", "email"]
  }'

Expected Response:
{
  "success": true,
  "campaign_id": "uuid",
  "enrolled_count": 2,
  "messages_scheduled": 8,
  "first_dispatch": "2025-06-22T19:30:00Z",
  "status": "active"
}
```

**Test 4.2: Campaign Analytics**
```bash
curl -X GET "http://localhost:3000/api/marketing/campaigns/analytics" \
  -H "Authorization: Bearer test-token"

Expected Response:
{
  "success": true,
  "analytics": {
    "total_campaigns": 1,
    "total_messages_sent": 8,
    "total_responses": 0,
    "conversion_rate": 0,
    "channel_breakdown": {
      "sms": { "sent": 4, "responses": 0 },
      "email": { "sent": 4, "responses": 0 }
    }
  }
}
```

#### Step 3.5: Test Cron Jobs Configuration (4 นาที)

**Check Cron Configuration:**
```bash
cat vercel.json | jq '.crons'

Expected Output:
[
  {
    "path": "/api/cron/sla-reminder",
    "schedule": "0 1 * * *"
  },
  {
    "path": "/api/cron/evening-report",
    "schedule": "0 11 * * *"
  },
  {
    "path": "/api/cron/finance/auto-schedule-payments",
    "schedule": "0 9 * * *"
  },
  {
    "path": "/api/cron/finance/cash-flow-alerts",
    "schedule": "0 7 * * *"
  },
  {
    "path": "/api/cron/marketing/dispatch-messages",
    "schedule": "*/15 * * * *"
  }
]
```

**After deployment, check Vercel logs:**
```
Vercel Dashboard → Deployments → Logs
Look for cron job execution logs
Expected: Job runs at scheduled times without errors
```

---

### 📊 PHASE 4: Final Verification (10 นาที)

#### Step 4.1: Database Verification

```bash
# Connect to Supabase SQL Editor
Run query:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('documents', 'general_ledger', 'expenses', 'gl_accounts', 
                   'payment_instructions', 'marketing_campaigns', 'marketing_messages',
                   'cash_flow_forecast', 'auto_approved_expenses', 'marketing_analytics');

Expected: All 10 tables present
```

#### Step 4.2: Build Verification

```bash
npm run build

Expected Output:
✓ Compiled successfully
○ Prerendered as static content
ƒ server-rendered on demand
```

#### Step 4.3: Git Verification

```bash
git log --oneline -3

Expected:
fb39c8e Final status report: v6.55 complete and ready for production
a8ecce4 docs: Complete deployment and setup documentation for v6.55
be29af2 Configure Vercel cron jobs for automation
```

---

## 🎯 SUCCESS CRITERIA

### ✅ All systems must pass:

```
📄 Receipt OCR:
  ✅ Upload endpoint returns 200
  ✅ OCR extraction works (or mock data if no ANTHROPIC_API_KEY)
  ✅ GL suggestion engine working
  ✅ RLS policies enforce access

💰 Finance:
  ✅ Forecast calculated correctly
  ✅ Risk detection working
  ✅ Payment scheduling functional
  ✅ Auto-approval logic working

🎯 Marketing:
  ✅ Campaign scheduling works
  ✅ Message templates configured
  ✅ Analytics tracking functional
  ✅ Multi-channel support ready (SMS/Email/LINE)

⏰ Cron Jobs:
  ✅ All 5 jobs configured in vercel.json
  ✅ Schedules correct (converted to UTC)
  ✅ No deployment errors
  ✅ Logs show job execution

🔒 Security:
  ✅ All 8 P0 fixes applied
  ✅ RLS policies enforced
  ✅ No credential leaks
  ✅ Auth checks on all endpoints
```

---

## 📝 TESTING RESULTS TEMPLATE

When you complete testing, report:

```
✅ RECEIPT OCR SYSTEM:
   □ Upload endpoint: PASS/FAIL
   □ OCR extraction: PASS/FAIL (credential: YES/NO)
   □ GL suggestion: PASS/FAIL
   □ Database tables: PASS/FAIL

✅ FINANCE AUTOMATION:
   □ Cash flow forecast: PASS/FAIL
   □ Risk detection: PASS/FAIL
   □ Payment scheduling: PASS/FAIL
   □ Auto-approval: PASS/FAIL

✅ MARKETING AUTOMATION:
   □ Campaign scheduling: PASS/FAIL
   □ Message dispatch: PASS/FAIL
   □ Analytics tracking: PASS/FAIL
   □ Multi-channel: PASS/FAIL

✅ CRON JOBS:
   □ All 5 configured: PASS/FAIL
   □ Deployment successful: PASS/FAIL
   □ Logs clean: PASS/FAIL

✅ SECURITY:
   □ P0 fixes verified: PASS/FAIL
   □ RLS policies active: PASS/FAIL
   □ Auth enforced: PASS/FAIL

OVERALL RESULT: READY FOR GO-LIVE / NEEDS FIXES
```

---

## ⏱️ Expected Timeline

```
19:00 - Start infrastructure setup (30 min)
19:30 - Migrations + Storage + Vercel config
20:00 - Start dev testing (30 min)
20:30 - Run all test scenarios
21:00 - Final verification (10 min)
21:10 - ✅ SYSTEM READY FOR GO-LIVE!
```

---

## 🚀 Ready?

**Confirm you understand all steps above:**
- [ ] All 4 migrations ready to run
- [ ] Storage bucket ready to create
- [ ] Environment variables ready to add
- [ ] Vercel redeploy ready to trigger
- [ ] Dev server ready to start
- [ ] Test scenarios understood
- [ ] Success criteria understood

**When ready, respond with:** "เริ่มเลย" or "ทำเลย"

---

**Next Action:** Wait for your confirmation, then execute all phases immediately.
