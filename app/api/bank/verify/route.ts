import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@/lib/supabase-server';
import { sendSlackDM } from '@/lib/slack';

export const dynamic = 'force-dynamic';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

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

    // Step 1: Create Razorpay Contact
    const contactRes = await fetch('https://api.razorpay.com/v1/contacts', {
      method: 'POST',
      headers: razorpayHeaders(),
      body: JSON.stringify({
        name: accountHolderName,
        type: 'vendor',
        reference_id: sellerId,
      }),
    });

    let fundAccountId: string | null = null;

    if (contactRes.ok) {
      const contact = await contactRes.json();
      const contactId = contact.id;

      // Step 2: Create Fund Account
      const fundRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
        method: 'POST',
        headers: razorpayHeaders(),
        body: JSON.stringify({
          contact_id: contactId,
          account_type: 'bank_account',
          bank_account: {
            name: accountHolderName,
            ifsc,
            account_number: accountNumber,
          },
        }),
      });

      if (fundRes.ok) {
        const fundAccount = await fundRes.json();
        fundAccountId = fundAccount.id;

        // Step 3: Penny drop validation
        const verifyRes = await fetch('https://api.razorpay.com/v1/fund_accounts/validations', {
          method: 'POST',
          headers: razorpayHeaders(),
          body: JSON.stringify({
            account_number: process.env.RAZORPAY_ACCOUNT_NUMBER || '',
            fund_account: { id: fundAccountId },
            amount: 100, // ₹1 in paise
            currency: 'INR',
            notes: { purpose: 'bank_verification' },
          }),
        });

        if (verifyRes.ok) {
          // Mark as verified
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
