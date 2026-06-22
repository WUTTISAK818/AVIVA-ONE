# Receipt OCR System - Phase 1 Implementation Guide
**Version**: 6.55  
**Date**: 2026-06-21  
**Status**: Ready for Testing & Deployment

---

## Overview
Receipt OCR System enables automated processing of receipts/invoices:
1. **User Upload** → Receipt image (JPG/PNG/PDF)
2. **AI Extraction** → Claude Vision reads vendor, date, items, amounts
3. **GL Mapping** → Auto-suggests GL account based on vendor/items
4. **Approval** → Manual review or auto-save depending on amount
5. **Database** → Stores to GL, expenses table, with full audit trail

---

## Files Created (6 total)

### 1. **Library Service** - `/src/lib/receipt-linking.ts` (257 lines)
Handles GL account mapping and anomaly detection.

**Key Functions:**
- `suggestGLAccount(receipt)` → Returns GL code + category + confidence + flags
- `isConstructionRelated(receipt)` → Boolean for project linking
- `detectContractor(vendor_name)` → Contractor lookup
- `detectFlags(receipt)` → Warning flags (amount, VAT, date, missing info)

**GL Accounts Supported:**
```
5201 → Fuel/Transportation
5202 → Meals & Entertainment  
5203 → Office Supplies
5204 → Maintenance & Repairs
5301 → Utilities
5401 → Advertising
5402 → Professional Services
6001 → Construction Materials
6100 → Contractor Payment
6200 → Labor & Wages
```

**Vendor Pattern Matching:**
- Regex-based vendor name matching (Thai + English)
- Fallback to item descriptions if vendor not recognized
- Default category: Supplies (GL 5203) if no match

---

### 2. **Upload API** - `/src/app/api/documents/upload/route.ts` (157 lines)
Handles file upload and initial storage.

**Endpoint:** `POST /api/documents/upload`

**Auth:**
- Requires Bearer token
- Only: accounting, finance, admin, ceo, coo, manager, director

**Request Body:**
```json
{
  "file": FormData,
  "documentType": "receipt|invoice|bill"
}
```

**Response:**
```json
{
  "documentId": "uuid",
  "status": "uploaded",
  "message": "File uploaded successfully"
}
```

**Features:**
- Validates file type (JPG, PNG, PDF only)
- Max 10MB file size
- Stores in Supabase Storage bucket: `receipts/{user_id}/{timestamp}-{random}-{filename}`
- Creates metadata record in `documents` table
- RLS: Users can only see own documents

---

### 3. **OCR Processing API** - `/src/app/api/documents/process/route.ts` (267 lines)
Calls Claude Vision to extract receipt data.

**Endpoint:** `POST /api/documents/process`

**Request Body:**
```json
{
  "documentId": "uuid"
}
```

**Response:**
```json
{
  "status": "ready_for_approval|review_needed",
  "data": {
    "documentId": "uuid",
    "extracted_data": {
      "date": "YYYY-MM-DD",
      "vendor_name": "string",
      "items": [...],
      "subtotal": number,
      "vat": number,
      "total": number,
      "payment_method": "cash|card|bank",
      "vendor_tax_id": "string"
    },
    "gl_suggestion": {
      "gl_account": "5201",
      "account_name": "เชื้อเพลิง",
      "confidence": 95,
      "flags": [...]
    },
    "confidence": 95,
    "extraction_model": "claude-opus-4-8"
  }
}
```

**Processing Steps:**
1. Verify auth + document ownership
2. Download file from Supabase Storage
3. Convert to base64
4. Call Claude Vision API with OCR prompt
5. Extract JSON response
6. Validate confidence >= 85%
7. Call `suggestGLAccount()` for mapping
8. Save extracted_data to documents table
9. Update status: `ready_for_approval` or `review_needed`

**Confidence Thresholds:**
- >= 95%: High confidence (ready to approve)
- 85-94%: Medium confidence (review_needed)
- < 85%: Low confidence (requires manual review)

---

### 4. **Record Expense API** - `/src/app/api/accounting/record-expense/route.ts` (191 lines)
Saves validated receipt to GL and expenses tables.

