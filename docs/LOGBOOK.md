# Crevis v2 — LOGBOOK.md
# Live Project Journal

---

## How to Use This File

This is the living record of everything that happens during the build.
Update this file at the END of every session — not after, not tomorrow, now.
Claude Code must read this file at the start of every session alongside
CLAUDE.md, DESIGN.md, and BUILD.md.

One entry per session. Never delete old entries. Never summarize old entries.
The full history stays intact — it is the debugging context for future sessions.

---

## Logbook Entry Format

Copy this block at the end of every session and fill it in:

```
---
### Session [PHASE.MEGASESSION.SESSION] — [DATE] — [TIME SPENT]

**Status:** 🔄 In Progress / ✅ Completed / ❌ Blocked

**What was built:**
- 

**What was skipped / deferred:**
- 

**Bugs encountered:**
- 

**Bugs fixed:**
- 

**Decisions made:**
- 

**Open questions / blockers:**
- 

**Next session starts at:**
[ ] First to-do of next session

**Environment state:**
- Supabase: [connected / not connected]
- Telegram bot: [polling / webhook / not started]
- Razorpay: [test / live / not connected]
- Slack: [connected / not connected]
- Vercel: [deployed / not deployed]
- Last known working URL: 
---
```

---

## Project Vitals
(Update these whenever they change)

```
Started:          [DATE]
Target deadline:  [DATE]
Repo:             github.com/evan894/crevis-v2
Local URL:        http://localhost:3000
Production URL:   [TBD]
Supabase project: [PROJECT ID]
Telegram bot:     @[BOT_USERNAME]
Slack workspace:  [WORKSPACE NAME]
Razorpay mode:    TEST
Current phase:    Phase 1
Current session:  1.1.1
Hours spent:      0
Hours remaining:  50
```

---

## Known Issues Tracker

Active bugs and blockers. Move to Resolved once fixed.

### Active
| # | Issue | Severity | Opened | Session |
|---|---|---|---|---|
| — | No issues yet | — | — | — |

### Resolved
| # | Issue | Fix | Resolved | Session |
|---|---|---|---|---|
| — | No issues yet | — | — | — |

---

## Decisions Log

