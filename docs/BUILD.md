# Crevis v2 — BUILD.md
# Execution Bible for Claude Code

---

## How to Use This File

This file is the single source of truth for building Crevis v2.
Every Claude Code session must begin by reading CLAUDE.md + DESIGN.md + BUILD.md.
Never skip phases. Never start a new session without completing the done checklist
of the previous one. Each to-do is a discrete, testable unit of work.

---

## Context Header (Paste at the Start of EVERY Claude Code Session)

```
You are building Crevis v2 — a two-sided conversational commerce marketplace.
Always read CLAUDE.md, DESIGN.md, and BUILD.md before writing any code.
Current phase: [FILL IN PHASE]
Current megasession: [FILL IN MEGASESSION]
Current session: [FILL IN SESSION]
Last completed to-do: [FILL IN LAST COMPLETED TO-DO]
Do not proceed to the next session until the done checklist of the current
megasession is fully verified. Ask me to confirm before moving forward.
Stack: Next.js 14 App Router, Tailwind, Supabase, Telegraf, Slack Bolt,
Razorpay, Gemini 2.0 Flash. Solo project by Ishaan.
```

---

## Agent Prompting Strategy

### General Rules for Every Session
- Always read all three .md files at the start of a new Claude Code session
- One to-do at a time — complete, test, confirm, then proceed
- Never assume env variables are set — always check .env.local first
- After every session, update the context header with current position
- If blocked on a to-do for more than 15 minutes, skip and flag — don't spiral

### Phase-Specific Prompting Strategies

**Phases 1-2 (Foundation + Auth):**
Prompt Claude Code to be conservative and precise. Schema changes are expensive
to undo. Every Supabase migration must be reviewed before running.
Prompt style: "Build X exactly as specified in CLAUDE.md schema. Show me the
SQL/code before executing. Wait for my confirmation."

**Phase 3-4 (Seller Web App):**
Prompt Claude Code to follow DESIGN.md tokens exactly.
No improvising colors, fonts, or spacing. Reference design tokens by variable name.
Prompt style: "Build the /products/new page using DESIGN.md tokens exactly.
Use Syne for headings, DM Sans for body, JetBrains Mono for prices.
Primary CTA uses --color-saffron. Show me the component before wiring up logic."

**Phase 5-6 (Telegram Bot):**
Prompt Claude Code to build flows conversationally — think in user messages,
not in functions. Each handler is a user moment.
Prompt style: "Build the Browse flow as a series of user moments:
1. User taps Browse 2. Bot shows categories 3. User picks category
4. Bot shows products. Build handler by handler, test each before next."

**Phase 7 (Payments):**
Prompt Claude Code to be paranoid about security. Every webhook must verify
Razorpay signature before touching the database. No exceptions.
Prompt style: "Build the Razorpay credit purchase webhook. Verify signature
first. If verification fails, return 400 and log. Only then process.
Show me the verification logic before the DB write logic."

**Phase 8 (Slack):**
Prompt Claude Code to treat every Slack notification as a user-facing product
moment. Copy matters. Use exact strings from CLAUDE.md.
Prompt style: "Build the new order Slack notification using exactly this copy:
[paste from CLAUDE.md]. The message must arrive within 3 seconds of order
confirmation. Test with a mock order before wiring to real webhook."

**Phase 9 (Polish + Demo):**
Prompt Claude Code to think like a panel member experiencing the product
for the first time. Every rough edge is a lost mark.
Prompt style: "Walk through the full demo flow as a first-time user.
List every rough edge, loading state gap, or missing empty state you find.
Fix them one by one. Prioritize mobile experience."

---

## PHASE 1 — Foundation
**Goal:** Project exists, runs locally, talks to Supabase.
**Estimated time:** 6 hours

---

### Megasession 1 — Project Scaffold + Supabase Schema
**Goal:** Monorepo running locally, all tables created, seed data in.

#### Session 1.1 — Scaffold (2 hours)
- [x] Init Next.js 14 project with App Router and Tailwind
- [x] Set up monorepo structure: /app /bot /lib /supabase folders
- [x] Install dependencies: telegraf, @slack/bolt, razorpay, @google/generative-ai,
      @supabase/supabase-js, @supabase/auth-helpers-nextjs
