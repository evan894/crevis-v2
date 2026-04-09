# Crevis v2 — FLOWS.md
# All User Journeys, Bot Flows, Webhook Flows, and Edge Cases

---

## How to Use This File

Every flow is written as a numbered step sequence.
Each step maps directly to a unit of code Claude Code must build.
Steps marked [DB] touch the database.
Steps marked [EXT] call an external service (Razorpay, Slack, Gemini, Telegram).
Steps marked [GUARD] are validation checks that must block flow if they fail.

---

## 1. Seller Web App Flows

---

### 1.1 Registration Flow

Trigger: User visits `/auth` for the first time.

```
1. User lands on /auth
2. User toggles to Sign Up tab
3. User enters: name, email, password
4. [GUARD] Validate: email is valid format, password >= 8 chars
5. [EXT] Call Supabase signUp(email, password)
6. [GUARD] If Supabase returns error → show specific error message, stop
7. [DB] Supabase creates auth.users record automatically
8. Redirect to /onboarding
```

---

### 1.2 Sign In Flow

Trigger: Returning seller visits `/auth`.

```
1. User lands on /auth — Sign In tab is default
2. User enters: email, password
3. [EXT] Call Supabase signInWithPassword(email, password)
4. [GUARD] If error → show "Incorrect email or password", stop
5. [DB] Supabase sets session cookie
6. Check if seller record exists for this user_id:
   SELECT * FROM sellers WHERE user_id = auth.uid()
7. If seller record exists → redirect to /dashboard
8. If seller record does not exist → redirect to /onboarding
```

---

### 1.3 Onboarding Flow — Step 1 (Shop Setup)

Trigger: New seller lands on /onboarding after sign up.

```
1. User sees Step 1 of 3 progress bar
2. User enters: shop_name
3. User selects: primary category from dropdown
   (Clothing / Footwear / Accessories / Home Textiles / Other)
4. User clicks Next
5. [GUARD] Validate: shop_name not empty, category selected
6. [DB] INSERT into sellers:
   (user_id, shop_name, category, credit_balance = 0)
7. Save seller.id to local state for subsequent steps
8. Advance to Step 2
```

---

### 1.4 Onboarding Flow — Step 2 (Connect Slack)

Trigger: Seller completes Step 1.

```
1. User sees Step 2 of 3 — "Connect Slack to receive order alerts"
2. User clicks "Connect Slack" button
3. [EXT] Redirect to Slack OAuth URL:
   https://slack.com/oauth/v2/authorize?
   client_id={SLACK_CLIENT_ID}
   &scope=chat:write,im:write,users:read
   &redirect_uri={APP_URL}/api/auth/slack/callback
   &state={seller_id}
4. User authorises on Slack
5. [EXT] Slack redirects to /api/auth/slack/callback?code=X&state=seller_id
6. [EXT] Exchange code for token:
   POST https://slack.com/api/oauth.v2.access
7. [DB] UPDATE sellers SET
   slack_user_id = response.authed_user.id,
   slack_access_token = response.authed_user.access_token
   WHERE id = seller_id
8. Redirect back to /onboarding with ?step=2&connected=true
9. Show "Slack connected ✅" confirmation state on Step 2
10. User clicks Next → advance to Step 3

--- SKIP PATH ---
2b. User clicks "Skip for now"
3b. Advance directly to Step 3
    (slack_user_id and slack_access_token remain null)
```

---

### 1.5 Onboarding Flow — Step 3 (Load Wallet)

Trigger: Seller completes or skips Step 2.

```
1. User sees Step 3 of 3 — "Load your wallet to start listing"
2. User sees coupon input field + "Redeem" button
3. User enters coupon code (e.g. CREVIS100)
4. User clicks Redeem
5. [GUARD] Validate: code is not empty
6. [DB] Call redeem_coupon(seller_id, code) RPC:
   — Validates code exists, active, not exceeded
   — Increments uses_so_far
   — Calls add_credits(seller_id, 100, 'coupon')
   — Returns new balance
7. [GUARD] If RPC throws → show exact error message, stop
8. [EXT] Fire confetti animation (canvas-confetti)
9. Show: "100 credits added! Your balance: 100 credits"
10. Show "Go to Dashboard" CTA button
11. User clicks → redirect to /dashboard

--- SKIP PATH ---
3b. User clicks "Skip for now"
4b. Redirect to /dashboard with 0 credits
    (low credits warning banner will show on dashboard)
```

