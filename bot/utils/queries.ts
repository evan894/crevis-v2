import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

type Supabase = SupabaseClient<Database>;

// ── Base product query (boosted first, then newest) ──────────────────────────

export const buildProductQuery = (supabase: Supabase, storeContext: string | null) => {
  let query = supabase
    .from('products')
    .select('*, sellers(shop_name)')
    .eq('active', true)
    .order('boosted', { ascending: false })
    .order('created_at', { ascending: false });

  if (storeContext) {
    query = query.eq('seller_id', storeContext);
  }

  return query;
};

// ── Buyer ─────────────────────────────────────────────────────────────────────

export async function findBuyer(supabase: Supabase, telegramId: string) {
  const { data } = await supabase
    .from('buyers')
    .select('id')
    .eq('telegram_id', telegramId)
    .single();
  return data;
}

export async function upsertBuyer(
  supabase: Supabase,
  telegramId: string,
  firstName: string | null,
  username: string | null
) {
  await supabase.from('buyers').insert({
    telegram_id: telegramId,
    first_name: firstName,
    username: username,
  });
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProductById(supabase: Supabase, productId: string) {
  const { data } = await supabase
    .from('products')
    .select('*, sellers(shop_name, id)')
    .eq('id', productId)
    .eq('active', true)
    .single();
  return data;
}

export async function getProductVariants(supabase: Supabase, productId: string) {
  const { data } = await supabase
    .from('products')
    .select('has_variants, variants')
    .eq('id', productId)
    .single();
  return data;
}

export async function getActiveProductsForSearch(
  supabase: Supabase,
  storeContext: string | null
) {
  let query = supabase
    .from('products')
    .select('id, name, description, category, price')
    .eq('active', true);

  if (storeContext) {
    query = query.eq('seller_id', storeContext);
  }

  const { data } = await query;
  return data ?? [];
}

// ── Sellers ───────────────────────────────────────────────────────────────────

export async function getSellerBySlug(supabase: Supabase, shopSlug: string) {
  const { data } = await supabase
    .from('sellers')
    .select('id, shop_name')
    .eq('shop_slug', shopSlug)
    .single();
  return data;
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function getBuyerOrders(supabase: Supabase, telegramId: string) {
  const { data } = await supabase
    .from('orders')
    .select('amount, status, created_at, products(name)')
    .eq('buyer_telegram_id', telegramId)
    .order('created_at', { ascending: false })
    .limit(10);
  return data ?? [];
}

export async function getOrderForReturn(supabase: Supabase, orderId: string) {
  const { data } = await supabase
    .from('orders')
    .select('return_window_closes_at, return_requested')
    .eq('id', orderId)
    .single();
  return data;
}

export async function getOrderWithRelations(supabase: Supabase, orderId: string) {
  const { data } = await supabase
    .from('orders')
    .select('*, products(name), sellers(slack_access_token, slack_user_id)')
    .eq('id', orderId)
    .single();
  return data;
}

export async function markReturnRequested(
  supabase: Supabase,
  orderId: string,
  reason: string
) {
  await supabase
    .from('orders')
    .update({
      return_requested: true,
      return_requested_at: new Date().toISOString(),
      return_reason: reason,
    })
    .eq('id', orderId);
}
