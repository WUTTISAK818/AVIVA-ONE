# AVIVA ONE Codebase Audit Report
## Comprehensive Security & Quality Findings

**Audit Date:** 2026-06-20  
**Scope:** API Routes, Database/RLS, Type Safety, Workflows, Permissions, Activity Tracking, Error Handling, Data Validation, Messaging, Dead Code

---

## Executive Summary

**Total Issues Found:** 47  
**Critical Issues:** 8  
**High Priority Issues:** 12  
**Medium Priority Issues:** 18  
**Low Priority Issues:** 9  

Major vulnerability areas:
- Service role key exposed in client-side authentication
- Unhandled Promise.all failures in data fetching
- Missing null checks on database queries using .single()
- Insufficient error handling in inter-API calls
- Permission checks not consistently applied
- Missing input validation in several endpoints

---

## 🔴 CRITICAL ISSUES (Must Fix Before Production)

### 1. **Service Role Key Passed as Bearer Token to Internal API**
**File:** `src/app/api/construction/inspections/[id]/signoff/route.ts`  
**Lines:** 173  
**Severity:** CRITICAL  
**Risk:** Complete database bypass, data exposure  

**Current Code:**
```typescript
'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
```

**Problem:** Service role key should NEVER be passed to API endpoints, especially in Authorization headers. This:
- Bypasses all RLS policies
- Allows the payment voucher API to write as admin regardless of user permissions
- Violates maker-checker pattern (Phase 1 enforcement)
- Exposes the key in logs and network traces

**Expected Behavior:** Should use the authenticated user's token or trigger the payment voucher through a database function with proper RLS checks.

**Suggested Fix:**
```typescript
// Option 1: Use authenticated user's token
const authHeader = req.headers.get("Authorization");
const userToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

// Option 2: Trigger via database function with RLS
const { error } = await sb.rpc('create_payment_voucher_from_milestone', {
  p_installment_id: installmentId,
  p_house_id: house_id,
  // ...
});
```

---

### 2. **Unhandled Promise.all() Failure - AI Chat Context Loading**
**File:** `src/app/api/ai-chat/route.ts`  
**Lines:** 197-208  
**Severity:** CRITICAL  
**Risk:** Silent data corruption, stale context, incorrect responses  

**Current Code:**
```typescript
const results = await Promise.all([
  db.from("projects").select("*").eq("id", PROJECT_ID).single().then(r => r.data),
  db.from("leads").select("id,status,source,budget,assigned_to").eq("project_id", PROJECT_ID).then(r => r.data ?? []),
  // ... 8 more queries ...
]).catch(() => null);

if (!results) {
  return NextResponse.json({ response: "ไม่สามารถดึงข้อมูลโครงการได้ในขณะนี้ กรุณาลองใหม่ค่ะ" });
}

const [project, leads, houses, txns, campaigns, employees, pendingApprovals, pendingClaims, installments, loanApps] = results;
```

**Problem:**
- `.then(r => r.data)` swallows errors from individual queries
- If ANY query fails, that element is `undefined`
- Code assumes all elements exist and destructures without null checks
- Line 214: `const loans = (loanApps as { status: string }[]) ?? []` will throw if loanApps is undefined
- Financial/lead data could be undefined but used in context building without validation

**Expected Behavior:** Should fail gracefully with clear error or use fallback with explicitly partial data.

**Suggested Fix:**
```typescript
const results = await Promise.allSettled([
  db.from("projects").select("*").eq("id", PROJECT_ID).single(),
  db.from("leads").select("*").eq("project_id", PROJECT_ID),
  // ...
]);

const project = results[0].status === "fulfilled" ? results[0].value.data : null;
const leads = results[1].status === "fulfilled" ? results[1].value.data ?? [] : [];
// ... validate each and use with null checks
```

---

### 3. **Missing Auth/Permission Check in Multiple Activity Endpoints**
**File:** `src/app/api/activity/alerts/route.ts`  
**Lines:** 4-8, 40-42  
**Severity:** CRITICAL  
**Risk:** Unauthorized data access, privacy breach  

