#!/bin/bash
# AVIVA ONE v6.56 — Vercel Environment Variables Setup Script
# Usage: bash set-vercel-envs.sh

set -e

echo "🚀 AVIVA ONE — Setting Vercel Environment Variables"
echo "=================================================="

# Get Vercel auth token from user
echo ""
echo "ต้องการ: Vercel Auth Token"
echo "ได้จาก: https://vercel.com/account/tokens"
echo ""
read -sp "Paste your Vercel auth token: " VERCEL_TOKEN
echo ""

if [ -z "$VERCEL_TOKEN" ]; then
    echo "❌ Error: Vercel token required"
    exit 1
fi

export VERCEL_TOKEN

# Environment variables to set
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweGVyeHhjYnh3c2ppbXpvdWdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUxOTc1NiwiZXhwIjoyMDk0MDk1NzU2fQ.ZPdAfdI5h3X-LCmO9fZkgZQftDRgVs8VnF_RiMFhEyg"
NEXT_PUBLIC_SUPABASE_URL="https://lpxerxxcbxwsjimzougk.supabase.co"
CRON_SECRET="aviva-prod-cron-2025"

PROJECT_ID="wuttisak-s-projects/aviva-one"

echo "📝 Setting environment variables..."
echo ""

# Set env vars using Vercel API
echo "Setting SUPABASE_SERVICE_ROLE_KEY..."
curl -s -X POST https://api.vercel.com/v9/projects/$PROJECT_ID/env \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "SUPABASE_SERVICE_ROLE_KEY",
    "value": "'$SUPABASE_SERVICE_ROLE_KEY'",
    "target": ["production"]
  }' | jq '.' || echo "⚠️  Could not set via API, use web UI instead"

echo ""
echo "Setting NEXT_PUBLIC_SUPABASE_URL..."
curl -s -X POST https://api.vercel.com/v9/projects/$PROJECT_ID/env \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "NEXT_PUBLIC_SUPABASE_URL",
    "value": "'$NEXT_PUBLIC_SUPABASE_URL'",
    "target": ["production"]
  }' | jq '.' || echo "⚠️  Could not set via API, use web UI instead"

echo ""
echo "Setting CRON_SECRET..."
curl -s -X POST https://api.vercel.com/v9/projects/$PROJECT_ID/env \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "CRON_SECRET",
    "value": "'$CRON_SECRET'",
    "target": ["production"]
  }' | jq '.' || echo "⚠️  Could not set via API, use web UI instead"

echo ""
echo "✅ Environment variables set!"
echo ""
echo "Vercel will auto-redeploy in 2-3 minutes"
echo "Check: https://vercel.com/wuttisak-s-projects/aviva-one/deployments"