---

### 1.6 Product Listing Flow

Trigger: Seller clicks "Add Product" on /products.

```
1. Seller lands on /products/new
2. Seller fills in form:
   — Product name (text, required)
   — Description (textarea, optional)
   — Price (numeric, required, min ₹1)
   — Category (select, required)
   — Photo (file upload, required)
3. Seller selects photo file
4. Photo previews immediately in the dropzone
5. [GUARD] Validate all required fields before submit
6. Seller clicks "Publish Product"
7. [DB] Fetch seller.credit_balance
8. [GUARD] If credit_balance < 2:
   — Block submit
   — Show: "You need at least 2 credits to list a product.
     Your balance: {N}. Top up your wallet."
   — Show link to /wallet, stop
9. [EXT] Upload photo to Supabase Storage bucket 'product-images':
   — File path: {seller_id}/{uuid}.{ext}
   — Get public photo_url from response
10. [DB] INSERT into products:
    (seller_id, name, description, photo_url, price, category,
     boosted=false, active=true)
11. [DB] Call deduct_credits(seller_id, 2, 'listing'):
    — Deducts 2 credits atomically
    — Logs to credit_ledger
12. [DB] Fetch new credit_balance
13. [GUARD] If new balance = 0 → call deactivate_seller_listings(seller_id)
14. Show success toast: "Your {name} is now live on the Crevis network."
15. Redirect to /products
```

---

### 1.7 Boost Product Flow

Trigger: Seller clicks "Boost" on a product card in /products.

```
1. Seller clicks Boost on a product card
2. Show confirmation modal:
   "Boost {product_name} to the top of search results?
    This costs 10 credits. Your balance: {N} credits."
3. Seller clicks Confirm
4. [DB] Fetch seller.credit_balance
5. [GUARD] If credit_balance < 10:
   — Show: "You need 10 credits to boost. Your balance: {N}."
   — Show link to /wallet, stop
6. [DB] Call deduct_credits(seller_id, 10, 'boost'):
   — Deducts 10 credits atomically
   — Logs to credit_ledger
7. [DB] UPDATE products SET boosted = true WHERE id = product_id
8. [DB] Fetch new credit_balance
9. [GUARD] If new balance = 0 → call deactivate_seller_listings(seller_id)
10. Product card shows boosted badge immediately
11. Show success toast: "{product_name} is now boosted."
```

---

### 1.8 Credit Purchase Flow

Trigger: Seller clicks "Buy Credits" on /wallet.

```
1. Seller sees 3 credit packages:
   — ₹100 = 100 credits
   — ₹500 = 550 credits
   — ₹1000 = 1200 credits
2. Seller clicks a package
3. [EXT] POST /api/credits/purchase:
   — Create Razorpay order:
     amount = package.amount_paid * 100 (paise)
     currency = INR
     receipt = 'credits_{seller_id}_{timestamp}'
   — [DB] INSERT into credit_purchases:
     (seller_id, amount_paid, credits_added, razorpay_order_id,
      status='pending')
   — Return razorpay_order_id to client
4. [EXT] Open Razorpay checkout on client:
   — key: RAZORPAY_KEY_ID
   — amount, currency, order_id
   — prefill: seller name + email
   — theme color: #F4631E (saffron)
5. Seller completes payment on Razorpay
6. Razorpay fires webhook → /api/webhooks/razorpay-credits
   (see Webhook Flows section 3.1)
7. On webhook success → credit balance updates on /wallet page
   via Supabase realtime subscription
```

---

### 1.9 Coupon Redemption Flow (from /wallet)

Trigger: Seller enters a coupon code on /wallet.