- [x] Create .env.local with all variable placeholders from CLAUDE.md
- [x] Configure tailwind.config.js with all design tokens from DESIGN.md
      (colors, fonts, spacing, radius, shadows as CSS variables)
- [x] Add Google Fonts import to layout.tsx (Syne, DM Sans, JetBrains Mono)
- [x] Create /lib/supabase.ts — client + server clients
- [x] Verify app runs on localhost:3000 with correct fonts loading

#### Session 1.2 — Supabase Schema (2 hours)
- [x] Create Supabase project under evan@fixinbound.com
- [x] Write migration SQL for all 7 tables as specified in CLAUDE.md
- [x] Add RLS policies: sellers can only read/write their own data
- [x] Add RPC function: deduct_credits(seller_id, amount) — atomic,
      returns error if balance would go below 0
- [x] Add RPC function: add_credits(seller_id, amount) — atomic
- [x] Create Supabase Storage bucket: 'product-images' (public)
- [x] Run migration, verify all tables exist in dashboard
- [x] Seed coupon: CREVIS100, 100 credits, unlimited uses, active

#### Session 1.3 — Environment Verification (2 hours)
- [x] Add all real env values to .env.local
- [x] Write /lib/supabase.ts with typed Database interface
- [x] Write /lib/razorpay.ts — Razorpay client init
- [x] Write /lib/gemini.ts — Gemini 2.0 Flash client init
- [x] Write /lib/slack.ts — Slack WebClient init
- [x] Write /lib/credits.ts — all credit deduction/addition logic
      using Supabase RPC functions
- [x] Test Supabase connection with a simple select query
- [x] Commit to GitHub: evan894/crevis-v2

#### ✅ Megasession 1 Done Checklist
- [x] `npm run dev` runs without errors
- [x] All 7 tables visible in Supabase dashboard
- [x] CREVIS100 coupon seeded and queryable
- [x] deduct_credits RPC tested manually in Supabase SQL editor
- [x] All /lib files exist and export correctly
- [x] Tailwind design tokens accessible in a test component
- [x] Google Fonts (Syne, DM Sans, JetBrains Mono) rendering in browser

---

## PHASE 2 — Auth + Onboarding
**Goal:** Seller can register, set up shop, and load free credits.
**Estimated time:** 10 hours

---

### Megasession 2 — Auth + Onboarding Flow
**Goal:** Full seller registration to first credit load working end-to-end.

#### Session 2.1 — Auth Page (3 hours)
- [x] Build /app/auth/page.tsx — split layout per DESIGN.md
- [x] Left panel: saffron gradient mesh background, Crevis logo, tagline
- [x] Right panel: sign up / sign in form with toggle
- [x] Form fields: email, password (sign in) + name, email, password (sign up)
- [x] Wire up Supabase email auth (signUp + signInWithPassword)
- [x] On sign up success → redirect to /onboarding
- [x] On sign in success → redirect to /dashboard
- [x] Error states: wrong password, email already exists, network error
- [x] Loading state on submit button
- [x] Mobile: full-width form, logo above, no left panel

#### Session 2.2 — Onboarding Step 1 + 2 (3 hours)
- [x] Build /app/onboarding/page.tsx — 3-step wizard
- [x] Step progress bar component (saffron fill, 3 steps)
- [x] Step 1: shop name input + category select (Clothing, Footwear,
      Accessories, Home Textiles, Other)
- [x] On Step 1 next: insert row into sellers table with user_id,
      shop_name, category
- [x] Step 2: Connect Slack button → triggers Slack OAuth flow
- [x] Slack OAuth: /api/auth/slack route → redirect to Slack authorize URL
- [x] Slack OAuth callback: /api/auth/slack/callback → exchange code for
      token → save slack_user_id + slack_access_token to seller record
- [x] Step 2 skip option: "Skip for now" → proceed to Step 3
- [x] Show Slack connected confirmation state on Step 2 after OAuth

