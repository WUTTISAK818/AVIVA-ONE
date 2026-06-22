#!/bin/bash

# AVIVA ONE — Vercel Environment Variables Setup (Automated)
# ตั้ง 3 environment variables ทีเดียวเสร็จ

set -e

echo "🚀 AVIVA ONE — Setting Vercel Environment Variables"
echo "=================================================="
echo ""

# ตัวแปร
VERCEL_TOKEN=""
PROJECT_ID="wuttisak-s-projects/aviva-one"

# ขอ Vercel Personal Access Token
echo "📋 ต้องการ: Vercel Personal Access Token"
echo "ได้จาก: https://vercel.com/account/tokens"
echo ""
read -sp "Paste your Vercel token: " VERCEL_TOKEN
echo ""
echo ""

if [ -z "$VERCEL_TOKEN" ]; then
    echo "❌ Error: Token required"
    exit 1
fi

# Define environment variables
declare -a ENV_VARS=(
    "SUPABASE_SERVICE_ROLE_KEY:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweGVyeHhjYnh3c2ppbXpvdWdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUxOTc1NiwiZXhwIjoyMDk0MDk1NzU2fQ.ZPdAfdI5h3X-LCmO9fZkgZQftDRgVs8VnF_RiMFhEyg"
    "NEXT_PUBLIC_SUPABASE_URL:https://lpxerxxcbxwsjimzougk.supabase.co"
    "CRON_SECRET:aviva-prod-cron-2025"
)

echo "📝 ตั้งค่า environment variables..."
echo ""

# Loop through each environment variable
for env_var in "${ENV_VARS[@]}"; do
    IFS=':' read -r KEY VALUE <<< "$env_var"

    echo "🔄 Setting: $KEY"

    # Use Vercel API to set environment variable
    RESPONSE=$(curl -s -X POST "https://api.vercel.com/v9/projects/$PROJECT_ID/env" \
        -H "Authorization: Bearer $VERCEL_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"key\": \"$KEY\",
            \"value\": \"$VALUE\",
            \"target\": [\"production\"]
        }")

    # Check if successful
    if echo "$RESPONSE" | grep -q '"key"'; then
        echo "   ✅ Set successfully"
    else
        echo "   ⚠️  Response: $RESPONSE"
    fi
    echo ""
done

echo "=================================================="
echo "✅ Environment variables set!"
echo ""
echo "Vercel will auto-redeploy in 2-3 minutes"
echo "Check: https://vercel.com/wuttisak-s-projects/aviva-one/deployments"
echo ""
echo "🎯 Next: Wait for deployment to complete → v6.55 LIVE 🚀"