```
1. Seller enters code in coupon input field
2. Seller clicks Redeem
3. [GUARD] Validate: code is not empty
4. [EXT] POST /api/credits/redeem-coupon { code, seller_id }
5. [DB] Call redeem_coupon(seller_id, code) RPC
6. [GUARD] If RPC throws:
   — 'Invalid or inactive coupon code.' → show exact message
   — 'Coupon usage limit reached.' → show exact message
   — Stop
7. Show success: "{credits} credits added! New balance: {N}"
8. Credit balance updates on page immediately
9. Ledger table shows new 'coupon' entry
```

---

## 2. Telegram Buyer Flows

---

### 2.1 Start Flow

Trigger: Buyer sends /start to the bot.

```
1. Bot receives /start command
2. [DB] Check if buyer exists:
   SELECT * FROM buyers WHERE telegram_id = ctx.from.id
3. If not exists:
   [DB] INSERT into buyers (telegram_id, first_name, username)
4. Bot sends welcome message:
   "👋 Welcome to Crevis! Discover and buy from local sellers
    across India. What would you like to do?"
5. Bot shows main menu inline keyboard:
   [🛍 Browse Products] [🔍 Search]
   [📦 My Orders]
```

---

### 2.2 Browse by Category Flow

Trigger: Buyer taps "🛍 Browse Products".

```
1. [EXT] Bot answers callback query (clears loading spinner)
2. Bot sends category selection message:
   "Choose a category:"
3. Bot shows inline keyboard with categories:
   [Clothing] [Footwear]
   [Accessories] [Home Textiles]
   [Other] [⬅ Back]
4. Buyer taps a category
5. [EXT] Bot answers callback query
6. [DB] Fetch active products in category:
   SELECT * FROM products
   WHERE category = ? AND active = true
   ORDER BY boosted DESC, created_at DESC
   LIMIT 5
7. If no products:
   Bot replies: "No products here yet. Try another category."
   Show [⬅ Back to Categories] button, stop
8. For each product → send product card:
   [EXT] Bot sends photo with caption:
   "{name}
    ₹{price}
    🏪 {shop_name}
    ✨ Boosted (if boosted = true)"
   Inline buttons: [Buy Now ₹{price}] [⬅ Back]
9. If total products > 5:
   After 5 cards, show [Load More] button
10. Buyer taps Load More:
    Fetch next 5 (offset += 5), repeat step 8
```

---

### 2.3 Search Flow

Trigger: Buyer taps "🔍 Search".

```
1. [EXT] Bot answers callback query
2. Bot sends: "What are you looking for?
   (e.g. 'cotton kurta under ₹500' or 'wedding outfit')"
3. Bot sets conversation state: awaiting_search = true
4. Buyer types their search query
5. Bot receives text message, checks awaiting_search = true
6. Bot sends: "🔍 Searching..." (typing indicator)
7. [DB] Fetch all active products:
   SELECT id, name, description, category, price
   FROM products WHERE active = true
8. [EXT] Call Gemini 2.0 Flash with prompt:
   "Given this list of products: {products_json}
    Find the top 3 most relevant matches for this search query:
    '{user_query}'
    Return ONLY a JSON array of product IDs. No explanation.
    Example: ["uuid1", "uuid2", "uuid3"]"
9. Parse Gemini response → extract array of up to 3 product IDs
10. [DB] Fetch full product details for matched IDs
11. If 0 results:
    Bot replies: "Couldn't find that. Try browsing by category."
    Show [🛍 Browse Products] button, stop
12. For each matched product → send product card (same as 2.2 step 8)
13. Clear conversation state: awaiting_search = false

--- FALLBACK (Gemini timeout > 3s or error) ---
8b. Run text search fallback:
    Filter products where
    LOWER(name) LIKE '%query%'
    OR LOWER(description) LIKE '%query%'
    ORDER BY boosted DESC
    LIMIT 3
9b. Continue from step 10
```

---

### 2.4 Buy Now Flow

Trigger: Buyer taps "Buy Now ₹{price}" on a product card.

