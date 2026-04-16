# Crevis v2 — LOGBOOK2.md
# Active journal from Phase 8 onwards.
# Read this file at session start.
# Update this file at session end.
# Never delete entries. Never summarize old entries.
# For Phase 1-7 history see LOGBOOK.md

---

## Session Entry Format
Copy this block at end of every session:

---
### [Phase].[Session] — [Date] — [Time spent]
**Status:** ✅ Completed / 🔄 In Progress / ❌ Blocked
**Built:** (bullet list of what was created or changed)
**Bugs fixed:** (or "None")
**Deferred:** (or "None")
**Blockers:** (or "None")
**Next session:** [ ] First to-do of next session
**Env state:** Supabase / Bot / Razorpay / Vercel
---

## Session History

### 13.1.1 — April 9, 2026 — 1h 30m spent
**Status:** ✅ Completed (Phase 13: Team Invitation System)
**Built:** 
- **Database Schema**: Created `store_invites` table with RLS and token-based security for pending invitations.
- **Resend Integration**: Configured Resend SDK for transactional email delivery.
- **Invitation API**: Implemented `POST /api/team/invites` (send), `GET /api/team/invites` (list), and `DELETE /api/team/invites/[id]` (withdraw).
- **Acceptance Flow**: Built public signup/join page at `/join/[token]` and auto-accept logic at `POST /api/team/invites/[token]/accept`.
- **UI Rewrite**: Updated Team management dashboard to show pending invitations and allow management (revocation).
- **Type Safety**: Regenerated database types to include the invitations table and resolved all related TypeScript linting errors.
**Bugs fixed:** 
- Fixed `token` type mismatch in `JoinTeamPage` (handled array vs string).
- Removed outdated "must already have account" hint from the invitation panel.
**Deferred:** None.
**Blockers:** None.
**Next session:** [ ] Perform end-to-end testing of the invitation flow with a real email. [ ] Proceed to Phase C: Store Settings & Profile management.
**Env state:** Supabase / Bot / Razorpay / Vercel / Resend
---

### 14.1.1 — April 12, 2026 — ~2h
**Status:** ✅ Completed (Phase 14: Pharmacy Flow)
**Built:**
- **Pharmacy entry**: Selecting Pharmacy category bypasses standard budget filter, shows "Upload Prescription / Type Medicine Name" choice.
- **Prescription upload**: User sends a photo → `file_id` stored in session → bot prompts for medicine name. Prescription reference included in payment notes (accessible to pharmacist).
- **Medicine search**: Exact `ilike` match within Pharmacy category. If not found → Gemini fuzzy search on Pharmacy products only. Fuzzy match shown with explicit disclaimer: _"This AI-powered search is not responsible for picking the correct alternative."_ No match → "not found" with retry.
- **Cart**: `pharma_add:{id}` adds to session cart. Users can add multiple medicines sequentially. Cart shows name + price + shop per item, running total.
- **Cart confirmation**: Shows full cart summary with Yes/No (Confirm / Clear).
- **Phone collection**: On confirm, if `buyerPhone` not in session, bot asks for phone number before proceeding.
- **Checkout**: `POST /api/payment/create-pharmacy-cart` — one Razorpay payment link for the total, one pending `orders` row per product (all linked to same `razorpay_payment_id`).
- **Webhook**: `razorpay-orders` detects `notes.is_pharmacy_cart = 'true'`, completes all linked orders, creates delivery_orders entries, deducts platform fees. Slack notification per seller includes buyer phone and instruction to call before packing. Telegram confirmation to buyer includes phone call notice.
- **Bug fix**: `search.ts` `bot.on('text')` early return now uses `return next()` so pharmacy text handler correctly receives input.
**Bugs fixed:** `ctx.message.photos` → `ctx.message.photo` (Telegraf API), Map iteration TS error fixed with `Array.from()`.
**Deferred:** End-to-end test with real pharmacy products and payment. Prescription image forwarding to seller Slack.
**Blockers:** None.
**Next session:** [ ] Seed pharmacy products in Supabase for testing. [ ] Test full flow: browse → pharmacy → type name → add to cart → confirm → pay → check Slack/Telegram.
**Env state:** Supabase / Bot ✅ / Razorpay / Vercel / Resend
---

