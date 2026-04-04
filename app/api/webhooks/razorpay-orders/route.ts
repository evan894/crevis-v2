import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { deductCredits, deactivateSellerListings } from '@/lib/credits';
import { slackAdmin } from '@/lib/slack';
import { Telegraf } from 'telegraf';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET!;

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'payment_link.paid' || event.event === 'payment.captured') {
       const payload = event.payload.payment_link?.entity || event.payload.payment?.entity;
       if (!payload) return NextResponse.json({ received: true });
       
       const notes = payload.notes || {};
       const productId = notes.product_id;
       const buyerTelegramId = notes.buyer_telegram_id;
       const sellerId = notes.seller_id;
       const paymentId = payload.id;
       const refId = payload.reference_id || payload.description;

       // Find pending order
       let orderQuery = supabase.from('orders').select('*, products(name), sellers(shop_name, slack_user_id)').eq('status', 'pending');
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
       const fee = Math.ceil(order.amount * 0.05);

       // 1. Update order status
       await supabase.from('orders').update({
           status: 'completed',
           razorpay_payment_id: paymentId,
           platform_fee: fee,
           credits_deducted: fee
       }).eq('id', order.id);

       // 2. Deduct platform fee (5%)
       try {
           const new_balance = await deductCredits(
               order.seller_id as string, 
               fee, 
               'order_fee', 
               `5% fee for ${Array.isArray(order.products) ? order.products[0]?.name : order.products?.name}`,
               order.amount,
               order.id
           );
           
           if (typeof new_balance === 'number' && new_balance <= 0) {
               await deactivateSellerListings(order.seller_id as string);
           }
       } catch (feeError) {
           console.error("Fee deduction error:", feeError);
       }
       
       // 3. Send Telegram confirmation
       const productName = Array.isArray(order.products) ? order.products[0]?.name : order.products?.name;
       const shopName = Array.isArray(order.sellers) ? order.sellers[0]?.shop_name : order.sellers?.shop_name;
       const slackUserId = Array.isArray(order.sellers) ? order.sellers[0]?.slack_user_id : order.sellers?.slack_user_id;
       
       try {
           await bot.telegram.sendMessage(
              order.buyer_telegram_id,
              `✅ Order placed! ${productName} from ${shopName}. Thank you!`
           );
       } catch (tgErr) {
           console.error("Buyer telegram notification failed", tgErr);
       }

       // 4. Send Slack notification
       if (slackUserId) {
           try {
               await slackAdmin.chat.postMessage({
                   channel: slackUserId,
                   text: `🎉 New Order Received! ₹${order.amount} for ${productName}\nBuyer: ${order.buyer_name}`
               });
           } catch (slackErr) {
               console.error("Slack notification failed", slackErr);
           }
       }
    }

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