```
1. [EXT] Bot answers callback query
2. Bot extracts product_id from callback data
3. [DB] Fetch product by id:
   [GUARD] If product not found or active = false:
   Bot replies: "Sorry, this product is no longer available."
   Show [🛍 Browse Products] button, stop
4. [EXT] POST /api/payment/create-link:
   — product_id, buyer_telegram_id, buyer_name
   — [DB] INSERT into orders:
     (product_id, seller_id, buyer_telegram_id, buyer_name,
      amount = product.price,
      platform_fee = floor(product.price * 0.05),
      credits_deducted = max(1, floor(product.price * 0.05)),
      status = 'pending')
   — [EXT] Create Razorpay payment link:
     amount = product.price * 100 (paise)
     currency = INR
     description = "Crevis — {product.name}"
     callback_url = {APP_URL}/api/webhooks/razorpay-orders
     callback_method = get
   — Return payment link URL + order_id
5. Bot sends payment message:
   "💳 {product.name} — ₹{product.price}
    Tap below to pay securely 👇"
   Inline button: [Pay ₹{price}] → opens payment_link URL
6. Buyer completes Razorpay payment
7. Razorpay fires webhook → /api/webhooks/razorpay-orders
   (see Webhook Flows section 3.2)
```

---

### 2.5 My Orders Flow

Trigger: Buyer taps "📦 My Orders".

```
1. [EXT] Bot answers callback query
2. [DB] Fetch buyer's orders:
   SELECT o.*, p.name as product_name, s.shop_name
   FROM orders o
   JOIN products p ON o.product_id = p.id
   JOIN sellers s ON o.seller_id = s.id
   WHERE o.buyer_telegram_id = ctx.from.id
   ORDER BY o.created_at DESC
   LIMIT 10
3. If no orders:
   Bot replies: "You haven't placed any orders yet.
   Start browsing! 🛍"
   Show [🛍 Browse Products] button, stop
4. For each order, bot sends summary:
   "📦 {product_name}
    🏪 {shop_name}
    ₹{amount} • {status emoji} {status}
    📅 {formatted date}"
5. Show [🛍 Continue Shopping] button after all orders
```

---

## 3. Webhook Flows

---

### 3.1 Razorpay Credit Purchase Webhook

Endpoint: POST /api/webhooks/razorpay-credits
Trigger: Seller completes credit purchase on /wallet.

```
1. Receive POST request from Razorpay
2. Read raw request body (must be raw bytes for signature verification)
3. [GUARD] Verify Razorpay signature:
   expectedSignature = HMAC-SHA256(rawBody, RAZORPAY_KEY_SECRET)
   If signature mismatch → return 400, log warning, stop
4. Parse event payload
5. [GUARD] Check event is 'payment.captured', if not → return 200, stop
6. Extract: razorpay_order_id, razorpay_payment_id, amount
7. [DB] Fetch credit_purchase by razorpay_order_id:
   [GUARD] If not found → log error, return 200, stop
   [GUARD] If status = 'completed' → already processed, return 200, stop
8. [DB] UPDATE credit_purchases SET
   status = 'completed',
   razorpay_payment_id = payment_id
   WHERE razorpay_order_id = order_id
9. [DB] Call add_credits(seller_id, credits_added, 'credit_purchase'):
   — Atomically adds credits
   — Logs to credit_ledger
10. [DB] Fetch seller record for Slack notification
11. [EXT] Send Slack notification (if connected):
    "✅ Wallet recharged! {credits} credits added.
    New balance: {new_balance} credits."
12. Return 200 OK
```

---

### 3.2 Razorpay Product Order Webhook

Endpoint: POST /api/webhooks/razorpay-orders
Trigger: Buyer completes product purchase via Telegram bot.

