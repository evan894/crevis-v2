# Crevis v2 — CONVENTIONS.md
# Code Style, Git Rules, Security, and Agent Discipline

---

## TypeScript

- Strict mode is ON — never disable it, never use `any`
- Always define explicit return types on functions
- Use `type` for object shapes, `interface` for extendable contracts
- Prefer named exports over default exports everywhere
- Use `const` by default, `let` only when reassignment is needed
- Never use `var`
- Always destructure imports: `import { foo } from 'bar'`
- Use optional chaining `?.` and nullish coalescing `??` over ternary chains
- Always handle the null/undefined case — never assume a value exists

```typescript
// ✅ Correct
import { createClient } from '@supabase/supabase-js'
export const getProducts = async (sellerId: string): Promise<Product[]> => { }

// ❌ Wrong
import supabase from '@supabase/supabase-js'
export default async function(id) { }
```

---

## File and Folder Naming

```
Pages:          app/dashboard/page.tsx       — always page.tsx
Layouts:        app/dashboard/layout.tsx     — always layout.tsx
Components:     components/ProductCard.tsx   — PascalCase
Utilities:      lib/credits.ts               — camelCase
API routes:     app/api/credits/purchase/route.ts
Bot handlers:   bot/handlers/browseHandler.ts
Types:          types/index.ts               — all shared types here
Constants:      lib/constants.ts             — all magic numbers/strings
```

---

## Component Rules

- Always use functional components — never class components
- One component per file — no exceptions
- Component files must export only that component
- Props must always be typed with an explicit `type` or `interface`
- Never inline styles — always use Tailwind utility classes
- Never hardcode colors — always reference CSS variables from DESIGN.md
- Keep components under 150 lines — split if longer
- No business logic in components — call lib/ functions instead

```typescript
// ✅ Correct
type ProductCardProps = {
  product: Product
  onBoost: (id: string) => void
}

export const ProductCard = ({ product, onBoost }: ProductCardProps) => {
  return (...)
}

// ❌ Wrong
export default function({ product, onBoost }) {
  const res = await supabase.from('products')... // business logic in component
}
```

---

## Tailwind Rules

- Use CSS variables for all brand colors — never hardcode hex in className
- Follow spacing scale from DESIGN.md — never use arbitrary values like `p-[13px]`
- Mobile-first always — base styles are mobile, add `md:` and `lg:` for larger
- Never use `!important` overrides
- Group Tailwind classes in this order:
  layout → sizing → spacing → typography → color → border → shadow → animation

```tsx
// ✅ Correct
<button className="flex items-center w-full px-5 py-3 text-sm font-medium
  text-white bg-[var(--color-saffron)] rounded-[var(--radius-md)]
  shadow-sm hover:bg-[var(--color-saffron-dark)] transition-colors
  duration-[var(--duration-base)]">

// ❌ Wrong
<button className="bg-[#F4631E] p-[13px] text-white !important">
```

---

## API Routes (Next.js)

- All API routes live under `app/api/`
- Always validate request method first — return 405 if wrong method
- Always validate and sanitize all inputs before DB operations
- Always return consistent JSON shape:

```typescript
// Success
return Response.json({ success: true, data: result }, { status: 200 })

// Error
return Response.json({ success: false, error: 'Descriptive message' }, { status: 400 })
```

- Never return raw Supabase errors to the client — log them, return generic message
- All Razorpay webhooks must verify signature as the FIRST operation
- Webhook routes must return 200 immediately even if processing fails —
  log the failure, never let Razorpay retry loop

---

## Supabase Rules

- Always use the server client (service role) in API routes
- Always use the browser client in components
- Never call Supabase directly from components — always via lib/ functions
- Always handle both `data` and `error` from every Supabase call
- Never use `!` non-null assertion on Supabase responses
- Credit operations: ONLY via `deduct_credits()` and `add_credits()` RPCs
- All mutations must log to `credit_ledger` in the same operation

```typescript
// ✅ Correct — in lib/credits.ts
export const deductCredits = async (sellerId: string, amount: number) => {
  const { data, error } = await supabase.rpc('deduct_credits', {
    seller_id: sellerId,
    amount
  })
  if (error) throw new Error(`Credit deduction failed: ${error.message}`)
  return data
}

// ❌ Wrong — direct balance update
await supabase
  .from('sellers')
  .update({ credit_balance: balance - amount })
  .eq('id', sellerId)
```

---

## Telegram Bot Rules

- Every handler must be wrapped in try/catch — bot must never crash
- Always answer callback queries — never leave them hanging (causes loading spinner)
- Never store sensitive data in session — only IDs and navigation state
- Keep all message text in a constants file — never hardcode strings in handlers
- Product cards must always show: photo, name, price, shop name
- Boosted products always rendered first — enforce in every query

```typescript
// ✅ Correct
bot.action('browse_clothing', async (ctx) => {
  try {
    await ctx.answerCbQuery()
    const products = await getProductsByCategory('clothing')
    // render...
  } catch (err) {
    console.error('[browse_clothing]', err)
    await ctx.reply('Something went wrong. Please try /start again.')
  }
})
```

---

## Slack Notification Rules

- All Slack sends wrapped in try/catch — NEVER let Slack failure affect order flow
- If seller has no `slack_access_token` → skip silently, no error thrown
- Use exact copy strings from CLAUDE.md — never paraphrase them
- Never send more than one notification per event
- Log all Slack failures with: `[Slack] failed for seller_id: ${id} — ${err.message}`

