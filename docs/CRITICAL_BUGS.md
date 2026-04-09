Read docs/LOGBOOK2.md and docs/CLAUDE.md before starting.
Do not build new features. Fix only what is listed below.
One fix at a time. Verify each fix before moving to the next.

===================================================
FIX A1 — Telegram link copies full URL not username
===================================================
File: app/(app)/dashboard/page.tsx

Find the copy button for the Telegram bot link.
It currently copies: @Crevis_shop_bot
Change it to copy: https://t.me/Crevis_shop_bot

The display text can stay as @Crevis_shop_bot
but the clipboard value must be the full URL.

Test: Click copy → paste somewhere → confirm
full URL is pasted not just the username.

===================================================
FIX A2 — Product photos not showing
===================================================
Files to check:
- app/(app)/products/page.tsx
- app/api/products/create/route.ts
- lib/supabase.ts (storage URL construction)

Debug steps:
1. Open Supabase dashboard → Storage → product-images
   Check if photos actually exist in the bucket.

2. Check what value is stored in products.photo_url:
   Run in Supabase SQL Editor:
   SELECT id, name, photo_url FROM products LIMIT 5;
   Report the exact photo_url values.

3. If photo_url is a relative path (e.g. /product-images/xxx.jpg):
   Fix to store full public URL:
   const { data } = supabaseAdmin.storage
     .from('product-images')
     .getPublicUrl(filePath)
   Store data.publicUrl in photo_url column

4. In products/page.tsx find the <img> or <Image> tag:
   Ensure src={product.photo_url} uses the full URL
   Add onError handler to show placeholder if image fails

5. Check Supabase Storage bucket policy:
   Bucket 'product-images' must be PUBLIC
   If not public → make it public in Supabase dashboard
   Storage → product-images → Edit → Public bucket ON

Fix whatever is causing photos to not display.
Test: Upload a new product with photo →
confirm photo appears on products page.

===================================================
FIX A3 — Stock field creating multiple products
===================================================
Files to check:
- app/(app)/products/new/page.tsx
- app/api/products/create/route.ts

This is a critical bug. When stock=3 is entered,
3 separate product records are being created
instead of 1 product with stock=3.

Debug steps:
1. Find app/api/products/create/route.ts
   Look for any loop, map, or forEach
   that might be iterating over stock value

2. The create route must INSERT exactly ONE row:
   INSERT INTO products (
     seller_id, name, description, photo_url,
     price, category, stock, active, boosted
   ) VALUES (
     sellerId, name, description, photoUrl,
     price, category, stockQuantity, true, false
   )
   -- stockQuantity is just the number, not a loop

3. If you find any loop over stock → remove it entirely
   Stock is just a count field, not a quantity to repeat

4. Also check products/new/page.tsx:
   The form submit handler must call the API exactly ONCE
   Look for any accidental multiple submissions
   (e.g. form submit + button onClick both firing)
   Add a submitting state flag to prevent double submit:
   const [submitting, setSubmitting] = useState(false)
   On submit: if (submitting) return; setSubmitting(true)
   On complete: setSubmitting(false)

Fix: ensure exactly 1 product created regardless of stock value.
Test: Create product with stock=3 →
confirm exactly 1 product appears in products list
with stock badge showing "3".

===================================================
FIX A4 — UI shows error but product created on backend
===================================================
File: app/api/products/create/route.ts

This happens when:
- Product INSERT succeeds
- Credit deduction fails
- API returns error
- But product already exists in DB

Fix the transaction order:
1. Check credit balance FIRST (before any DB writes)
   If balance < CREDIT_LOW_THRESHOLD → return error immediately
   No DB writes happen

2. Upload photo to storage
3. INSERT product record
4. Call deduct_credits RPC
5. If deduct_credits fails:
   DELETE the product that was just created
   Return error to client
   (This is a compensating transaction)

Better approach — use a single Supabase RPC that does
both insert and deduct atomically. Ask me if you need
help writing this RPC.

Current broken order is likely:
   deduct → insert → error on deduct → product exists

Correct order:
   check balance → upload photo → insert → deduct
   if deduct fails → delete product → return error

Test: Create product with exactly 50 credits →
confirm either succeeds fully or fails fully,
never partial state.

===================================================
FIX A5 — Three dots menu broken on products page
===================================================
File: app/(app)/products/page.tsx

The Boost, Deactivate, Delete actions in the
three-dot menu are not working.

Debug steps:
1. Open browser DevTools → Console
   Click the three dots on any product
   Report any JavaScript errors shown

2. Check the onClick handlers for Boost/Deactivate/Delete
   Are they calling the correct API routes?
   Are they passing the correct product ID?

3. Check API routes exist:
   - POST /api/products/[id]/boost
   - POST /api/products/[id]/toggle-active
   - DELETE /api/products/[id]/delete
   If any are missing → create them

4. Check role permissions in each API route:
   Each route calls requirePermission()
   If getMemberContext throws → action silently fails
   Add proper error handling and return 403 with message

5. In products/page.tsx add error toast on failed actions:
   if (!response.ok) {
     const error = await response.json()
     toast.error(error.message || 'Action failed')
   }

Fix all three actions to work correctly.
Test: Boost a product → confirm 10 credits deducted
and boosted badge appears.

