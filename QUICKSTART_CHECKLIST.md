# AVIVA ONE — Go-Live QUICK-START Checklist
**Print this page. Tick boxes as you complete each step. ⏰ 6 DAYS LEFT**

---

## TODAY: 18 JUNE 2026 — 3-HOUR SPEED RUN

### 🟦 HOUR 1: BACKUP & VERIFICATION (0:00 - 1:00)

- [ ] **[0:00]** Open Supabase Dashboard → SQL Editor
- [ ] **[0:05]** Run Query #1 (Section 1: BACKUP DEMO ACCOUNTS) → See 9 rows
- [ ] **[0:10]** Export results as JSON → Download
- [ ] **[0:15]** Upload JSON to Google Drive → 2026-06 Deployment folder
- [ ] **[0:20]** Copy Google Drive link → Paste here: `____________________`
- [ ] **[0:25]** Verify: Email confirmed for sale1@alisa.com? ✓ / ✗
- [ ] **[0:25]** Verify: Email confirmed for sale2@alisa.com? ✓ / ✗
- [ ] **[0:25]** Verify: Email confirmed for engineer@alisa.com? ✓ / ✗
- [ ] **[0:30]** If missing employees → Use /settings/users → Seed Accounts
- [ ] **[0:40]** Supabase Dashboard → Project Settings → Create backup manually
- [ ] **[0:50]** Screenshot confirmation → Save locally

**✓ HOUR 1 CHECKPOINT:** All backups done. 9 demo accounts identified. 3 employees verified.

---

### 🟦 HOUR 2: DELETE DEMO ACCOUNTS (1:00 - 2:00)

- [ ] **[1:00]** Verify Google Drive has:
  - [ ] AVIVA-ONE-BACKUP-DemoAccounts-*.json ✓
  - [ ] Supabase backup entry visible ✓
- [ ] **[1:05]** Supabase Dashboard → Authentication → Users
- [ ] **[1:10]** Search: `@aviva.th` → See 9 demo accounts listed
- [ ] **[1:15]** Delete: `ceo.test@aviva.th` → Confirm
- [ ] **[1:18]** Delete: `demo.admin@aviva.th` → Confirm
- [ ] **[1:21]** Delete: `demo.sales@aviva.th` → Confirm
- [ ] **[1:24]** Delete: `demo.finance@aviva.th` → Confirm
- [ ] **[1:27]** Delete: `demo.construction@aviva.th` → Confirm
- [ ] **[1:30]** Delete: `demo.accounting@aviva.th` → Confirm
- [ ] **[1:33]** Delete: `demo.hr@aviva.th` → Confirm
- [ ] **[1:36]** Delete: `demo.marketing@aviva.th` → Confirm
- [ ] **[1:39]** Delete: `demo.aftersales@aviva.th` → Confirm
- [ ] **[1:45]** Refresh dashboard → Search `@aviva.th` → See 0 results
- [ ] **[1:50]** SQL Editor → Run Query #10 (POST-DEPLOYMENT) → Result: 0
- [ ] **[1:55]** Screenshot verification → Save locally

**✓ HOUR 2 CHECKPOINT:** All 9 demo accounts DELETED. Verified count = 0.

---

### 🟦 HOUR 3: BUILD & DEPLOY PREP (2:00 - 3:00)

- [ ] **[2:00]** Terminal: `cd /home/user/AVIVA-ONE`
- [ ] **[2:05]** Run: `npm run build`
- [ ] **[2:20]** Expected: `✓ Compiled successfully` (wait ~15 min)
- [ ] **[2:20]** If error: Fix + Re-run build
- [ ] **[2:35]** Check version:
  - [ ] Current dashboard badge: v__.__.__
  - [ ] Current settings version: Version __.__.
- [ ] **[2:40]** Update version (if needed):
  - [ ] Edit src/app/dashboard/page.tsx → v6.35
  - [ ] Edit src/app/settings/page.tsx → Version 6.35
- [ ] **[2:45]** Git commit: `git add . && git commit -m "v6.35 — Pre-launch cleanup"`
- [ ] **[2:50]** Git push: `git push origin main`
- [ ] **[2:52]** Git push: `git push origin claude/move-work-location-2CfBA`
- [ ] **[2:55]** Vercel dashboard → Confirm deployment in progress
- [ ] **[2:58]** Screenshot: Production status ✓

**✓ HOUR 3 CHECKPOINT:** Code built. Version bumped. Deployed to GitHub. Vercel building.

---

## NEXT 6 DAYS: PREPARATION TIMELINE

### 📅 19 JUNE (FRIDAY)
- [ ] Morning: Smoke tests (QA)
- [ ] Afternoon: Department UAT — Each team tests their module
- [ ] Evening: Fix any bugs found

### 📅 20 JUNE (SATURDAY)
- [ ] Optional: Additional UAT if needed
- [ ] OR: Team rest day