```typescript
// ✅ Correct
export const notifyNewOrder = async (seller: Seller, order: Order) => {
  if (!seller.slack_access_token) return
  try {
    await sendSlackDM(seller.slack_access_token, seller.slack_user_id,
      `🛍 New order — ${order.product_name} ₹${order.amount} from
      ${order.buyer_name}. ${order.credits_deducted} credits deducted.`)
  } catch (err) {
    console.error(`[Slack] failed for seller_id: ${seller.id} — ${err.message}`)
  }
}
```

---

## Security Rules

- NEVER log or print any environment variable value — not even partially
- NEVER expose server-side env vars to the client (no `NEXT_PUBLIC_` prefix
  on secrets)
- NEVER include API keys, tokens, or secrets in any prompt sent to Claude Code
- NEVER commit `.env.local` — it must always be in `.gitignore`
- ALWAYS verify Razorpay webhook signatures before reading payload
- ALWAYS use Supabase service role key server-side only
- Input sanitization: always trim and validate all user inputs before DB writes
- Treat all Telegram user input as untrusted — sanitize before any DB operation

```typescript
// ✅ Correct — verify before processing
const isValid = validateRazorpaySignature(
  req.headers['x-razorpay-signature'],
  rawBody,
  process.env.RAZORPAY_KEY_SECRET!
)
if (!isValid) return Response.json({ error: 'Invalid signature' }, { status: 400 })
```

---

## Git Rules

### Branch naming
```
feature/[short-description]     — new features
fix/[short-description]         — bug fixes
session/[phase-megasession]     — Claude Code session branches
```

### Commit format (Conventional Commits)
```
feat: add product listing page
fix: correct credit deduction on boost
chore: update supabase types
refactor: extract credit logic to lib/credits.ts
style: fix mobile layout on /wallet
test: add webhook signature verification test
```

### Commit rules
- Commit at the end of EVERY session — never leave uncommitted work
- One commit per logical unit — never batch unrelated changes
- Always run `npm run typecheck` and `npm run lint` before committing
- Never commit with `--no-verify`
- Commit message must reference the session: `feat(MS3-S2): add photo upload`
- Never force push to main

### Branch strategy
- `main` — production only, Vercel deploys from here
- `dev` — integration branch, all sessions merge here first
- Never code directly on `main`

---

## Claude Code Agent Rules

### Context management
- Run `/compact` manually when context reaches ~50% — never wait for auto-compact
- Use `/clear` when switching between completely different parts of the codebase
- If Claude starts repeating itself or losing track — `/clear` immediately
- Each session must start with the context header from CLAUDE.md

### Session discipline
- Complete one to-do fully before starting the next
- Never start a new megasession without passing the done checklist
- If blocked for more than 15 minutes on a single to-do — flag it in LOGBOOK.md,
  skip it, and continue
- Always update LOGBOOK.md at the end of every session before closing

### What Claude Code must never do
- Never modify CLAUDE.md, DESIGN.md, BUILD.md, CONVENTIONS.md autonomously
- Never run database migrations without explicit confirmation
- Never switch library or framework choices mid-build
- Never delete files without explicit instruction
- Never push to `main` directly

### Prompting discipline (for Ishaan)
- Start every session with the context header filled in
- One task at a time — never give Claude Code two unrelated tasks in one prompt
- When reviewing code: "show me X before wiring up Y"
- When stuck: paste the exact error, not a description of it
- After a bad output: "scrap this, implement the correct version" not iterating
  on broken code

---

## Import Order Convention

```typescript
// 1. Node built-ins
import { readFileSync } from 'fs'

// 2. External packages
import { createClient } from '@supabase/supabase-js'
import { Telegraf } from 'telegraf'

// 3. Internal lib/
import { supabaseServer } from '@/lib/supabase'
import { deductCredits } from '@/lib/credits'

// 4. Components
import { ProductCard } from '@/components/ProductCard'

// 5. Types
import type { Product, Seller } from '@/types'
```

---

## Error Handling Convention

All errors must follow this pattern — no swallowed errors, no bare throws:

```typescript
// In lib/ functions — throw with context
if (error) throw new Error(`[credits] deduction failed: ${error.message}`)

// In API routes — catch and return
try {
  const result = await deductCredits(sellerId, amount)
  return Response.json({ success: true, data: result })
} catch (err) {
  console.error('[POST /api/credits/deduct]', err)
  return Response.json({ success: false, error: 'Credit operation failed' }, { status: 500 })
}

// In bot handlers — catch and reply
try {
  // handler logic
} catch (err) {
  console.error('[handler name]', err)
  await ctx.reply('Something went wrong. Please try /start again.')
}
```

---

## Types File Convention

All shared types live in `/types/index.ts`:

```typescript
export type Seller = {
  id: string
  user_id: string
  shop_name: string
  slack_user_id: string | null
  slack_access_token: string | null
  credit_balance: number
  created_at: string
}

export type Product = {
  id: string
  seller_id: string
  name: string
  description: string | null
  photo_url: string
  price: number
  category: string
  boosted: boolean
  active: boolean
  created_at: string
}

export type Order = {
  id: string
  product_id: string
  buyer_telegram_id: string
  buyer_name: string
  amount: number
  platform_fee: number
  status: 'pending' | 'completed' | 'failed'
  razorpay_payment_id: string | null
  created_at: string
}

export type CreditAction =
  | 'listing'
  | 'boost'
  | 'order_fee'
  | 'credit_purchase'
  | 'coupon'