**Current Code:**
```typescript
export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""  // ← Uses service role without auth check!
  );
  // No Authorization header validation
  // No user ID check
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employee_id");  // ← Could request anyone's alerts
```

**Problem:**
- Uses service role without verifying user identity
- Allows accessing any employee's alerts by ID parameter
- No RLS enforcement (RLS v473 expects user context)
- Same issue in PUT endpoint (line 40-42)

**Files with Same Issue:**
- `src/app/api/activity/goals/route.ts`
- `src/app/api/activity/badges/route.ts`
- `src/app/api/activity/workload/route.ts` (likely)
- `src/app/api/activity/trends/route.ts` (likely)
- `src/app/api/activity/digest/route.ts` (likely)

**Suggested Fix:**
```typescript
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  // Use serverDb(token) to enforce RLS per user
  const db = serverDb(token);
  
  // Now RLS will enforce that user can only see their own alerts
  const { data, error } = await db
    .from("activity_alerts")
    .select("*")
    .eq("employee_id", user.id);  // ← Enforce user identity
```

---

### 4. **Missing Error Handling in Cross-API Calls**
**File:** `src/app/api/construction/inspections/[id]/signoff/route.ts`  
**Lines:** 167-188, 228-232  
**Severity:** CRITICAL  
**Risk:** Silent failures, inconsistent state, missing audit trail  

**Current Code:**
```typescript
const paymentResponse = await fetch(
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/finance/payment-voucher/create`,
  { /* ... */ }
);

