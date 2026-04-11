import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAuth } from '@/lib/auth';
import { sendSlackDM } from '@/lib/slack';
import {
  createRazorpayContact,
  createFundAccount,
  validateFundAccount,
} from '@/lib/razorpay';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { sellerId, accountHolderName, accountNumber, ifsc, accountType, bankName } = body;

    if (!sellerId || !accountHolderName || !accountNumber || !ifsc || !accountType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify this is the seller owner
    const { data: member } = await supabaseAdmin
      .from('store_members')
      .select('role')
      .eq('seller_id', sellerId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const { data: sellerOwner } = await supabaseAdmin
      .from('sellers')
      .select('id, user_id')
      .eq('id', sellerId)
      .single();

    const isOwner = member?.role === 'owner' || sellerOwner?.user_id === user.id;
    if (!isOwner) {
      return NextResponse.json({ error: 'Only owners can manage bank accounts' }, { status: 403 });
    }

    // Upsert bank account in db first
    const { error: upsertError } = await supabaseAdmin
      .from('seller_bank_accounts')
      .upsert({
        seller_id: sellerId,
        account_holder_name: accountHolderName,
        account_number: accountNumber,
        ifsc_code: ifsc,
        account_type: accountType,
        bank_name: bankName || null,
        verified: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'seller_id' });

    if (upsertError) throw new Error(upsertError.message);

    // Create contact → fund account → penny-drop validation
    const contactId = await createRazorpayContact(sellerId, accountHolderName);
    let fundAccountId: string | null = null;

    if (contactId) {
      fundAccountId = await createFundAccount(contactId, accountHolderName, ifsc, accountNumber);

      if (fundAccountId) {
        const payoutAccountNumber = process.env.RAZORPAY_ACCOUNT_NUMBER || '';
        const verified = await validateFundAccount(fundAccountId, payoutAccountNumber);

        if (verified) {
          await supabaseAdmin
            .from('seller_bank_accounts')
            .update({
              verified: true,
              razorpay_fund_account_id: fundAccountId,
              updated_at: new Date().toISOString(),
            })
            .eq('seller_id', sellerId);
        }
      }
    }

    // Fetch seller for Slack notification
    const { data: seller } = await supabaseAdmin
      .from('sellers')
      .select('shop_name, slack_user_id, slack_access_token')
      .eq('id', sellerId)
      .single();

    if (seller?.slack_user_id && seller?.slack_access_token) {
      await sendSlackDM(
        seller.slack_access_token,
        seller.slack_user_id,
        '✅ Bank account verified successfully. You can now withdraw your earnings.'
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[bank/verify] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