===================================================
AFTER ALL FIXES:
===================================================
[ ] Telegram link copies https://t.me/Crevis_shop_bot
[ ] Product photos display correctly
[ ] Stock=3 creates 1 product not 3
[ ] Product creation succeeds or fails atomically
[ ] Three dots menu actions all work
[ ] No console errors on products page
[ ] npm run typecheck passes
[ ] npm run build passes
[ ] git add .
[ ] git commit -m "fix: critical bug fixes A1-A5"
[ ] git push origin main
[ ] Update LOGBOOK2.md with session entry
[ ] Report what was fixed and what was not

Read docs/LOGBOOK2.md and docs/CLAUDE.md before starting.
Do not touch any Phase A fixes. Build only what is listed below.

===================================================
FIX B1 — Remove Vercel auth from user-facing flows
===================================================
The Vercel deployment protection is showing
Vercel's own auth screen to users.

This is NOT a code fix — it is a Vercel setting.

Manual steps (Ishaan does these):
1. Go to Vercel dashboard → crevis-v2 project
2. Settings → Deployment Protection
3. Set to "None" or "Only preview deployments"
4. Production URL must have zero Vercel auth

Verify: Open crevis-v2.vercel.app in incognito
→ should go directly to /auth page, no Vercel screen.

===================================================
FIX B2 — Invite-based team member signup
===================================================
Currently: Team member must already have Crevis account
Target: Owner sends invite → member gets email →
clicks link → signs up or logs in → joins store

STEP 1 — Database
CREATE TABLE team_invitations (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references sellers(id)
    on delete cascade not null,
  email text not null,
  role text not null check (role in (
    'manager', 'sales_agent', 'delivery_agent', 'custom'
  )),
  custom_role_id uuid default null,
  token text unique not null
    default encode(gen_random_bytes(32), 'hex'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired')),
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null
    default now() + interval '7 days',
  created_at timestamptz not null default now()
);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_invitations"
ON team_invitations FOR ALL
USING (
  seller_id IN (
    SELECT sm.seller_id FROM store_members sm
    WHERE sm.user_id = auth.uid()
    AND sm.role = 'owner'
  )
);

STEP 2 — Install Resend
npm install resend

Add to .env.local:
RESEND_API_KEY=your_resend_api_key

Add to Vercel env vars:
RESEND_API_KEY=your_resend_api_key

STEP 3 — Invite email template
Create lib/email.ts:

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendTeamInvite = async ({
  toEmail,
  shopName,
  role,
  inviteToken,
  invitedByName
}: {
  toEmail: string
  shopName: string
  role: string
  inviteToken: string
  invitedByName: string
}) => {
  const inviteUrl =
    `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`

  const roleLabel = {
    manager: 'Store Manager',
    sales_agent: 'Sales Agent',
    delivery_agent: 'Delivery Agent',
    custom: 'Team Member'
  }[role] ?? role

  await resend.emails.send({
    from: 'Crevis <noreply@crevis.in>',
    to: toEmail,
    subject: `You've been invited to join ${shopName} on Crevis`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #F4631E;">You're invited to Crevis</h2>
        <p>${invitedByName} has invited you to join
        <strong>${shopName}</strong> as a
        <strong>${roleLabel}</strong>.</p>
        <a href="${inviteUrl}"
           style="display: inline-block; background: #F4631E;
           color: white; padding: 12px 24px; border-radius: 8px;
           text-decoration: none; margin: 16px 0;">
          Accept Invitation
        </a>
        <p style="color: #888; font-size: 12px;">
          This invitation expires in 7 days.
          If you didn't expect this, ignore this email.
        </p>
      </div>
    `
  })
}

STEP 4 — Update team page invite flow
In app/(app)/team/page.tsx:

Change "Add Member" flow:
OLD: Look up user by email → add directly
NEW:
  1. Owner enters email + role
  2. POST /api/team/invite { email, role, sellerId }
  3. API creates team_invitations record
  4. Sends invite email via Resend
  5. Show: "Invitation sent to {email}"

Show pending invitations section below team members:
  Table: Email | Role | Sent | Expires | Status
  [Resend] button if expired
  [Cancel] button to delete invitation

STEP 5 — Invite acceptance page
Create app/invite/[token]/page.tsx:

On load:
  Fetch invitation by token
  Check not expired + status = pending

  If user is logged in:
    Show: "Accept invitation to join {shop_name}
    as {role}?"
    [Accept] button

  If user is not logged in:
    Show: "Create your Crevis account to join
    {shop_name} as {role}"
    Show sign up form (name, password)
    On sign up → auto-accept invitation

On acceptance:
  POST /api/invite/accept { token }
  API:
    1. Validate token not expired
    2. Get or create user by invitation email
    3. INSERT into store_members
       (seller_id, user_id, role)
    4. UPDATE team_invitations SET status = 'accepted'
    5. Redirect to /dashboard (or /agent or /delivery
       based on role)

STEP 6 — Handle existing Crevis users
If invited email already has a Crevis account:
  On invite page → show sign in form instead
  After sign in → auto-accept invitation
  Redirect to correct dashboard for role

===================================================
AFTER ALL FIXES:
===================================================
[ ] team_invitations table created in Supabase
[ ] Resend API key added to .env.local and Vercel
[ ] Invite email sends correctly from noreply@crevis.in
[ ] Pending invitations shown on /team page
[ ] /invite/[token] page works for new users
[ ] /invite/[token] page works for existing users
[ ] Accepted invitation creates store_members record
[ ] Correct dashboard shown after accepting
[ ] Expired invitations handled gracefully
[ ] npm run typecheck passes
[ ] npm run build passes
[ ] git add .
[ ] git commit -m "feat: invite-based team member signup"
[ ] git push origin main
[ ] Update LOGBOOK2.md