```
1. Receive POST request from Razorpay
2. Read raw request body
3. [GUARD] Verify Razorpay signature:
   If mismatch → return 400, log warning, stop
4. Parse event payload
5. [GUARD] Check event is 'payment.captured', if not → return 200, stop
6. Extract: razorpay_payment_id, razorpay_order_id, amount
7. [DB] Fetch order by razorpay payment link reference:
   [GUARD] If not found → log error, return 200, stop
   [GUARD] If status = 'completed' → already processed, return 200, stop
8. [DB] UPDATE orders SET
   status = 'completed',
   razorpay_payment_id = payment_id
   WHERE id = order_id
9. [DB] Call deduct_credits(
   seller_id,
   order.credits_deducted,
   'order_fee',
   order.amount,
   order.id
   ):
   — Atomically deducts platform fee credits
   — Logs to credit_ledger
10. [DB] Fetch seller's new credit_balance
11. [GUARD] If new credit_balance <= 0:
    [DB] Call deactivate_seller_listings(seller_id)
    Trigger low-balance Slack alert (see 4.3)
12. [EXT] Send buyer confirmation via Telegram bot:
    "✅ Order placed! {product_name} from {shop_name}. Thank you!"
13. [EXT] Send seller Slack notification (see 4.1)
14. [GUARD] If new credit_balance < 20 AND > 0:
    [EXT] Send low credits Slack warning (see 4.2)
15. Return 200 OK

--- ON ANY STEP FAILURE ---
- Log full error with order_id and step number
- Do NOT return non-200 (prevents Razorpay retry loop)
- Return 200 with error logged internally
```

---

## 4. Slack Notification Flows

All notifications use seller.slack_access_token and seller.slack_user_id.
If either is null → skip silently, no error thrown.
All Slack calls wrapped in try/catch.

---

### 4.1 New Order Notification

Trigger: Step 13 of Razorpay order webhook.

```
1. Fetch seller, order, product records
2. Calculate credits_deducted from order record
3. [EXT] sendSlackDM(slack_access_token, slack_user_id):
   "🛍 New order — {product_name} ₹{amount} from {buyer_name}.
   {credits_deducted} credits deducted."
```

---

### 4.2 Low Credits Warning

Trigger: After any credit deduction where new balance < 20 AND > 0.

```
1. [EXT] sendSlackDM(slack_access_token, slack_user_id):
   "⚠️ Your Crevis wallet is running low ({balance} credits).
   Recharge to keep listings active: {APP_URL}/wallet"
```

---

### 4.3 Listings Deactivated Notification

Trigger: After deactivate_seller_listings is called (balance hits 0).

```
1. [EXT] sendSlackDM(slack_access_token, slack_user_id):
   "❌ Your listings have been paused due to zero credits.
   Recharge at {APP_URL}/wallet"
```

---

### 4.4 Credit Purchase Success Notification

Trigger: Step 11 of Razorpay credits webhook.

```
1. [EXT] sendSlackDM(slack_access_token, slack_user_id):
   "✅ Wallet recharged! {credits_added} credits added.
   New balance: {new_balance} credits."
```

---

## 5. Edge Cases and Guard Flows

---

### 5.1 Insufficient Credits — Listing

```
Trigger: Seller tries to publish a product with balance < 2.

1. On /products/new submit → fetch credit_balance
2. If balance < 2:
   — Disable submit button
   — Show banner: "You need at least 2 credits to list a product.
     Your balance: {N}. Top up your wallet."
   — Show "Go to Wallet" CTA
   — Do not call any DB or storage function
   — Stop
```

---

### 5.2 Insufficient Credits — Boost

```
Trigger: Seller tries to boost a product with balance < 10.

1. On Boost confirm click → fetch credit_balance
2. If balance < 10:
   — Show error in modal: "You need 10 credits to boost.
     Your balance: {N} credits."
   — Show "Top Up" link to /wallet
   — Close modal on dismiss
   — Stop
```

---

### 5.3 Credit Balance Hits Zero

```
Trigger: Any credit deduction results in balance = 0.

1. deduct_credits RPC completes, returns new_balance = 0
2. In the same server operation:
   [DB] Call deactivate_seller_listings(seller_id)
   — Sets all seller products active = false
3. [EXT] Send Slack notification 4.3
4. On seller's next page load:
   — Show full-width error banner:
     "Your listings are paused. Recharge your wallet to reactivate."
   — All product cards show inactive badge
   — "Recharge" CTA links to /wallet
```

