#!/usr/bin/env bash
# AVIVA Plus — One-shot deploy script
# Run this in a session scoped to WUTTISAK818/aviva-plus
# Assumes: ONE repo branch claude/aviva-plus-resident-app-wdPCx already cloned
#
# Usage:
#   git clone https://github.com/WUTTISAK818/aviva-one.git /tmp/aviva-one
#   cd /tmp/aviva-one && git checkout claude/aviva-plus-resident-app-wdPCx
#   git clone https://github.com/WUTTISAK818/aviva-plus.git /tmp/aviva-plus
#   bash /tmp/aviva-one/aviva-plus-extract/scripts/deploy.sh /tmp/aviva-one /tmp/aviva-plus

set -euo pipefail

ONE="${1:-/tmp/aviva-one}"
PLUS="${2:-/tmp/aviva-plus}"
EXTRACT="$ONE/aviva-plus-extract"

echo "==> ONE repo:   $ONE"
echo "==> PLUS repo:  $PLUS"
echo "==> Extract:    $EXTRACT"
echo ""

if [ ! -d "$EXTRACT" ]; then
  echo "ERROR: $EXTRACT not found — wrong branch?"
  exit 1
fi

# === Step 1: scaffold Next.js if PLUS is empty ===
if [ ! -f "$PLUS/package.json" ]; then
  echo "==> [1/6] Scaffolding Next.js in $PLUS"
  cd "$PLUS"
  # Use the prepared package.json instead of create-next-app
  cp "$EXTRACT/package.json" .
  mkdir -p src/app src/components src/lib public
  # Minimal tsconfig
  cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF
  # Next.js plumbing
  cat > next.config.ts <<'EOF'
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  experimental: { typedRoutes: false },
};
export default nextConfig;
EOF
  cat > next-env.d.ts <<'EOF'
/// <reference types="next" />
/// <reference types="next/image-types/global" />
EOF
  cat > .gitignore <<'EOF'
node_modules
.next
out
.env.local
.env*.local
.vercel
*.tsbuildinfo
next-env.d.ts
EOF
  # ESLint
  cat > eslint.config.mjs <<'EOF'
import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [...compat.extends("next/core-web-vitals", "next/typescript")];
EOF
fi

# === Step 2: copy Plus surfaces from ONE ===
echo "==> [2/6] Copying Plus surfaces"
bash "$EXTRACT/scripts/copy-plus-files.sh" "$ONE" "$PLUS"

# === Step 3: overlay Plus-only shared files ===
echo "==> [3/6] Overlaying Plus-only shared files"
cp "$EXTRACT/src/app/layout.tsx"          "$PLUS/src/app/layout.tsx"
cp "$EXTRACT/src/app/manifest.ts"         "$PLUS/src/app/manifest.ts"
cp "$EXTRACT/src/app/page.tsx"            "$PLUS/src/app/page.tsx"
cp "$EXTRACT/src/app/icon.tsx"            "$PLUS/src/app/icon.tsx"
cp "$EXTRACT/src/app/apple-icon.tsx"      "$PLUS/src/app/apple-icon.tsx"
cp "$EXTRACT/src/app/login/page.tsx"      "$PLUS/src/app/login/page.tsx"
cp "$EXTRACT/src/components/BottomNav.tsx" "$PLUS/src/components/BottomNav.tsx"
cp "$EXTRACT/src/lib/user-context.tsx"    "$PLUS/src/lib/user-context.tsx"

# Promote .from-one configs (review then accept)
if [ -f "$PLUS/next.config.ts.from-one" ]; then
  mv "$PLUS/next.config.ts.from-one" "$PLUS/next.config.ts"
fi
# Root page.tsx already overlaid above, discard the .from-one copy
rm -f "$PLUS/src/app/page.tsx.from-one"

# === Step 4: setup .env.local ===
echo "==> [4/6] Setting up .env.local"
cp "$EXTRACT/.env.example" "$PLUS/.env.local"

# === Step 5: npm install + build ===
echo "==> [5/6] npm install + build"
cd "$PLUS"
npm install
npm run build

# === Step 6: commit + push ===
echo "==> [6/6] Commit + push to main"
git add .
git commit -m "Initial AVIVA Plus extraction — community/guard/security surfaces from AVIVA ONE

- 47 routes (17 community + 8 guard + 22 security + /v + /login + /settings)
- 13 API routes (Plus-only — visitor passes, bills, gate events, polls, etc.)
- 9 components (community + security)
- Plus-only layout, manifest, BottomNav, user-context
- Supabase: aviva-plus (azstncqpwyrabwvcuxjf)"
git push -u origin main

echo ""
echo "✅ Done. Now go to Vercel:"
echo "   1. Import WUTTISAK818/aviva-plus"
echo "   2. Set env vars from .env.local"
echo "   3. Deploy"