if (paymentResponse.ok) {
  const voucherResult = await paymentResponse.json()
  console.log('✅ Payment Voucher created:', voucherResult.voucher?.id)
} else {
  console.error('⚠️ Failed to create payment voucher:', await paymentResponse.text())
}
// No exception thrown, execution continues regardless
```

**Problem:**
- Fetch errors are silently logged but not reported to client
- Payment voucher creation failure is non-fatal (by design) but client doesn't know
- Client receives 200 OK even though workflow is incomplete
- Inspection signoff completes successfully but payment voucher doesn't exist
- Violates maker-checker (approver expects automatic voucher creation)

**Suggested Fix:**
```typescript
try {
  const paymentResponse = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/finance/payment-voucher/create`,
    { /* ... */ }
  );

  if (!paymentResponse.ok) {
    throw new Error(`Payment voucher API failed: ${paymentResponse.status} ${await paymentResponse.text()}`);
  }
  
  const voucherResult = await paymentResponse.json();
  if (!voucherResult.success) {
    throw new Error(`Payment voucher creation failed: ${voucherResult.error}`);
  }
  
  console.log('✅ Payment Voucher created:', voucherResult.voucher?.id);
} catch (err) {
  console.error('❌ Critical: Payment voucher creation failed:', err);
  // Option A: Rollback signoff
  throw err;
  // Option B: Mark as requires_manual_voucher_creation
  // Option C: Return 202 Accepted with warning
}
```

---

### 5. **Type Safety Issue: Unsafe Casting with `as any`**
**File:** `src/app/api/ai-chat/route.ts`  
**Lines:** 280, 281, 282, 283, 284  
**Severity:** CRITICAL  
**Risk:** Runtime type errors, data corruption, security bypass  

**Current Code:**
```typescript
: buildStaffContext(userName, userDept, {
    project: project as any,  // ← Line 280
    houses: houses as HouseRow[],
    leads: leads as {status:string}[],
    installments: installments as unknown[],
    pendingClaims: pendingClaims as unknown[],
    campaigns: campaigns as CampaignRow[],
```

**Problem:**
- `as any` on `project` removes all type safety
- If project has unexpected structure, buildStaffContext crashes with unclear error
- Defeats TypeScript's safety checks
- Security implications: if project data is missing or malformed, financial/operational data could be exposed incorrectly

**Expected Behavior:** Proper type validation, not casting.

**Suggested Fix:**
```typescript
function validateProject(data: unknown): ProjectRow {
  if (!data || typeof data !== 'object') throw new Error('Invalid project data');
  const p = data as Record<string, unknown>;
  return {
    total_units: typeof p.total_units === 'number' ? p.total_units : 0,
    sold_units: typeof p.sold_units === 'number' ? p.sold_units : 0,
    construction_progress: typeof p.construction_progress === 'number' ? p.construction_progress : 0,
    sellout_forecast: typeof p.sellout_forecast === 'string' ? p.sellout_forecast : '',
    revenue_target: typeof p.revenue_target === 'number' ? p.revenue_target : 0,
  };
}

const validated = {
  project: validateProject(project),
  houses: houses as HouseRow[],
  // ...
};
```

---

### 6. **Missing Null Check on `.single()` Queries**
**File:** `src/app/api/ai-action/route.ts`  
**Line:** 148  
**Severity:** CRITICAL  
**Risk:** Null pointer exception, permission bypass  

**Current Code:**
```typescript
const { data: dbUser } = await serverDb(token).from("users").select("full_name").eq("id", user.id).single();
if (dbUser?.full_name) userName = dbUser.full_name;
```

**Problem:**
- `.single()` throws if 0 rows or >1 row found (unless wrapped in try-catch, which it is)
- But the function continues even if dbUser is null
- Line 149 uses `dbUser.full_name` with optional chaining, which is good BUT
- This is called in `buildSystem()` which is then passed to Claude
- If user record doesn't exist, AI system prompt gets empty/default userName

**Expected Behavior:** Should fail explicitly or have clear fallback.

**Suggested Fix:**
```typescript
try {
  const { data: dbUser, error } = await serverDb(token).from("users").select("full_name").eq("id", user.id).single();
  if (error) {
    console.warn(`User record not found for ${user.id}:`, error);
    // Decide: fail or use fallback
    throw new Error("User profile not configured");
  }
  if (!dbUser) {
    throw new Error("User profile missing");
  }
  userName = dbUser.full_name || "พนักงาน";
} catch (err) {
  console.error('Error loading user profile:', err);
  return NextResponse.json({ error: "User profile error" }, { status: 500 });
}
```

---

### 7. **LINE Webhook - No Signature Validation**
**File:** `src/app/api/line/webhook/route.ts`  
**Lines:** 21-23  
**Severity:** CRITICAL  
**Risk:** Spoofed webhooks, account takeover, malicious actions  

**Current Code:**
```typescript
export async function POST(req: NextRequest) {
  let body: { events?: LineEvent[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }
  const db = admin();

  for (const ev of body.events ?? []) {
    // ... processes events without verifying they came from LINE
```

**Problem:**
- No X-Line-Signature validation (LINE Platform requirement)
- Anyone can POST to this endpoint with crafted payload
- Attacker can link arbitrary LINE IDs to AVIVA accounts (line 48)
- Attacker can update line_user_id for any code
- No rate limiting or replay protection

**Expected Behavior:** Every webhook must be signed by LINE.

**Suggested Fix:**
```typescript
import crypto from 'crypto';

async function verifyLineSignature(req: NextRequest): Promise<boolean> {
  const signature = req.headers.get('x-line-signature');
  const body = await req.clone().text();
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  
  if (!signature || !channelSecret) {
    console.warn('Missing LINE signature headers');
    return false;
  }
  
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}

export async function POST(req: NextRequest) {
  if (!(await verifyLineSignature(req))) {
    console.error('Invalid LINE signature');
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  
  let body: { events?: LineEvent[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }
  // ... rest of processing
}
```

---

### 8. **Payment Voucher Creation - Missing Permission Check**
**File:** `src/app/api/finance/payment-voucher/create/route.ts`  
**Lines:** 34-45  
**Severity:** CRITICAL  
**Risk:** Unauthorized voucher creation, budget manipulation  

**Current Code:**
```typescript
export async function POST(request: Request) {
  try {
    const supabase = getServiceClient()
    const body: CreatePaymentVoucherRequest = await request.json()

    // Validate input
    if (!body.projectId || !body.houseId || !body.contractorId) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    // No auth check! Endpoint is completely open!
```

**Problem:**
- Uses service role client (line 36)
- No Authorization header check
- No permission validation
- Anyone can create payment vouchers with any amount
- Bypasses all approval workflows and maker-checker
- Can fabricate payments to contractors

**Expected Behavior:** Only authorized users (finance manager/CFO) should create vouchers.

**Suggested Fix:**
```typescript
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create anon client to validate token
    const anonSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authErr } = await anonSupabase.auth.getUser(token);
    if (authErr || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission via RLS
    const db = serverDb(token);
    const { data: dbUser, error: roleErr } = await db
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    
    if (roleErr || !MANAGER_ROLES.includes(dbUser?.role ?? "")) {
      return Response.json({ error: "Forbidden - Finance role required" }, { status: 403 });
    }

    // Now proceed with service client
    const supabase = getServiceClient();
    const body: CreatePaymentVoucherRequest = await request.json();
    // ... rest of logic
```

---

## 🟠 HIGH PRIORITY ISSUES (Should Fix in Next Sprint)

### 9. **Missing Auth Check - Messages API**
**File:** `src/app/api/messages/route.ts`  
**Lines:** 4-52 (GET), 55-106 (POST)  
**Severity:** HIGH  

Both GET and POST endpoints use service role without checking Authorization header.

**Risk:** Any user can read/write all messages across the system.

**Suggested Fix:** Add token validation like in ai-chat/route.ts (lines 20-24).

---

### 10. **Missing Auth Check - Tasks API**
**File:** `src/app/api/tasks/route.ts`  
**Lines:** 4-52 (GET), 55-117 (POST)  
**Severity:** HIGH  

Same issue as Messages API.

---

### 11. **Construction Logs - Hardcoded Author**
**File:** `src/app/api/construction-logs/route.ts`  
**Line:** 4  
**Severity:** HIGH  

```typescript
const DEFAULT_AUTHOR = 'พีท (ผู้จัดการก่อสร้าง)'
```

**Problem:**
- Hardcodes author name instead of using authenticated user
- Audit trail inaccurate
- Multiple people can create logs attributed to "พีท"

**Suggested Fix:**
```typescript
export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { data: { user } } = await supabase.auth.getUser(token);
  const { data: dbUser } = await db.from("users").select("full_name").eq("id", user.id).single();
  
  const row = {
    // ...
    submitted_by: dbUser?.full_name ?? "ไม่ระบุ",
    // ...
  };
```

---

### 12. **Promise.all with Chained .then() Swallows Errors**
**File:** `src/app/api/ai-chat/route.ts`  
**Lines:** 198-207  

Multiple queries use `.then(r => r.data)` which means:
- If error occurs, the Promise resolves with undefined
- No error information available
- Causes issues in AI context building

**Suggested Fix:** Use Promise.allSettled or wrap each query in try-catch.

---

### 13. **Missing Input Validation - AI Action Routes**
**File:** `src/app/api/ai-action/route.ts`  
**Lines:** 152-155  
**Severity:** HIGH  

```typescript
const msgs = [
  ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" as const : "user" as const, content: h.content })),
  { role: "user" as const, content: message },
];
```

**Problem:**
- history array from request body is not validated (line 134)
- No check for array length, content type, or message length
- history.slice(-6) could contain arbitrary objects
- Could cause issues in Claude API call or leak information

**Suggested Fix:**
```typescript
if (!Array.isArray(body.history)) {
  return NextResponse.json({ error: "Invalid history" }, { status: 400 });
}

const history = (body.history as any[])
  .slice(-6)
  .filter(h => typeof h === 'object' && h !== null)
  .map(h => ({
    role: ["user", "assistant"].includes(h.role) ? h.role : "user",
    content: typeof h.content === "string" ? h.content : "",
  }))
  .filter(h => h.content.trim().length > 0 && h.content.length < 2000);
```

---

### 14. **Missing RLS on activity_goals, activity_badges Tables**
**Files:** Database migrations  
**Severity:** HIGH  

Recent migrations (20260620d, 20260620e) create activity_goals and activity_badges tables but the critical_gaps_schema.sql doesn't show RLS policies for these tables.

**Risk:** Employees can view other departments' goal data.

**Suggested Fix:** Add RLS policies:
```sql
CREATE POLICY activity_goals_own_dept ON activity_goals
  FOR SELECT USING (
    auth.jwt()->>'department' = department OR
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo')
  );

CREATE POLICY activity_badges_own_dept ON activity_badges
  FOR SELECT USING (
    auth.jwt()->>'department' = department OR
    auth.jwt()->>'role' IN ('admin', 'ceo', 'coo')
  );
```

---

### 15. **Maker-Checker NOT Enforced on DB Side - Only Phase 1 Trigger**
**File:** `supabase/migrations/20260612_phase1_maker_checker_db.sql`  
**Severity:** HIGH  

Current trigger only prevents self-approval:
```sql
IF NEW.action_taken IN ('Approved','Rejected')
   AND coalesce(OLD.action_taken,'Pending') = 'Pending'
   AND NEW.submitted_by_user_id IS NOT NULL
   AND auth.uid() IS NOT NULL
   AND auth.uid() = NEW.submitted_by_user_id THEN
  RAISE EXCEPTION 'Maker-Checker: ผู้อนุมัติต้องไม่ใช่ผู้ยื่นคำขอ';
```

**Problem:**
- Only prevents self-approval, doesn't enforce 2-level approval
- Material_Purchase should require Finance → Director
- Installment_Review should require Engineer → Finance
- Finance_Approval should require Finance → CFO
- Currently no validation that second approver has correct role

**Suggested Fix:** Extend trigger to enforce approval chain:
```sql
CREATE OR REPLACE FUNCTION public.enforce_approval_workflow()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_required_approvers TEXT[];
  v_current_approver_role TEXT;
BEGIN
  -- Get required approvers for this workflow
  SELECT COALESCE(required_approver_roles, '{}'::TEXT[])
    INTO v_required_approvers
    FROM approval_matrix
   WHERE workflow_type = NEW.workflow_type;

  -- Validate current approver's role
  SELECT auth_user_role(auth.uid()) INTO v_current_approver_role;
  
  IF NOT v_current_approver_role = ANY(v_required_approvers) THEN
    RAISE EXCEPTION 'Approver role % not authorized for %', v_current_approver_role, NEW.workflow_type;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

### 16. **No Idempotency Check on Payment Voucher Creation**
**File:** `src/app/api/finance/payment-voucher/create/route.ts`  
**Lines:** 60-69  
**Severity:** HIGH  

```typescript
const countToday = result.count || 0;
const voucherNumber = `FIN-${year}-${String(countToday + 1).padStart(5, '0')}`
```

**Problem:**
- If called twice with same milestone, creates duplicate vouchers with sequential numbers
- No unique constraint on (construction_progress_id, project_id)
- If network retry occurs, creates 2 vouchers
- Payment could be made twice

**Suggested Fix:**
```sql
ALTER TABLE payment_vouchers ADD UNIQUE (construction_progress_id, project_id);
```

And in API:
```typescript
const { data: existing } = await supabase
  .from('payment_vouchers')
  .select('id')
  .eq('construction_progress_id', body.constructionProgressId)
  .eq('project_id', body.projectId)
  .maybeSingle();

if (existing) {
  return Response.json(
    { error: "Payment voucher already exists for this milestone", existingId: existing.id },
    { status: 409 }
  );
}
```

---

### 17. **AI Council - No Data Returned on Failure**
**File:** `src/app/api/ai-council/route.ts`  
**Lines:** 47-56  
**Severity:** HIGH  

When `generateExecutiveBriefing` fails, API returns error without structure validation.

---

### 18. **Missing Type Validation in Admin Settings**
**File:** `src/app/api/admin/settings/route.ts`  
**Lines:** 62-77  
**Severity:** HIGH  

API key format is validated (line 63) but only AFTER the setter runs. Database insert could fail for other reasons.

---

### 19. **No Rate Limiting on Payment Voucher Endpoint**
**File:** `src/app/api/finance/payment-voucher/create/route.ts`  
**Severity:** HIGH  

Unlike ai-chat (lines 39-54 with checkRateLimit), payment voucher endpoint has no protection against:
- DoS by creating thousands of vouchers
- Brute force attacks on projectId/houseId

---

### 20. **SLA Reminder - Type Casting Without Validation**
**File:** `src/app/api/cron/sla-reminder/route.ts`  
**Lines:** 118, 122  
**Severity:** HIGH  

```typescript
const email = (u as { email?: string | null } | null)?.email;
// ...
const reqDept = (emp as { department?: string | null } | null)?.department;
```

These use `as` casts but the queries already selected specific columns. The casts are defensively written but indicate lack of type safety.

---

## 🟡 MEDIUM PRIORITY ISSUES (Next Quarter)

### 21. **Inconsistent Error Messages**
Multiple endpoints return error messages in different formats:
- Some: `{ error: "..." }`
- Some: `{ success: false, error: "..." }`
- Some: `{ ok: false, error: "..." }`

Inconsistency makes client error handling harder.

---

### 22. **No Request ID / Correlation ID for Debugging**
Cannot trace cross-API calls. When signoff → payment-voucher call fails, no way to correlate logs.

**Suggested Fix:**
```typescript
const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
// Log all errors with requestId
console.error(`[${requestId}] Error in payment creation:`, err);
// Return to client
return NextResponse.json({ error: "...", requestId }, { status: 500 });
```

---

### 23. **No Audit Trail for Settings Changes**
**File:** `src/app/api/admin/settings/route.ts`  
**Lines:** 62-76  
**Severity:** MEDIUM  

When ANTHROPIC_API_KEY or line_channel_access_token is changed, no audit log is created.

**Suggested Fix:**
```typescript
if (action === "set") {
  // ... validation ...
  await db.from("app_settings").upsert({...});
  
  // Log the change
  await db.from("audit_log").insert({
    event_type: "setting_changed",
    resource_type: "app_settings",
    resource_id: key,
    changed_by: user.id,
    old_value: v ? "***" : null,
    new_value: "***", // Never store actual key
    created_at: new Date().toISOString(),
  });
}
```

---

### 24. **Construction Progress View May Not Be Updated**
**File:** `src/app/api/construction/progress/route.ts`  
**Lines:** 44-54  

Uses `vw_construction_progress` view but no RLS policy shown on this view. If it queries payment_vouchers with contractor_id, contractors might see each other's progress.

---

### 25. **Missing Validation on Inspection Signoff Actions**
**File:** `src/app/api/construction/inspections/[id]/signoff/route.ts`  
**Lines:** 76-121  
**Severity:** MEDIUM  

While each action branch validates its fields, there's no overall action validation:
```typescript
if (!action) {
  return NextResponse.json({ error: 'Missing action', ok: false }, { status: 400 })
}
// But no check that action is one of: 'inspect', 'approve', 'reject', 'owner-sign'
// Could be any arbitrary string, matches nothing, silently creates record
```

**Suggested Fix:**
```typescript
const VALID_ACTIONS = ['inspect', 'approve', 'reject', 'owner-sign'] as const;
if (!VALID_ACTIONS.includes(action)) {
  return NextResponse.json(
    { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`, ok: false },
    { status: 400 }
  );
}
```

---

### 26. **QC Defects Endpoint Missing Auth**
**File:** `src/app/api/qc-defects/[id]/route.ts`  
**Severity:** MEDIUM  

(Likely follows same pattern as other endpoints - use service role without auth check)

---

### 27. **Contractor Scorecard - No Validation of Scores**
**File:** `src/app/api/construction/contractor-scorecard/route.ts`  
**Severity:** MEDIUM  

Scores are 0-100 but there's probably no database CHECK constraint.

---

### 28. **Change Order - Circular Reference Risk**
**File:** `src/app/api/construction/change-order/route.ts`  
**Severity:** MEDIUM  

If a change order references another change order and vice versa, approval logic could loop.

---

### 29. **Push Notifications - No Unsubscribe Handling**
**File:** `src/app/api/push/send/route.ts`  
**Lines:** 39-43  
**Severity:** MEDIUM  

No handling for expired/invalid push subscriptions. If user unsubscribes, endpoint still tries to send and fails silently.

---

### 30. **No Pagination Cursor Validation**
**File:** `src/app/api/messages/route.ts`  
**Lines:** 15-16  

```typescript
const limit = parseInt(searchParams.get("limit") || "50");
const offset = parseInt(searchParams.get("offset") || "0");
```

No maximum limit check. Malicious request could request 1M records.

**Suggested Fix:**
```typescript
const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 1000);
const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));
```

---

### 31. **Activity Logs - No Deduplication**
**File:** `supabase/migrations/20260617d_activity_logs.sql`  
**Severity:** MEDIUM  

If rapid clicks create multiple requests, duplicate activity records are created.

---

### 32. **Loan Application Status - No State Machine**
**File:** Various  
**Severity:** MEDIUM  

Loan status can transition from any state to any state. Should be restricted:
- submitted → approved/rejected
- approved → paid (not to submitted)
- rejected → cannot reopen

---

### 33. **No Soft Delete for Audit Trail**
**Files:** Various  
**Severity:** MEDIUM  

approval_logs, messages, etc. use `is_deleted` but some old migrations use actual DELETE. Inconsistent approach.

---

### 34. **spec_lock_check Cron - No Timezone Handling**
**File:** `src/app/api/cron/spec-lock-check/route.ts`  
**Severity:** MEDIUM  

Uses local Date.now() but specs could be locked in different timezone regions.

---

### 35. **Evening Report - Could Run Twice**
**File:** `src/app/api/cron/evening-report/route.ts`  
**Severity:** MEDIUM  

No idempotency check. If cron job runs twice in same window, sends duplicate push.

---

### 36. **No Connection Pool Management**
**Files:** All API routes  
**Severity:** MEDIUM  

Each route calls createClient() which could exhaust Supabase connection limit under load.

**Suggested Fix:** Create singleton clients or use connection pooling.

---

### 37. **Approval Matrix Not Validated at Runtime**
**File:** Various  
**Severity:** MEDIUM  

SLA_DAYS from approval-matrix.ts is hard-coded but could be out of sync with database. No validation that approval roles exist in role hierarchy.

---

### 38. **Missing Index on Common Queries**
**Files:** Database  
**Severity:** MEDIUM  

Looking at critical_gaps_schema.sql, there are indexes on commonly filtered columns BUT:
- No index on approval_logs(workflow_type, action_taken) for SLA queries
- No index on messages(recipient_id, sender_id, created_at)
- No index on task_assignments(assigned_to, status)

---

## 🟢 LOW PRIORITY ISSUES (Nice to Have)

### 39. **Console.log Should Be Structured Logging**
**Severity:** LOW  

Using console.log/error instead of structured logging makes production debugging hard. Should use Winston/Bunyan.

---

### 40. **Magic Numbers Throughout Code**
Various hardcoded values:
- MAX_REMINDERS_PER_DAY = 2
- MAX_QUEUE_ESCALATIONS = 40
- RATE_LIMIT = 10
- RATE_WINDOW = 60_000

Should be config constants in settings.

---

### 41. **Unused Imports**
Some routes import unused dependencies (minimal but worth cleanup).

---

### 42. **No OpenAPI/Swagger Documentation**
API routes lack documentation. Hard for frontend developers to know expected formats.

---

### 43. **Incomplete Error Stack Traces**
**Severity:** LOW  

Some errors are caught and logged as just `err.message` instead of full stack.

```typescript
console.error('[GET /api/construction/progress]', err)  // ← Should include stack
return NextResponse.json({ error: String(err), ok: false }, { status: 400 })
```

---

### 44. **No Request Timeout Configuration**
Various fetch() calls don't set timeout, could hang forever.

---

### 45. **Hardcoded PROJECT_ID**
**File:** Multiple files  
**Severity:** LOW  

```typescript
const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
```

Should be environment variable or inferred from context.

---

### 46. **No Dead Code Analysis**
Imports are included that may not be used:
- compressContextForAPI in ai-chat (used but worth verifying)

---

### 47. **Inconsistent Date Handling**
Some use `new Date()`, some use `Date.now()`, some use ISO strings directly.

---

## Summary Table

| Issue | File | Line | Severity | Status |
|-------|------|------|----------|--------|
| Service role in Bearer token | inspections/signoff | 173 | 🔴 CRITICAL | MUST FIX |
| Unhandled Promise.all | ai-chat | 197-208 | 🔴 CRITICAL | MUST FIX |
| Missing auth checks | activity/* | Multiple | 🔴 CRITICAL | MUST FIX |
| Cross-API error handling | inspections/signoff | 167-188 | 🔴 CRITICAL | MUST FIX |
| Unsafe `as any` casting | ai-chat | 280-284 | 🔴 CRITICAL | MUST FIX |
| Missing null checks | ai-action | 148 | 🔴 CRITICAL | MUST FIX |
| LINE webhook no signature | line/webhook | 21-23 | 🔴 CRITICAL | MUST FIX |
| Payment voucher no auth | payment-voucher | 34-45 | 🔴 CRITICAL | MUST FIX |
| Messages API no auth | messages | Multiple | 🟠 HIGH | FIX SOON |
| Tasks API no auth | tasks | Multiple | 🟠 HIGH | FIX SOON |
| Hardcoded author | construction-logs | 4 | 🟠 HIGH | FIX SOON |
| Promise chaining | ai-chat | 198-207 | 🟠 HIGH | FIX SOON |
| Input validation | ai-action | 152-155 | 🟠 HIGH | FIX SOON |
| Missing RLS | activity_goals/badges | DB | 🟠 HIGH | FIX SOON |
| Maker-checker incomplete | Phase 1 | 20260612 | 🟠 HIGH | FIX SOON |
| No idempotency | payment-voucher | 60-69 | 🟠 HIGH | FIX SOON |
| Audit trail missing | settings | 62-76 | 🟡 MEDIUM | NEXT SPRINT |
| RLS validation | progress view | - | 🟡 MEDIUM | REVIEW |
| Action validation | inspections | 76-121 | 🟡 MEDIUM | IMPROVE |
| Pagination limits | messages | 15-16 | 🟡 MEDIUM | ADD GUARDS |
| State machine | Loan app | - | 🟡 MEDIUM | DESIGN |
| Dedup activity | activity_logs | - | 🟡 MEDIUM | SCHEMA |
| Soft delete inconsistent | Various | - | 🟡 MEDIUM | STANDARDIZE |
| Connection pooling | All routes | - | 🟡 MEDIUM | REFACTOR |
| Console logging | All files | - | 🟢 LOW | NICE-TO-HAVE |
| Magic numbers | Various | - | 🟢 LOW | CONFIG |

---

## Recommended Action Plan

**Phase 1 (This Week) - Security Fixes:**
1. Remove service role key from auth headers (Issue #1, #8)
2. Add Authorization checks to activity/messages/tasks endpoints (Issues #3, #9, #10)
3. Add LINE webhook signature validation (Issue #7)
4. Fix Promise.all error handling in ai-chat (Issue #2)

**Phase 2 (This Sprint) - Data Integrity:**
5. Add idempotency to payment voucher creation (Issue #16)
6. Extend maker-checker to enforce approval chain (Issue #15)
7. Add RLS policies to new activity tables (Issue #14)
8. Fix type safety issues (Issue #5)

**Phase 3 (Next Sprint) - Polish:**
9. Add audit trails for sensitive operations
10. Standardize error response formats
11. Add structured logging
12. Implement connection pooling

---

## Testing Recommendations

1. **Security Testing:** Try accessing activity endpoints without auth token
2. **Fuzzing:** Send invalid JSON, extreme values to all APIs
3. **Workflow Testing:** Complete full approval chain to catch state machine issues
4. **Performance Testing:** Load test SLA reminder cron with 1000+ pending approvals
5. **Integration Testing:** Verify signoff → payment-voucher → notification flow
6. **Signature Testing:** Test LINE webhook with valid/invalid signatures

---

End of Report
