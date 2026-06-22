# Vercel Environment Variables Setup — COPY/PASTE Ready

**Status:** Ready to set ✅
**Go-Live Date:** June 23, 2025
**Version:** v6.55 (deploy) + v6.56 (codebase)

---

## Quick Setup (3 minutes)

### Step 1: Open Vercel Settings
```
https://vercel.com/wuttisak-s-projects/aviva-one/settings/environment-variables
```

### Step 2: Add 3 Environment Variables

**Variable 1:**
```
Key:   SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweGVyeHhjYnh3c2ppbXpvdWdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUxOTc1NiwiZXhwIjoyMDk0MDk1NzU2fQ.ZPdAfdI5h3X-LCmO9fZkgZQftDRgVs8VnF_RiMFhEyg
Target: Production
```

**Variable 2:**
```
Key:   NEXT_PUBLIC_SUPABASE_URL
Value: https://lpxerxxcbxwsjimzougk.supabase.co
Target: Production
```

**Variable 3:**
```
Key:   CRON_SECRET
Value: aviva-prod-cron-2025
Target: Production
```

---

## Step 3: Verify Deployment

1. Click **Save** on each variable (Vercel auto-redeploys)
2. Wait 2-3 minutes
3. Check Deployments tab: https://vercel.com/wuttisak-s-projects/aviva-one/deployments
4. Verify v6.55 shows ✓ Deployment Complete

---

## Step 4: Verify API Working

Run this command:
```bash
curl -s https://aviva-4kdgzsmoo-wuttisak-s-projects.vercel.app/api/dashboard | jq '.success'
# Should see: true
```

---

## Database Seeding Status ✅

All SQL seeding completed:
- ✅ Contractors (bank details): 2 records
- ✅ Message Templates: 7 templates  
- ✅ App Settings: 34 settings

Final verification passed:
```
Contractors | 2
Settings    | 34
Templates   | 7
```

---

## What Was Done

✅ Phase 1-4 Code: Receipt OCR, Finance, Marketing Automation
✅ v6.55 ready for production
✅ v6.56 codebase bumped (for ongoing development)
✅ All migrations applied + RLS configured
✅ SQL seeding complete (P3-1, P3-2, P3-3)
✅ Environment variables documented

---

## Deployment Timeline

- **June 22, 2026 17:00 น. (UTC+7):** v6.56 code pushed, deploy report created
- **June 22, 2026 (Now):** SQL seeding complete, Vercel env vars ready
- **June 23, 2025:** Go-Live v6.55 production
- **After env vars set:** Auto-redeploy → System live

---

**🚀 Ready to Go-Live!**