Architectural and product decisions made during the build.
These must never be revisited without a strong reason.

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
| 10 | Saffron (#F4631E) as primary brand color | Distinctly Indian, warm, high energy, not overused in tech | Pre-build |

---

## Environment Checklist
(Check off as credentials are obtained)

- [ ] Supabase project created (evan@fixinbound.com)
- [ ] Supabase URL + anon key added to .env.local
- [ ] Supabase service role key added to .env.local
- [ ] Telegram bot created via BotFather
- [ ] Telegram bot token added to .env.local
- [ ] Slack app created (Ivan's account)
- [ ] Slack client ID + secret + signing secret added to .env.local
- [ ] Razorpay test key ID + secret added to .env.local
- [ ] Gemini API key added to .env.local
- [x] GitHub repo created: evan894/crevis-v2
- [ ] Vercel project created and linked to repo

---

## Session History

*(Entries will appear here as the build progresses)*

---
### Session 0.0 — [DATE] — 0h (Pre-build planning)

**Status:** ✅ Completed

**What was built:**
- CLAUDE.md — full project spec and business logic
- DESIGN.md — complete brand system, tokens, page-by-page notes
- BUILD.md — phased execution plan with session-level to-dos
- LOGBOOK.md — this file

**What was skipped / deferred:**
- All actual code — Phase 1 starts next session

**Bugs encountered:**
- None

**Bugs fixed:**
- None

**Decisions made:**
- See Decisions Log above — all pre-build decisions locked

**Open questions / blockers:**
- Telegram bot token not yet created (needs BotFather)
- Slack app not yet created (needs Ivan)
- Supabase project not yet created
- Razorpay keys not yet added to .env.local
- Gemini API key not yet confirmed

**Next session starts at:**
[ ] Session 1.1.1 — Init Next.js 14 project with App Router and Tailwind

**Environment state:**
- Supabase: not connected
- Telegram bot: not started
- Razorpay: not connected
- Slack: not connected
- Vercel: not deployed
- Last known working URL: —
---

### Session 1.1 — April 4, 2026 — 30 mins

**Status:** ✅ Completed

**What was built:**
- Initialized Next.js 14 project
- Created root structure (lib, supabase, bot)
- Installed explicitly stated dependencies
- Configured Tailwind theme directly from DESIGN tokens
- Loaded Google Fonts in layout.tsx globally
- Generated lib/supabase.ts client + server helpers
- Verified with custom splash UI on localhost:3000

**What was skipped / deferred:**
- Deferred supabase DB Typed interfaces to next session when Schema actually exists

**Bugs encountered:**
- npm complained about creating adjacent directories that had spaces/capitalization; sidestepped perfectly.

**Bugs fixed:**
- Handled via temporary folder setup transparently.

**Decisions made:**
- Hardcoded design tokens properly to global CSS variables so all child apps or bot views can consume them reliably.

**Open questions / blockers:**
- Ready for schema writing.

**Next session starts at:**
[ ] Session 1.2 — Supabase Schema (2 hours)
  - Create Supabase project
  - Write migration SQL

**Environment state:**
- Supabase: keys present
- Telegram bot: keys present
- Razorpay: keys present
- Slack: keys present
- Vercel: not deployed
- Last known working URL: http://localhost:3000
---

### Session 1.2 — April 4, 2026

**Status:** ✅ Completed

**What was built:**
- Extracted and materialized `SCHEMA.md` into isolated `supabase/migrations/` (0001-0007).
- Created a `master_schema.sql` helper at the root.
- Generated SQL includes comprehensive RLS policies, RPC atomic functions, explicit schema indexes, and demo seed data.

**What was skipped / deferred:**
- Local API generation of `Database` interface directly from CLI (deferred to next session once environment vars are all verified).

**Bugs encountered:**
- Supabase MCP push initially failed because `auth.uid()::uuid = owner_id` typecast was rejected as `uuid = text` missing operators.

**Bugs fixed:**
- Modified the `product_images_delete_own` policy in `storage.objects` to logically use `owner = auth.uid()` natively without forced casts, which pushed perfectly.

**Decisions made:**
- Connected via Supabase MCP Server directly instead of manually handling connection strings, deploying the `master_schema.sql` completely remotely in a single transaction.

**Open questions / blockers:**
- None. Now that Database is initialized and populated, we can seamlessly move into Phase 2 / Environment Verification!

**Next session starts at:**
[ ] Session 1.3 — Environment Verification / Authentication

**Environment state:**
- Supabase: Schema successfully blasted and live in cloud via MCP
- Telegram bot: keys present
- Razorpay: keys present
- Slack: keys present
- Vercel: not deployed
- Last known working URL: http://localhost:3000
---

### Megasession 2 & Session 3.1 — April 4, 2026

**Status:** ✅ Completed

**What was built:**
- Completed Phase 1 build stabilization (migrated from @supabase/auth-helpers-nextjs to @supabase/ssr, fixed ESLint).
- Built `/app/auth/page.tsx` split layout with Supabase signup/signin.
- Built `/app/onboarding/page.tsx` 3-step wizard (Shop Details -> Slack Connect -> Coupon Redeem).
- Implemented Slack OAuth routing (`/api/auth/slack`).
- Integrated `/api/credits/redeem-coupon` calling `redeem_coupon` RPC with `canvas-confetti` celebration.
- Built explicit route guards natively in `middleware.ts` leveraging `createServerClient`.
- Started Phase 3: Built `/app/products/page.tsx` inventory listing grid with active/inactive tags, and an interactive boost endpoint (`/api/products/[id]/boost`).

**What was skipped / deferred:**
- Skipped standalone components for simple empty states; integrated inline for velocity.

**Bugs encountered:**
- Next.js build failed strictly due to ESLint/TypeScript strict mode configs in Supabase SSR callbacks.

**Bugs fixed:**
- Added `CookieOptions` types to `@supabase/ssr` methods, replaced unused vars instead of ignoring them natively.

**Decisions made:**
- Opted for `middleware.ts` for native lightweight route guarding before React rendering components, ensuring edge speed.

**Open questions / blockers:**
- None. Fully ready for `/products/new` (Session 3.2).

**Next session starts at:**
[ ] Session 3.2 — New Product Form

**Environment state:**
- Supabase: Session logic active, onboarding flow operational
- Telegram bot: keys present
- Razorpay: keys present
- Slack: keys present
- Vercel: not deployed
- Last known working URL: http://localhost:3000