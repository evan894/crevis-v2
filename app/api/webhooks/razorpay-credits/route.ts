import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { addCredits } from '@/lib/credits';
import { sendSlackDM } from '@/lib/slack';
import { SLACK_MESSAGES } from '@/lib/constants';

import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET!;

    if (!signature) {
      console.error('[Razorpay Credits Webhook] Missing signature');
      return new NextResponse('OK', { status: 200 });
    }

    try {
      const isValid = validateWebhookSignature(bodyText, signature, secret);
      if (!isValid) {
        console.error('[Razorpay Credits Webhook] Signature mismatch');
        return new NextResponse('OK', { status: 200 });
      }
    } catch (err) {
      console.error('[Razorpay Credits Webhook] Signature verification failed', err);
      return new NextResponse('OK', { status: 200 });
    }

    const event = JSON.parse(bodyText);

    if (event.event !== 'payment.captured' && event.event !== 'payment_link.paid') {
      return new NextResponse('OK', { status: 200 });
    }

    const payment = event.payload.payment?.entity || event.payload.payment_link?.entity;
    if (!payment) return new NextResponse('OK', { status: 200 });

    const razorpay_order_id = payment.order_id || (payment.notes?.order_id);
    // const razorpay_payment_id = payment.id || (payment.order_id ? null : payment.id);

    if (!razorpay_order_id) {
       console.error('[Razorpay Credits Webhook] Missing order_id in payload');
       return new NextResponse('OK', { status: 200 });
    }

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('credit_purchases')
      .select('*, sellers (id, slack_user_id, slack_access_token)')
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (purchaseError || !purchase) {
      console.error(`[Razorpay Credits Webhook] Purchase record missing for order: ${razorpay_order_id}`);
      return new NextResponse('OK', { status: 200 });
    }

    if (purchase.status === 'completed') {
      return new NextResponse('OK', { status: 200 });
    }

    // Mark as completed
    await supabaseAdmin
      .from('credit_purchases')
      .update({ status: 'completed', razorpay_payment_id: payment.id })
      .eq('id', purchase.id);

    // Call addCredits via RPC
    const newBalance = await addCredits(
      purchase.seller_id, 
      purchase.credits_added, 
      'credit_purchase',
      'promo', 
      `Razorpay txn: ${payment.id}`
    );

    const seller = purchase.sellers;
    if (seller && !Array.isArray(seller)) {
      const s = seller as { slack_access_token?: string; slack_user_id?: string };
      if (s.slack_access_token && s.slack_user_id) {
          try {
              await sendSlackDM(
                  s.slack_access_token,
                  s.slack_user_id,
                  SLACK_MESSAGES.walletRecharged(purchase.credits_added, newBalance as number)
              );
          } catch (slackErr) {
              console.error(`Slack notification failed [Credit Purchase]`, slackErr);
          }
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('[Razorpay Credits Webhook] Unknown Error:', error);
    return new NextResponse('OK', { status: 200 });
  }
}
