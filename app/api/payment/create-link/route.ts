import { NextResponse } from 'next/server';
import { razorpay } from '@/lib/razorpay';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { PLATFORM_FEE_PERCENT } from '@/lib/constants';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { productId, buyerTelegramId } = await request.json();

    if (!productId || !buyerTelegramId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch product
    const { data: product, error: fetchErr } = await supabase
      .from('products')
      .select('*, sellers(id, shop_name)')
      .eq('id', productId)
      .single();

    if (fetchErr || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    
    const sellerId = Array.isArray(product.sellers) ? product.sellers[0]?.id : product.sellers?.id;
    const shopName = Array.isArray(product.sellers) ? product.sellers[0]?.shop_name : product.sellers?.shop_name;

    // 2. Fetch Buyer
    const { data: buyer } = await supabase
       .from('buyers')
       .select('id, first_name')
       .eq('telegram_id', buyerTelegramId)
       .single();
       
    if (!buyer) {
       return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
    }

    // 3. Create a unique receipt id
    const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // 4. Create Razorpay Payment Link
    const paymentLinkOptions = {
        amount: Math.round(product.price * 100), // in paise
        currency: 'INR',
        accept_partial: false,
        expire_by: Math.floor(Date.now() / 1000) + (20 * 60), // 20 mins expiry
        reference_id: receiptId,
        description: `Purchase ${product.name} from ${shopName}`,
        customer: {
            name: buyer.first_name || 'Buyer',
            contact: '',
            email: ''
        },
        notify: {
            sms: false,
            email: false
        },
        reminder_enable: false,
        notes: {
            product_id: product.id,
            buyer_telegram_id: buyerTelegramId,
            seller_id: sellerId
        }
    };

    const paymentLink = await razorpay.paymentLink.create(paymentLinkOptions);

    // 5. Create Pending Order in Supabase
    const { error: orderError } = await supabase
       .from('orders')
       .insert({
          buyer_telegram_id: buyerTelegramId,
          buyer_name: buyer.first_name || 'Buyer',
          seller_id: sellerId as string,
          product_id: product.id,
          amount: product.price,
          status: 'pending',
          razorpay_payment_id: paymentLink.id, // Store payment link ID 
          platform_fee: 0,
          credits_deducted: 0,
          // Note: actual transaction ID will be populated when paid
       });
       
    if (orderError) {
        throw orderError;
    }

    return NextResponse.json({
        short_url: paymentLink.short_url,
        paymentLink: paymentLink
    });
    
  } catch (error: unknown) {
    console.error("Create payment link error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
