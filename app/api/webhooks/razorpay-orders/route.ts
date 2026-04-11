import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { deductCredits, deactivateSellerListings } from '@/lib/credits';
import { sendSlackDM } from '@/lib/slack';
import { Telegraf } from 'telegraf';
import { PLATFORM_FEE_PERCENT, LOW_CREDIT_THRESHOLD, SLACK_MESSAGES } from '@/lib/constants';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET!;

    if (!signature) {
      console.error('[Razorpay Orders Webhook] Missing signature');
      return NextResponse.json({ received: true });
    }

    try {
      const isValid = validateWebhookSignature(rawBody, signature, secret);
      if (!isValid) {
        console.error('[Razorpay Orders Webhook] Signature mismatch');
        return NextResponse.json({ received: true });
      }
    } catch (err) {
      console.error('[Razorpay Orders Webhook] Signature verification failed', err);
      return NextResponse.json({ received: true });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'payment_link.paid' || event.event === 'payment.captured') {
       const payload = event.payload.payment_link?.entity || event.payload.payment?.entity;
       if (!payload) return NextResponse.json({ received: true });
       
       const notes = payload.notes || {};
       const productId = notes.product_id;
       const buyerTelegramId = notes.buyer_telegram_id;
       const paymentId = payload.id;

       // Find pending order
       let orderQuery = supabase.from('orders').select('*, products(name), sellers(shop_name, slack_user_id, slack_access_token)').eq('status', 'pending');
       if (productId && buyerTelegramId) {
          orderQuery = orderQuery.eq('product_id', productId).eq('buyer_telegram_id', buyerTelegramId);
       } else {
          orderQuery = orderQuery.eq('razorpay_payment_id', paymentId);
       }
       
       const { data: orders, error: orderErr } = await orderQuery.limit(1);

       if (orderErr || !orders || orders.length === 0) {
          console.error("No pending order found for webhook", orderErr);
          return NextResponse.json({ received: true });
       }

       const order = orders[0];
       const fee = Math.ceil(order.amount * PLATFORM_FEE_PERCENT);

       // 1. Update order status
       const returnWindowClosesAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
       await supabase.from('orders').update({
           status: 'completed',
           razorpay_payment_id: paymentId,
           platform_fee: fee,
           credits_deducted: fee,
           return_window_closes_at: returnWindowClosesAt,
           credits_released: false
       }).eq('id', order.id);

       // 1a. Deduct stock and check auto-unlist
       if (order.product_id) {
           const { data: product } = await supabase.from('products').select('*').eq('id', order.product_id).single();
           if (product) {
               let updatedStock = product.stock;
               let updatedVariants = product.variants;
               
               interface VariantOption { label: string; stock: number }

               if (product.has_variants && product.variants && order.selected_variant) {
                   // safely cast knowing the structure
                   const productVariants = product.variants as unknown as { type: string; options: VariantOption[] };
                   const options = productVariants.options;
                   const targetOption = options.find((o) => o.label === order.selected_variant);
                   if (targetOption && targetOption.stock > 0) {
                       targetOption.stock -= 1;
                   }
                   updatedStock = options.reduce((sum, opt) => sum + opt.stock, 0);
                   // eslint-disable-next-line @typescript-eslint/no-explicit-any
                   updatedVariants = { type: 'size', options } as unknown as any;
               } else if (!product.has_variants) {
                   updatedStock = Math.max(0, product.stock - 1);
               }

               // Set active to false if stock hits 0
               const active = updatedStock > 0 ? product.active : false;
               
               await supabase.from('products').update({ 
                   stock: updatedStock, 
                   variants: updatedVariants,
                   active 
               }).eq('id', order.product_id);
           }
       }

       // 1b. Auto-create delivery_orders record (pending) if not already present
       await supabase.from('delivery_orders').upsert(
           { order_id: order.id, status: 'pending' },
           { onConflict: 'order_id', ignoreDuplicates: true }
       );

       // 2. Deduct platform fee (5%)
       let newBalance: number | null = null;
       try {
           newBalance = await deductCredits(
               order.seller_id as string, 
               fee, 
               'order_fee', 
               `5% fee for ${Array.isArray(order.products) ? order.products[0]?.name : order.products?.name}`,
               order.amount,
               order.id
           );
           
           if (typeof newBalance === 'number' && newBalance <= 0) {
               await deactivateSellerListings(order.seller_id as string);
           }
       } catch (feeError) {
           console.error("Fee deduction error:", feeError);
       }
       
       // 3. Send Telegram confirmation
       const productName = Array.isArray(order.products) ? order.products[0]?.name : order.products?.name;
       const shopName = Array.isArray(order.sellers) ? order.sellers[0]?.shop_name : order.sellers?.shop_name;
       const slackAccessToken = Array.isArray(order.sellers) ? order.sellers[0]?.slack_access_token : order.sellers?.slack_access_token;
       const slackUserId = Array.isArray(order.sellers) ? order.sellers[0]?.slack_user_id : order.sellers?.slack_user_id;
       
       try {
            await bot.telegram.sendMessage(
               order.buyer_telegram_id,
                `✅ Order placed! ${productName} from ${shopName}.\n\nYou have 2 days to request a return if needed.\nYou'll receive updates here as your order is packed and delivered.\nKeep this chat open — your OTP for delivery confirmation will be sent when your order is packed.`,
               {
                 reply_markup: {
                   inline_keyboard: [
                     [{ text: 'Request Return', callback_data: `return_order_${order.id}` }]
                   ]
                 }
               }
            );
       } catch (tgErr) {
           console.error("Buyer telegram notification failed", tgErr);
       }

       // 4. Send Slack notification(s)
       if (slackAccessToken && slackUserId) {
           try {
               await sendSlackDM(
                   slackAccessToken,
                   slackUserId,
                   SLACK_MESSAGES.newOrder(productName as string, order.amount, order.buyer_name, fee)
               );
           } catch (slackErr) {
               console.error(`Slack notification failed [New Order] [seller_id: ${order.seller_id}]:`, slackErr);
           }

           if (typeof newBalance === 'number') {
               if (newBalance <= 0) {
                   try {
                       await sendSlackDM(
                           slackAccessToken,
                           slackUserId,
                           SLACK_MESSAGES.deactivated()
                       );
                   } catch (slackErr) {
                       console.error(`Slack notification failed [Zero Credits] [seller_id: ${order.seller_id}]:`, slackErr);
                   }
               } else if (newBalance < LOW_CREDIT_THRESHOLD) {
                   try {
                       await sendSlackDM(
                           slackAccessToken,
                           slackUserId,
                           SLACK_MESSAGES.lowCredits(newBalance)
                       );
                   } catch (slackErr) {
                       console.error(`Slack notification failed [Low Credits] [seller_id: ${order.seller_id}]:`, slackErr);
                   }
               }
           }
       }
    }

    return NextResponse.json({ received: true });

  } catch (err: unknown) {
    console.error("Webhook error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