---

### 5.4 Gemini Timeout or Failure

```
Trigger: Gemini call takes > 3 seconds or throws an error.

1. Set timeout: 3000ms on Gemini API call
2. On timeout or catch:
   — Log: [Gemini] timeout or error for query: {query}
   — Run fallback text search:
     Filter products WHERE
     LOWER(name) LIKE '%{query}%'
     OR LOWER(description) LIKE '%{query}%'
     ORDER BY boosted DESC LIMIT 3
3. Continue flow with fallback results
4. Never surface the failure to the buyer — results appear seamlessly
```

---

### 5.5 Payment Link Expired or Failed

```
Trigger: Buyer does not complete payment / link expires.

1. Razorpay fires payment.failed event to webhook
2. [GUARD] Verify signature
3. [DB] UPDATE orders SET status = 'failed'
   WHERE razorpay_payment_id matches
4. [EXT] Send buyer Telegram message:
   "❌ Payment was not completed. Tap /start to try again."
5. No credits deducted (deduction only happens on 'completed' status)
6. Seller receives no notification
```

---

### 5.6 Seller Has No Slack Connected

```
Trigger: Any Slack notification is triggered for a seller
         with slack_access_token = null.

1. In sendSlackDM helper:
   if (!slack_access_token || !slack_user_id) return
2. Log: [Slack] skipped — seller {seller_id} has no Slack connected
3. Continue main flow uninterrupted
4. No error thrown, no retry attempted
```

---

### 5.7 Duplicate Webhook Event

```
Trigger: Razorpay sends the same webhook event twice (retry).

1. In both webhook handlers, after fetching the record:
   Check if status = 'completed'
2. If already completed:
   — Log: [Webhook] duplicate event ignored for {order_id or purchase_id}
   — Return 200 immediately
   — No DB writes, no notifications sent
3. This prevents double credit deduction or double credit addition
```

---

### 5.8 Product Purchased But Seller Has Zero Credits After Fee

```
Trigger: Platform fee deduction after order leaves seller at 0 credits.

1. Order webhook completes step 8 (order marked completed)
2. deduct_credits RPC executes → returns new_balance = 0
3. Immediately:
   [DB] deactivate_seller_listings(seller_id)
   [EXT] Slack: listings deactivated notification (4.3)
4. Order is still marked completed — buyer gets confirmation
5. Seller listings go dark on Telegram bot immediately
   (next browse/search fetches only active = true products)
```

---

### 5.9 Photo Upload Fails During Product Listing

```
Trigger: Supabase Storage upload throws an error.

1. Catch error from storage upload
2. Do NOT insert product record
3. Do NOT deduct credits
4. Show error: "Photo upload failed. Please try again."
5. Form stays populated — seller does not lose their input
6. Retry button available
```

---

## 6. Advanced Seller & Financial Flows

---

### 6.1 Credits Separation (Earned vs Promo)

Trigger: Any credit addition or deduction.

```
1. [DB] All additions specify credit_type ('earned' for sales, 'promo' for coupons/recharges).
2. [DB] add_credits RPC updates sellers.earned_credits or promo_credits specifically.
3. [DB] deduct_credits RPC handles 'any' type by deducting from promo first, then earned.
4. [DB] deduct_credits RPC for withdrawals MUST specify 'earned' type (blocks promo).
```

---

### 6.2 Grace Period & Auto-Deactivation

Trigger: Credit balance goes negative.

```
1. [DB] In deduct_credits RPC: if balance < 0 and grace_period_started_at is null:
   UPDATE sellers SET grace_period_started_at = now()
2. [EXT] Vercel Cron runs daily (/api/cron/grace-period):
   — Day 3: Send Slack warning "2 days remaining".
   — Day 5: Send Slack warning "Final warning".
   — Day 6: 
     a. [DB] SELECT active products and save to deactivated_snapshot.
     b. [DB] UPDATE products SET active = false.
     c. [DB] UPDATE sellers SET deactivated = true, deactivated_at = now().
     d. [EXT] Send Slack "Store paused" DM and notify Crevis Admin.
3. Re-activation: 
   — When balance >= 0:
     a. [DB] Restore products from deactivated_snapshot.
     b. [DB] Reset grace_period_started_at and deactivated fields.
```

