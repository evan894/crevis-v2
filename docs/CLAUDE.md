# Crevis v2 — CLAUDE.md
# Project Bible for Claude Code

## What is Crevis?
Crevis is a two-sided conversational commerce marketplace targeting tier 2/3
Indian cities. Sellers list products via a web app. Buyers discover and purchase
via a Telegram bot. Sellers receive all notifications via Slack. The platform
monetizes via a credit wallet system.

## Tagline
"Sell everywhere. Start here."

## Full Specification Files
Always read these files before writing any code:

@docs/SCHEMA.md       — Full database schema, RPC functions, RLS policies
@docs/FLOWS.md        — All user journeys, bot flows, webhook flows
@docs/DESIGN.md       — Brand system, design tokens, component specs
@docs/BUILD.md        — Phase/session/to-do execution plan
@docs/LOGBOOK.md      — Live session history and current project state
@docs/CONVENTIONS.md  — Code style, git rules, security rules, npm commands

---

## Stack
- Next.js 14 App Router + Tailwind CSS
- Supabase (auth + database + storage)
- Telegraf (Telegram bot)
- Slack Bolt + Slack WebClient (notifications)
- Razorpay (payments)
- Gemini 2.0 Flash (background AI search only)
- Vercel (hosting)

---

## Project Structure
```
crevis-v2/
├── app/                    # Next.js App Router pages
│   ├── auth/
│   ├── onboarding/
│   ├── dashboard/
│   ├── products/
│   │   └── new/
│   └── wallet/
├── bot/                    # Telegram bot (Telegraf)
│   ├── index.ts
│   ├── handlers/
│   └── utils/
├── lib/                    # Shared utilities
│   ├── supabase.ts
│   ├── razorpay.ts
│   ├── gemini.ts
│   ├── slack.ts
│   └── credits.ts
├── docs/                   # All .md specification files live here
├── supabase/
│   └── migrations/
├── public/
├── CLAUDE.md               # This file
└── .env.local
```

---

## npm Commands
```
npm run dev       — start local dev server (localhost:3000)
npm run build     — production build
npm run lint      — ESLint check
npm run typecheck — TypeScript strict check
npm run bot       — start Telegram bot in polling mode (development)
```
Always run `npm run typecheck` after completing any session.
Always run `npm run lint` before committing.

---

## Business Logic (Summary)
See @docs/SCHEMA.md for full detail.

| Action | Credits |
|---|---|
| List a product | -2 |
| Boost a product | -10 |
| Order received | -(order_value × 0.05) |
| Purchase credits | +N |
| Redeem CREVIS100 coupon | +100 |

- Credits hit 0 → all seller listings deactivated immediately
- Boosted products always appear first in all listings and search
- All credit operations use Supabase RPC (never direct balance updates)
- Razorpay webhooks must verify signature before any DB write

---

## Platform Split
- Telegram — buyer storefront, always
- Slack — seller notifications and order alerts, always
- Web app — seller registration, product listing, credits, dashboard

---

## AI Usage Rule
Gemini 2.0 Flash is used ONLY in the Telegram search flow.
Never surface "AI", "Gemini", or "powered by" language to any user.
Always implement a text-match fallback if Gemini times out (>3s).

---

## Critical Rules (Never Break)
1. NEVER write to credit_balance directly — always use deduct_credits
   or add_credits RPC functions
2. NEVER process a Razorpay webhook without verifying signature first
3. NEVER let a Slack notification failure break the order flow —
   always wrap in try/catch
4. NEVER expose RAZORPAY_KEY_SECRET or SUPABASE_SERVICE_ROLE_KEY
   client-side
5. NEVER log or print any environment variable values
6. ALWAYS test on real mobile before marking a session done
7. ALWAYS run typecheck after a session before committing
8. Boosted products ALWAYS appear first — everywhere, no exceptions

---

## Context Header (Paste at Start of Every Session)
```
You are building Crevis v2. Read CLAUDE.md and all @docs/ files before
writing any code.
Current phase: [FILL IN]
Current megasession: [FILL IN]
Current session: [FILL IN]
Last completed to-do: [FILL IN]
Do not move to the next session without confirming the done checklist.
```

---

## Current State
See @docs/LOGBOOK.md for live project status, known bugs, and decisions.