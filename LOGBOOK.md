# CREVIS V2 — Logbook

## 2026-04-05 — Blocking fixes + UI improvements

### B1: Supabase auth email redirect ✅
- Added `emailRedirectTo: \`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback\`` to `signUp` call in [app/auth/page.tsx](app/auth/page.tsx)
- Created [app/auth/callback/route.ts](app/auth/callback/route.ts) — exchanges code for session, redirects to `/dashboard`
- **Manual step required**: Set Site URL + Redirect URL in Supabase Dashboard → Authentication → URL Configuration:
  - Site URL: `https://crevis-v2.vercel.app`
  - Redirect URLs: `https://crevis-v2.vercel.app/**`

### B2: Slack OAuth redirect URI ✅
- Code was already correct — both `route.ts` files use `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback`
- `NEXT_PUBLIC_APP_URL` is set to `https://crevis-v2.vercel.app` in Vercel Production env
- **Manual step required**: In Slack app settings (api.slack.com/apps) → OAuth & Permissions → Redirect URLs, ensure only `https://crevis-v2.vercel.app/api/auth/slack/callback` is listed (remove localhost)

### B3: Payment initialization failure ✅
- Root cause: `credit_purchases` table had no RLS INSERT policy, so the anon-client insert was silently rejected
- Fix: switched the insert in [app/api/credits/purchase/route.ts](app/api/credits/purchase/route.ts) to use `supabaseAdmin` (service role bypasses RLS)
- **Manual step required**: Run migration `0008` in Supabase SQL Editor (also adds INSERT policy as belt-and-suspenders)

### I1: Stock quantity on products ✅
- New `stock` column (integer, default 1) via migration [supabase/migrations/0008_add_stock_and_photo_urls.sql](supabase/migrations/0008_add_stock_and_photo_urls.sql)
- Stock input added to [app/(app)/products/new/page.tsx](app/(app)/products/new/page.tsx) — sits between Price and Category
- API [app/api/products/create/route.ts](app/api/products/create/route.ts) now saves `stock`
- Product cards in [app/(app)/products/page.tsx](app/(app)/products/page.tsx) show "Stock: N" badge

### I2: Wallet UI layout ✅
- Refactored [app/(app)/wallet/page.tsx](app/(app)/wallet/page.tsx):
  - Removed the broken 3-col grid; balance card now full-width at top
  - "Top up wallet" + "Have a coupon?" in `grid grid-cols-1 sm:grid-cols-2 gap-6 w-full` — no cut-off
  - Each card has `min-w-0` to prevent overflow
  - Credits display uses `.toLocaleString()` so "+1,200 C" renders on one line with `whitespace-nowrap`

### I3: Multiple product photos (up to 5) ✅
- New `photo_urls text[]` column via same migration
- [app/(app)/products/new/page.tsx](app/(app)/products/new/page.tsx):
  - Dropzone accepts multiple files, up to 5
  - Thumbnails shown with "Cover" badge on first, individual remove buttons
  - All photos uploaded to Supabase Storage; first = `photo_url` (cover)
- [app/api/products/create/route.ts](app/api/products/create/route.ts) saves `photo_urls` array

---

## 2026-04-06 — Phase 7 SESSION R1: DB Schema + Role Middleware

### R1.1: Migration 0009_multi_role_system.sql ✅
- Created `supabase/migrations/0009_multi_role_system.sql`
- New tables: `store_members`, `custom_roles`, `delivery_orders`
- RLS enabled on all three; policies for owner, member, agent
- Seeds all existing sellers as `owner` in store_members
- **Manual step required**: Run migration in Supabase SQL Editor

### R1.2: lib/permissions.ts ✅
- `Role` type: owner | manager | sales_agent | delivery_agent | custom
- `Permission` type: 8 permissions
- `ROLE_PERMISSIONS` map + `hasPermission()` helper

### R1.3: lib/roles.ts ✅
- `getMemberContext(userId)` — fetches role + custom permissions via supabaseAdmin
- `requirePermission(userId, permission)` — throws if permission denied
- Checks `ADMIN_EMAIL` for platform admin bypass

### R1.4: middleware.ts updated ✅
- Fetches `store_members` role via session SSR client (RLS: member_read_own)
- Role-based routing: sales_agent → /agent, delivery_agent → /delivery, owner/manager → /dashboard
- `/admin/*` requires `ADMIN_EMAIL` match
- Users with no store_members record (mid-onboarding) routed to /onboarding
- Platform admin bypasses all role checks

### Onboarding updated ✅
- `app/onboarding/page.tsx` now inserts into `store_members` with role 'owner' after seller creation
- Ensures new sellers have a membership record immediately

### typecheck + build ✅
- `npx tsc --noEmit` — clean
- `npm run build` — 21 pages, no errors

---

## Pending manual steps (owner action required)

1. **Supabase Dashboard** → Run SQL from `supabase/migrations/0008_add_stock_and_photo_urls.sql` (if not done)
2. **Supabase Dashboard** → Run SQL from `supabase/migrations/0009_multi_role_system.sql`
2. **Supabase Dashboard** → Authentication → URL Configuration → set Site URL + Redirect URLs
3. **Slack app settings** → Remove localhost redirect URL, confirm production URL only
4. **Vercel Dashboard** → Confirm `NEXT_PUBLIC_APP_URL=https://crevis-v2.vercel.app` is set for Preview too (currently Production-only)