#### Session 2.3 — Onboarding Step 3 + Guard (2 hours)
- [x] Step 3: coupon redemption UI — large input + Redeem button
- [x] API route: POST /api/credits/redeem-coupon
      — validate code exists + active + not exceeded max_uses
      — call add_credits RPC
      — increment coupon uses_so_far
      — log to credit_ledger (action: 'coupon')
      — return new balance
- [x] On success: confetti animation (canvas-confetti library) +
      "100 credits added!" message in credit color
- [x] Credit balance updates live on screen after redemption
- [x] "Go to Dashboard" CTA after coupon step
- [x] Route guard: /dashboard and all protected routes redirect to
      /auth if no session
- [x] Route guard: /onboarding redirects to /dashboard if
      seller record already exists

#### ✅ Megasession 2 Done Checklist
- [x] New user can sign up, land on /onboarding, complete all 3 steps
- [x] Seller record created in Supabase on Step 1 completion
- [x] Slack OAuth flow completes, token saved to seller record
- [x] CREVIS100 coupon redeems successfully, 100 credits added
- [x] credit_ledger has a 'coupon' entry after redemption
- [x] Confetti fires on coupon success
- [x] Unauthenticated users cannot access /dashboard
- [x] Already-onboarded users skip /onboarding to /dashboard

---

## PHASE 3 — Seller Web App
**Goal:** Seller can list products, manage inventory, purchase credits.
**Estimated time:** 14 hours

---

### Megasession 3 — Products + Wallet
**Goal:** Full product listing flow and credit wallet working.

#### Session 3.1 — Products List Page (2 hours)
- [x] Build /app/products/page.tsx
- [x] Fetch all products for current seller from Supabase
- [x] Product grid: 3 col desktop / 2 tablet / 1 mobile per DESIGN.md
- [x] Product card component: photo, name, price (JetBrains Mono),
      active/inactive badge, boosted badge (saffron top-right)
- [x] Filter tabs: All / Active / Inactive / Boosted
- [x] Quick actions per card: Boost (if not boosted) / Deactivate / Delete
- [x] Boost action: call deduct_credits(seller_id, 10) + set boosted = true
      — show error if insufficient credits
- [x] Empty state: illustrated empty shelf + "Add your first product" CTA
- [x] "Add Product" button top-right, saffron, links to /products/new

#### Session 3.2 — New Product Form (3 hours)
- [x] Build /app/products/new/page.tsx — single column, max-width 560px
- [x] Photo upload: drag-and-drop dropzone + click to upload
- [x] Photo preview after selection, replace button
- [x] Upload photo to Supabase Storage bucket 'product-images' on submit
- [x] Form fields: name, description (textarea), price (₹ prefix,
      JetBrains Mono), category select
- [x] Credit cost notice banner: "Publishing deducts 2 credits.
      Your balance: {N} credits" — warning color if balance < 5
- [x] Block submit if credit balance < 2, show recharge CTA
- [x] On submit: upload photo → insert product → deduct_credits(2)
      → log credit_ledger (action: 'listing') → redirect to /products
- [x] Success toast: "Your {name} is now live on the Crevis network."

#### Session 3.3 — Wallet Page (3 hours)
- [x] Build /app/wallet/page.tsx
- [x] Hero: large credit balance (JetBrains Mono 700, text-2xl,
      credit color, credit-light background card)
- [x] Three credit packages as cards:
      ₹100 = 100 credits / ₹500 = 550 credits / ₹1000 = 1200 credits
- [x] Buy Credits flow:
      — POST /api/credits/purchase → create Razorpay order
      — Open Razorpay checkout (razorpay.js)
      — On success → POST /api/credits/verify → verify signature
      → add_credits RPC → log ledger → update UI balance
- [x] Redeem coupon: input + button (same logic as onboarding Step 3)
- [x] Credit ledger table: date, action, credits delta (color-coded),
      order value if applicable
- [x] Ledger rows: green for positive delta, saffron for deductions

