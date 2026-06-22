# Finance & Marketing Automation (Phase 2-3) Documentation

## Version: 6.55
**Release Date:** June 21, 2026

---

## Overview

This document outlines the Finance & Marketing Automation system for AVIVA ONE, implementing automated payment scheduling, cash flow forecasting, expense approvals, lead nurturing campaigns, and marketing analytics.

### Key Features Implemented

**Finance Phase 2:**
- ✅ Auto-schedule payments from approved vouchers
- ✅ 90-day cash flow forecasting with risk detection
- ✅ Auto-approve low-risk expenses
- ✅ Trusted vendor whitelist management

**Marketing Phase 3:**
- ✅ Lead nurturing campaign sequences
- ✅ Scheduled message dispatch (SMS, Email, LINE, Call tasks)
- ✅ Campaign performance analytics
- ✅ Message templates with variable substitution
- ✅ Lead enrollment tracking

---

## Database Schema

### Finance Tables

#### 1. `payment_instructions`
Tracks scheduled payment records created from approved payment vouchers.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| payment_voucher_id | UUID | Reference to approved voucher |
| project_id | UUID | Project reference |
| amount | DECIMAL | Payment amount (THB) |
| to_account | VARCHAR(50) | Bank account number |
| to_bank | VARCHAR(100) | Bank name |
| description | TEXT | Payment description |
| scheduled_date | DATE | When to execute payment |
| status | VARCHAR(50) | pending/approved/sent/failed |
| sent_at | TIMESTAMP | When payment was sent |
| sent_reference | VARCHAR(100) | Bank/payment system reference |
| created_by | UUID | User who created record |
| created_at | TIMESTAMP | Creation timestamp |

**Indexes:** voucher_id, project_id, status, scheduled_date

**RLS Policy:** Finance role only (finance, ceo, coo, admin)

---

#### 2. `cash_flow_forecast`
Weekly cash flow projections and risk analysis.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| project_id | UUID | Project reference |
| forecast_date | DATE | Date forecast was generated |
| week_number | INT | 1-13 (weeks ahead) |
| week_start_date | DATE | Start of week |
| expected_inflow | DECIMAL | Projected revenue (THB) |
| expected_outflow | DECIMAL | Projected payments (THB) |
| net_position | DECIMAL | Inflow - outflow |
| has_negative_position | BOOLEAN | Risk flag: negative cash |
| large_outflow_flag | BOOLEAN | Risk flag: large payment week |
| collection_delay_flag | BOOLEAN | Risk flag: collection delays |
| created_by | UUID | Creator |
| created_at | TIMESTAMP | Timestamp |

**Indexes:** project_id, forecast_date, week_number

**RLS Policy:** Finance role only

---

#### 3. `auto_approved_expenses`
Log of expenses auto-approved by system.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| project_id | UUID | Project reference |
| vendor_name | VARCHAR(255) | Vendor name |
| amount | DECIMAL | Expense amount (THB) |
| invoice_number | VARCHAR(100) | Invoice number |
| invoice_date | DATE | Invoice date |
| gl_account_code | VARCHAR(50) | GL account |
| gl_account_name | VARCHAR(255) | Account name |
| status | VARCHAR(50) | auto_approved/posted/failed |
| jv_number | VARCHAR(100) | Journal voucher reference |
| posted_at | TIMESTAMP | When posted to GL |
| created_by | UUID | Creator |
| created_at | TIMESTAMP | Timestamp |

**RLS Policy:** Finance/Accounting/Admin only

---

#### 4. `trusted_vendors`
Whitelist of vendors eligible for auto-approval.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| project_id | UUID | Project reference |
| vendor_name | VARCHAR(255) | Vendor name |
| vendor_tax_id | VARCHAR(50) | Tax ID |
| max_auto_approve_amount | DECIMAL | Max auto-approval limit (THB) |
| is_trusted | BOOLEAN | Trusted flag |
| created_by | UUID | Creator |
| created_at | TIMESTAMP | Timestamp |

**Constraint:** Unique (project_id, vendor_name)

---

### Marketing Tables

#### 5. `marketing_campaigns`
Define lead nurturing campaign sequences.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| project_id | UUID | Project reference |
| name | VARCHAR(255) | Campaign name |
| description | TEXT | Campaign description |
| lead_status_filter | VARCHAR(100) | Lead status to target (NEW_LEAD, SITE_VISIT, etc.) |
| sequence_config | JSONB | Message sequence definition |
| is_active | BOOLEAN | Active flag |
| campaign_start_date | DATE | Campaign start |
| campaign_end_date | DATE | Campaign end |
| created_by | UUID | Creator |
| updated_by | UUID | Last updater |
| created_at | TIMESTAMP | Timestamp |