### P0 Incident — April 12, 2026 — ~45m
**Status:** ✅ Resolved
**Incident:** Telegram bot completely down. `getWebhookInfo` showed `"Wrong response from the webhook: 403 Forbidden"` with `pending_update_count: 3`.
**Root causes (3, compounding):**
1. **Webhook route returned 500 on any error** — catch block returned `NextResponse.json({error:...}, {status:500})` instead of always returning 200. Telegram stops delivering after repeated non-200 responses.
2. **Token check had no null guard** — `if (token !== process.env.ADMIN_SECRET_TOKEN)` with no `&&` guard meant any env var mismatch returned 401 to Telegram.
3. **Webhook URL pointed at wrong host** — Registered URL used `crevis.in`, but that domain's DNS (`198.185.159.x`) still points to Squarespace, not Vercel. The domain was added to Vercel 3 hours before the incident but DNS was never updated. Every Telegram request hit the old Squarespace host → 403.
**Fixes applied:**
- Rewrote webhook route: `return new Response('ok', { status: 200 })` moved outside try/catch so it always fires. Token check guarded with `process.env.ADMIN_SECRET_TOKEN &&`.
- Re-registered webhook to `https://crevis-v2.vercel.app/api/telegram/webhook?token=<encoded>` with properly URL-encoded token (original had `#`, `@`, `!`, `$` which fragmented the URL).
**Result:** `pending_update_count: 0`, no `last_error_message`. Bot healthy.
**Action required:** Update `crevis.in` DNS A records to point to Vercel (`76.76.21.21`) so the custom domain works. Until then, webhook runs on `crevis-v2.vercel.app`.
**Env state:** Supabase / Bot ✅ / Razorpay / Vercel / Resend
---
### Phase 8 — Mobile-First Agent Dashboards — [Current Date] — ~2h
**Status:** ✅ Completed
**Built:**
- **Sales Agent Dashboard (`/agent`)**: Implemented mobile-first single column ticket-based UI with "Pending", "Packing", and "Packed" tabs. Added layout with Bottom Nav (Orders, Inventory, History).
- **Delivery Agent Dashboard (`/delivery`)**: Implemented mobile-first ticket UI with "Ready for Pickup", "Out for Delivery", and "Delivered Today" tabs. Added Layout with Top Bar.
- **Stock Management API (`/api/products/[id]/stock`)**: Allows `sales_agent` to perform inline stock edits from the inventory page. Includes automatic Slack notification when stock hits 0.
- **Agent Actions APIs (`/api/agent/pack-order`, `/api/agent/delivery-action`)**: Built robust backend endpoints to update states, generate delivery OTPs, verify OTP limits, and dispatch corresponding Slack and Telegram notifications.
- **Database Schema Updates**: Added the `packing` status missing in the `delivery_orders` enum via migration `0019_add_packing_status.sql` and inner-joined `orders` in the queries.
- **TypeScript**: Ran strict `tsc` checks. Fixed date-fns dependencies and Supabase SSR client signature mismatches.
**Bugs fixed:** 
- Used inner joins on queries (`orders!inner(...)`) since `delivery_orders` table lacks a direct `seller_id` column.
- Supabase SSR cookie mismatch was fixed by using the standard `@supabase/supabase-js` `createClient` for service role operations.
**Deferred:** None.
**Blockers:** None.
**Next session:** [ ] E2E testing of the packing and delivery flow on actual devices or simulators.
**Env state:** Supabase / Bot ✅ / Razorpay / Vercel / Resend
---

### Production Fixes — April 16, 2026 — 1h spent
**Status:** ✅ Completed
**Built:** 
- Centralized `signOut` utility in `lib/auth-actions.ts` utilizing hard redirects.
- Added sign-out functionality reliably across all layouts (Owner sidebar, mobile nav, Sales Agent top bar, Delivery top bar, Admin top nav, Onboarding page).
- Built `auth/forgot-password/page.tsx` with rate limit handling and correct Supabase methods.
- Built `auth/reset-password/page.tsx` with dynamic token validation, password strength checker, and UI feedback.
- Auth callback route properly implemented with onboarding verification and role-based redirects.
**Bugs fixed:** None
**Deferred:** None
**Blockers:** None
**Next session:** [ ] Manual verification via end-to-end tests on branch before merge.
**Env state:** Supabase / Bot ✅ / Razorpay / Vercel / Resend
---
