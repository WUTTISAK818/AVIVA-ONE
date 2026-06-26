# Auto-Deploy Pipeline Setup for AVIVA ONE

## Overview
After completing work and pushing to main branch, the application automatically:
1. ✅ Builds and verifies code (TypeScript check)
2. ✅ Triggers Vercel deployment
3. ⏳ Supabase migrations (manual step via dashboard or CLI)

---

## Workflow: Push → Test → Deploy

### Step 1: Complete Work & Push to Main
```bash
git add -A
git commit -m "Feature: Your work here"
git push origin main
```

### Step 2: GitHub Actions Runs Automatically
- **Triggered:** When code is pushed to `main`
- **Actions:**
  - Build & compile (npm run build)
  - TypeScript validation
  - Vercel deployment trigger
- **Time:** ~2-3 minutes
- **Status:** View in GitHub Actions tab

### Step 3: Vercel Auto-Deploys
- **Auto-detected:** When main branch is updated
- **Build:** Next.js optimized build
- **Deploy:** CDN deployment worldwide
- **Time:** ~1-2 minutes
- **Preview:** Vercel dashboard shows deployment status

### Step 4: Supabase Migrations (Manual)
**⚠️ Still requires manual step:**

If new migrations were added, apply them to Supabase:

#### Option A: Supabase Dashboard (Easiest)
1. Go to: https://app.supabase.com
2. Select project: AVIVA ONE
3. SQL Editor → Run migration file:
   ```sql
   -- Copy entire SQL file content and execute
   -- e.g., supabase/migrations/20260626_add_command_tracking_fields.sql
   ```

#### Option B: Supabase CLI (Recommended for CI)
```bash
supabase migration up
# or
supabase db push --dry-run  # preview
supabase db push            # apply
```

---

## GitHub Actions Setup

### Required Secrets (Set in GitHub):
1. **VERCEL_TOKEN** - Vercel API token
2. **VERCEL_PROJECT_ID** - Vercel project ID
3. **VERCEL_TEAM_ID** - Vercel team ID
4. **SUPABASE_URL** - Supabase project URL
5. **SUPABASE_SERVICE_ROLE_KEY** - Supabase service key

### How to Add Secrets:
1. GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret above

---

## Deployment Status Checks

### View Deploy Progress:
- **GitHub Actions:** Repo → Actions tab → Latest workflow
- **Vercel:** https://vercel.com → AVIVA ONE project
- **Supabase:** https://app.supabase.com → Deployments tab

### Common Checks:
```bash
# Check current version
cat src/lib/version.ts

# View latest commits
git log --oneline -5

# Check if migrations exist
ls supabase/migrations/
```

---

## Emergency Rollback

If deployment has issues:

### Rollback Code (via Vercel):
1. Vercel Dashboard → AVIVA ONE
2. Click "Deployments" tab
3. Select previous stable version
4. Click "Promote to Production"

### Rollback Database (via Supabase):
1. Supabase Dashboard → Backups
2. Restore from latest backup before migration
3. Reapply migrations carefully

---

## Workflow Summary

| Step | Trigger | Action | Time | Status |
|------|---------|--------|------|--------|
| 1. Commit | Manual (git push) | Push to main | - | ✅ Done |
| 2. Build | Auto (GitHub Actions) | npm run build | 2-3m | 🔄 Running |
| 3. Deploy | Auto (Vercel) | CDN deployment | 1-2m | 🔄 Running |
| 4. DB Migration | Manual (Supabase) | Apply SQL | varies | ⏳ Manual |
| 5. Verify | Manual | Check production | - | ✅ Ready |

---

## Next Steps to Enable Full Auto-Deploy

To make migrations fully automatic:

1. **Option 1:** Setup Supabase CLI in GitHub Actions
2. **Option 2:** Use Supabase API with authentication token
3. **Option 3:** Create custom migration runner

Currently: Workflow identifies migrations and logs them for manual application.

---

## Support

For questions about auto-deploy setup:
- Check GitHub Actions logs for errors
- Review Vercel deployment logs
- Check Supabase migration status in dashboard
