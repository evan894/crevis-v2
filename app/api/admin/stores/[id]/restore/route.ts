import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('x-admin-token');
    if (authHeader !== process.env.ADMIN_SECRET_TOKEN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: sellerId } = params;

    // Fetch the seller to get the snapshot and current balance
    const { data: seller, error: sellerError } = await supabaseAdmin
      .from('sellers')
      .select('deactivated_snapshot, credit_balance, deactivated')
      .eq('id', sellerId)
      .single();

    if (sellerError || !seller) {
      return NextResponse.json({ error: sellerError?.message || 'Seller not found' }, { status: 404 });
    }

    if (!seller.deactivated) {
      return NextResponse.json({ error: 'Store is not deactivated' }, { status: 400 });
    }

    // 1. Restore products
    const productIds: string[] = seller.deactivated_snapshot?.product_ids || [];
    if (productIds.length > 0) {
      await supabaseAdmin
        .from('products')
        .update({ active: true })
        .in('id', productIds);
    }

    // 2. Reset balance and remove deactivation flags
    const refundAmount = seller.credit_balance < 0 ? Math.abs(seller.credit_balance) : 0;
    
    // We update the seller record directly to wipe away the negative balance 
    // and clear the deactivated markers
    const { error: updateError } = await supabaseAdmin
      .from('sellers')
      .update({
        deactivated: false,
        deactivated_at: null,
        deactivated_snapshot: null,
        grace_period_started_at: null,
      })
      .eq('id', sellerId);

    if (updateError) {
      throw updateError;
    }

    // Adjust promo credits to ensure balance constraint (bonus: add it as a ledger entry)
    if (refundAmount > 0) {
      // Actually, since we didn't update earned/promo fields above directly to arbitrary values, we should just rely on the RPC or raw sql to fix the mismatch if we want.
      // But let's do an RPC call to `add_credits` to properly restore the balance to 0 and log it, rather than direct update.
      await supabaseAdmin.rpc('add_credits', {
        p_seller_id: sellerId,
        p_amount: refundAmount,
        p_action: 'admin_restore',
        p_credit_type: 'promo',
        p_note: 'Admin restored store (balance forgiven)'
      });
    }

    return NextResponse.json({ success: true, message: 'Store restored successfully', products_restored: productIds.length });
  } catch (err: unknown) {
    console.error('[restore handler error]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
