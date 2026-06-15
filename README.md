# AVIVA Plus — Resident/Guard/Juristic Surfaces

Branch `plus-deploy` is a complete standalone Next.js app for AVIVA Plus,
deployable to Vercel directly from this branch.

## Vercel Setup
- Repo: `WUTTISAK818/aviva-one`
- Production Branch: `plus-deploy`
- Root Directory: `./`
- Framework: Next.js (auto-detect)

## Env Vars (set in Vercel)
- `NEXT_PUBLIC_SUPABASE_URL` = `https://azstncqpwyrabwvcuxjf.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_D0pvoxynqKJuzyY7CXvNiA_2Eau5g5e`
- `SUPABASE_SERVICE_ROLE_KEY` = (from Supabase Dashboard → Project: aviva-plus → Settings → API)

## Supabase
- Project: `aviva-plus` (`azstncqpwyrabwvcuxjf`)
- Region: `ap-southeast-1`
- 37 public tables + 23 auth tables
- Seed: 55 houses, 3 residents, 3 facilities

## Routes
- `/` → redirect `/community/announcements`
- `/login` — resident login form
- `/community/*` — 17 resident-facing routes
- `/guard/*` — 8 guard surfaces
- `/security/*` — 22 juristic management surfaces
- `/v/[qr_token]` — visitor pass landing
- `/settings/*` — shared settings
- `/api/*` — 13 API endpoints

## Status
Build verified locally. 47 routes compile, TypeScript pass, no errors.