**Endpoint:** `POST /api/accounting/record-expense`

**Request Body:**
```json
{
  "documentId": "uuid",
  "vendor_name": "string",
  "expense_date": "YYYY-MM-DD",
  "description": "string",
  "amount": number,
  "vat": number,
  "total": number,
  "gl_account": "5201",
  "payment_method": "cash|card|bank",
  "project_id": "uuid (optional)",
  "contractor_id": "uuid (optional)",
  "notes": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "entryId": "uuid",
  "status": "approved|pending_approval",
  "approval_required": boolean,
  "message": "Expense auto-approved and recorded"
}
```

**Auto-Approval Logic:**
- If `total <= 50,000 THB`: Auto-approved (status = "approved")
- If `total > 50,000 THB`: Routes to manager approval (status = "pending_approval")

**Database Updates:**
1. Insert → `general_ledger` (GL entry with credit to expense account)
2. Insert → `expenses` (tracking record)
3. Update → `documents` (link to expense record)
4. Insert → `notifications` (alert accountant/manager)

---

### 5. **Receipt Processor UI** - `/src/app/accounting/receipt-processor/page.tsx` (564 lines)
React component for end-to-end receipt processing.

**Route:** `/accounting/receipt-processor`

**Access:**
- Only: accounting, finance, admin users
- Redirects to access denied if unauthorized

**Features:**

#### Upload Section
- Drag & drop zone
- Click to browse file
- Real-time file validation
- Progress indicator while processing

#### Receipt Preview (After Processing)
- Vendor name
- Date
- Items table (description, qty, unit price)
- Subtotal, VAT, Total amounts
- GL account suggestion with confidence
- Warning flags (high/medium/low severity)
- **Buttons:**
  - ✅ Confirm & Save → Records to GL/expenses
  - ❌ Cancel → Discards receipt

#### Recent Uploads List
- Shows last 10-20 receipts
- Status badge (color-coded)
- Amount and OCR confidence %
- Upload timestamp
- Click to view details

**Status Indicators:**
- 🔵 Uploaded (gray) - Initial upload
- 🔄 Processing (blue, animated) - OCR running
- 👁️ Ready (yellow) - Waiting approval
- ⚠️ Review Needed (orange) - Low OCR confidence
- ✅ Saved (green) - Successfully recorded
- ⏱️ Pending Approval (purple) - Awaiting manager
- ❌ Error (red) - Failed to process

---

### 6. **Database Schema** - `/supabase/migrations/20260621_receipt_ocr_system.sql` (188 lines)

**Tables Created:**

#### `documents` (Receipt metadata)
```sql
id uuid PRIMARY KEY
project_id uuid
uploaded_by uuid
file_path text
file_name text
document_type text (receipt|invoice|bill)
extracted_data jsonb
status text (uploaded|processing|ready_for_approval|...)
linked_to uuid
created_at timestamptz
```
- RLS: Users can only view own documents

#### `general_ledger` (GL postings)
```sql
id uuid PRIMARY KEY
project_id uuid
account_code text (5201, 6100, etc.)
description text
debit_amount numeric
credit_amount numeric
transaction_date date
created_by uuid
status text (pending_approval|approved|rejected)
created_at timestamptz
```
- RLS: Only accounting/finance roles can view/edit

#### `expenses` (Expense tracking)
```sql
id uuid PRIMARY KEY
project_id uuid
gl_entry_id uuid
vendor_name text
expense_date date
amount numeric
vat numeric
total_amount numeric
payment_method text
project_id_linked uuid (for construction allocation)
contractor_id uuid
status text
recorded_by uuid
created_at timestamptz
```
- RLS: Only accounting/finance roles can view/edit

#### `gl_accounts` (Master chart)
```sql
account_code text (5201, 6100, etc.)
account_name text (Thai/English)
account_type text (expense, asset, etc.)
category text
description text
```
- Pre-populated with 10 common expense accounts

---

## Testing Checklist

### Unit Tests (Manual)

