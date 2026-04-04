```markdown
# Crevis v2 — DESIGN.md

## Brand Identity

### The Big Idea
Crevis sits at the intersection of two worlds — the chaotic, colourful energy
of Indian street markets and the clean confidence of modern commerce.
The design should feel like a premium product built FOR Bharat, not imported
from Silicon Valley. Warm, tactile, trustworthy, and alive.

The one thing someone must remember: "This feels like it was made for me."

---

## Brand Name & Tagline
- **Name:** Crevis
- **Tagline:** *Sell everywhere. Start here.*
- **Sub-tagline (onboarding):** *Your shop. Your network. Your terms.*

---

## Brand Personality
| Trait | Expression |
|---|---|
| Warm | Earthy oranges, human photography, rounded corners |
| Confident | Strong typography, clear hierarchy, no clutter |
| Modern-Indian | Saffron accent, Devanagari-inspired geometry in patterns |
| Trustworthy | Consistent spacing, muted backgrounds, clear CTAs |
| Alive | Subtle motion, micro-interactions, live data feel |

---

## Color System

### Primary Palette
```
--color-saffron:       #F4631E   /* Primary CTA, highlights, active states */
--color-saffron-light: #FFF0E8   /* Backgrounds, hover states, tags */
--color-saffron-dark:  #C44D10   /* Pressed states, dark CTAs */
```

### Neutral Palette
```
--color-ink:           #1A1A1A   /* Primary text, headings */
--color-ink-secondary: #4A4A4A   /* Body text, descriptions */
--color-ink-muted:     #8A8A8A   /* Placeholders, disabled, captions */
--color-surface:       #FAFAF8   /* Page background — warm white, not cold */
--color-surface-raised:#FFFFFF   /* Cards, modals, inputs */
--color-border:        #EBEBEA   /* Dividers, input borders */
--color-border-strong: #D0D0CE   /* Focused borders, separators */
```

### Semantic Colors
```
--color-success:       #1A7F4B   /* Order confirmed, credit added */
--color-success-bg:    #E8F7F0
--color-warning:       #C47B00   /* Low credits warning */
--color-warning-bg:    #FFF8E6
--color-error:         #C4302B   /* Errors, deactivated listings */
--color-error-bg:      #FEF0EF
--color-info:          #1A5FAB   /* Info banners, tooltips */
--color-info-bg:       #EBF3FF
```

### Credit/Wallet Accent
```
--color-credit:        #7C5CBF   /* Credit balance, wallet UI — distinct from saffron */
--color-credit-light:  #F2EEFF
```

---

## Typography

### Font Pairing
```
Display / Headings:  "Syne" — geometric, confident, slightly unusual
Body / UI:           "DM Sans" — warm, readable, modern without being sterile
Mono / Numbers:      "JetBrains Mono" — credit balances, order IDs, amounts
```

Import via Google Fonts:
```
https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap
```

### Type Scale
```
--text-xs:    11px / 1.4  — captions, badges, metadata
--text-sm:    13px / 1.5  — secondary UI, table rows
--text-base:  15px / 1.6  — body text, descriptions
--text-md:    17px / 1.5  — card titles, form labels
--text-lg:    20px / 1.4  — section headings
--text-xl:    26px / 1.3  — page titles
--text-2xl:   34px / 1.2  — hero headings, credit balance display
--text-3xl:   48px / 1.1  — landing/onboarding hero only
```

### Font Weight Usage
```
800 — Syne, hero headlines only
700 — Syne, page titles, credit numbers
600 — Syne, section headings / DM Sans, strong UI labels
500 — DM Sans, button text, nav items
400 — DM Sans, body text, descriptions
300 — DM Sans, captions, helper text
```

---

## Spacing System
Base unit: 4px

```
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-5:   20px
--space-6:   24px
--space-8:   32px
--space-10:  40px
--space-12:  48px
--space-16:  64px
--space-20:  80px
```

---

## Border Radius
```
--radius-sm:   6px    — badges, tags, small chips
--radius-md:   10px   — inputs, buttons, small cards
--radius-lg:   16px   — cards, modals, product tiles
--radius-xl:   24px   — feature cards, hero sections
--radius-full: 9999px — pills, avatar circles, toggle buttons
```

---

## Elevation / Shadow System
```
--shadow-xs:  0 1px 2px rgba(0,0,0,0.05)              — subtle lift
--shadow-sm:  0 2px 8px rgba(0,0,0,0.07)              — cards at rest
--shadow-md:  0 4px 16px rgba(0,0,0,0.10)             — cards on hover
--shadow-lg:  0 8px 32px rgba(0,0,0,0.12)             — modals, dropdowns
--shadow-xl:  0 16px 48px rgba(0,0,0,0.14)            — full-screen overlays
--shadow-saffron: 0 4px 20px rgba(244,99,30,0.25)     — CTA buttons on hover
--shadow-credit:  0 4px 20px rgba(124,92,191,0.20)    — wallet card hover
```

---

## Motion & Animation

### Principles
- Motion should feel physical — things ease out, never linear
- Nothing animates without purpose
- Page transitions: fade + slight upward drift (8px)
- Loading states: skeleton shimmer, never spinners

### Easing Curves
```
--ease-out:      cubic-bezier(0.16, 1, 0.3, 1)    — elements entering
--ease-in-out:   cubic-bezier(0.4, 0, 0.2, 1)     — state changes
--ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1) — micro-interactions
```

### Duration Scale
```
--duration-fast:    120ms   — hover state color changes
--duration-base:    200ms   — button presses, toggles
--duration-slow:    320ms   — panel slides, modals
--duration-page:    400ms   — page transitions
```

### Key Animations
- **Credit balance update:** number counts up with JetBrains Mono, saffron flash
- **Product card hover:** translate Y -4px + shadow-md upgrade
- **CTA button hover:** shadow-saffron appears + saffron-dark background
- **Order notification badge:** soft pulse on new order
- **Coupon success:** confetti burst (canvas, 1 second) + credit counter increments

---

## Component Design Tokens

### Buttons
```
Primary:    bg saffron, text white, hover saffron-dark + shadow-saffron
Secondary:  bg saffron-light, text saffron-dark, hover border saffron
Ghost:      bg transparent, text ink-secondary, hover bg surface-raised
Danger:     bg error-bg, text error, hover bg error
Disabled:   bg border, text ink-muted, cursor not-allowed

