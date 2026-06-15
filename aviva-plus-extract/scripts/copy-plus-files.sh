#!/usr/bin/env bash
# Copy Plus-only files from AVIVA ONE branch → AVIVA Plus repo
# Usage: bash copy-plus-files.sh <ONE_REPO_ROOT> <PLUS_REPO_ROOT>

set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <ONE_REPO_ROOT> <PLUS_REPO_ROOT>"
  echo "  ONE_REPO_ROOT = path to wuttisak818/aviva-one (branch claude/aviva-plus-resident-app-wdPCx)"
  echo "  PLUS_REPO_ROOT = path to joyus818/aviva-plus (scaffolded Next.js)"
  exit 1
fi

ONE="$1"
PLUS="$2"

if [ ! -d "$ONE/src/app/community" ]; then
  echo "ERROR: $ONE doesn't look like AVIVA ONE repo (missing src/app/community)"
  exit 1
fi
if [ ! -d "$PLUS/src/app" ]; then
  echo "ERROR: $PLUS doesn't look like a Next.js repo (missing src/app)"
  exit 1
fi

echo "Copying Plus surfaces..."

# 1. Community routes (17 files)
mkdir -p "$PLUS/src/app/community"
cp -r "$ONE/src/app/community/." "$PLUS/src/app/community/"

# 2. Guard routes (8 files)
mkdir -p "$PLUS/src/app/guard"
cp -r "$ONE/src/app/guard/." "$PLUS/src/app/guard/"

# 3. Security routes (22 files — Juristic manager surface)
mkdir -p "$PLUS/src/app/security"
cp -r "$ONE/src/app/security/." "$PLUS/src/app/security/"

# 4. Visitor pass landing
mkdir -p "$PLUS/src/app/v/[qr_token]"
cp "$ONE/src/app/v/[qr_token]/page.tsx" "$PLUS/src/app/v/[qr_token]/page.tsx"

# 5. API routes (Plus-only)
mkdir -p "$PLUS/src/app/api"
for api in announcements bills gate-events gates juristic-journals visitor-passes; do
  cp -r "$ONE/src/app/api/$api" "$PLUS/src/app/api/"
done
# residents/invite (sub-route of residents)
mkdir -p "$PLUS/src/app/api/residents"
cp -r "$ONE/src/app/api/residents/invite" "$PLUS/src/app/api/residents/"
# resolutions/[id]/vote
mkdir -p "$PLUS/src/app/api/resolutions/[id]"
cp -r "$ONE/src/app/api/resolutions/[id]/vote" "$PLUS/src/app/api/resolutions/[id]/"
# Plus payment + ALPR (Plus-specific)
cp -r "$ONE/src/app/api/promptpay-qr" "$PLUS/src/app/api/"
cp -r "$ONE/src/app/api/mock-alpr" "$PLUS/src/app/api/"

# 6. Components — Plus only + shared root components used by Plus pages
mkdir -p "$PLUS/src/components/community" "$PLUS/src/components/security"
cp -r "$ONE/src/components/community/." "$PLUS/src/components/community/"
cp -r "$ONE/src/components/security/." "$PLUS/src/components/security/"
# Shared UI primitives used across Plus pages
cp "$ONE/src/components/GlassCard.tsx"     "$PLUS/src/components/"
cp "$ONE/src/components/KPICard.tsx"       "$PLUS/src/components/"
cp "$ONE/src/components/SectionHeader.tsx" "$PLUS/src/components/"

# 7. Libs — Plus-only utilities
mkdir -p "$PLUS/src/lib"
cp "$ONE/src/lib/aviva-plus-font.ts" "$PLUS/src/lib/"
cp "$ONE/src/lib/gate-events.ts" "$PLUS/src/lib/"

# 8. Supabase clients (shared shape, but reuse)
cp "$ONE/src/lib/supabase.ts" "$PLUS/src/lib/"
cp "$ONE/src/lib/supabase-server.ts" "$PLUS/src/lib/"

# 9. Theme/AuthProvider (shared infra)
cp "$ONE/src/lib/theme-context.tsx" "$PLUS/src/lib/" 2>/dev/null || echo "  (theme-context.tsx not found — skip)"
cp "$ONE/src/components/AuthProvider.tsx" "$PLUS/src/components/" 2>/dev/null || echo "  (AuthProvider.tsx not found — skip)"

# 10. globals.css (Tailwind v4 — theme is inline, no tailwind.config)
cp "$ONE/src/app/globals.css" "$PLUS/src/app/"
cp "$ONE/postcss.config.mjs" "$PLUS/"
# next.config.ts — copy but review (may have ONE-specific settings)
cp "$ONE/next.config.ts" "$PLUS/next.config.ts.from-one"
echo "  ⚠️  next.config.ts copied as next.config.ts.from-one — review before replacing"

# 11. settings page (shared) + dashboard removal
# Plus has /settings but NOT /dashboard, /crm, /construction, /office, /reports
mkdir -p "$PLUS/src/app/settings"
[ -d "$ONE/src/app/settings" ] && cp -r "$ONE/src/app/settings/." "$PLUS/src/app/settings/"

# 12. globals + root page (need landing — copy / page if exists)
[ -f "$ONE/src/app/page.tsx" ] && cp "$ONE/src/app/page.tsx" "$PLUS/src/app/page.tsx.from-one"
echo "  ⚠️  root page.tsx copied as page.tsx.from-one — Plus needs custom landing or redirect"

echo ""
echo "✅ Copy complete."
echo ""
echo "Next steps:"
echo "  1. Overwrite shared files with Plus-only versions:"
echo "       cp aviva-plus-extract/src/app/layout.tsx          \$PLUS/src/app/"
echo "       cp aviva-plus-extract/src/app/manifest.ts         \$PLUS/src/app/"
echo "       cp aviva-plus-extract/src/app/login/page.tsx      \$PLUS/src/app/login/"
echo "       cp aviva-plus-extract/src/components/BottomNav.tsx \$PLUS/src/components/"
echo "       cp aviva-plus-extract/src/lib/user-context.tsx    \$PLUS/src/lib/"
echo ""
echo "  2. cp aviva-plus-extract/.env.example \$PLUS/.env.local"
echo "  3. cd \$PLUS && npm install && npm run build"