#### Test 1: Upload receipt (JPG)
```
1. Navigate to /accounting/receipt-processor
2. Select JPG receipt (5-10MB, clear text)
3. Drag & drop or click "Select File"
4. Verify: Upload completes, status = "Processing"
```

#### Test 2: OCR Extraction
```
1. Wait for OCR processing (< 30 seconds)
2. Verify: Status = "Ready" or "Review Needed"
3. Check extracted data:
   - vendor_name matches receipt ✓
   - date is correct YYYY-MM-DD ✓
   - items list all line items ✓
   - amounts (subtotal, vat, total) = receipt ✓
   - payment_method detected correctly ✓
```

#### Test 3: GL Account Suggestion
```
1. For Fuel receipt:
   - GL should suggest 5201 ✓
   - Confidence >= 95% ✓
2. For unknown vendor:
   - GL should suggest 5203 (Supplies) ✓
   - Confidence 50-80% ✓
3. For construction materials:
   - GL should suggest 6001 ✓
   - Flag: "Construction-related" ✓
```

#### Test 4: Anomaly Detection
```
1. Upload receipt with:
   - VAT mismatch → Flag: "ภาษี...ไม่ตรง" ✓
   - Very large amount (> 1M) → Flag: "ยอดรวมสูงมาก" ✓
   - Future date → Flag: "วันที่ในอนาคต" ✓
   - Old receipt (> 90 days) → Flag: "ใบเสร็จเก่า" ✓
   - No vendor tax ID → Flag: "ไม่มีหมายเลขประจำตัว" ✓
```

#### Test 5: Auto-Approval
```
Amount <= 50,000:
1. Save receipt
2. Verify: GL entry created ✓
3. Verify: Expense record status = "approved" ✓
4. Verify: Document linked to expense ✓
5. Verify: Notification sent to accounting ✓

Amount > 50,000:
1. Save receipt
2. Verify: Expense record status = "pending_approval" ✓
3. Verify: Notification sent to manager ✓
```

#### Test 6: Auth & Security
```
1. Test as non-accounting user:
   - Access /accounting/receipt-processor → Redirected ✓
   - API /documents/upload → 403 Forbidden ✓
2. Test as accounting user:
   - Full access ✓
3. Test RLS:
   - User A uploads receipt
   - User B tries to access → Cannot see ✓
   - Admin can see all ✓
```

#### Test 7: Database Verification
```
After saving receipt:
1. Check documents table:
   - status = "saved" or "pending_approval" ✓
   - extracted_data has all fields ✓
   - linked_to = expense ID ✓
2. Check general_ledger table:
   - GL entry with correct account_code ✓
   - transaction_date = receipt date ✓
   - credit_amount = receipt total ✓
3. Check expenses table:
   - vendor_name matches ✓
   - status = "approved" or "pending_approval" ✓
   - gl_entry_id linked ✓
```

### Integration Tests

#### Test 8: Full End-to-End Flow
```
1. Upload 5 different receipt types:
   - Fuel (convenience store)
   - Food/beverage (restaurant)
   - Office supplies (stationary store)
   - Contractor payment (company invoice)
   - Utilities (electric bill)
2. Verify each extracts correctly
3. Verify GL accounts all different
4. Verify all save successfully
5. Check accounting dashboard shows new expenses
```

---

## Deployment Steps

### Step 1: Database Migration
```sql
-- Run in Supabase SQL Editor:
-- Copy entire content of:
-- /supabase/migrations/20260621_receipt_ocr_system.sql

-- Verify tables created:
SELECT tablename FROM pg_tables 
WHERE schemaname='public' AND tablename IN ('documents', 'general_ledger', 'expenses', 'gl_accounts');
```

### Step 2: Create Storage Bucket
```
Supabase Dashboard → Storage → New Bucket
- Name: receipts
- Privacy: Private (enable RLS)
- Allow list: *.jpg, *.jpeg, *.png, *.pdf
```

### Step 3: Build & Deploy
```bash
# Local/CI:
npm run build    # Must pass TypeScript checks
git add .
git commit -m "Phase 1: Receipt OCR System"
git push origin main

# Vercel/Platform:
- Auto-deploys from main branch
- Verify build succeeds
- Test in staging before production
```