**Example sequence_config:**
```json
{
  "messages": [
    {
      "delay_hours": 1,
      "type": "sms",
      "template_id": "welcome-sms"
    },
    {
      "delay_hours": 24,
      "type": "email",
      "template_id": "day1-followup"
    },
    {
      "delay_hours": 72,
      "type": "line_message",
      "template_id": "day3-nurture"
    }
  ]
}
```

**RLS Policy:** Marketing/Sales/Admin roles

---

#### 6. `marketing_messages`
Scheduled and sent marketing messages to leads.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| project_id | UUID | Project reference |
| campaign_id | UUID | Campaign reference |
| lead_id | UUID | Lead being targeted |
| lead_name | VARCHAR(255) | Lead name (denormalized) |
| lead_phone | VARCHAR(20) | Lead phone (denormalized) |
| lead_email | VARCHAR(255) | Lead email (denormalized) |
| message_type | VARCHAR(50) | sms/email/line_message/call |
| subject | VARCHAR(255) | Email subject (if email) |
| content | TEXT | Message content |
| scheduled_at | TIMESTAMP | When to send |
| sent_at | TIMESTAMP | When actually sent |
| status | VARCHAR(50) | pending/sent/delivered/failed/bounced |
| error_message | TEXT | Error description if failed |
| response_received | BOOLEAN | Lead responded |
| response_at | TIMESTAMP | Response timestamp |
| click_count | INT | Links clicked in message |
| clicked_at | TIMESTAMP | First click time |
| created_by | UUID | Creator |
| created_at | TIMESTAMP | Timestamp |

**Indexes:** campaign_id, lead_id, scheduled_at (for pending), status, created_at

**RLS Policy:** Marketing/Sales/Admin roles

---

#### 7. `campaign_analytics`
Performance metrics for marketing campaigns.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| project_id | UUID | Project reference |
| campaign_id | UUID | Campaign reference |
| analytics_date | DATE | Date of metrics |
| messages_sent | INT | Total sent |
| messages_delivered | INT | Total delivered |
| messages_failed | INT | Total failed |
| messages_bounced | INT | Total bounced |
| response_count | INT | Lead responses |
| click_count | INT | Total link clicks |
| lead_status_changes | INT | Leads moved to next stage |
| conversion_count | INT | Leads moved to Booking+ status |
| revenue_generated | DECIMAL | Revenue attributed to campaign |
| delivery_rate | DECIMAL | Delivered/sent % |
| engagement_rate | DECIMAL | (responses+clicks)/delivered % |
| conversion_rate | DECIMAL | conversions/sent % |
| created_at | TIMESTAMP | Timestamp |
| updated_at | TIMESTAMP | Last update |

**Constraint:** Unique (project_id, campaign_id, analytics_date)

**RLS Policy:** Marketing/Admin roles

---

#### 8. `message_templates`
Reusable message templates for campaigns.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| project_id | UUID | Project reference |
| name | VARCHAR(255) | Template name |
| description | TEXT | Template description |
| message_type | VARCHAR(50) | sms/email/line_message |
| subject | VARCHAR(255) | Email subject |
| body | TEXT | Message template (supports {var} syntax) |
| variables | TEXT | JSON array of variable names |
| is_active | BOOLEAN | Active flag |
| created_by | UUID | Creator |
| created_at | TIMESTAMP | Timestamp |

**Example template:**
```
Hello {customer_name},

Thank you for your interest in {project_name}!
We'd love to schedule a site visit at your convenience.

Reply "YES" to confirm.
```

---

#### 9. `lead_campaign_enrollments`
Track which leads are enrolled in which campaigns.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| campaign_id | UUID | Campaign reference |
| lead_id | UUID | Lead reference |
| enrolled_at | TIMESTAMP | Enrollment timestamp |
| last_message_sent_at | TIMESTAMP | Last message sent |
| completed_at | TIMESTAMP | Campaign completion time |
| status | VARCHAR(50) | active/paused/completed/unsubscribed |
| current_message_index | INT | Current position in sequence |
| messages_sent_count | INT | Total messages sent |
| created_at | TIMESTAMP | Timestamp |
| updated_at | TIMESTAMP | Last update |

**Constraint:** Unique (campaign_id, lead_id)

---

## API Endpoints

