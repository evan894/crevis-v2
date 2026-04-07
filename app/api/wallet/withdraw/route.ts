import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@/lib/supabase-server';
import { deductCredits } from '@/lib/credits';
import { sendSlackDM } from '@/lib/slack';

export const dynamic = 'force-dynamic';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;
const MIN_WITHDRAWAL_INR = 100;

function razorpayHeaders() {
  const token = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${token}`,
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { amount } = body; // amount in INR (= credits, 1:1)

    if (!amount || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (amount < MIN_WITHDRAWAL_INR) {
      return NextResponse.json({ error: `Minimum withdrawal is ₹${MIN_WITHDRAWAL_INR}` }, { status: 400 });
    }

    // --- Get seller ---
    const { data: member } = await supabaseAdmin
      .from('store_members')
      .select('role, seller_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    let sellerId: string | null = null;
    let isOwner = false;

    if (member?.role === 'owner') {
      sellerId = member.seller_id;
      isOwner = true;
    } else {
      // Check if they own a store directly
      const { data: directSeller } = await supabaseAdmin
        .from('sellers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (directSeller) {
        sellerId = directSeller.id;
        isOwner = true;
      }
    }

    if (!isOwner || !sellerId) {
      return NextResponse.json({ error: 'Only store owners can withdraw' }, { status: 403 });
    }

    // --- Check seller earned credits ---
    const { data: seller } = await supabaseAdmin
      .from('sellers')
      .select('earned_credits, slack_user_id, slack_access_token, shop_name')
      .eq('id', sellerId)
      .single();

    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

    if (seller.earned_credits < amount) {
      return NextResponse.json({
        error: `Insufficient earned credits. You have ${seller.earned_credits} CC available.`
      }, { status: 400 });
    }

    // --- Check verified bank account ---
    const { data: bankAccount } = await supabaseAdmin
      .from('seller_bank_accounts')
      .select('id, razorpay_fund_account_id, verified, account_holder_name')
      .eq('seller_id', sellerId)
      .maybeSingle();

    if (!bankAccount) {
      return NextResponse.json({ error: 'No bank account found. Add one in Settings.' }, { status: 400 });
    }
    if (!bankAccount.verified) {
      return NextResponse.json({ error: 'Bank account verification is pending.' }, { status: 400 });
    }
    if (!bankAccount.razorpay_fund_account_id) {
      return NextResponse.json({ error: 'Bank account is not linked to Razorpay.' }, { status: 400 });
    }

    // --- Deduct earned credits (1 CC = ₹1) ---
    const amountInr = amount; // 1:1 ratio
    await deductCredits(
      sellerId,
      amount,
      'withdrawal',
      `Withdrawal of ₹${amountInr}`,
      undefined,
      undefined,
      'earned'
    );

    // --- Trigger Razorpay Payout ---
    let razorpayPayoutId: string | null = null;
    let payoutStatus = 'pending';

    try {
      const payoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
        method: 'POST',
        headers: razorpayHeaders(),
        body: JSON.stringify({
          account_number: process.env.RAZORPAY_ACCOUNT_NUMBER || '',
          fund_account_id: bankAccount.razorpay_fund_account_id,
          amount: amountInr * 100, // paise
          currency: 'INR',
          mode: 'IMPS',
          purpose: 'payout',
          queue_if_low_balance: true,
          reference_id: `withdrawal_${sellerId}_${Date.now()}`,
          narration: `Crevis earnings for ${seller.shop_name}`,
        }),
      });

      if (payoutRes.ok) {
        const payout = await payoutRes.json();
        razorpayPayoutId = payout.id;
        payoutStatus = payout.status === 'processed' ? 'completed' : 'processing';
      } else {
        const errBody = await payoutRes.json();
        console.error('[withdraw] Razorpay payout error:', errBody);
        payoutStatus = 'failed';
      }
    } catch (payoutErr) {
      console.error('[withdraw] Payout network error:', payoutErr);
      payoutStatus = 'failed';
    }

    // --- Insert withdrawal record ---
    const { data: withdrawal, error: wError } = await supabaseAdmin
      .from('withdrawals')
      .insert({
        seller_id: sellerId,
        amount_credits: amount,
        amount_inr: amountInr,
        status: payoutStatus,
        razorpay_payout_id: razorpayPayoutId,
      })
      .select()
      .single();

    if (wError) console.error('[withdraw] Insert withdrawal error:', wError.message);

    // --- Slack notification ---
    try {
      if (seller.slack_user_id && seller.slack_access_token) {
        const statusMsg = payoutStatus === 'failed'
          ? `⚠️ Withdrawal of ₹${amountInr} was initiated but payout failed. Please contact support.`
          : `💸 Withdrawal of ₹${amountInr} initiated. Expected in 1-2 business days.`;

        await sendSlackDM(seller.slack_access_token, seller.slack_user_id, statusMsg);
      }
    } catch (slackErr) {
      console.error('[withdraw] Slack DM error:', slackErr);
    }

    return NextResponse.json({
      success: true,
      withdrawal: withdrawal ?? null,
      status: payoutStatus,
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error('[withdraw] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
