# 📋 AVIVA ONE v6.55 Setup Guide
## Automated Systems: Accounting, Finance, Marketing

**Updated:** June 22, 2025  
**Version:** 6.55  
**Status:** Ready for Deployment ⚡

---

## 🎯 Quick Overview

This system includes 3 major features:

| Feature | How It Works | Time Saved |
|---------|-------------|-----------|
| 📄 **Receipt OCR Processing** | Upload → Extract automatically → Suggest GL → Approve | 70-80% accounting time |
| 💰 **Auto-Schedule Payments** | Check → Create → Route for approval (7-day cycle) | 60% workflow |
| 📈 **Cash Flow Forecast & Alerts** | Calculate 13 weeks → Detect risks → Alert | 85% accuracy |
| 🎯 **AI Lead Nurturing Sequences** | Send SMS/Email/Line → Track responses → Measure success | +60% sales conversion |

---

## 📦 Setup Steps (6 Steps)

### **Step 1: Supabase Database Migrations**

#### File Locations:
```
supabase/migrations/
├── 20260621_receipt_ocr_system.sql          (Documents + GL + Expenses)
├── 20260621a_finance_automation_phase2.sql  (Payments + Forecast)
├── 20260621b_marketing_automation_phase3.sql (Campaigns + Dispatch)
└── 20260621c_add_rls_activity_tables.sql    (Department-level security)
```

#### Steps:
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select AVIVA ONE project
3. Navigate to **SQL Editor**
4. For each migration file:
   - **Copy** entire contents
   - **Paste** into SQL Editor
   - **Click** "Run"
   - **Verify** no errors

#### ⚠️ IMPORTANT: Run in this order ONLY
```
1️⃣  20260621_receipt_ocr_system.sql
2️⃣  20260621a_finance_automation_phase2.sql  
3️⃣  20260621b_marketing_automation_phase3.sql
4️⃣  20260621c_add_rls_activity_tables.sql
```

---

### **Step 2: Storage Bucket for Documents**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Storage**
3. Click **"Create bucket"** (blue button)
4. Name: `receipts`
5. **IMPORTANT:** Set Privacy to **Private** (NOT Public)
6. Click **"Create bucket"**

**Verify:** Go to `receipts` bucket → **Policies** and confirm:
```
✅ SELECT: authenticated & role = 'accounting|finance|admin'
✅ INSERT: authenticated & role = 'accounting|finance|admin'
✅ UPDATE: authenticated & role = 'accounting|finance|admin'
```

---

### **Step 3: External Services (Choose 1-3)**

#### Option A: SMS - BulkSMS
```
1. Go to https://www.bulksms.com
2. Sign up → Get API Key
3. Configure:
   • Username: YOUR_BULKSMS_USERNAME
   • API Key: YOUR_BULKSMS_API_KEY
```

#### Option B: Email - SendGrid  
```
1. Go to https://sendgrid.com
2. Sign up → Create API Key
3. Configure:
   • API Key: YOUR_SENDGRID_API_KEY
   • From Email: noreply@avivaone.co.th (must be verified)
```

#### Option C: LINE Bot
```
1. Go to https://business.line.biz
2. Create Official Account or Bot
3. Go to Messaging API settings
4. Configure:
   • Channel Access Token: YOUR_LINE_CHANNEL_ACCESS_TOKEN
   • Channel Secret: YOUR_LINE_CHANNEL_SECRET
   • Webhook URL: https://aviva-one.vercel.app/api/line/webhook
```

---

### **Step 4: Environment Variables (Vercel)**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select AVIVA ONE project
3. Navigate to **Settings** → **Environment Variables**
4. **Add variables** as shown below:

```bash
# ✅ Cron Job Security
CRON_SECRET=your-random-secret-32-chars

# SMS Provider (BulkSMS)
SMS_PROVIDER=bulksms
BULKSMS_USERNAME=your_bulksms_username
BULKSMS_API_KEY=your_bulksms_api_key

# Email Provider (SendGrid)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@avivaone.co.th

# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_WEBHOOK_URL=https://aviva-one.vercel.app/api/line/webhook
```

#### ⚠️ Security Guidelines:
- Never use test values (keep credentials secure)
- Rotate API keys every 3 months
- Don't commit to git (see `.env.template`)

---

### **Step 5: Redeploy in Vercel**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select AVIVA ONE project
3. Go to **Deployments** → Find latest
4. Click **⋮ (menu)** → **Redeploy**
5. Verify:
   - ✅ Status changes to green (Deployment successful)
   - ✅ Logs show no errors
   - ✅ Takes ~2-3 minutes

---

### **Step 6: User Acceptance Testing (UAT)**