### Finance APIs

#### 1. Auto-Schedule Payments
**Endpoint:** `POST /api/finance/payments/auto-schedule`

**Authentication:** Bearer token with finance role

**Request:**
```json
{
  "projectId": "aaaaaaaa-0000-0000-0000-000000000001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully scheduled 5 payments",
  "processed": 5,
  "payment_instructions": ["id1", "id2", "id3", "id4", "id5"]
}
```

**Logic:**
1. Verify finance role (finance/ceo/coo/admin)
2. Query approved vouchers due within 7 days
3. For each voucher:
   - Create payment_instruction record
   - Set scheduled date (tomorrow by default)
   - Status: pending
4. Log to daily_activity_log
5. Return count and IDs

---

#### 2. Cash Flow Forecast
**Endpoint:** `GET /api/finance/cash-flow/forecast`

**Authentication:** Bearer token with finance role

**Query Parameters:**
- `projectId` (string, optional): Project ID (default: main project)
- `days` (int, optional): Forecast period in days (default: 90)

**Response:**
```json
{
  "success": true,
  "forecast": [
    {
      "week_number": 1,
      "week_start_date": "2026-06-22",
      "expected_inflow": 500000,
      "expected_outflow": 300000,
      "net_position": 200000,
      "cumulative_position": 200000,
      "risk_level": "low"
    },
    {
      "week_number": 2,
      "week_start_date": "2026-06-29",
      "expected_inflow": 250000,
      "expected_outflow": 800000,
      "net_position": -550000,
      "cumulative_position": -350000,
      "risk_level": "high",
      "risk_reason": "Negative cash position"
    }
  ],
  "risks": [
    {
      "type": "negative_cash",
      "date": "2026-06-29",
      "impact": -350000,
      "description": "Cumulative cash position turns negative: -350,000"
    },
    {
      "type": "large_outflow",
      "date": "2026-07-06",
      "impact": 1200000,
      "description": "Large payment outflow expected: 1,200,000"
    }
  ],
  "summary": {
    "total_outflow_30d": 1500000,
    "total_inflow_30d": 1000000,
    "net_position_30d": -500000,
    "total_outflow_90d": 5000000,
    "total_inflow_90d": 4500000,
    "net_position_90d": -500000,
    "min_position": -350000,
    "min_position_date": "2026-06-29"
  }
}
```

**Logic:**
1. Verify finance role
2. Aggregate approved vouchers for next N days
3. Calculate weekly flows:
   - Outflows: sum of net_amount from payment_vouchers
   - Inflows: projected revenue from closed deals (TODO: implement)
4. Detect risks:
   - Negative cumulative position
   - Large single-week outflows (>1M THB)
   - Collection delays (TODO: implement)
5. Return 13-week forecast and risks

---

#### 3. Auto-Approve Expenses
**Endpoint:** `POST /api/finance/expenses/auto-approve`

**Authentication:** Bearer token with finance role

**Query Parameters:**
- `projectId` (string, optional): Project ID

**Response:**
```json
{
  "success": true,
  "message": "Processed expenses: 3 approved, 2 skipped",
  "approved_count": 3,
  "skipped_count": 2,
  "approved_expenses": ["exp1", "exp2", "exp3"],
  "skipped_expenses": [
    {"id": "exp4", "reason": "Amount exceeds threshold"},
    {"id": "exp5", "reason": "Unknown vendor"}
  ]
}
```

**Logic:**
1. Verify finance role
2. Query pending expenses < 50,000 THB
3. For each expense:
   - Check if vendor is in trusted_vendors list
   - If trusted and amount OK: auto-approve
   - Create GL posting/JV entry
   - Send notification to accountant
4. Log failed approvals for manual review

---

### Marketing APIs

#### 4. Schedule Lead Nurturing Campaign
**Endpoint:** `POST /api/marketing/campaigns/schedule`

**Authentication:** Bearer token with marketing role

**Request:**
```json
{
  "campaignId": "campaign-uuid",
  "batchSize": 100,
  "projectId": "aaaaaaaa-0000-0000-0000-000000000001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully scheduled 450 messages",
  "scheduled_count": 50,
  "messages_scheduled": 450,
  "campaign_id": "campaign-uuid"
}
```

**Logic:**
1. Verify marketing role
2. Fetch campaign with sequence_config
3. Get active enrollments (batch_size limit)
4. For each enrollment:
   - Parse sequence_config
   - For each message in sequence:
     * Calculate scheduled_at = now + delay_hours
     * Resolve template_id to actual content
     * Insert marketing_messages record
