import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendSlackDM } from '@/lib/slack';

import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      console.error('RAZORPAY_WEBHOOK_SECRET and RAZORPAY_KEY_SECRET both missing');
      return NextResponse.json({ error: 'Config error' }, { status: 200 });
    }

    if (!signature) {
      console.error('[Razorpay Payout Webhook] Missing signature');
      return NextResponse.json({ received: true });
    }

    try {
      const isValid = validateWebhookSignature(body, signature, secret);
      if (!isValid) {
        console.warn('[Razorpay Payout Webhook] Signature mismatch');
        return NextResponse.json({ received: true });
      }
    } catch (err) {
      console.error('[Razorpay Payout Webhook] Signature verification failed', err);
      return NextResponse.json({ received: true });
    }

    const payload = JSON.parse(body);
    const event = payload.event;
    const payout = payload.payload.payout.entity;

    console.info(`[Razorpay Payout Webhook] Received ${event} for payout ${payout.id}`);

    // Fetch withdrawal by razorpay_payout_id
    const { data: withdrawal, error: fetchError } = await supabaseAdmin
      .from('withdrawals')
      .select('*, sellers(shop_name, slack_access_token, slack_user_id)')
      .eq('razorpay_payout_id', payout.id)
      .single();

    if (fetchError || !withdrawal) {
      console.warn(`[Razorpay Webhook] Withdrawal ${payout.id} not found in DB`);
      return NextResponse.json({ received: true });
    }

    if (withdrawal.status === 'completed' || withdrawal.status === 'failed') {
      console.info(`[Razorpay Webhook] Payout ${payout.id} already in final state: ${withdrawal.status}`);
      return NextResponse.json({ received: true });
    }

    let nextStatus = withdrawal.status;
    let failureReason = null;

    if (event === 'payout.processed') {
      nextStatus = 'completed';
    } else if (event === 'payout.failed' || event === 'payout.rejected' || event === 'payout.reversed') {
      nextStatus = 'failed';
      failureReason = payout.status_details?.reason || payout.failure_reason || 'Payout failed';
    }

    if (nextStatus !== withdrawal.status) {
      await supabaseAdmin
        .from('withdrawals')
        .update({
          status: nextStatus,
          failure_reason: failureReason,
          completed_at: nextStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', withdrawal.id);

      // Notify seller via Slack
      const seller = withdrawal.sellers as unknown as { slack_access_token?: string; slack_user_id?: string } | null;
      if (seller?.slack_access_token && seller?.slack_user_id) {
        let message = '';
        if (nextStatus === 'completed') {
          message = `✅ Your withdrawal of ₹${withdrawal.amount_inr} has been successfully credited to your bank account.`;
        } else if (nextStatus === 'failed') {
          message = `❌ Your withdrawal of ₹${withdrawal.amount_inr} failed: ${failureReason}. The credits have NOT been refunded yet; please contact support.`;
        }

        if (message) {
          await sendSlackDM(seller.slack_access_token, seller.slack_user_id, message);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('[Razorpay Webhook Error]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
