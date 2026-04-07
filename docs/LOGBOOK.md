# Crevis v2 — LOGBOOK.md

---

## Quick State (Updated After Every Session)

```
Last completed:  Session R6 — Integration Audit + Demo Prep
Production URL:  https://crevis-v2.vercel.app
Preview URL:     https://crevis-v2-git-preview-m3-demo-evan-1695s-projects.vercel.app
Telegram bot:    @Crevis_shop_bot
All sessions:    R1–R6 ✅ Complete
Next action:     Manual e2e testing + DTI demo deliverables
Demo date:       [DATE]
Open bugs:       None known

Test accounts (Bombay Curations store):
  sales_agent@test.com    / Crevis@123  (sales_agent)
  delivery_agent@test.com / Crevis@123  (delivery_agent)
  manager@test.com        / Crevis@123  (manager)
  demo@crevis.in                        (owner — Bombay Curations)
```

---

## Project Vitals

```
Started:          April 4, 2026
Repo:             github.com/evan894/CREVIS
Local URL:        http://localhost:3000
Production URL:   https://crevis-v2.vercel.app
Supabase project: kykzwnghijedbjhdinlq
Telegram bot:     @Crevis_shop_bot
Razorpay mode:    TEST
Current phase:    Phase 7 Complete — all planned sessions done
Current session:  R6 Complete
Hours spent:      ~18 (estimate across 6 days)
Hours remaining:  Manual testing + demo prep only
```

---

## Known Issues Tracker

### Active
| # | Issue | Severity | Opened | Session |
|---|---|---|---|---|
| — | None | — | — | — |

### Resolved
| # | Issue | Fix | Resolved | Session |
|---|---|---|---|---|
| 1 | `supabaseAdmin` in client bundle — blank `/auth` screen | Moved to `lib/supabase-admin.ts` (server-only) | Apr 4 | F5 |
| 2 | Agent "New" tab always empty post-R5 | Filter includes `delivery.status === 'pending'` | Apr 7 | R6 |
| 3 | Permission key mismatch (`update_delivery_status` vs `update_delivery`) | Aligned key in team page + added `manage_settings` | Apr 7 | R6 |
| 4 | Out-of-stock action left `stock` non-zero | Now updates `{ active: false, stock: 0 }` | Apr 7 | R6 |

---

## Decisions Log

