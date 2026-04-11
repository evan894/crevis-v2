import { NextResponse } from 'next/server';
import { razorpay } from '@/lib/razorpay';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  shopName: string;
}

export async function POST(request: Request) {
  try {
    const { cartItems, buyerTelegramId, buyerPhone, prescriptionFileId } = await request.json();

    if (!cartItems?.length || !buyerTelegramId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: buyer } = await supabase
      .from('buyers')
      .select('id, first_name')
      .eq('telegram_id', buyerTelegramId)
      .single();

    if (!buyer) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 });
    }

    const productIds = cartItems.map((item: CartItem) => item.productId);
    const { data: products } = await supabase
      .from('products')
      .select('id, seller_id, price, name')
      .in('id', productIds);

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'No valid products found' }, { status: 404 });
    }

    const total = products.reduce((sum, p) => sum + Number(p.price), 0);
    const itemNames = cartItems.map((i: CartItem) => i.name).join(', ');
    const receiptId = `pharma_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const paymentLink = await razorpay.paymentLink.create({
      amount: Math.round(total * 100),
      currency: 'INR',
      accept_partial: false,
      expire_by: Math.floor(Date.now() / 1000) + 20 * 60,
      reference_id: receiptId,
      description: `Pharmacy: ${itemNames.substring(0, 100)}`,
      customer: {
        name: buyer.first_name || 'Buyer',
        contact: buyerPhone || '',
        email: '',
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: {
        is_pharmacy_cart: 'true',
        buyer_telegram_id: buyerTelegramId,
        buyer_phone: buyerPhone || '',
        ...(prescriptionFileId && { prescription_file_id: prescriptionFileId }),
      },
    });

    // Create one pending order per product, all linked to the same payment link ID
    for (const product of products) {
      await supabase.from('orders').insert({
        buyer_telegram_id: buyerTelegramId,
        buyer_name: buyer.first_name || 'Buyer',
        seller_id: product.seller_id,
        product_id: product.id,
        amount: product.price,
        status: 'pending',
        razorpay_payment_id: paymentLink.id,
        platform_fee: 0,
        credits_deducted: 0,
        selected_variant: null,
      });
    }

    return NextResponse.json({ short_url: paymentLink.short_url, paymentLink });
  } catch (error: unknown) {
    console.error('[create-pharmacy-cart]', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
