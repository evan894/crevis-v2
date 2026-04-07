import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';
import { addCredits } from '@/lib/credits';
import { sendSlackDM } from '@/lib/slack';
import { SLACK_MESSAGES } from '@/lib/constants';
// No service role imported from lib
// Let me use standard pattern from other webhooks.

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      console.error('[Razorpay Credits Webhook] Missing signature');
      return new NextResponse('OK', { status: 200 }); // Always 200
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(bodyText)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('[Razorpay Credits Webhook] Invalid signature');
      return new NextResponse('OK', { status: 200 });
    }

    const event = JSON.parse(bodyText);

    if (event.event !== 'payment.captured') {
      return new NextResponse('OK', { status: 200 });
    }

    const payment = event.payload.payment.entity;
    const razorpay_order_id = payment.order_id;
    const razorpay_payment_id = payment.id;

    const cookieStore = cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Webhooks must use service role
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value; },
          set() { },
          remove() { }
        }
      }
    );

    const { data: purchase, error: purchaseError } = await supabase
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
    await supabase
      .from('credit_purchases')
      .update({ status: 'completed', razorpay_payment_id })
      .eq('id', purchase.id);

    // Call addCredits via RPC
    const newBalance = await addCredits(
      purchase.seller_id, 
      purchase.credits_added, 
      'credit_purchase',
      'promo', 
      `Razorpay txn: ${razorpay_payment_id}`
    );

    const seller = purchase.sellers;
    if (seller && Array.isArray(seller) ? false : seller) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = seller as any;
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