#### ✅ Megasession 3 Done Checklist
- [x] Seller can list a product end-to-end (photo uploads to Supabase)
- [x] 2 credits deducted on listing, logged in credit_ledger
- [x] Product appears in /products grid immediately after listing
- [x] Boost deducts 10 credits, product shows boosted badge
- [x] Listing blocked when balance < 2 with clear error
- [x] Credit purchase via Razorpay completes, balance updates
- [x] Razorpay signature verified before credits added
- [x] Coupon redemption works from /wallet page

---

### Megasession 4 — Dashboard
**Goal:** Seller has full visibility into their shop performance.

#### Session 4.1 — Dashboard Layout + Stats (3 hours)
- [x] Build /app/dashboard/page.tsx
- [x] Sidebar navigation component (desktop) with Lucide icons:
      Dashboard, Products, Wallet, Orders, Settings
- [x] Bottom navigation (mobile, 4 items max)
- [x] Active nav item: saffron-light bg, saffron-dark text,
      3px left border saffron (desktop)
- [x] Top greeting: "Good morning, {shop_name}" — Syne 600
- [x] 4 stat cards: Total Orders, Credit Balance, Active Listings,
      Total Earnings
- [x] Credit Balance card uses credit color scheme + shadow-credit
- [x] Stat cards: skeleton loader while fetching

#### Session 4.2 — Orders Table + Live Updates (3 hours)
- [x] Recent orders table: product name, buyer name, amount,
      platform fee, status, time
- [x] Status badges: pending (warning), completed (success),
      failed (error) — color-coded per DESIGN.md
- [x] Supabase realtime subscription on orders table for current seller
- [x] On new order: table updates live + subtle pulse animation on
      order count stat card
- [x] Low credits warning banner: full-width warning-bg, shows if
      balance < 20, links to /wallet, dismissible per session
- [x] Empty orders state: "No orders yet. Share your Telegram bot
      link to start selling."

#### ✅ Megasession 4 Done Checklist
- [x] Dashboard loads with correct stats for current seller
- [x] Sidebar navigation works on desktop, bottom nav on mobile
- [x] New order appears in table within 3 seconds via realtime
- [x] Low credits banner shows when balance < 20
- [x] All skeleton loaders present during data fetch
- [x] Mobile layout tested on 375px viewport

---

## PHASE 4 — Telegram Bot
**Goal:** Buyer can browse, search, and purchase via Telegram.
**Estimated time:** 10 hours

---

### Megasession 5 — Bot Scaffold + Browse Flow
**Goal:** Bot is live, responds to /start, browse flow works end-to-end.

#### Session 5.1 — Bot Scaffold (2 hours)
- [x] Create /bot/index.ts — Telegraf bot init with token from env
- [x] Set up webhook mode for production, polling for development
- [x] Register /start command handler
- [x] /start response: welcome message + main menu inline keyboard
      (🛍 Browse Products / 🔍 Search / 📦 My Orders)
- [x] Create or fetch buyer record in buyers table on /start
- [x] Session middleware for conversation state
- [x] Error handler: log errors, send user-friendly message
- [x] Test bot responds to /start locally with polling

#### Session 5.2 — Browse + Product Card Flow (4 hours)
- [x] Category selection: inline keyboard with all categories
- [x] On category select: fetch active products in category from Supabase
      — boosted products first, then by created_at desc
- [x] Product card format: send photo with caption
      Name: {name}
      Price: ₹{price}
      Shop: {shop_name}
      {BOOSTED badge if boosted}
- [x] Inline buttons per product: "Buy Now ₹{price}" + "⬅ Back"
- [x] Pagination: "Load More" button if > 5 products in category
- [x] Back button returns to category selection
- [x] No products in category: "No products here yet. Try another category."
- [x] My Orders: fetch orders by buyer telegram_id, show list with
      product name, amount, status, date

#### ✅ Megasession 5 Done Checklist
- [x] /start shows main menu on Telegram
- [x] Browse flow: main menu → category → product cards → back
- [x] Boosted products appear before non-boosted
- [x] Product photo, name, price, shop name all display correctly
- [x] My Orders shows correct history for the buyer
- [x] Bot handles unexpected input gracefully (no crashes)

---

### Megasession 6 — Search + Buy Flow
**Goal:** Buyer can search with natural language and complete a purchase.