---

### 6.3 50 Credit Threshold Flow

Trigger: Listing or Boosting a product.

```
1. [DB] Fetch seller.credit_balance.
2. [GUARD] If balance < 50:
   — Block "Publish" or "Boost" actions.
   — Error: "Balance below 50. Top up to list/boost new items. Existing items stay active."
3. [UI] Show "Low Balance" warning banner on Dashboard if balance < 100.
```

---

### 6.4 Auto-Unlist & Scheduled Delete

Trigger: Product stock reaches 0 or manual unlist.

```
1. [DB] UPDATE products SET unlisted_at = now().
2. [DB] Calculate scheduled_delete_at = now() + (unlist_duration_days).
3. [EXT] Vercel Cron runs daily:
   — DELETE products where scheduled_delete_at < now().
4. Exception: if unlist_duration_days = 0, product is never deleted.
```

---

### 6.5 Size & Inventory Management

Trigger: Product listing or update.

```
1. Seller toggles "This product has size variants".
2. Seller defines options (e.g. S, M, L) and stock per option.
3. [DB] Store in products.variants JSON.
4. [DB] products.stock becomes total sum of all variant stocks.
5. [DB] When an order is placed:
   — Reduce stock of selected variant.
   — Recalculate total stock.
   — If total stock = 0, set product.active = false and unlisted_at = now().
```

---

### 6.6 Category Qualifying Questions (Bot)

Trigger: Buyer selects a category in Telegram bot.

```
1. Buyer selects "Clothing".
2. Bot asks "What size?" (Buttons: XS, S, M, L, XL, XXL, Any).
3. Bot asks "For whom?" (Buttons: Men, Women, Kids, Unisex, Any).
4. Bot asks "Budget?" (Buttons based on category price points).
5. [DB] Filter products matching category AND selected variant sizes AND gender AND price range.
6. Display results.
```

---

### 6.7 2-Day Return Window & Credit Release

Trigger: Order payment captured.

```
1. [DB] UPDATE orders SET return_window_closes_at = now() + 2 days, credits_released = false.
2. [EXT] Vercel Cron runs hourly (/api/cron/release-credits):
   — Find orders where return_window_closes_at < now() AND credits_released = false.
   — [DB] For each order:
     a. Call add_credits(seller_id, order_net_amount, 'earned', 'Order payment release').
     b. UPDATE orders SET credits_released = true, credits_released_at = now().
3. Return process:
   — Buyer requests return via bot.
   — [DB] UPDATE orders SET return_requested = true, return_requested_at = now().
   — Return window is frozen; credits are NOT released.
   — Admin/Seller resolves return manually.
```

---

### 6.8 Bank Account Management

Trigger: Seller visits Wallet → Bank Details.

```
1. Seller enters: Holder Name, A/C Number, IFSC, Type.
2. [EXT] Validate IFSC via Razorpay API.
3. [EXT] Penny Drop Verification:
   — Create Razorpay Contact.
   — Create Fund Account.
   — Trigger "Penny Drop" (₹1 withdrawal).
4. [DB] UPDATE seller_bank_accounts SET verified = true if Razorpay confirms.
```

---

### 6.9 Credit Withdrawal

Trigger: Seller clicks "Withdraw" on Wallet.

```
1. [GUARD] Check seller has verified bank account.
2. [GUARD] Check withdrawal amount >= ₹100.
3. [DB] Deduct credits from 'earned' pool via deduct_credits RPC.
4. [DB] INSERT into withdrawals (status='pending').
5. [EXT] Create Razorpay Payout (IMPS).
6. [DB] UPDATE withdrawals SET status='processing', razorpay_payout_id.
7. [EXT] Send Slack DM: "Payout of ₹X initiated."
8. Webhook: Update withdrawal status to 'completed' or 'failed'.
```