import Razorpay from 'razorpay';

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ── Payout API helpers (raw fetch — not available in razorpay npm SDK) ──────

function razorpayAuthHeader(): string {
  const token = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');
  return `Basic ${token}`;
}

function rzpHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: razorpayAuthHeader(),
  };
}

/** Create a Razorpay Contact for a seller. Returns the contact ID or null. */
export async function createRazorpayContact(
  sellerId: string,
  name: string
): Promise<string | null> {
  const res = await fetch('https://api.razorpay.com/v1/contacts', {
    method: 'POST',
    headers: rzpHeaders(),
    body: JSON.stringify({ name, type: 'vendor', reference_id: sellerId }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.id ?? null;
}

/** Create a Fund Account linked to a contact. Returns fund account ID or null. */
export async function createFundAccount(
  contactId: string,
  holderName: string,
  ifsc: string,
  accountNumber: string
): Promise<string | null> {
  const res = await fetch('https://api.razorpay.com/v1/fund_accounts', {
    method: 'POST',
    headers: rzpHeaders(),
    body: JSON.stringify({
      contact_id: contactId,
      account_type: 'bank_account',
      bank_account: { name: holderName, ifsc, account_number: accountNumber },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.id ?? null;
}

/**
 * Initiate a ₹1 penny-drop validation for a fund account.
 * Returns true if the validation request was accepted by Razorpay.
 */
export async function validateFundAccount(
  fundAccountId: string,
  payoutAccountNumber: string
): Promise<boolean> {
  const res = await fetch('https://api.razorpay.com/v1/fund_accounts/validations', {
    method: 'POST',
    headers: rzpHeaders(),
    body: JSON.stringify({
      account_number: payoutAccountNumber,
      fund_account: { id: fundAccountId },
      amount: 100, // ₹1 in paise
      currency: 'INR',
      notes: { purpose: 'bank_verification' },
    }),
  });
  return res.ok;
}

export interface PayoutResult {
  id: string | null;
  status: 'completed' | 'processing' | 'failed';
}

/** Trigger an IMPS payout to a verified fund account. */
export async function createPayout(params: {
  payoutAccountNumber: string;
  fundAccountId: string;
  amountInr: number;
  sellerId: string;
  shopName: string;
}): Promise<PayoutResult> {
  const { payoutAccountNumber, fundAccountId, amountInr, sellerId, shopName } = params;
  try {
    const res = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: rzpHeaders(),
      body: JSON.stringify({
        account_number: payoutAccountNumber,
        fund_account_id: fundAccountId,
        amount: amountInr * 100,
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: `withdrawal_${sellerId}_${Date.now()}`,
        narration: `Crevis earnings for ${shopName}`,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('[razorpay] createPayout error:', err);
      return { id: null, status: 'failed' };
    }
    const payout = await res.json();
    return {
      id: payout.id ?? null,
      status: payout.status === 'processed' ? 'completed' : 'processing',
    };
  } catch (err) {
    console.error('[razorpay] createPayout network error:', err);
    return { id: null, status: 'failed' };
  }
}