#### Session 6.1 — Gemini Search (2 hours)
- [x] Search handler: bot asks "What are you looking for?"
- [x] On user reply: fetch all active products from Supabase
      (id, name, description, category, price)
- [x] Call Gemini 2.0 Flash with prompt from CLAUDE.md
- [x] Parse response: array of up to 3 product IDs
- [x] Fetch full product details for matched IDs
- [x] Show same product card format as browse flow
- [x] Fallback: if Gemini fails or times out (>3s), do simple
      case-insensitive text match on name + description
- [x] Never mention AI, Gemini, or "search powered by" to user
- [x] "No results" state: "Couldn't find that. Try browsing by category."

#### Session 6.2 — Buy Now + Payment Flow (3 hours)
- [x] Buy Now handler: receives product_id + buyer telegram_id
- [x] POST /api/payment/create-link:
      — create Razorpay payment link for product price
      — store pending order in orders table
      — return payment link URL
- [x] Bot sends payment link with message:
      "Tap below to pay securely 👇" + inline URL button
- [x] Razorpay webhook: POST /api/webhooks/razorpay-orders
      — verify signature
      — update order status to 'completed'
      — deduct platform fee credits from seller
      — if seller balance hits 0: set all their products active = false
      — send buyer Telegram confirmation
      — send seller Slack notification
- [x] Buyer confirmation: "✅ Order placed! {product_name} from
      {shop_name}. Thank you!"
- [x] Payment failed/expired: "❌ Payment was not completed.
      Tap /start to try again."

#### ✅ Megasession 6 Done Checklist
- [x] Search returns relevant results for natural language query
- [x] Gemini fallback works when AI is unavailable
- [x] Full purchase flow: product → Buy Now → Razorpay → confirmation
- [x] Order record created in Supabase after successful payment
- [x] Platform fee (5%) deducted from seller credits after order
- [x] Seller listings deactivated if balance hits 0 after fee deduction
- [x] Buyer receives Telegram confirmation within 5 seconds of payment

---

## PHASE 5 — Slack Notifications
**Goal:** Seller receives every important event in Slack DM.
**Estimated time:** 6 hours

---

### Megasession 7 — Slack Integration
**Goal:** All four notification types working and tested.