5. Update enrollment status to active
6. Log to daily_activity_log

---

#### 5. Campaign Performance Analytics
**Endpoint:** `GET /api/marketing/campaigns/analytics`

**Authentication:** Bearer token with marketing role

**Query Parameters:**
- `campaignId` (string, optional): Filter by campaign
- `projectId` (string, optional): Filter by project
- `startDate` (string, optional): Start date (YYYY-MM-DD)
- `endDate` (string, optional): End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "metrics": {
    "campaign_id": "campaign-uuid",
    "campaign_name": "Welcome Sequence - New Leads",
    "messages_sent": 500,
    "messages_delivered": 480,
    "messages_failed": 20,
    "delivery_rate": 96.0,
    "responses_count": 145,
    "clicks_count": 89,
    "engagement_rate": 48.75,
    "conversions": 12,
    "conversion_rate": 2.4,
    "revenue_generated": 2400000
  },
  "trend": [
    {
      "date": "2026-06-20",
      "sent": 100,
      "delivered": 98,
      "responses": 30,
      "conversions": 2,
      "revenue": 400000
    },
    {
      "date": "2026-06-21",
      "sent": 120,
      "delivered": 115,
      "responses": 40,
      "conversions": 3,
      "revenue": 600000
    }
  ],
  "message_type_stats": {
    "sms": {"sent": 300, "delivered": 290, "failed": 10},
    "email": {"sent": 150, "delivered": 145, "failed": 5},
    "line_message": {"sent": 50, "delivered": 45, "failed": 5}
  },
  "summary": {
    "total_records": 2,
    "period_start": "2026-06-20",
    "period_end": "2026-06-21",
    "generated_at": "2026-06-21T16:00:00Z"
  }
}
```

---

## Cron Jobs

### 1. Auto-Schedule Payments Cron
**URL:** `/api/cron/finance/auto-schedule-payments`

**Schedule:** Daily at 9:00 AM (`0 9 * * *`)

**Authorization:** CRON_SECRET header

**Function:** Calls POST /api/finance/payments/auto-schedule to schedule due payments

**Vercel Cron Config (Add to vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/cron/finance/auto-schedule-payments",
      "schedule": "0 9 * * *"
    }
  ]
}
```

---

### 2. Marketing Messages Dispatch Cron
**URL:** `/api/cron/marketing/dispatch-messages`

**Schedule:** Every 15 minutes (`*/15 * * * *`)

**Authorization:** CRON_SECRET header

**Function:**
1. Query pending messages with scheduled_at <= now()
2. For each message:
   - Determine channel (SMS/Email/LINE/Call)
   - Send via appropriate provider
   - Update status to sent/failed
3. Update campaign_analytics counters

**Vercel Cron Config:**
```json
{
  "crons": [
    {
      "path": "/api/cron/marketing/dispatch-messages",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

---

### 3. Cash Flow Risk Alerts Cron
**URL:** `/api/cron/finance/cash-flow-alerts`

**Schedule:** Daily at 7:00 AM (`0 7 * * *`)

**Authorization:** CRON_SECRET header

**Function:**
1. Call GET /api/finance/cash-flow/forecast
2. Detect high-risk alerts
3. Send notifications to finance department
4. Log to daily_activity_log

**Vercel Cron Config:**
```json
{
  "crons": [
    {
      "path": "/api/cron/finance/cash-flow-alerts",
      "schedule": "0 7 * * *"
    }
  ]
}
```

---

## Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cron
CRON_SECRET=your-cron-secret
CRON_SERVICE_TOKEN=your-service-token
NEXT_PUBLIC_APP_URL=https://your-app.com

# SMS/Email Providers (TODO: Configure)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
SENDGRID_API_KEY=...
LINE_CHANNEL_ACCESS_TOKEN=...
```

---

## Testing Checklist

### Finance Automation Tests

- [ ] Test auto-schedule payments with valid vouchers
  - Query payment_vouchers table with status='approved'
  - Verify payment_instructions created
  - Verify scheduled_date is set correctly
  
- [ ] Test cash flow forecast
  - Verify 13-week forecast generated
  - Check negative position detection
  - Verify large outflow flags
  
- [ ] Test auto-approve expenses
  - Test with trusted vendor
  - Test with unknown vendor
  - Verify GL posting created
  
- [ ] Test role-based access
  - Verify finance role can access
  - Verify non-finance blocked with 403

### Marketing Automation Tests

