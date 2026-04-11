import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAuth } from '@/lib/auth';
import { deductCredits } from '@/lib/credits';
import { sendSlackDM } from '@/lib/slack';
import { createPayout } from '@/lib/razorpay';

export const dynamic = 'force-dynamic';

const MIN_WITHDRAWAL_INR = 100;

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
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
    await deductCredits(
      sellerId,
      amount,
      'withdrawal',
      `Withdrawal of ₹${amount}`,
      undefined,
      undefined,
      'earned'
    );

    // --- Trigger Razorpay Payout ---
    const { id: razorpayPayoutId, status: payoutStatus } = await createPayout({
      payoutAccountNumber: process.env.RAZORPAY_ACCOUNT_NUMBER || '',
      fundAccountId: bankAccount.razorpay_fund_account_id,
      amountInr: amount,
      sellerId,
      shopName: seller.shop_name,
    });

    // --- Insert withdrawal record ---
    const { data: withdrawal, error: wError } = await supabaseAdmin
      .from('withdrawals')
      .insert({
        seller_id: sellerId,
        amount_credits: amount,
        amount_inr: amount,
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
          ? `⚠️ Withdrawal of ₹${amount} was initiated but payout failed. Please contact support.`
          : `💸 Withdrawal of ₹${amount} initiated. Expected in 1-2 business days.`;

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