#### Session 7.1 — Slack App Setup + DM Helper (2 hours)
- [ ] Configure Slack app (Ivan's workspace):
      OAuth scopes: chat:write, im:write, users:read
- [ ] /api/auth/slack — OAuth initiation route
- [ ] /api/auth/slack/callback — token exchange + save to seller
- [ ] Build sendSlackDM(slack_access_token, slack_user_id, message)
      helper in /lib/slack.ts
- [ ] Test DM sends successfully to a connected seller

#### Session 7.2 — All Notification Types (2 hours)
- [ ] New order notification (triggered in Razorpay order webhook):
      "🛍 New order — {product_name} ₹{amount} from {buyer_name}.
      {credits} credits deducted."
- [ ] Low credits warning (triggered after any credit deduction
      that leaves balance < 20):
      "⚠️ Your Crevis wallet is running low ({balance} credits).
      Recharge to keep listings active: crevis.in/wallet"
- [ ] Listings deactivated notification (triggered when balance hits 0):
      "❌ Your listings have been paused due to zero credits.
      Recharge at crevis.in/wallet"
- [ ] Credit purchase success (triggered in Razorpay credits webhook):
      "✅ Wallet recharged! {credits} credits added.
      New balance: {balance} credits."

#### Session 7.3 — Notification Reliability (2 hours)
- [ ] Wrap all Slack sends in try/catch — never let Slack failure
      break the main order flow
- [ ] Log Slack send failures to console with seller_id + message type
- [ ] If seller has no Slack connected: skip DM silently
- [ ] Test all 4 notification types end-to-end with a real Slack workspace
- [ ] Verify notifications arrive within 3 seconds of triggering event

#### ✅ Megasession 7 Done Checklist
- [ ] Slack OAuth connects and saves token to seller record
- [ ] All 4 notification types send to correct seller DM
- [ ] Slack failure does not break order processing
- [ ] Seller with no Slack connected: no errors thrown
- [ ] Notification copy matches CLAUDE.md exactly

---

## PHASE 6 — Polish + Demo Prep
**Goal:** Product is airtight, demo flow is rehearsed, deployed to Vercel.
**Estimated time:** 8 hours

---

### Megasession 8 — Polish + Deploy
**Goal:** Every rough edge fixed, product deployed, demo ready.

#### Session 8.1 — UI Polish (3 hours)
- [ ] Audit every page on 375px mobile viewport — fix all layout breaks
- [ ] Add skeleton loaders to every data-fetching component
- [ ] Add toast notifications for all success/error states
- [ ] Verify all empty states have illustrations and clear CTAs
- [ ] Check all form validation messages are specific (per DESIGN.md tone)
- [ ] Verify JetBrains Mono on all prices, amounts, balances
- [ ] Verify Syne on all headings, DM Sans on all body text
- [ ] Check saffron is only used for primary CTAs and highlights
- [ ] Check credit color (#7C5CBF) only used in wallet/credit UI
- [ ] Smooth hover animations on all product cards (translate Y -4px)

#### Session 8.2 — Demo Data + Vercel Deploy (3 hours)
- [ ] Seed 5 sample products across 3 categories with real photos
- [ ] Ensure at least 1 product is boosted in seed data
- [ ] Register Telegram bot webhook to production Vercel URL
- [ ] Deploy to Vercel, set all env variables in Vercel dashboard
- [ ] Test full demo flow on production:
      register → onboard → CREVIS100 → list product →
      Telegram browse → buy → Slack notification
- [ ] Test on real mobile phone (not just DevTools)
- [ ] Razorpay switched to TEST mode — confirm ₹1 transaction works

#### Session 8.3 — Demo Rehearsal (2 hours)
- [ ] Write demo script (step by step, 5 minutes max)
- [ ] Rehearse full flow 3 times without stopping
- [ ] Identify any steps that take > 10 seconds and optimize
- [ ] Prepare backup: screen recording of full flow as failsafe
- [ ] Brief panel: "Open this URL on your phone. Register.
      Enter CREVIS100. List a product. Then open Telegram."
- [ ] Have Telegram bot link ready to share instantly during demo
- [ ] Confirm Slack app installed in demo workspace before demo day

#### ✅ Megasession 8 Done Checklist
- [ ] Full demo flow works on production URL on real mobile
- [ ] CREVIS100 coupon active and working on production DB
- [ ] 5 seed products visible on Telegram bot
- [ ] Razorpay TEST mode ₹1 transaction completes end-to-end
- [ ] Slack notification arrives within 3 seconds of purchase
- [ ] No console errors on any page
- [ ] Screen recording backup ready
- [ ] Panel briefing message prepared and ready to share

---

## Master Progress Tracker

| Phase | Megasession | Status | Hours Used |
|---|---|---|---|
| 1 | MS1 — Scaffold + Schema | ⬜ Not started | — |
| 2 | MS2 — Auth + Onboarding | ⬜ Not started | — |
| 3 | MS3 — Products + Wallet | ⬜ Not started | — |
| 3 | MS4 — Dashboard | ⬜ Not started | — |
| 4 | MS5 — Bot Scaffold + Browse | ⬜ Not started | — |
| 4 | MS6 — Search + Buy | ⬜ Not started | — |
| 5 | MS7 — Slack | ⬜ Not started | — |
| 6 | MS8 — Polish + Deploy | ⬜ Not started | — |

Update status to:
⬜ Not started → 🔄 In progress → ✅ Done

---

## Critical Rules (Never Break These)
1. Never write to credit_balance directly — always use deduct_credits
   or add_credits RPC functions to prevent race conditions
2. Never process a Razorpay webhook without verifying the signature first
3. Never let a Slack notification failure break the order flow
4. Never expose RAZORPAY_KEY_SECRET or SUPABASE_SERVICE_ROLE_KEY
   to the client side
5. Always test on real mobile before marking a session done
6. Boosted products always appear first — in browse, search, everywhere
7. If seller credit balance hits 0 after any deduction, immediately
   deactivate all their listings in the same database transaction