| # | Decision | Reason | Session |
|---|---|---|---|
| 1 | Telegram for buyers, Slack for sellers | Clean UX separation, demo-friendly | Pre-build |
| 2 | Credit wallet model (not direct fees) | Prepaid = no payment failures mid-order | Pre-build |
| 3 | 5% platform fee on order value | Simple, scalable, industry standard | Pre-build |
| 4 | 2 credits per listing, 10 per boost | Low barrier to entry, boost has clear value | Pre-build |
| 5 | CREVIS100 coupon for demo onboarding | Panel experiences product first-hand | Pre-build |
| 6 | Supabase RPC for credit operations | Atomic transactions, prevents race conditions | Pre-build |
| 7 | Gemini 2.0 Flash for search, background only | AI as invisible infrastructure, not a feature | Pre-build |
| 8 | Next.js App Router + Vercel | Fast deploy, serverless webhooks, easy env management | Pre-build |
| 9 | Syne + DM Sans + JetBrains Mono type stack | Warm, modern-Indian feel without being generic | Pre-build |
| 10 | Saffron (#F4631E) as primary brand color | Distinctly Indian, warm, high energy | Pre-build |
| 11 | `middleware.ts` for route guarding | Edge speed, before React renders | M2 |
| 12 | Admin auth via `x-admin-token` header + env var | Platform-level auth, not seller-level | R2 |
| 13 | Member removal is soft-delete (`is_active = false`) | Preserves historical records | R2 |
| 14 | Agent resolves `seller_id` via `store_members`, not `sellers` | Agents are members, not sellers | R3 |
| 15 | OTP tracked server-side only; wrong-OTP returns structured JSON not 4xx | Client shows inline state without disruptive toast | R4 |
| 16 | R5 webhook upserts `delivery_orders {status: 'pending'}` on payment | Every paid order immediately visible in agent queue | R5 |
| 17 | Dashboard removed payment `status` column — delivery status tells the full story | Cleaner seller view | R5 |

---

## Environment Checklist

- [x] Supabase project created (evan@fixinbound.com)
- [x] Supabase URL + anon key in .env.local
- [x] Supabase service role key in .env.local
- [x] Telegram bot created — @Crevis_shop_bot
- [x] Telegram bot token in .env.local
- [x] Slack app created + OAuth configured
- [x] Slack client ID + secret + signing secret in .env.local
- [x] Razorpay test keys in .env.local
- [x] Gemini API key in .env.local
- [x] GitHub repo: evan894/CREVIS
- [x] Vercel project deployed at crevis-v2.vercel.app

---

## Session History

### Sessions 0.0 – 1.2 (Pre-build + Scaffold)
✅ Completed. Set up planning docs (CLAUDE.md, DESIGN.md, BUILD.md), initialized Next.js 14 with App Router, configured Tailwind design tokens, and deployed Supabase schema (0001–0007 migrations) with RLS, RPC atomic credit functions, and indexes.

### Megasessions 2–3 (Auth + Seller Web App)
✅ Completed. Auth flow with Supabase SSR, 3-step onboarding wizard (Slack OAuth + coupon redemption), products listing/boost page, new product form with Supabase Storage upload, Razorpay wallet + credit ledger. Decision: `(app)` route group for AppLayout isolation.

### Megasessions 4–5 (Dashboard + Telegram Bot)
✅ Completed. Dashboard with live Supabase realtime orders feed and low-credit banner. Telegram bot with session management, category browse cascade, paginated photo cards, My Orders, and Gemini AI search fallback.

### Megasession 6–7 (Buy Flow + Slack Pipeline)
✅ Completed. Full Razorpay checkout from Telegram, HMAC-verified order webhook, credit deduction + seller deactivation at zero balance, Slack DM integration for all critical events (new order, low credits, recharge, boost). Telegram confirmation to buyer on payment.

### Megasession 8 + Sessions F1–F5 (Production Hardening)
✅ Completed. Vercel deployment with env vars, Telegram webhook registered on production. Credit webhook re-architected (razorpay-credits replaces client-side verify). Slack error swallowing so upstream never crashes. Critical bug: `supabaseAdmin` was in client bundle — fixed by moving to server-only file. Constants extracted to `lib/constants.ts`.

### Session R2 — April 6, 2026 — Team Management + Admin Workspace
✅ Completed. Built `/team` page (owner-only gate, member RBAC table, Add Member panel, Custom Role Builder with per-permission toggles). Built `/admin/stores` workspace (store list sidebar, 5-tab detail panel, product removal with reason, token-gate login). 7 new API routes. Decision: owner role is immutable in UI.

### Session R3 — April 6, 2026 — Sales Agent Dashboard
✅ Completed. `/agent` page: mobile-first, sticky header, 3-tab order queue (New/Packing/Ready), Start Packing → Mark Packed (OTP to Telegram, Slack notify) → Out of Stock (buyer + seller notified, product deactivated). API routes: `GET /api/agent/orders`, `POST /api/agent/orders/[id]/action`.

---

### Session R4 — April 6, 2026 — Delivery Agent Mobile Dashboard

**Status:** ✅ Completed

**What was built:**
- `app/(agent)/delivery/page.tsx` — Mobile-first delivery dashboard. Stats row (Ready/En Route/Delivered Today). Three tabs: Ready → Out for Delivery → Completed.
- **Ready tab**: "Pick Up Order" CTA → `status = out_for_delivery`, buyer notified on Telegram.
- **Out for Delivery tab**: 6-box OTP input with individual refs, cross-box focus, paste support. Wrong OTP: inline error + attempts remaining. After 3 failures: locked warning. "Report Failed" → reason modal (bottom-sheet on mobile, centred on desktop).
- **Completed tab**: today-scoped, read-only.
- `GET /api/delivery/orders` — resolves seller via `store_members`, returns packed/out_for_delivery/delivered records.
- `POST /api/delivery/orders/[id]/action` — `pick_up`, `confirm_delivery` (OTP verify, 3-attempt limit, Telegram + Slack on success), `report_failed` (reason + notes, Telegram + Slack).

**Decisions made:**
- OTP attempts tracked server-side only. Wrong-OTP returns structured JSON (`wrong_otp: true`, `attempts_left: N`) not a 4xx.
- Completed tab filtered to today (local midnight) — operational clarity.
- `OtpInput` uses 6 individual `useRef` instances for imperative focus management.
- `FailedDeliveryModal` uses `items-end sm:items-center` for bottom-sheet mobile / centred desktop.

**Environment state:**
- Vercel: ✅ Deployed (commit a70db06) — all 4 dashboards live.

---

### Session R5 — April 6, 2026 — Order State Machine + Dashboard Updates

**Status:** ✅ Completed

**What was built:**
- **R5.1** `dashboard/page.tsx` rewritten: orders query joins `delivery_orders(status)`. New "Delivery Status" column with `deliveryBadge()` mapping all 6 states to semantic colour badges (pending/grey, confirmed/amber, packed/blue, out_for_delivery/info, delivered/green, failed/red). Old payment status column removed.
- **R5.2** Razorpay webhook now upserts `delivery_orders { status: 'pending' }` immediately on payment confirmation — every paid order enters the agent queue instantly.
- **R5.3** Dashboard Team Activity Today section for owner/manager: aggregates `packed_at` (sales agents) and `delivered_at` (delivery agents) since midnight, grouped by agent with display name + role badge + count.
- **R5.4** Telegram order confirmation message updated to set expectation: "You'll receive updates here as your order is packed and delivered. Keep this chat open — your OTP for delivery confirmation will be sent when your order is packed."

**Decisions made:**
- Dashboard `delivery_orders` join defaults to `pending` badge when no delivery record exists — no crash.
- Team activity uses two separate fetches aggregated client-side (acceptable at current scale, avoids complex join).
- Removed payment status column entirely — delivery status conveys this more usefully.

**Deferred:** Realtime delivery status updates on dashboard; agent name lookup in orders table.

**Environment state:**
- Vercel: ✅ Deployed (commit a7a62ea)
- `npm run build`: 38 pages, exit 0 / `npx tsc --noEmit`: clean

---

### Session R6 — April 7, 2026 — Integration Audit + Demo Prep

**Status:** ✅ Completed

**What was done:**
- Full codebase audit against all 4 test flows. Cross-referenced live DB schema via Supabase MCP.
- Seeded 3 test accounts (confirmed auth users + `store_members` rows on Bombay Curations): `sales_agent@test.com`, `delivery_agent@test.com`, `manager@test.com` — all password `Crevis@123`.
- Confirmed 5 demo products already live in Bombay Curations store.

**Bugs fixed:**

| Bug | File | Fix |
|-----|------|-----|
| **CRITICAL**: Agent New tab always empty post-R5 | `agent/page.tsx` | Filter include `delivery.status === 'pending'`; added `"pending"` to TS union |
| Permission key `update_delivery_status` didn't exist | `team/page.tsx` | Corrected to `update_delivery`; added `manage_settings` |
| Out-of-stock left `stock` column non-zero | `agent/orders/[id]/action` | Now `{ active: false, stock: 0 }` |

**Flow status:** All 4 flows code-verified ✅. Manual live e2e, Slack/Telegram latency, and browser console scan deferred as manual-only steps.

**Environment state:**
- Supabase: Active — 3 test accounts seeded
- Vercel: ✅ Deployed (commit 46320c1)
- Preview branch: `preview/m3-demo` → pushed to origin
- `npm run build`: 38 pages, exit 0 / `npx tsc --noEmit`: clean
---

### Session 8.2.1 — April 7, 2026 — Product Link Infrastructure

**Status:** ✅ Completed

**What was built:**

**Step 1 — DB verified.** All product IDs are UUIDs — confirmed via Supabase SQL. No schema changes needed.

**Step 2 — `/p/[productId]/route.ts`**
New redirect route. Validates UUID format, checks `products` table for active product, redirects to `https://t.me/Crevis_shop_bot?start=product_<id>`. Returns `/not-found` for invalid or inactive products.

**Step 3 — Bot deep link handler**
Updated `/start` handler in `bot/index.ts`. When `ctx.startPayload` begins with `product_`, extracts the UUID, fetches the product from Supabase, and sends a direct product card (photo + bold name + price + description + shop name + boosted emoji if applicable) with two buttons: **Buy Now** + **Browse More**. Gracefully handles missing/inactive products with a plain-text fallback message.

**Step 4 — Copy Link button on product cards**
Added `handleCopyLink()` to `app/(app)/products/page.tsx`. Copies `${NEXT_PUBLIC_APP_URL}/p/${product.id}` to clipboard via `navigator.clipboard`. Shows `"Product link copied!"` toast on success. Button appears as the first item in the `MoreVertical` action menu (above Boost and Deactivate). Added `Link2` icon from lucide-react.

**Step 5 — Not-found page**
Created `app/not-found.tsx` — shown when the redirect route gets an invalid or inactive product ID. Displays: "This product is no longer available on Crevis." with a "Browse all products on Telegram" button linking to `@Crevis_shop_bot`.

**Bugs encountered:** None — clean first pass.

**Decisions made:**
- UUID regex validation in the route handler before DB hit — avoids unnecessary DB queries on garbage input.
- Used 302 (temporary) redirect, not 301 — if a product is reactivated the original URL should still work.
- Bot sends product card with `ctx.replyWithPhoto` (not `editMessageText`) since `/start` comes from a fresh deep link, not a callback query.

**Build:** 39 pages, exit 0 / `npx tsc --noEmit`: clean

**Environment state:**
- Vercel: ✅ Deployed (commit 86380ba)
- Shareable link format: `https://crevis-v2.vercel.app/p/<product-uuid>`
- Example: `https://crevis-v2.vercel.app/p/10507609-2c84-444d-90f3-83b99470941f`
---

### Session 8.3.1 — April 7, 2026 — Shop Slugs + Store Pages

**Status:** ✅ Completed

**What was built:**

**Step 1 — DB migration** (`add_shop_slug`)
- Added `shop_slug text UNIQUE` column to `sellers` table with unique index `idx_sellers_shop_slug`.
- Created `generate_shop_slug(shop_name text)` PL/pgSQL function — normalises name to kebab-case, de-duplicates with numeric suffix.
- Backfilled all existing sellers: `bombay-curations`, `style-maxx` confirmed via SQL.
- Updated `types/database.types.ts` — added `shop_slug: string | null` to sellers Row/Insert/Update + `generate_shop_slug` to Functions.

**Step 2 — `/s/[shopSlug]/route.ts`**
Redirect route: looks up `sellers` by `shop_slug`, returns `/not-found` if missing, else 302 → `https://t.me/Crevis_shop_bot?start=store_<slug>` (bot can handle `store_*` in a future session).

**Step 3 — Settings page — Shop Link section**
Rewrote `settings/page.tsx`. New "Shop Link" section at top:
- Read-only view: full link with Copy + Edit (pencil) buttons.
- Edit mode: inline input pre-filled with current slug, forced lowercase, hyphens only. Debounced 500ms availability check via Supabase `.maybeSingle()`. Live indicators: spinner → green check (available) / red X (taken). Validation: 3–30 chars, `^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$`, no leading/trailing hyphens. Save → UPDATE sellers SET shop_slug. Cancel reverts.

**Step 4 — Dashboard shop card**
Inserted above the stats grid in `dashboard/page.tsx`:
- Store icon + shop name + "Your store" label.
- Two copyable rows: shop link (`/s/{slug}`) and `@Crevis_shop_bot`.
- `handleCopyDashboard` uses `document.getElementById` to give inline "Copied!" feedback without a toast import.
- Card only renders after load and when `shop_slug` is set.

**Decisions made:**
- Slug stored as `text UNIQUE` not `text NOT NULL` — sellers created before this migration get slugs on backfill; future onboarding will auto-assign on registration.
- Bot `store_*` deep link handler deferred — noted for a future session when store browse by slug is implemented.
- Dashboard copy uses inline DOM mutation instead of toast for zero-import cost on that component.

**Build:** 40 pages, exit 0 / `npx tsc --noEmit`: clean

**Environment state:**
- Vercel: ✅ Deployed (commit cbd2f2b)
- Shop link format: `https://crevis-v2.vercel.app/s/<slug>`
- Bombay Curations: `https://crevis-v2.vercel.app/s/bombay-curations`
---


