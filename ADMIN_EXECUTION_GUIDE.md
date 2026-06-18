# ADMIN EXECUTION GUIDE
## AVIVA ONE — Pre-Launch Cleanup
**Target: 25 June 2026 Go-Live**

---

## 👤 WHO SHOULD DO THIS?

**Minimum Role Required:** Admin / CEO / COO

**Tools Needed:**
- Supabase Dashboard access (https://app.supabase.com)
- Google Drive access (for backups)
- GitHub access (for version bump push)
- Terminal/CLI for `npm run build` (optional but recommended)

---

## 📋 STEP-BY-STEP EXECUTION

### PHASE 1: PREPARATION (30 minutes)

#### Step 1.1: Backup Production Database
1. Go to: Supabase Dashboard → Project Settings → Backups
2. Click: "Create backup manually"
3. Name: `AVIVA-ONE-PreLaunch-2026-06-18`
4. Wait for backup to complete (~5 minutes)
5. **Screenshot:** Save confirmation ✓

#### Step 1.2: Verify Backup Files Location
1. Go to: Supabase Dashboard → Project Settings → Backups
2. Confirm latest backup is listed
3. Note backup timestamp

#### Step 1.3: Prepare Google Drive Folder
1. Open: Google Drive → AVIVA ONE folder
2. Create subfolder: `2026-06 Deployment`
3. You will save 3 JSON files here:
   - `AVIVA-ONE-BACKUP-DemoAccounts-2026-06-18.json`
   - `AVIVA-ONE-BACKUP-TestHouses-2026-06-18.json`
   - `AVIVA-ONE-BACKUP-TestHousesProgress-2026-06-18.json`

---

### PHASE 2: BACKUP DEMO ACCOUNTS (45 minutes)

#### Step 2.1: Extract Demo Accounts Data
1. Go to: Supabase Dashboard → SQL Editor
2. **Copy-paste Query #1 from `GOLIVE_CLEANUP_QUERIES.sql`** (Section 1)
3. Click: "Run" button
4. **Wait for results** (should show 9 rows)
5. Sample result:
   ```
   | id                                    | email                    | full_name | role      | department      |
   |---------------------------------------|--------------------------|-----------|-----------|-----------------|
   | 11111111-1111-1111-1111-111111111111 | ceo.test@aviva.th        | CEO Test  | admin     | ฝ่ายบริหาร       |
   | 22222222-2222-2222-2222-222222222222 | demo.admin@aviva.th      | Admin     | admin     | ฝ่ายบริหาร       |
   | ... (7 more rows)
   ```

#### Step 2.2: Export to JSON
1. In SQL Editor results → Click: "Export" button
2. Format: **JSON**
3. Filename: `AVIVA-ONE-BACKUP-DemoAccounts-2026-06-18.json`
4. Click: "Download"

#### Step 2.3: Upload to Google Drive
1. Open: Google Drive → `2026-06 Deployment` folder
2. Upload: `AVIVA-ONE-BACKUP-DemoAccounts-2026-06-18.json`
3. **Verify:** File visible in Drive (5-10 seconds)
4. Right-click → "Get link" → Copy URL → **Save this URL**

#### Step 2.4: Verify Count
1. Go to: SQL Editor
2. **Copy-paste Query #2** (Section 2: COUNT)
3. Click: "Run"
4. Expected result: `total_demo_accounts: 9`
5. **Screenshot:** Save confirmation

---

### PHASE 3: BACKUP TEST HOUSES DATA (45 minutes)

#### Step 3.1: Check if Test Houses Exist
1. Go to: SQL Editor
2. **Copy-paste Query #3** (Section 3: BACKUP TEST HOUSES)
3. Click: "Run"
4. **Important:** Check result
   - If result shows 0 rows → **No test houses found** → Skip to Phase 4
   - If result shows >0 rows → Continue with 3.2

#### Step 3.2: Export Test Houses to JSON (if found)
1. In SQL Editor results → Click: "Export"
2. Format: **JSON**
3. Filename: `AVIVA-ONE-BACKUP-TestHouses-2026-06-18.json`
4. Download & upload to Google Drive folder

#### Step 3.3: Backup Test Houses Progress
1. Go to: SQL Editor
2. **Copy-paste Query #4** (Section 4: BACKUP PROGRESS)
3. Click: "Run"
4. **If rows found:**
   - Export as JSON
   - Filename: `AVIVA-ONE-BACKUP-TestHousesProgress-2026-06-18.json`
   - Upload to Google Drive

#### Step 3.4: Verify Count
1. **Copy-paste Query #5** from SQL section (VERIFY HOUSES EXIST)
2. Click: "Run"
3. Expected structure for production houses:
   ```
   | id  | house_number | plot_code | status      |
   |-----|--------------|-----------|-------------|
   | ... | POM-01       | Pom       | in_progress | ← real production house
   | ... | A07          | A07       | completed   | ← real production house
   | ... | 17           | 17        | not_started | ← real production house
   ```

---

### PHASE 4: VERIFY PRODUCTION EMPLOYEES (15 minutes)

#### Step 4.1: Check Employee Data
1. Go to: SQL Editor
2. **Copy-paste Query #5** (Section 5: VERIFY PRODUCTION EMPLOYEES)
3. Click: "Run"
4. **Expected result:** 3 rows

   ```
   | email                | full_name | role   | department    | email_confirmed_at |
   |----------------------|-----------|--------|---------------|-------------------|
   | sale1@alisa.com      | ฟ้า       | sales  | ฝ่ายขาย       | [timestamp]       |
   | sale2@alisa.com      | เดียร์    | sales  | ฝ่ายขาย       | [timestamp]       |
   | engineer@alisa.com   | พีท       | engineer| ฝ่ายก่อสร้าง  | [timestamp]       |
   ```

#### Step 4.2: If Any Employee Missing
**If not all 3 exist, you must CREATE them via edge function:**

**Option A: Use Admin Panel (Easiest)**
1. Go to AVIVA ONE app → /settings/users page (if available)
2. Click: "เตรียมบัญชีพนักงาน" (Seed Pilot Accounts)
3. Click: "โหลดรายชื่อพนักงาน"
4. Edit rows to match:
   - sale1@alisa.com / ฟ้า / ฝ่ายขาย / sales
   - sale2@alisa.com / เดียร์ / ฝ่ายขาย / sales
   - engineer@alisa.com / พีท / ฝ่ายก่อสร้าง / engineer
5. Click: "สร้างทั้งหมด"
6. Wait for "สร้างแล้ว ✓" status

**Option B: Manual Creation via Supabase Dashboard**
1. Go to: Supabase Dashboard → Authentication → Users
2. Click: "Add user" button
3. Fill for each employee:
   ```
   Email: sale1@alisa.com
   Password: TempPass123
   Confirm: Yes
   ```
4. Add full_name + role in User Metadata:
   ```json
   {
     "full_name": "ฟ้า",
     "role": "sales",
     "department": "ฝ่ายขาย"
   }
   ```
5. Click: "Create user"
6. Repeat for sale2@alisa.com and engineer@alisa.com

#### Step 4.3: Verify All 3 Are Confirmed
1. Go to: Supabase Dashboard → Authentication → Users
2. Click on each employee email
3. Check: "Email confirmed at" has a timestamp (not empty)
4. If empty → Click "Confirm identity" → They must click confirmation link or admin can manually confirm

---

### PHASE 5: DELETE DEMO ACCOUNTS (20 minutes) ⚠️

**⚠️ WARNING: This is PERMANENT. Do not proceed if backup is not confirmed in Google Drive**

#### Step 5.1: Final Verification Before Deleting
1. Go to: Google Drive → Verify these files exist:
   - ✓ `AVIVA-ONE-BACKUP-DemoAccounts-2026-06-18.json`
   - ✓ `AVIVA-ONE-BACKUP-TestHouses-2026-06-18.json` (if applicable)
   - ✓ Supabase backup exists (from Step 1.2)
2. **If all verified:** Proceed to 5.2
3. **If anything missing:** STOP and re-do the backup phase

#### Step 5.2: Method 1 — Delete via Dashboard (Recommended)
1. Go to: Supabase Dashboard → Authentication → Users
2. Search for: `@aviva.th` in email field
3. Results should show ~9 demo accounts:
   ```
   ☐ ceo.test@aviva.th
   ☐ demo.admin@aviva.th
   ☐ demo.sales@aviva.th
   ☐ demo.finance@aviva.th
   ☐ demo.construction@aviva.th
   ☐ demo.accounting@aviva.th
   ☐ demo.hr@aviva.th
   ☐ demo.marketing@aviva.th
   ☐ demo.aftersales@aviva.th
   ```
4. Click each user email → Click "Delete user" button → Confirm "Delete"
5. Repeat for all 9 accounts
6. **Screenshot after last delete**

#### Step 5.3: Method 2 — Delete via SQL (If Dashboard not available)
1. Go to: SQL Editor
2. **Copy-paste DELETE statements from Section 7 of GOLIVE_CLEANUP_QUERIES.sql**
3. Carefully run (1 at a time or all together):
   ```sql
   DELETE FROM auth.users
   WHERE email = 'ceo.test@aviva.th'
      OR email = 'demo.admin@aviva.th'
      OR email = 'demo.sales@aviva.th'
      OR email = 'demo.finance@aviva.th'
      OR email = 'demo.construction@aviva.th'
      OR email = 'demo.accounting@aviva.th'
      OR email = 'demo.hr@aviva.th'
      OR email = 'demo.marketing@aviva.th'
      OR email = 'demo.aftersales@aviva.th';
   ```
4. Click: "Run"
5. Result should show: "x rows affected" (x = number deleted)

#### Step 5.4: Verify Deletion
1. Go to: SQL Editor
2. **Copy-paste Query #10** (Section 11: POST-DEPLOYMENT CHECKS)
3. Click: "Run"
4. **Expected result:**
   ```
   remaining_demo_accounts: 0
   ```
5. If result is 0 → ✅ **SUCCESS: Demo accounts deleted**
6. If result is >0 → ❌ **ERROR: Some still remain** → Repeat 5.2 or 5.3

---

### PHASE 6: DELETE TEST HOUSES (if applicable) (30 minutes)

**⚠️ Only run this phase if test houses were found in Phase 3.1**

#### Step 6.1: Final Verification Before Deleting
1. Check: `AVIVA-ONE-BACKUP-TestHouses-2026-06-18.json` exists in Google Drive ✓
2. Run Query #6 (FIND DEPENDENCIES) to see what data depends on test houses
3. Note any linked records (audit defects, sales leads, etc.)

#### Step 6.2: Delete in Correct Order
1. Go to: SQL Editor
2. Copy from **Section 7** in GOLIVE_CLEANUP_QUERIES.sql
3. Run in this order (wait for each to complete):

   **Step 1:** Delete audit defects
   ```sql
   DELETE FROM audit_defects
   WHERE house_id IN (SELECT id FROM houses WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05'));
   ```
   Wait for: "x rows affected" message

   **Step 2:** Delete sales leads
   ```sql
   DELETE FROM crm_leads
   WHERE house_id IN (SELECT id FROM houses WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05'));
   ```

   **Step 3:** Delete progress records
   ```sql
   DELETE FROM houses_progress
   WHERE house_id IN (SELECT id FROM houses WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05'));
   ```

   **Step 4:** Delete houses
   ```sql
   DELETE FROM houses
   WHERE plot_code IN ('A01', 'A02', 'A03', 'A04', 'A05');
   ```

#### Step 6.3: Verify Deletion
1. **Copy-paste Query #8** (Section 8: VERIFY)
2. Click: "Run"
3. Expected result: `test_houses_remaining: 0`

---

### PHASE 7: PRODUCTION DATA VALIDATION (15 minutes)

#### Step 7.1: Validate House Data
1. **Copy-paste Query #9** (Section 9: PRODUCTION DATA)
2. Click: "Run"
3. Expected result:
   - total_active_houses > 0 (should be dozens of real houses)
   - Example: `total_active_houses: 47`

#### Step 7.2: Validate Projects
1. Run Query from Section 9 (project integrity)
2. Expected:
   ```
   | project_name | total_units | houses_count | status    |
   |--------------|-------------|--------------|-----------|
   | AVIVA ONE    | 50          | 50           | active    |
   | ...          | ...         | ...          | ...       |
   ```

#### Step 7.3: Validate RLS Policies
1. **Copy-paste Query #10** (Section 10: RLS VERIFICATION)
2. Click: "Run"
3. Expected: Function exists + returns role name
4. Result: `auth_role()` returns current user's role (e.g., "sales", "engineer", "admin")

---

### PHASE 8: PREPARE FOR CODE DEPLOYMENT (15 minutes)

#### Step 8.1: Version Bump (if needed)
1. Open: Repository → `src/app/settings/page.tsx`
2. Find: Line 210 with `Version 6.34`
3. Check current version in code:
   ```bash
   grep -n "Version\|v[0-9]" src/app/settings/page.tsx | head -5
   grep -n "v[0-9]" src/app/dashboard/page.tsx | head -5
   ```
4. Decide next version:
   - If v6.34 → next is v6.35 (patch bump for cleanup)
   - If v7.0.0 → next is v7.0.1
5. **Skip if already done in another session**

#### Step 8.2: Build Test (Local CLI)
1. Terminal: `cd /home/user/AVIVA-ONE`
2. Run: `npm run build`
3. Expected output:
   ```
   ✓ Compiled successfully
   ```
4. If errors occur:
   - Check error message → File/type mismatch
   - Fix file → Re-run `npm run build`
   - **Do NOT proceed if build fails**

#### Step 8.3: Git Commit (if version bumped)
```bash
cd /home/user/AVIVA-ONE
git status                    # Verify only version files changed
git add src/app/settings/page.tsx src/app/dashboard/page.tsx
git commit -m "v6.35 — Pre-launch cleanup: Demo accounts + test data removed"
```

---

### PHASE 9: DEPLOYMENT & FINAL REPORT (30 minutes)

#### Step 9.1: Push to GitHub
```bash
git push origin main
git push origin claude/move-work-location-2CfBA
```
Wait for: "Everything up-to-date" messages

#### Step 9.2: Verify Vercel Deployment
1. Go to: https://vercel.com → Select AVIVA ONE project
2. Check: New deployment in progress
3. Wait for: "✓ Production" status (green checkmark)
4. Deployment usually takes 3-5 minutes

#### Step 9.3: Create Deploy Report
1. Open: Google Drive → `2026-06 Deployment` folder
2. Create: New File → "AVIVA-ONE-deploy-report-v6.35-2026-06-18.txt"
3. Paste template (fill in your details):

   ```
   =====================================================
   AVIVA ONE — DEPLOY REPORT v6.35
   =====================================================
   
   Date: 18 June 2026
   Time: [HH:MM น. UTC+7]  (e.g., 14:30 น.)
   Deployed By: [Your Name]
   
   =====================================================
   CLEANUP SUMMARY
   =====================================================
   
   Demo Accounts Deleted:
   ✓ ceo.test@aviva.th
   ✓ demo.admin@aviva.th
   ✓ demo.sales@aviva.th
   ✓ demo.finance@aviva.th
   ✓ demo.construction@aviva.th
   ✓ demo.accounting@aviva.th
   ✓ demo.hr@aviva.th
   ✓ demo.marketing@aviva.th
   ✓ demo.aftersales@aviva.th
   
   Test Houses Deleted: [0 or X]
   - [If X > 0: list plot codes deleted]
   
   Backup Files Created:
   ✓ AVIVA-ONE-BACKUP-DemoAccounts-2026-06-18.json
   ✓ AVIVA-ONE-BACKUP-TestHouses-2026-06-18.json
   ✓ Supabase Automated Backup: AVIVA-ONE-PreLaunch-2026-06-18
   
   =====================================================
   VERIFICATION RESULTS
   =====================================================
   
   Production Employees Verified:
   ✓ sale1@alisa.com (ฟ้า, Sales)
   ✓ sale2@alisa.com (เดียร์, Sales)
   ✓ engineer@alisa.com (พีท, Construction)
   
   Database Integrity:
   ✓ Production houses: [COUNT] active
   ✓ No orphaned records: ✓
   ✓ RLS policies: ✓ Verified
   
   Build Status:
   ✓ npm run build: SUCCESS
   ✓ No TypeScript errors
   ✓ Version updated: v6.35
   
   =====================================================
   DEPLOYMENT STATUS
   =====================================================
   
   GitHub Push:
   ✓ main branch
   ✓ claude/move-work-location-2CfBA branch
   
   Vercel Deployment:
   ✓ Status: Production
   ✓ Deployment URL: [copy from Vercel dashboard]
   
   Go-Live Readiness: ✓ READY FOR 25 JUNE 2026
   
   =====================================================
   NOTES
   =====================================================
   
   - Demo accounts completely removed from auth.users
   - All backups stored in Google Drive → 2026-06 Deployment folder
   - Production data verified and ready
   - Next deployment: 25 June 2026 (7 days)
   
   Questions? Contact: joyus818@gmail.com
   ```

#### Step 9.4: Share Report with Team
1. Go to: Google Drive → Report file → Click "Share"
2. Add: CEO, COO, Project Manager emails
3. Message: "AVIVA ONE pre-launch cleanup complete. Database is clean and ready for go-live on 25 June."

---

## ✅ COMPLETION CHECKLIST

After completing all phases, verify:

- [ ] Phase 1: Supabase backup created ✓
- [ ] Phase 2: Demo accounts backed up to Google Drive ✓
- [ ] Phase 3: Test houses backed up (if applicable) ✓
- [ ] Phase 4: 3 production employees verified ✓
- [ ] Phase 5: All 9 demo accounts deleted ✓ (verified count = 0)
- [ ] Phase 6: Test houses deleted (if applicable) ✓
- [ ] Phase 7: Production data validated ✓
- [ ] Phase 8: Build test passed ✓
- [ ] Phase 9: Code pushed + Vercel deployed ✓
- [ ] Phase 9: Deploy report created + shared ✓

**Status:** ✅ **GO-LIVE PREPARATION COMPLETE**

---

## 🆘 TROUBLESHOOTING

### Issue: "Demo accounts still showing 9 rows after delete"
**Solution:**
- Refresh browser completely (Ctrl+Shift+Delete cache)
- Try SQL query again
- If still 9 rows: Contact Supabase support

### Issue: "Cannot find production employees"
**Solution:**
- Use admin panel (/settings/users) to create manually
- Or use Supabase Dashboard → "Add user" button
- Ensure email is confirmed before go-live

### Issue: "Build failed with TypeScript errors"
**Solution:**
- Read error message carefully
- Common: Missing fields in setForm({...})
- Fix: Add missing fields to all setForm calls
- Re-run: `npm run build`

### Issue: "Vercel deployment failed"
**Solution:**
- Go to Vercel dashboard → Check deployment logs
- Common: Missing env vars
- Fix: Add to Vercel project settings
- Re-deploy: Push same commit again

---

**Need Help?** → Email: joyus818@gmail.com

**Go-Live Date: 25 JUNE 2026** ⏰