### 📅 22-23 JUNE (MONDAY-TUESDAY)
- [ ] Final security review
- [ ] Database integrity check
- [ ] User permissions verification

### 📅 24 JUNE (WEDNESDAY)
- [ ] Database backup (final)
- [ ] Build production image (if containerized)
- [ ] Deploy to staging environment (final test)
- [ ] All sign-offs collected

### 📅 25 JUNE (THURSDAY) — LAUNCH DAY
- [ ] 06:00 — Team assembled (30 min before launch)
- [ ] 07:00 — Deploy to production
- [ ] 07:00-09:00 — Monitoring + support on-call
- [ ] 12:00 — Declare go-live complete (if no critical issues)

---

## VERIFICATION QUESTIONS

After completing all 3 hours, answer these:

1. **Demo Accounts:**
   - [ ] Are 9 demo accounts deleted? Answer: `____` (YES/NO)
   - [ ] SQL query "remaining_demo_accounts" returned 0? Answer: `____` (YES/NO)

2. **Employees:**
   - [ ] Do sale1@alisa.com exist + confirmed? Answer: `____` (YES/NO)
   - [ ] Do sale2@alisa.com exist + confirmed? Answer: `____` (YES/NO)
   - [ ] Do engineer@alisa.com exist + confirmed? Answer: `____` (YES/NO)

3. **Build:**
   - [ ] Does build compile without errors? Answer: `____` (YES/NO)
   - [ ] Is version updated to 6.35? Answer: `____` (YES/NO)

4. **Deployment:**
   - [ ] Is code pushed to main + Vercel branch? Answer: `____` (YES/NO)
   - [ ] Is Vercel deployment showing green ✓ Production? Answer: `____` (YES/NO)

5. **Backups:**
   - [ ] Are all backup JSONs in Google Drive? Answer: `____` (YES/NO)
   - [ ] Is Supabase backup created? Answer: `____` (YES/NO)

---

## ⚠️ CRITICAL GATES — DO NOT SKIP

**GATE #1: Backups Exist**
- Without backup, deletions cannot be undone
- If backup missing → STOP and re-do backup phase
- Confirm message: "✅ Google Drive folder has all 3 JSON files"

**GATE #2: Demo Accounts Deleted**
- Verify SQL query returns 0 remaining demo accounts
- Confirm message: "✅ SQL query returned remaining_demo_accounts: 0"

**GATE #3: Build Compiles**
- TypeScript errors block deployment
- Confirm message: "✅ npm run build → ✓ Compiled successfully"

**GATE #4: Code Deployed**
- Vercel must show green Production status
- Confirm message: "✅ Vercel shows ✓ Production (green)"

---

## FINAL STATUS BOARD (to fill after completion)

```
AVIVA ONE Pre-Launch Status — 18 June 2026
==============================================

Backup Status:
  Demo Accounts    ✅ / ❌
  Test Houses      ✅ / ❌ / N/A
  Supabase Backup  ✅ / ❌

Database Cleanup:
  Demo Accounts    ✅ DELETED (0 remaining)
  Test Houses      ✅ DELETED / N/A
  Production Data  ✅ VERIFIED (3 employees, X houses)

Build Status:
  npm run build    ✅ SUCCESS / ❌ FAILED
  Version Bumped   ✅ YES / ❌ NO
  Git Push         ✅ MAIN + BRANCH / ❌ FAILED

Deployment Status:
  GitHub Push      ✅ COMPLETE
  Vercel Status    ✅ PRODUCTION / 🔄 BUILDING / ❌ FAILED

GO-LIVE READINESS:
  🟢 READY FOR 25 JUNE 2026
  OR
  🔴 ISSUES FOUND — MUST RESOLVE

Issues Found (if any):
  1. ________________________________________
  2. ________________________________________
  3. ________________________________________

Signed By: ________________________  Date: __________
```

---

## 💡 PRO TIPS

- **Have SQL Editor open in one tab, Dashboard in another** — Faster switching
- **Take screenshots** — Proof of completion for audit trail
- **Don't rush the backups** — 10 minutes here saves 10 HOURS if rollback needed
- **Test on staging first** (if available) — Deploy path: staging → main
- **Keep this checklist updated** — Share with team for transparency

---

## EMERGENCY CONTACTS

- **Technical Issues:** Open SQL Editor issue / Check Supabase docs
- **Build Errors:** grep error message → Fix file → Rebuild
- **Deployment Blocked:** Check Vercel dashboard for build logs
- **Database Issues:** Restore backup from Google Drive
- **Questions:** Email joyus818@gmail.com

---

**⏰ TIMER STARTS NOW. You have 3 hours. Go! 🚀**

*Document: AVIVA ONE Quick-Start Checklist*
*For: Pre-launch cleanup before 25 June 2026 go-live*