### Step 4: Environment Checks
```
.env.local / Production Env Vars Required:
- NEXT_PUBLIC_SUPABASE_URL ✓
- NEXT_PUBLIC_SUPABASE_ANON_KEY ✓
- SUPABASE_SERVICE_ROLE_KEY (for serverDb) ✓
- ANTHROPIC_API_KEY (for Claude Vision) ✓

Optional:
- DEBUG=receipt-ocr (for verbose logging)
```

---

## Known Limitations & Future Work

### Phase 1 Limitations
1. **OCR Model**: Uses Claude Opus 4.8 (can be upgraded to Sonnet for faster processing)
2. **Project Linking**: Construction project auto-linking not yet fully integrated
3. **Contractor Matching**: Vendor-to-contractor mapping is manual (future: ML model)
4. **Multi-Currency**: Assumes Thai Baht (THB) - no currency conversion
5. **Duplicate Detection**: No built-in receipt duplicate checking

### Phase 2 Planned Features
1. **Bulk Upload**: Process multiple receipts at once
2. **Template Learning**: Learn vendor patterns per company over time
3. **Receipt History**: Search/filter past receipts
4. **GL Account Mapping**: Admin customizable mapping rules
5. **Approval Workflow**: Manager review + sign-off
6. **Email Integration**: Automated email receipt capture
7. **API Integration**: Connect to supplier portals
8. **Analytics Dashboard**: Expense trends, category breakdowns

---

## Troubleshooting

### Issue: Build fails with Turbopack cache error
**Solution:**
```bash
rm -rf .next .turbo
npm run build
```

### Issue: OCR returns low confidence (< 85%)
**Troubleshooting:**
1. Check receipt image quality (clear, not blurry)
2. Verify all text is readable (not folded, torn, or faded)
3. Check lighting (shadows can affect OCR)
4. Consider higher resolution scan
5. Manual review in UI shows extracted data for correction

### Issue: API returns 401 Unauthorized
**Solution:**
1. Verify Bearer token in Authorization header
2. Check token is valid (not expired)
3. Verify user role is accounting/finance/admin
4. Check app_settings.ANTHROPIC_API_KEY is set

### Issue: GL Account not suggested correctly
**Solution:**
1. Check vendor name in extracted_data (may need manual correction)
2. Check if vendor is in VENDOR_PATTERNS regex
3. Add new pattern to receipt-linking.ts
4. Test with different receipt samples

---

## API Reference

### Upload Receipt
```
POST /api/documents/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  file: File,
  documentType: "receipt"
}

Response: 201 Created
{
  "documentId": "...",
  "status": "uploaded"
}
```

### Process Receipt
```
POST /api/documents/process
Authorization: Bearer {token}
Content-Type: application/json

{
  "documentId": "..."
}

Response: 200 OK
{
  "status": "ready_for_approval",
  "data": { extracted_data, gl_suggestion, confidence }
}
```

### Record Expense
```
POST /api/accounting/record-expense
Authorization: Bearer {token}
Content-Type: application/json

{
  "documentId": "...",
  "vendor_name": "...",
  "total": 1500.00,
  ...
}

Response: 201 Created
{
  "success": true,
  "entryId": "...",
  "approval_required": false
}
```

---

## Performance Metrics

**Target Metrics:**
- Upload time: < 5 seconds
- OCR processing: 15-30 seconds
- Database save: < 2 seconds
- UI responsiveness: < 1 second
- GL account accuracy: > 95%
- OCR confidence average: > 90%

**Scalability:**
- Supports 100+ concurrent uploads (with Supabase scaling)
- Storage: ~500KB per receipt (optimized)
- API timeouts: 60 seconds (configurable)
- Maximum file size: 10MB

---

## Support & Documentation

**Code Comments:**
- All functions have inline comments (Thai/English)
- API endpoints documented with request/response
- Database schema has table descriptions

**Additional Resources:**
- Claude API docs: https://docs.anthropic.com/
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

---

**Implementation Complete** ✅  
Ready for testing & Phase 2 development
