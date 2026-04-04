# CREVIS Demo Script

**Total Time:** ~4.5 minutes

## Prerequisite (Before the Call)
- Ensure your database has at least 1 user/seller.
- Run `npx tsx scripts/seed_products.ts` to populate the 5 beautiful dummy products.
- Ensure your `.env.local` contains valid Razorpay (Test Mode) keys.
- Ensure your Telegram bot Webhook is routed using `npx tsx scripts/register_webhook.ts <YOUR_VERCEL_URL>/api/webhooks/telegram`.

## Introduction (0:30)
*“Welcome to Crevis - a platform designed to let high-end sellers list their goods on the web, but transact directly where the buyers are. Today, I'll walk you through the seller setup, and then we'll buy a beautiful vintage watch over Telegram.”*

## 1. Seller Onboarding & Wallet (1:30)
1. **Open dashboard:** Navigate to the production Vercel URL.
2. **Onboarding:** Show the clean UI. Sign in, set the shop name (e.g. *Bombay Curations*).
3. **Slack Setup:** Click "Connect Slack" and authorize using your workspace to demonstrate direct seller notifications.
4. **Credits (The 'Aha' platform economics moment):**
   - Head to the 'Claim your credits' page.
   - Enter `CREVIS100`.
   - **Click Redeem.** Wait for the Confetti!
   - Highlight the wallet balance (100 credits = 100 listings) dynamically appearing via our real-time database.

## 2. Inventory Management (1:00)
1. **Products Page:** Show the beautifully seeded items. Hover over the items to show the smooth `-4px translate Y` interactive animation.
2. **Badges:** Point out the "Boosted (10 C)" badge on the *Vintage OMEGA Seamaster Watch*.
3. **Add Product:** Open the "Add Product" flow, upload a quick picture or drop an image, and publish it. Let the `toast.success` notification pop cleanly at the bottom right.

## 3. The Buyer Experience (Telegram) (1:00)
1. **Share screen on Telegram Desktop.**
2. **Start the bot:** Send `/start`.
3. **Browse:** Click "🛍 Browse Products".
   - Show how the *Vintage OMEGA Seamaster Watch* appears first because it was boosted.
4. **Search:** Click "🔍 Search" and type "Vintage". Show the lightning-fast matching.
5. **Buy Flow:**
   - Click **Buy Now** on the watch.
   - The bot instantly returns the Razorpay Payment link.
   - **Click the link & Pay:** Complete a ₹1 test order inside Razorpay overlay.

## 4. The Slack Climax (0:30)
1. **Immediate Flip to Slack:** As soon as the Razorpay payment succeeds, swap to your Slack workspace.
2. Show the channel where the notification *just* popped in:
   `🛍 New order — Vintage OMEGA Seamaster Watch ₹45000 from <Buyer_Name>...`
3. Point out that the seller didn't even have to open a dashboard to know they just made a ₹45000 sale.

## Wrap Up (0:00)
*“And that is Crevis. Lightning-fast seller publishing, native platform tokenomics, and frictionless buyer conversion.”*