- [ ] Test campaign scheduling
  - Create test campaign with sequence
  - Verify messages scheduled at correct times
  - Check message templates resolved
  
- [ ] Test message dispatch
  - Verify pending messages sent
  - Check status updated to 'sent'
  - Test all message types (SMS/Email/LINE)
  
- [ ] Test campaign analytics
  - Verify metrics aggregated correctly
  - Check delivery rates calculated
  - Verify engagement rate formula
  
- [ ] Test enrollment tracking
  - Verify lead enrollments created
  - Check current_message_index incremented
  - Test pause/resume functionality

### Cron Job Tests

- [ ] Test auto-schedule cron
  - Manually trigger via API
  - Verify payment_instructions created
  - Check daily_activity_log entry
  
- [ ] Test dispatch cron
  - Schedule test messages
  - Run cron manually
  - Verify messages sent and status updated
  
- [ ] Test alert cron
  - Create negative cash scenario
  - Run cron
  - Verify alerts generated

---

## Integration Notes

### With Existing Systems

1. **Payment Vouchers**
   - payment_instructions references payment_vouchers
   - Auto-scheduler runs on approved vouchers only
   - Updates payment status to 'paid' after execution

2. **Leads/CRM**
   - marketing_messages references leads by ID
   - Denormalizes lead_name, lead_phone, lead_email
   - Campaign enrollment filters leads by lead_status_filter

3. **Notifications**
   - Auto-approvals send notification_log entries
   - Cash flow alerts trigger push notifications
   - Marketing dispatch calls existing SMS/Email services

4. **Activity Logging**
   - All operations logged to daily_activity_log
   - Reference_type: 'marketing_campaigns', 'payment_vouchers'
   - Activity_type: 'finance_automation', 'marketing_automation'

---

## Performance Considerations

### Database Indexes
- `idx_payment_instructions_scheduled_date` - For cron job filtering
- `idx_marketing_messages_scheduled_at` - For pending message query
- `idx_campaign_analytics_date` - For trend analysis
- `idx_lead_campaign_enrollments_active` - For active campaign filtering

### Query Optimization
- Cron jobs use batch limits (100 messages per run)
- Campaign analytics uses daily rollups
- Payment forecast caches 90-day window

### Scaling
- Cron jobs designed for horizontal scaling
- Each cron run processes limited batch to prevent timeouts
- Idempotent operations (safe to re-run)

---

## Security & Compliance

### RLS Policies
- All tables protected with role-based RLS
- Finance tables: finance/ceo/coo/admin only
- Marketing tables: marketing/admin only

### Audit Trail
- All API calls logged to daily_activity_log
- User ID tracked via created_by field
- Timestamps recorded for all changes

### Data Privacy
- Lead personal data (phone/email) stored
- No payment card data stored
- Bank account numbers stored in payment_instructions (handle with care)

---

## Known Limitations & TODO

- [ ] SMS/Email providers not integrated (placeholder functions)
- [ ] LINE API integration needed for line_message type
- [ ] Revenue attribution logic incomplete (TODO in cash flow)
- [ ] Contractor bank account lookup needs implementation
- [ ] Message template variable substitution not yet implemented
- [ ] Collection delay prediction needs historical data
- [ ] Recurring expenses table not yet created

---

## Support & Maintenance

### Common Issues

**Payment Instructions not creating:**
- Check payment_vouchers table for approved status
- Verify finance role assigned to user
- Check daily_activity_log for error messages

**Messages not sending:**
- Verify cron job is running (check logs)
- Check marketing_messages status
- Verify lead_phone or lead_email populated

**Cash flow forecast inaccurate:**
- Verify payment_vouchers have approved_at dates
- Check for data gaps in closed deals
- Review risk detection thresholds

### Monitoring
- Monitor cron job execution logs
- Alert on failed message deliveries
- Track auto-approval rejection rates
- Review cash flow forecast accuracy

---

## Version History

- **v6.55** (2026-06-21) - Initial release: Finance Phase 2-3, Marketing Phase 3
  - Payment automation APIs
  - Cash flow forecasting
  - Lead nurturing campaigns
  - Message scheduling & dispatch
  - Campaign analytics

---

## References

- Database Schema: See migration files
  - `20260621a_finance_automation_phase2.sql`
  - `20260621b_marketing_automation_phase3.sql`
- API Routes: `/src/app/api/finance/` and `/src/app/api/marketing/`
- Cron Jobs: `/src/app/api/cron/finance/` and `/src/app/api/cron/marketing/`