Height:     40px (default) / 36px (sm) / 48px (lg)
Padding:    0 20px (default) / 0 14px (sm) / 0 28px (lg)
Font:       DM Sans 500, 14px
Radius:     radius-md
```

### Input Fields
```
Background:   surface-raised
Border:       1px solid border
Focus border: 1.5px solid saffron
Radius:       radius-md
Height:       44px
Font:         DM Sans 400, 15px
Label:        DM Sans 500, 13px, ink-secondary, 6px below label
Error state:  border error, helper text in error color below
```

### Cards
```
Background:   surface-raised
Border:       1px solid border
Radius:       radius-lg
Shadow:       shadow-sm
Hover:        shadow-md + translate Y -2px
Padding:      space-6
```

### Product Cards (Telegram-style, shown in dashboard)
```
Aspect ratio: 4:3 photo top
Radius:       radius-lg
Photo:        object-cover, rounded top corners only
Price:        Syne 700, text-md, saffron color
Name:         DM Sans 500, text-base, ink
Shop name:    DM Sans 400, text-sm, ink-muted
Boosted badge: saffron background, white text, text-xs, radius-full, top-right of photo
```

### Credit Balance Display
```
Font:         JetBrains Mono 700, text-2xl
Color:        credit (#7C5CBF)
Background:   credit-light
Radius:       radius-xl
Label:        DM Sans 500, text-sm, ink-muted, above balance
Shadow:       shadow-credit
```

### Navigation (Sidebar on desktop, bottom bar on mobile)
```
Background:         surface-raised
Border-right:       1px solid border (desktop)
Active item bg:     saffron-light
Active item text:   saffron-dark
Active item border: 3px left border saffron (desktop)
Icon size:          20px
Font:               DM Sans 500, text-sm
```

---

## Layout System

### Breakpoints
```
mobile:   < 640px
tablet:   640px — 1024px
desktop:  > 1024px
```

### Page Layout (Authenticated)
```
Desktop:
  - Fixed sidebar: 240px wide
  - Main content: remaining width, max-width 1100px
  - Content padding: space-10 horizontal, space-8 vertical

Mobile:
  - No sidebar
  - Bottom navigation bar (5 items max)
  - Full-width content, space-4 padding
```

### Grid
```
Products grid:  3 columns desktop / 2 tablet / 1 mobile
Orders list:    Single column, full width
Dashboard:      2-column stats row + full-width tables
Wallet:         2-column (balance + ledger) desktop / stacked mobile
```

---

## Page-by-Page Design Notes

### /auth
- Split layout: left side brand visual (saffron gradient mesh + Crevis logo + tagline)
- Right side: clean form on white
- Mobile: form only, logo above
- Headline: "Your shop starts here." (Syne 800)

### /onboarding
- Step progress bar at top (3 steps, saffron fill)
- Each step: centered card layout, max-width 480px
- Step 3 (coupon): large input field, prominent "Redeem" button
- Success state: confetti animation + "100 credits added!" in credit color

### /dashboard
- Top bar: "Good morning, {shop_name}" in Syne 600
- 4 stat cards: Total Orders, Credits Balance, Active Listings, Total Earnings
- Credit balance card uses credit color scheme
- Recent orders table below stats
- Low credit warning banner: full-width, warning-bg, dismissible

### /products
- Top: search input + "Add Product" CTA (saffron, right-aligned)
- Filter tabs: All / Active / Inactive / Boosted
- Product grid with cards
- Empty state: illustrated empty shelf, "List your first product" CTA

### /products/new
- Single column form, max-width 560px, centered
- Photo upload: large dashed border dropzone, preview on upload
- Price input: ₹ prefix, JetBrains Mono for the number
- Credit cost notice: subtle banner "Publishing deducts 2 credits. Balance: {N}"
- Submit CTA: full-width, saffron, "Publish Product"

### /wallet
- Hero: large credit balance display (credit color, JetBrains Mono)
- Two actions: "Buy Credits" + "Redeem Coupon" side by side
- Credit packages: 3 cards — ₹100/100cr, ₹500/550cr, ₹1000/1200cr
- Ledger: clean table, color-coded rows (green credit purchase, orange deductions)

---

## Iconography
- Icon set: **Lucide Icons** (consistent stroke weight, 20px default)
- Never mix icon styles
- Icons always paired with text in navigation
- Standalone icons (actions) always have tooltip on hover

---

## Imagery & Illustration
- Product photos: real, taken by sellers — display as-is, no filters
- Empty states: simple line illustrations, saffron + ink-muted tones
- Onboarding: abstract geometric pattern using saffron + border colors
- No stock photography in the UI chrome

---

## Tone of Voice (UI Copy)
- Warm, direct, never corporate
- Use "you" and "your shop" — personal ownership
- Error messages: explain what happened + what to do next
- Success messages: brief, celebratory, specific
- Never say "Something went wrong" — always be specific

### Copy Examples
```
Empty products:    "Your shelves are empty. Add your first product and start selling."
Low credits:       "You're running low on credits (12 left). Top up to keep your shop active."
Order received:    "New order! Someone just bought your {product_name}."
Listing published: "Done! Your {product_name} is now live on the Crevis network."
Coupon success:    "100 credits added. You're ready to start selling."
```

---

## Do's and Don'ts

### Do
- Use saffron sparingly — only for primary actions and highlights
- Keep mobile experience first — sellers are on phones
- Show credit balance prominently at all times
- Use JetBrains Mono for all numbers, prices, amounts
- Add skeleton loaders for all data-fetching states

### Don't
- Don't use pure black (#000000) anywhere — use ink (#1A1A1A)
- Don't use cold white (#FFFFFF) for page backgrounds — use surface (#FAFAF8)
- Don't use more than 2 font families on any single screen
- Don't use purple (credit color) for anything other than wallet/credit UI
- Don't animate things that don't need attention drawn to them
- Don't use generic placeholder illustrations from libraries