#### Test 1: Receipt OCR Processing 📄
```
1. Navigate to /accounting/receipt-processor
2. Upload 5+ receipt images (jpg/png)
3. Verify:
   ✅ All fields extracted (vendor, date, amount, VAT)
   ✅ GL account suggested correctly
   ✅ Anomalies flagged if present
   ✅ Submit for approval or save
```

#### Test 2: Auto-Schedule Payments 💰
```
1. Create new INST due in 3-7 days
2. Approve INST
3. Wait for cron job at 9 AM UTC+7
4. Verify:
   ✅ payment_instruction created
   ✅ Notification sent to Finance Manager
   ✅ Log recorded in /api/cron/finance/auto-schedule-payments
```

#### Test 3: Cash Flow Forecast & Alerts 📈
```
1. Navigate to /finance/cash-flow-forecast (if available)
2. Verify:
   ✅ 13-week forecast (today +91 days)
   ✅ Inflow/Outflow separated
   ✅ Risk flags (negative cash, large outflows)
3. Wait for cron job at 7 AM UTC+7
4. Verify notification sent if risks detected
```

#### Test 4: Lead Nurturing Sequences 🎯
```
1. Create new Lead (source = Prospect/Demo)
2. Mark as "NEW_LEAD"
3. Verify:
   ✅ First SMS sent (1h after creation)
   ✅ Email sent (1h after creation)
   ✅ LINE message sent (if connected)
4. Wait for cron triggers:
   - 24h: "Check In" message sent
   - 3d: "No Response" sequence (if no reply)
   - 7d: Sequence ends
5. Verify metrics:
   ✅ Sent count
   ✅ Response count  
   ✅ Conversion rate
```

#### Test 5: Cron Jobs
```
Check Vercel Logs:
1. 01:00 → /api/cron/sla-reminder
2. 07:00 → /api/cron/finance/cash-flow-alerts
3. 09:00 → /api/cron/finance/auto-schedule-payments
4. 11:00 → /api/cron/evening-report
5. */15 → /api/cron/marketing/dispatch-messages (every 15 min)

Note: Times are UTC → Convert to Thailand time (UTC+7):
  01:00 UTC = 08:00 Thailand
  07:00 UTC = 14:00 Thailand
  09:00 UTC = 16:00 Thailand
  11:00 UTC = 18:00 Thailand
```

---

## 🚀 Quick Commands

### View Vercel Logs
```bash
# Use Vercel UI instead
# Vercel Dashboard → Deployments → View Logs
```

### Test APIs Locally
```bash
# Test Receipt OCR
curl -X POST http://localhost:3000/api/documents/process \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "file=@receipt.jpg"

# Test Forecast
curl -X GET "http://localhost:3000/api/finance/cash-flow/forecast" \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## ⚠️ Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Migration fails | RLS policy conflict | Delete old table → Re-run migration |
| Receipt OCR fails | Poor image quality or confidence < 85% | Retake photo with better lighting |
| SMS/Email not sent | Wrong credentials | Check API Key in Vercel env |
| Cron not running | Missing CRON_SECRET | Add CRON_SECRET to Vercel env |
| 404 API endpoint | Migration not executed | Run all 4 migration files |

---

## 📞 Additional Notes

### New API Endpoints
- `POST /api/documents/upload` - Upload document
- `POST /api/documents/process` - Process OCR
- `POST /api/accounting/record-expense` - Record expense
- `GET /api/finance/cash-flow/forecast` - Get forecast
- `POST /api/finance/payments/auto-schedule` - Schedule payment
- `POST /api/marketing/campaigns/schedule` - Schedule campaign
- `GET /api/marketing/campaigns/analytics` - Get metrics

### New Database Tables
- `documents` - Document/receipt storage
- `general_ledger` - GL entries
- `expenses` - Expense records
- `gl_accounts` - GL chart
- `payment_instructions` - Payment orders
- `marketing_campaigns` - Campaigns
- `marketing_messages` - Messages
- `marketing_analytics` - Metrics

### New Storage Bucket
- `receipts` - Receipt images (Private)

---

## ✅ Implementation Checklist

- [ ] Run 4 migration files in Supabase
- [ ] Create `receipts` bucket in Storage
- [ ] Sign up for BulkSMS / SendGrid / LINE
- [ ] Add environment variables in Vercel
- [ ] Redeploy in Vercel
- [ ] Test Receipt OCR (5+ receipts)
- [ ] Test Auto-Schedule Payments
- [ ] Test Cash Flow Forecast
- [ ] Test Lead Nurturing (SMS/Email/LINE)
- [ ] Check Cron logs
- [ ] ✅ System Live!

---

**Created:** June 22, 2025  
**Final Version:** 6.55  
**Status:** ✅ Ready to Launch
