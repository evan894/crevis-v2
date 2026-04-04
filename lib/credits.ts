import { supabaseAdmin } from './supabase';

type CreditAction = 'listing' | 'boost' | 'order_fee' | 'credit_purchase' | 'coupon';

export async function deductCredits(
  sellerId: string,
  amount: number,
  action: CreditAction,
  note?: string,
  orderValue?: number,
  orderId?: string
) {
  const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
    p_seller_id: sellerId,
    p_amount: amount,
    p_action: action,
    p_note: note,
    p_order_value: orderValue,
    p_order_id: orderId,
  });
  if (error) throw error;
  return data;
}

export async function addCredits(
  sellerId: string,
  amount: number,
  action: CreditAction,
  note?: string
) {
  const { data, error } = await supabaseAdmin.rpc('add_credits', {
    p_seller_id: sellerId,
    p_amount: amount,
    p_action: action,
    p_note: note,
  });
  if (error) throw error;
  return data;
}

export async function redeemCoupon(sellerId: string, code: string) {
  const { data, error } = await supabaseAdmin.rpc('redeem_coupon', {
    p_seller_id: sellerId,
    p_code: code,
  });
  if (error) throw error;
  return data;
}

export async function deactivateSellerListings(sellerId: string) {
  const { data, error } = await supabaseAdmin.rpc('deactivate_seller_listings', {
    p_seller_id: sellerId,
  });
  if (error) throw error;
  return data;
}
